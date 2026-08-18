export interface ActivityRecord {
  createdAt: Date;
  charge: { toString(): string } | string;
}
export interface ActivityPoint {
  date: string;
  orders: number;
  spent: string;
}
function micros(value: unknown): bigint {
  const [whole, fraction = ""] = String(value ?? "0").split(".");
  return (
    BigInt(whole || "0") * 1_000_000n +
    BigInt(fraction.padEnd(6, "0").slice(0, 6))
  );
}
export function subtractDecimal(left: unknown, right: unknown): string {
  const value = micros(left) - micros(right);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 1_000_000n}.${String(absolute % 1_000_000n).padStart(6, "0")}`;
}
export function buildActivitySeries(
  records: ActivityRecord[],
  now = new Date(),
): ActivityPoint[] {
  const days = new Map<string, { orders: number; spentMicros: bigint }>();
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - offset,
      ),
    );
    days.set(day.toISOString().slice(0, 10), { orders: 0, spentMicros: 0n });
  }
  for (const record of records) {
    const key = record.createdAt.toISOString().slice(0, 10);
    const bucket = days.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.spentMicros += micros(record.charge);
  }
  return [...days].map(([date, value]) => ({
    date,
    orders: value.orders,
    spent: `${value.spentMicros / 1_000_000n}.${String(value.spentMicros % 1_000_000n).padStart(6, "0")}`,
  }));
}
