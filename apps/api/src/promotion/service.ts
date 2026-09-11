const SCALE = 100_000_000n;
const money = (value: unknown) => {
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value ?? ""));
  if (!match)
    throw new PromotionError("AMOUNT_INVALID", "Số tiền không hợp lệ.");
  return BigInt(match[1]!) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"));
};
const decimal = (value: bigint) =>
  `${value / SCALE}.${String(value % SCALE).padStart(8, "0")}`;
const code = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9_-]{3,50}$/.test(normalized))
    throw new PromotionError("COUPON_INVALID", "Mã giảm giá không hợp lệ.");
  return normalized;
};

export class PromotionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const couponDiscount = (coupon: any, amount: unknown) => {
  const original = money(amount),
    value = money(coupon.value);
  if (original < money(coupon.minAmount ?? "0"))
    throw new PromotionError(
      "COUPON_MIN_AMOUNT",
      "Đơn hàng chưa đạt giá trị tối thiểu.",
    );
  let discount =
    coupon.type === "PERCENT" ? (original * value) / (100n * SCALE) : value;
  if (coupon.maxDiscount != null) {
    const cap = money(coupon.maxDiscount);
    if (discount > cap) discount = cap;
  }
  if (discount > original) discount = original;
  return {
    original: decimal(original),
    discount: decimal(discount),
    total: decimal(original - discount),
  };
};

export class PromotionService {
  constructor(private db: any) {}

