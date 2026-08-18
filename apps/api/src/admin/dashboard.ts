export interface AdminActivityRecord {
  createdAt: Date;
  charge: { toString(): string } | string;
  providerCost: { toString(): string } | string;
  profit: { toString(): string } | string;
}
export interface AdminActivityPoint {
  date: string;
  orders: number;
  revenue: string;
  providerCost: string;
  profit: string;
}
const SCALE = 100_000_000n;
function units(value: unknown): bigint {
  const [whole, fraction = ""] = String(value ?? "0").split(".");
  return (
    BigInt(whole || "0") * SCALE + BigInt(fraction.padEnd(8, "0").slice(0, 8))
  );
}
function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / SCALE}.${String(absolute % SCALE).padStart(8, "0")}`;
}
export function canAccessAdmin(
  access: { roles: readonly string[]; permissions: readonly string[] },
  permission = "reports.read",
): boolean {
  return (
    access.roles.includes("SUPER_ADMIN") ||
    access.permissions.includes(permission)
  );
}
export function buildAdminActivity(
  records: AdminActivityRecord[],
  now = new Date(),
): AdminActivityPoint[] {
  const days = new Map<
    string,
    { orders: number; revenue: bigint; providerCost: bigint; profit: bigint }
  >();
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - offset,
      ),
    );
    days.set(day.toISOString().slice(0, 10), {
      orders: 0,
      revenue: 0n,
      providerCost: 0n,
      profit: 0n,
    });
  }
  for (const record of records) {
    const bucket = days.get(record.createdAt.toISOString().slice(0, 10));
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += units(record.charge);
    bucket.providerCost += units(record.providerCost);
    bucket.profit += units(record.profit);
  }
  return [...days].map(([date, value]) => ({
    date,
    orders: value.orders,
    revenue: decimal(value.revenue),
    providerCost: decimal(value.providerCost),
    profit: decimal(value.profit),
  }));
}
