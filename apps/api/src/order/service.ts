import { PricingResolver } from "../catalog/resolver.js";
import { PromotionService } from "../promotion/service.js";
import { SiteSettlementService } from "./site-settlement.js";
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
  private readonly pricing: PricingResolver;
  private readonly settlements: SiteSettlementService;
  constructor(private readonly db: any) {
    this.promotions = new PromotionService(db);
    this.pricing = new PricingResolver(db);
    this.settlements = new SiteSettlementService(db);
  }
  async create(userId: string, input: any, key: string) {
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(key))
      throw new OrderError(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency-Key is required",
      );
    const serviceReference = String(input.serviceId ?? "");
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
          where: /^\d+$/.test(serviceReference)
            ? { serviceNumber: BigInt(serviceReference) }
            : { id: serviceReference },
        });
        const serviceId = service?.id ?? serviceReference;
        if (!service || !service.active || service.deletedAt)
          throw new OrderError("SERVICE_UNAVAILABLE", "Service unavailable");
        if (quantity < service.min || quantity > service.max)
          throw new OrderError(
            "QUANTITY_OUT_OF_RANGE",
            `Quantity must be ${service.min}-${service.max}`,
          );
        const user = tx.user ? await tx.user.findUnique({ where: { id: userId }, select: { siteId: true } }) : null;
        const siteId = user?.siteId;
        if (tx.site && !user) throw new OrderError("USER_NOT_FOUND", "User not found");
        const currentSite = siteId && tx.site ? await tx.site.findUnique({ where: { id: siteId } }) : null;
        if (siteId && (!currentSite || currentSite.status !== "ACTIVE")) throw new OrderError("PANEL_SUSPENDED", "Panel is unavailable");
        const edges = siteId && tx.siteServiceRule ? await this.settlements.quote(tx, siteId, service, quantity) : [];
        const resolved = await this.pricing.resolveCustomerPrice(
          userId,
          serviceId,
          tx,
        );
        const { mapping, providerService: ps, provider, group } = resolved;
        const manual = service.source === "MANUAL";
        if (!manual && (!mapping || !ps || !provider))
          throw new OrderError(
            "PROVIDER_MAPPING_UNAVAILABLE",
            "Provider mapping unavailable",
          );
        const saleRate = resolved.rate;
        const originalCharge = orderAmount(saleRate, quantity),
          providerCost = orderAmount(resolved.providerCost, quantity),
          coupon = input.couponCode
            ? await this.promotions.reserve(
                tx,
                userId,
                input.couponCode,
                originalCharge,
              )
            : null,
          requestedCharge = coupon?.total ?? originalCharge,
          /* Promotions are website-funded only when explicitly implemented. The safe default never sells below provider cost. */
          charge = text(
            units(requestedCharge) < units(providerCost)
              ? units(providerCost)
              : units(requestedCharge),
          ),
          discountAmount = text(units(originalCharge) - units(charge)),
          profit = text(units(charge) - units(providerCost));
        const required = siteId ? [{ userId, siteId, amount: charge }, ...edges.map((edge) => ({ userId: edge.payerUserId, siteId: edge.parentSiteId, amount: edge.upstreamCharge }))] : [];
        for (const item of required) {
          const locked = await tx.$queryRawUnsafe(`SELECT "balance" FROM "wallets" WHERE "user_id"=$1::uuid AND "site_id"=$2::uuid FOR UPDATE`, item.userId, item.siteId);
          if (!locked[0] || units(locked[0].balance) < units(item.amount)) throw new OrderError(item.userId === userId ? "INSUFFICIENT_BALANCE" : "PANEL_UPSTREAM_BALANCE_LOW", "Required wallet balance is insufficient");
        }
        const order = await tx.order.create({
          data: {
            ...(siteId ? { siteId } : {}),
            userId,
            serviceId,
            providerId: manual ? null : provider.id,
            providerSubmitKey: submitKey,
            link,
            quantity,
            saleRate,
            charge,
            originalCharge,
            discountAmount,
            couponCode: coupon?.coupon.code,
            priceGroupIdSnapshot: group?.id,
            priceGroupCodeSnapshot: group?.code,
            providerRate: String(resolved.providerCost),
            providerCost,
            profit,
            status: "PENDING",
            input: {
              source: manual ? "MANUAL" : "API",
              providerServiceId: ps?.id ?? null,
              providerExternalServiceId: ps?.externalId ?? null,
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
            ...(siteId ? { siteId } : {}),
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
        await this.settlements.debitAndSnapshot(tx, order, edges);
        await tx.orderHistory.create({
          data: {
            ...(siteId ? { siteId } : {}),
            orderId: order.id,
            toStatus: "PENDING",
            details: { source: "customer" },
          },
        });
        if (!manual)
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
  async detail(userId: string, reference: string) {
    const numericId = /^\d+$/.test(reference)
      ? BigInt(reference) - 100000n
      : null;
    const order = await this.db.order.findFirst({
      where:
        numericId !== null && numericId > 0n
          ? { id: numericId, userId }
          : { publicId: reference, userId },
    });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order not found");
    const service = await this.db.service.findUnique({
      where: { id: order.serviceId },
      select: { id: true, serviceNumber: true, name: true },
    });
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
      service,
      refundedAmount: String(order.refundedAmount),
      startCount: order.startCount,
      remains: order.remains,
      updatedAt: order.updatedAt,
      history: history.map((item: any) => ({
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        createdAt: item.createdAt,
      })),
      refills: refills.map((item: any) => ({
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      cancellations: cancellations.map((item: any) => ({
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      capabilities: {
        refill:
          Boolean(
            (
              await this.db.service.findUnique({
                where: { id: order.serviceId },
                select: { refill: true },
              })
            )?.refill,
          ) && order.status === "COMPLETED",
        cancel:
          Boolean(
            (
              await this.db.service.findUnique({
                where: { id: order.serviceId },
                select: { cancel: true },
              })
            )?.cancel,
          ) && ["PENDING", "PROCESSING", "IN_PROGRESS"].includes(order.status),
      },
    };
  }
  async list(
    userId: string,
    pageOrQuery:
      | number
      | {
          page: number;
          limit: number;
          search?: string;
          status?: string;
          from?: string;
          to?: string;
        },
    oldLimit?: number,
  ) {
    const query =
      typeof pageOrQuery === "number"
        ? { page: pageOrQuery, limit: oldLimit ?? 20 }
        : pageOrQuery;
    const { page, limit } = query;
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new OrderError("PAGINATION_INVALID", "Invalid pagination");
    const statuses = [
      "PENDING",
      "PROCESSING",
      "IN_PROGRESS",
      "COMPLETED",
      "PARTIAL",
      "CANCELED",
      "FAILED",
    ];
    if (query.status && !statuses.includes(query.status))
      throw new OrderError("STATUS_INVALID", "Invalid status filter");
    const search = String(query.search ?? "")
        .trim()
        .slice(0, 200),
      numeric = /^#?\d{6,}$/.test(search)
        ? BigInt(search.replace(/^#/, "")) - 100000n
        : null;
    const createdAt = {
      ...(query.from ? { gte: new Date(query.from + "T00:00:00.000Z") } : {}),
      ...(query.to ? { lte: new Date(query.to + "T23:59:59.999Z") } : {}),
    };
    const where: any = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(search
        ? numeric !== null && numeric > 0n
          ? { id: numeric }
          : {
              OR: [
                { link: { contains: search, mode: "insensitive" } },
                {
                  service: { name: { contains: search, mode: "insensitive" } },
                },
              ],
            }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const serviceIds = [...new Set(rows.map((x: any) => x.serviceId))];
    const services = serviceIds.length
      ? await this.db.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, serviceNumber: true, name: true },
        })
      : [];
    const serviceMap = new Map(services.map((x: any) => [x.id, x]));
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items: rows.map((x: any) =>
        this.serialize({ ...x, service: serviceMap.get(x.serviceId) }),
      ),
    };
  }
  private serialize(x: any) {
    return {
      id: String(x.id),
      publicId: x.publicId,
      orderNumber: String(100000n + BigInt(x.id)),
      serviceId: x.serviceId,
      service: x.service
        ? { ...x.service, serviceNumber: String(x.service.serviceNumber) }
        : undefined,
      link: x.link,
      quantity: x.quantity,
      charge: String(x.charge),
      originalCharge: String(x.originalCharge ?? x.charge),
      discountAmount: String(x.discountAmount ?? 0),
      couponCode: x.couponCode,
      saleRate: String(x.saleRate),
      status: x.status,
      createdAt: x.createdAt,
    };
  }
}
