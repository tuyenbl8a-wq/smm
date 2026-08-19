import { calculateSaleRate } from "../catalog/pricing.js";
import { PromotionService } from "../promotion/service.js";
export class OrderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const SCALE = 100_000_000n;
const units = (v: unknown) => {
  const m = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(v));
  if (!m) throw new OrderError("PRICE_INVALID", "Invalid price");
  return BigInt(m[1]!) * SCALE + BigInt((m[2] ?? "").padEnd(8, "0"));
};
const text = (value: bigint) => {
  const sign = value < 0n ? "-" : "",
    absolute = value < 0n ? -value : value;
  return `${sign}${absolute / SCALE}.${String(absolute % SCALE).padStart(8, "0")}`;
};
export const orderAmount = (rate: unknown, quantity: number) =>
  text((units(rate) * BigInt(quantity)) / 1000n);
export class OrderService {
  private readonly promotions: PromotionService;
  constructor(private readonly db: any) {
    this.promotions = new PromotionService(db);
  }
  async create(userId: string, input: any, key: string) {
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(key))
      throw new OrderError(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency-Key is required",
      );
    const serviceId = String(input.serviceId ?? "");
    const quantity = Number(input.quantity);
    const link = String(input.link ?? "").trim();
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new OrderError("QUANTITY_INVALID", "Invalid quantity");
    try {
      const u = new URL(link);
      if (!["http:", "https:"].includes(u.protocol)) throw 0;
    } catch {
      throw new OrderError("LINK_INVALID", "Link must be HTTP(S)");
    }
    const submitKey = `order:${userId}:${key}`.slice(0, 128);
    const existing = await this.db.order.findUnique({
      where: { providerSubmitKey: submitKey },
    });
    if (existing) return this.serialize(existing);
    try {
      return await this.db.$transaction(async (tx: any) => {
        const service = await tx.service.findUnique({
          where: { id: serviceId },
        });
        if (!service || !service.active || service.deletedAt)
          throw new OrderError("SERVICE_UNAVAILABLE", "Service unavailable");
        if (quantity < service.min || quantity > service.max)
          throw new OrderError(
            "QUANTITY_OUT_OF_RANGE",
            `Quantity must be ${service.min}-${service.max}`,
          );
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { priceGroupId: true },
        });
        const rule = user?.priceGroupId
          ? await tx.priceRule.findUnique({
              where: {
                priceGroupId_serviceId: {
                  priceGroupId: user.priceGroupId,
                  serviceId,
                },
              },
            })
          : null;
        const mapping = await tx.serviceMapping.findFirst({
          where: { serviceId, active: true },
          orderBy: { priority: "asc" },
        });
        if (!mapping)
          throw new OrderError(
            "PROVIDER_MAPPING_UNAVAILABLE",
            "No active provider mapping",
          );
        const ps = await tx.providerService.findUnique({
          where: { id: mapping.providerServiceId },
        });
        if (!ps || !ps.active)
          throw new OrderError(
            "PROVIDER_SERVICE_UNAVAILABLE",
            "Provider service unavailable",
          );
        const provider = await tx.provider.findUnique({
          where: { id: ps.providerId },
        });
        if (!provider || provider.status !== "ACTIVE")
          throw new OrderError("PROVIDER_UNAVAILABLE", "Provider unavailable");
        const saleRate = calculateSaleRate({
          baseRate: service.rate,
          providerCost: ps.rate,
          fixedRate: rule?.fixedRate,
          markupPercent: rule?.markupPercent,
          fixedProfit: rule?.fixedProfit,
          minProfit: rule?.minProfit ?? mapping.minProfit,
        });
        const originalCharge = orderAmount(saleRate, quantity),
          providerCost = orderAmount(ps.rate, quantity),
          coupon = input.couponCode
            ? await this.promotions.reserve(
                tx,
                userId,
                input.couponCode,
                originalCharge,
              )
            : null,
          charge = coupon?.total ?? originalCharge,
          discountAmount = coupon?.discount ?? "0.00000000",
          profit = text(units(charge) - units(providerCost));
        const order = await tx.order.create({
          data: {
            userId,
            serviceId,
            providerId: provider.id,
            providerSubmitKey: submitKey,
            link,
            quantity,
            saleRate,
            charge,
            originalCharge,
            discountAmount,
            couponCode: coupon?.coupon.code,
            providerRate: String(ps.rate),
            providerCost,
            profit,
            status: "PENDING",
            input: {
              providerServiceId: ps.id,
              providerExternalServiceId: ps.externalId,
            },
          },
        });
        if (coupon)
          await tx.couponUsage.create({
            data: {
              couponId: coupon.coupon.id,
              userId,
              referenceId: order.publicId,
              discount: discountAmount,
            },
          });
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance"="balance"-$1::numeric,"version"="version"+1,"updated_at"=CURRENT_TIMESTAMP WHERE "user_id"=$2::uuid AND "balance">=$1::numeric RETURNING "id","balance"+$1::numeric AS "before","balance" AS "after"`,
          charge,
          userId,
        );
        if (!rows[0])
          throw new OrderError("INSUFFICIENT_BALANCE", "Insufficient balance");
        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId,
            type: "ORDER",
            amount: `-${charge}`,
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: order.publicId,
            idempotencyKey: `wallet:${submitKey}`.slice(0, 128),
            description: "Order charge",
          },
        });
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            toStatus: "PENDING",
            details: { source: "customer" },
          },
        });
        await tx.providerOutbox.create({ data: { orderId: order.id } });
        return this.serialize(order);
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        const found = await this.db.order.findUnique({
          where: { providerSubmitKey: submitKey },
        });
        if (found) return this.serialize(found);
      }
      throw error;
    }
  }
  async detail(userId: string, publicId: string) {
    const order = await this.db.order.findFirst({
      where: { publicId, userId },
    });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order not found");
    const [history, refills, cancellations] = await Promise.all([
      this.db.orderHistory.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: "asc" },
      }),
      this.db.refill.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: "desc" },
      }),
      this.db.cancellation.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      ...this.serialize(order),
      refundedAmount: String(order.refundedAmount),
      startCount: order.startCount,
      remains: order.remains,
      updatedAt: order.updatedAt,
      history,
      refills,
      cancellations,
    };
  }
  async list(userId: string, page: number, limit: number) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new OrderError("PAGINATION_INVALID", "Invalid pagination");
    const [total, rows] = await Promise.all([
      this.db.order.count({ where: { userId } }),
      this.db.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items: rows.map((x: any) => this.serialize(x)),
    };
  }
  private serialize(x: any) {
    return {
      id: String(x.id),
      publicId: x.publicId,
      serviceId: x.serviceId,
      link: x.link,
      quantity: x.quantity,
      charge: String(x.charge),
      originalCharge: String(x.originalCharge ?? x.charge),
      discountAmount: String(x.discountAmount ?? 0),
      couponCode: x.couponCode,
      saleRate: String(x.saleRate),
      profit: String(x.profit),
      status: x.status,
      createdAt: x.createdAt,
    };
  }
}
