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
