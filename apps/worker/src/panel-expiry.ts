const renewalKey = (subscriptionId: string, expiresAt: Date) =>
  `panel-auto-renew:${subscriptionId}:${expiresAt.toISOString()}`.slice(0, 128);

export class PanelExpiryWorker {
  constructor(private readonly db: any) {}

  async once(now = new Date()) {
    return this.db.$transaction(async (tx: any) => {
      const renewable = await tx.panelSubscription.findMany({
        where: { status: "ACTIVE", autoRenew: true, expiresAt: { lte: now } },
        include: { plan: true },
      });
      let renewed = 0;
      let renewFailed = 0;
      for (const row of renewable) {
        const key = renewalKey(row.id, new Date(row.expiresAt));
        const existing = await tx.walletTransaction?.findUnique?.({
          where: { idempotencyKey: key },
        });
        if (existing) continue;
        const price = String(row.plan.price);
        const wallets = await tx.$queryRawUnsafe?.(
          'UPDATE "wallets" SET "balance"="balance"-$1::numeric,"version"="version"+1,"updated_at"=CURRENT_TIMESTAMP WHERE "user_id"=$2::uuid AND "site_id"=$3::uuid AND "balance">=$1::numeric RETURNING "id","balance"+$1::numeric AS "before","balance" AS "after"',
          price,
          row.renterUserId,
          row.sellerSiteId,
        );
        if (!wallets?.[0]) {
          renewFailed++;
          continue;
        }
        const expiresAt = new Date(
          now.getTime() + Number(row.plan.billingDays) * 86_400_000,
        );
        await tx.panelSubscription.update({
          where: { id: row.id },
          data: {
            status: "ACTIVE",
            expiresAt,
            graceUntil: expiresAt,
          },
        });
        await tx.site.updateMany({
          where: { id: row.siteId, parentSiteId: { not: null } },
          data: { status: "ACTIVE" },
        });
        await tx.walletTransaction.create({
          data: {
            siteId: row.sellerSiteId,
            walletId: wallets[0].id,
            userId: row.renterUserId,
            type: "PANEL_RENEWAL",
            amount: `-${price}`,
            balanceBefore: wallets[0].before,
            balanceAfter: wallets[0].after,
            referenceId: row.siteId,
            idempotencyKey: key,
            description: "Panel automatic renewal",
          },
        });
        renewed++;
      }

      const past = await tx.panelSubscription.findMany({
        where: { status: "ACTIVE", expiresAt: { lte: now } },
      });
      for (const row of past) {
        await tx.panelSubscription.update({
          where: { id: row.id },
          data: { status: "PAST_DUE" },
        });
        await tx.site.updateMany({
          where: { id: row.siteId, parentSiteId: { not: null } },
          data: { status: "SUSPENDED" },
        });
      }
      const suspended = await tx.panelSubscription.findMany({
        where: { status: "PAST_DUE", expiresAt: { lte: now } },
      });
      for (const row of suspended) {
        await tx.panelSubscription.update({
          where: { id: row.id },
          data: { status: "SUSPENDED" },
        });
        await tx.site.updateMany({
          where: { id: row.siteId, parentSiteId: { not: null } },
          data: { status: "SUSPENDED" },
        });
      }
      return {
        renewed,
        renewFailed,
        pastDue: past.length,
        suspended: suspended.length,
      };
    });
  }
}
