export class EmailWorker {
  constructor(
    private db: any,
    private send: ((x: any) => Promise<void>) | null,
  ) {}
  async once() {
    if (!this.send) return 0;
    const row = await this.db.$transaction(async (tx: any) => {
      const x = await tx.$queryRawUnsafe(
        `SELECT n.*,u."email" FROM "notifications" n JOIN "users" u ON u."id"=n."user_id" WHERE n."channel"='EMAIL' AND n."delivered_at" IS NULL AND n."delivery_attempts"<5 AND (n."next_attempt_at" IS NULL OR n."next_attempt_at"<=NOW()) FOR UPDATE OF n SKIP LOCKED LIMIT 1`,
      );
      if (!x[0]) return null;
      await tx.notification.update({
        where: { id: x[0].id },
        data: {
          deliveryAttempts: { increment: 1 },
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(3_600_000, 30_000 * 2 ** x[0].delivery_attempts),
          ),
        },
      });
      return x[0];
    });
    if (!row) return 0;
    try {
      await this.send({
        userId: row.user_id,
        to: row.email,
        title: row.title,
        body: row.body,
      });
      await this.db.notification.update({
        where: { id: row.id },
        data: { deliveredAt: new Date(), deliveryError: null },
      });
    } catch {
      await this.db.notification.update({
        where: { id: row.id },
        data: {
          deliveryError: "SMTP_DELIVERY_FAILED",
        },
      });
    }
    return 1;
  }
}
