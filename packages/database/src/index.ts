/** Exact database decimal transported across process boundaries without precision loss. */
export type DecimalString = string & {
  readonly __decimalString: unique symbol;
};
export type EntityId = string & { readonly __entityId: unique symbol };
export const DATABASE_MONEY_PRECISION = 20;
export const DATABASE_MONEY_SCALE = 8;
export function asDecimalString(value: string): DecimalString {
  if (!/^-?\d+(?:\.\d{1,8})?$/.test(value))
    throw new Error("Invalid decimal string");
  return value as DecimalString;
}

const MONEY_SCALE = 100_000_000n;

/** Parse and format NUMERIC(20,8) values without ever passing through a JS number. */
export function moneyToUnits(value: unknown): bigint {
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value ?? "0"));
  if (!match) throw new Error("MONEY_INVALID");
  return (
    BigInt(match[1]!) * MONEY_SCALE + BigInt((match[2] ?? "").padEnd(8, "0"))
  );
}

export function moneyFromUnits(value: bigint): string {
  if (value < 0n) throw new Error("MONEY_INVALID");
  return `${value / MONEY_SCALE}.${String(value % MONEY_SCALE).padStart(8, "0")}`;
}

/** Pro-rata target refund based on what the customer actually paid. */
export function partialRefundTarget(
  charge: unknown,
  remains: number,
  quantity: number,
): string {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    !Number.isInteger(remains) ||
    remains < 0 ||
    remains > quantity
  )
    throw new Error("REMAINS_INVALID");
  return moneyFromUnits(
    (moneyToUnits(charge) * BigInt(remains)) / BigInt(quantity),
  );
}

export type RefundResult = { target: string; added: string };

/**
 * Credit an order refund up to a target total. Call inside the same transaction as
 * order/history/audit writes. The advisory lock serializes worker and admin paths;
 * the unique wallet idempotency key remains a second line of defence.
 */
export async function applyOrderTargetRefund(
  tx: any,
  order: any,
  targetValue: unknown,
  description: string,
): Promise<RefundResult> {
  const target = moneyToUnits(targetValue),
    charge = moneyToUnits(order.charge),
    existing = moneyToUnits(order.refundedAmount);
  if (target > charge) throw new Error("REFUND_EXCEEDS_CHARGE");
  if (target < existing) throw new Error("REFUND_BELOW_EXISTING");
  const delta = target - existing;
  if (delta === 0n)
    return { target: moneyFromUnits(target), added: moneyFromUnits(0n) };
  const amount = moneyFromUnits(delta),
    targetText = moneyFromUnits(target);
  const rows = await tx.$queryRawUnsafe(
    `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
    amount,
    order.userId,
  );
  if (!rows?.[0]) throw new Error("WALLET_NOT_FOUND");
  await tx.walletTransaction.create({
    data: {
      walletId: rows[0].id,
      userId: order.userId,
      type: "REFUND",
      amount,
      balanceBefore: rows[0].before,
      balanceAfter: rows[0].after,
      referenceId: order.publicId,
      idempotencyKey: `refund:order:${order.publicId}:to:${targetText}`,
      description,
    },
  });
  return { target: targetText, added: amount };
}

export function zonedDayBounds(date: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("REPORT_DATE_INVALID");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const utcForLocal = (day: string) => {
    const [year, month, value] = day.split("-").map(Number),
      target = Date.UTC(year!, month! - 1, value!);
    let instant = target;
    for (let iteration = 0; iteration < 3; iteration++) {
      const parts = Object.fromEntries(
          formatter
            .formatToParts(new Date(instant))
            .map((part) => [part.type, part.value]),
        ),
        represented = Date.UTC(
          Number(parts.year),
          Number(parts.month) - 1,
          Number(parts.day),
          Number(parts.hour),
          Number(parts.minute),
          Number(parts.second),
        );
      instant += target - represented;
    }
    return new Date(instant);
  };
  const start = utcForLocal(date),
    next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: utcForLocal(next.toISOString().slice(0, 10)) };
}

export class DailySnapshotService {
  constructor(private db: any) {}
  async build(date: string, timezone = "Asia/Ho_Chi_Minh") {
    const { start, end } = zonedDayBounds(date, timezone),
      range = { gte: start, lt: end };
    const [orders, deposits, users] = await Promise.all([
      this.db.order.aggregate({
        where: { createdAt: range },
        _sum: {
          charge: true,
          providerCost: true,
          profit: true,
          refundedAmount: true,
        },
        _count: true,
      }),
      this.db.deposit.aggregate({
        where: { status: "PAID", paidAt: range },
        _sum: { netAmount: true },
      }),
      this.db.user.count({ where: { createdAt: range } }),
    ]);
    const [failedOrders, partialOrders] = await Promise.all([
      this.db.order.count({ where: { createdAt: range, status: "FAILED" } }),
      this.db.order.count({ where: { createdAt: range, status: "PARTIAL" } }),
    ]);
    const data = {
      revenue: String(orders._sum.charge ?? 0),
      providerCost: String(orders._sum.providerCost ?? 0),
      grossProfit: String(orders._sum.profit ?? 0),
      depositAmount: String(deposits._sum.netAmount ?? 0),
      refundedAmount: String(orders._sum.refundedAmount ?? 0),
      totalOrders: orders._count,
      failedOrders,
      partialOrders,
      newUsers: users,
    };
    return this.db.dailyReportSnapshot.upsert({
      where: {
        date_timezone: { date: new Date(`${date}T00:00:00Z`), timezone },
      },
      create: { date: new Date(`${date}T00:00:00Z`), timezone, ...data },
      update: data,
    });
  }
  trend(timezone: string, from: string, to: string) {
    return this.db.dailyReportSnapshot.findMany({
      where: {
        timezone,
        date: {
          gte: new Date(`${from}T00:00:00Z`),
          lte: new Date(`${to}T00:00:00Z`),
        },
      },
      orderBy: { date: "asc" },
      take: 366,
    });
  }
}