  private async validate(
    tx: any,
    siteId: string,
    userId: string,
    rawCode: unknown,
    amount: unknown,
    lock = false,
  ) {
    const normalized = code(rawCode);
    if (lock)
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM "coupons" WHERE "site_id"=$1::uuid AND "code"=$2 FOR UPDATE`,
        siteId,
        normalized,
      );
    const coupon = await tx.coupon.findUnique({
      where: { siteId_code: { siteId, code: normalized } },
    });
    if (!coupon)
      throw new PromotionError(
        "COUPON_NOT_FOUND",
        "Mã giảm giá không tồn tại.",
      );
    const now = new Date();
    if (!coupon.active)
      throw new PromotionError(
        "COUPON_INACTIVE",
        "Mã giảm giá không hoạt động.",
      );
    if (coupon.startsAt > now || coupon.endsAt <= now)
      throw new PromotionError("COUPON_EXPIRED", "Mã giảm giá đã hết hạn.");
    const [total, userTotal] = await Promise.all([
      tx.couponUsage.count({ where: { couponId: coupon.id } }),
      tx.couponUsage.count({ where: { couponId: coupon.id, userId } }),
    ]);
    if (coupon.usageLimit != null && total >= coupon.usageLimit)
      throw new PromotionError(
        "COUPON_LIMIT",
        "Mã giảm giá đã hết lượt sử dụng.",
      );
    if (userTotal >= coupon.userLimit)
      throw new PromotionError(
        "COUPON_USER_LIMIT",
        "Bạn đã sử dụng mã này quá số lần cho phép.",
      );
    return { coupon, ...couponDiscount(coupon, amount) };
  }

  preview(siteId: string, userId: string, rawCode: unknown, amount: unknown) {
    return this.validate(this.db, siteId, userId, rawCode, amount);
  }

  reserve(
    tx: any,
    siteId: string,
    userId: string,
    rawCode: unknown,
    amount: unknown,
  ) {
    return this.validate(tx, siteId, userId, rawCode, amount, true);
  }

  async listCoupons(siteId: string, search = "") {
    const rows = await this.db.coupon.findMany({
      where: {
        siteId,
        ...(search ? { code: { contains: search.toUpperCase() } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Promise.all(
      rows.map(async (coupon: any) => ({
        ...coupon,
        usageCount: await this.db.couponUsage.count({
          where: { couponId: coupon.id },
        }),
      })),
    );
  }

  async saveCoupon(actorId: string, siteId: string, input: any, id?: string) {
    const normalized = code(input.code),
      type = String(input.type ?? "");
    if (!["FIXED", "PERCENT"].includes(type))
      throw new PromotionError(
        "COUPON_TYPE_INVALID",
        "Loại giảm giá không hợp lệ.",
      );
    const value = money(input.value),
      startsAt = new Date(String(input.startsAt)),
      endsAt = new Date(String(input.endsAt));
    if (value <= 0n || (type === "PERCENT" && value > 100n * SCALE))
      throw new PromotionError(
        "COUPON_VALUE_INVALID",
        "Giá trị giảm giá không hợp lệ.",
      );
    if (!(startsAt < endsAt))
      throw new PromotionError(
        "COUPON_DATES_INVALID",
        "Thời gian áp dụng không hợp lệ.",
      );
    const data = {
      siteId,
      code: normalized,
      type,
      value: decimal(value),
      minAmount: decimal(money(input.minAmount ?? "0")),
      maxDiscount: input.maxDiscount ? decimal(money(input.maxDiscount)) : null,
      usageLimit: input.usageLimit == null ? null : Number(input.usageLimit),
      userLimit: Number(input.userLimit ?? 1),
      startsAt,
      endsAt,
      active: input.active !== false,
    };
    if (!Number.isInteger(data.userLimit) || data.userLimit < 1)
      throw new PromotionError(
        "COUPON_LIMIT_INVALID",
        "Giới hạn không hợp lệ.",
      );
    if (
      data.usageLimit != null &&
      (!Number.isInteger(data.usageLimit) || data.usageLimit < 1)
    )
      throw new PromotionError(
        "COUPON_LIMIT_INVALID",
        "Giới hạn không hợp lệ.",
      );
    return this.db.$transaction(async (tx: any) => {
      if (id && !(await tx.coupon.findFirst({ where: { id, siteId } })))
        throw new PromotionError(
          "COUPON_NOT_FOUND",
          "Mã giảm giá không tồn tại.",
        );
      const saved = id
        ? await tx.coupon.update({ where: { id, siteId }, data })
        : await tx.coupon.create({ data });
      await tx.auditLog.create({
        data: {
          siteId,
          actorId,
          action: id ? "COUPON_UPDATE" : "COUPON_CREATE",
          resource: "Coupon",
          resourceId: saved.id,
        },
      });
      return saved;
    });
  }

  async archiveCoupon(actorId: string, siteId: string, id: string) {
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.coupon.findFirst({ where: { id, siteId } });
      if (!before)
        throw new PromotionError(
          "COUPON_NOT_FOUND",
          "Mã giảm giá không tồn tại.",
        );
      const item = await tx.coupon.update({
        where: { id, siteId },
        data: { active: false },
      });
      await tx.auditLog.create({
        data: {
          siteId,
          actorId,
          action: "COUPON_ARCHIVE",
          resource: "coupon",
          resourceId: id,
          before: { active: before.active },
          after: { active: false, archived: true },
        },
      });
      return {
        item,
        archived: true,
        message: "Đã lưu trữ mã giảm giá; lịch sử sử dụng được giữ nguyên.",
      };
    });
  }

  async referralSummary(userId: string) {
    let affiliate = await this.db.affiliate.findUnique({ where: { userId } });
    if (!affiliate) {
      const user = await this.db.user.findUnique({ where: { id: userId } });
      if (!user)
        throw new PromotionError(
          "AFFILIATE_NOT_FOUND",
          "Không có chương trình giới thiệu.",
        );
      affiliate = await this.db.affiliate.create({
        data: {
          userId,
          code: user.referralCode,
          commissionRate: "10.000000",
        },
      });
    }
    const [referrals, commissions] = await Promise.all([
      this.db.referral.count({ where: { affiliateId: affiliate.id } }),
      this.db.affiliateCommission.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const paid = commissions
      .filter((x: any) => x.status === "PAID")
      .reduce((sum: bigint, x: any) => sum + money(x.amount), 0n);
    return {
      code: affiliate.code,
      referrals,
      paid: decimal(paid),
      commissions,
    };
  }

  async adminReferrals() {
    const [referrals, commissions] = await Promise.all([
      this.db.referral.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.affiliateCommission.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return { referrals, commissions };
  }
}

export async function settleReferral(tx: any, order: any) {
  if (!["COMPLETED", "PARTIAL"].includes(order.status)) return null;
  if (String(order.profit).startsWith("-")) return null;
  const referral = await tx.referral.findUnique({
    where: { referredUserId: order.userId },
  });
  if (!referral) return null;
  const affiliate = await tx.affiliate.findUnique({
    where: { id: referral.affiliateId },
  });
  if (
    !affiliate?.active ||
    affiliate.siteId !== order.siteId ||
    affiliate.userId === order.userId
  )
    return null;
  const netProfit = money(order.profit) - money(order.refundedAmount ?? "0");
  if (netProfit <= 0n) return null;
  const amount = (netProfit * money(affiliate.commissionRate)) / (100n * SCALE);
  if (amount <= 0n) return null;
  const referenceId = `order:${order.publicId}`;
  const existing = await tx.affiliateCommission.findUnique({
    where: {
      affiliateId_referenceId: { affiliateId: affiliate.id, referenceId },
    },
  });
  if (existing) return existing;
  const rows = await tx.$queryRawUnsafe(
    `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid AND "site_id"=$3::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
    decimal(amount),
    affiliate.userId,
    affiliate.siteId,
  );
  const commission = await tx.affiliateCommission.create({
    data: {
      affiliateId: affiliate.id,
      referralId: referral.id,
      referenceId,
      amount: decimal(amount),
      status: "PAID",
      paidAt: new Date(),
    },
  });
  await tx.walletTransaction.create({
    data: {
      walletId: rows[0].id,
      siteId: affiliate.siteId,
      userId: affiliate.userId,
      type: "AFFILIATE",
      amount: decimal(amount),
      balanceBefore: rows[0].before,
      balanceAfter: rows[0].after,
      referenceId: order.publicId,
      idempotencyKey: `affiliate:${order.publicId}`,
      description: "Referral commission",
    },
  });
  return commission;
}
