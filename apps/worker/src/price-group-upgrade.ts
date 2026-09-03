const SCALE = 100_000_000n;
const units = (value: unknown): bigint => {
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value ?? "0"));
  if (!match) throw new Error("MONEY_INVALID");
  return BigInt(match[1]!) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"));
};
const text = (value: bigint) =>
  `${value / SCALE}.${String(value % SCALE).padStart(8, "0")}`;

export class PriceGroupUpgradeWorker {
  constructor(private readonly db: any) {}

  private async stats(userId: string) {
    const [deposits, spending, completedOrders] = await Promise.all([
      this.db.deposit.aggregate({
        where: { userId, status: "PAID" },
        _sum: { netAmount: true },
      }),
      this.db.order.aggregate({
        where: { userId },
        _sum: { charge: true, refundedAmount: true },
      }),
      this.db.order.count({ where: { userId, status: "COMPLETED" } }),
    ]);
    const spent =
      units(spending._sum.charge ?? "0") -
      units(spending._sum.refundedAmount ?? "0");
    return {
      successfulDeposits: units(deposits._sum.netAmount ?? "0"),
      totalSpent: spent < 0n ? 0n : spent,
      completedOrders,
    };
  }

  private qualifies(group: any, stats: any) {
    const checks: boolean[] = [];
    if (group.minSuccessfulDeposits != null)
      checks.push(
        stats.successfulDeposits >= units(group.minSuccessfulDeposits),
      );
    if (group.minTotalSpent != null)
      checks.push(stats.totalSpent >= units(group.minTotalSpent));
    if (group.minCompletedOrders != null)
      checks.push(stats.completedOrders >= group.minCompletedOrders);
    if (!checks.length) return false;
    return group.upgradeMatchMode === "ANY"
      ? checks.some(Boolean)
      : checks.every(Boolean);
  }

  async once(limit = 500) {
    const settings = await this.db.setting.findMany({
      where: {
        group: "pricing",
        key: { in: ["autoUpgradeEnabled", "autoDowngradeEnabled"] },
      },
    });
    const setting = Object.fromEntries(
      settings.map((row: any) => [row.key, row.value]),
    );
    if (
      setting.autoUpgradeEnabled !== true &&
      setting.autoDowngradeEnabled !== true
    )
      return { evaluated: 0, upgraded: 0, downgraded: 0 };
    const groups = await this.db.priceGroup.findMany({
      where: { active: true },
      orderBy: [{ tierOrder: "asc" }, { id: "asc" }],
    });
    const users = await this.db.user.findMany({
      where: { status: "ACTIVE", deletedAt: null, priceGroupId: { not: null } },
      select: { id: true, priceGroupId: true },
      orderBy: [{ priceGroupEvaluatedAt: "asc" }, { id: "asc" }],
      take: Math.min(5000, Math.max(1, limit)),
    });
    let upgraded = 0,
      downgraded = 0;
    for (const user of users) {
      const index = groups.findIndex(
        (group: any) => group.id === user.priceGroupId,
      );
      const next = index >= 0 ? groups[index + 1] : null;
      const previous = index >= 0 ? groups[index] : null;
      const stats = await this.stats(user.id);
      const target =
        setting.autoUpgradeEnabled === true &&
        next?.upgradeEnabled &&
        this.qualifies(next, stats)
          ? next
          : setting.autoDowngradeEnabled === true &&
              previous?.upgradeEnabled &&
              !this.qualifies(previous, stats) &&
              index > 0
            ? groups[index - 1]
            : null;
      if (!target) {
        await this.db.user.updateMany({
          where: { id: user.id, priceGroupId: user.priceGroupId },
          data: { priceGroupEvaluatedAt: new Date() },
        });
        continue;
      }
      const changed = await this.db.$transaction(async (tx: any) => {
        const result = await tx.user.updateMany({
          where: { id: user.id, priceGroupId: user.priceGroupId },
          data: { priceGroupId: target.id, priceGroupEvaluatedAt: new Date() },
        });
        if (!result.count) return false;
        const metadata = {
          matchMode: target.upgradeMatchMode,
          stats: {
            successfulDeposits: text(stats.successfulDeposits),
            totalSpent: text(stats.totalSpent),
            completedOrders: stats.completedOrders,
          },
        };
        await tx.priceGroupHistory.create({
          data: {
            userId: user.id,
            oldPriceGroupId: previous?.id,
            oldPriceGroupCode: previous?.code,
            oldPriceGroupName: previous?.name,
            newPriceGroupId: target.id,
            newPriceGroupCode: target.code,
            newPriceGroupName: target.name,
            source: "AUTO",
            reason:
              target.tierOrder > previous.tierOrder
                ? "Đạt điều kiện nâng cấp tự động"
                : "Không còn đạt điều kiện cấp và chính sách hạ cấp đã bật",
            metadata,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "USER_PRICE_GROUP_AUTO_UPGRADE",
            resource: "User",
            resourceId: user.id,
            before: { priceGroupId: previous?.id, code: previous?.code },
            after: { priceGroupId: target.id, code: target.code, ...metadata },
          },
        });
        return true;
      });
      if (changed) {
        if (target.tierOrder > previous.tierOrder) upgraded += 1;
        else downgraded += 1;
      }
    }
    return { evaluated: users.length, upgraded, downgraded };
  }
}
