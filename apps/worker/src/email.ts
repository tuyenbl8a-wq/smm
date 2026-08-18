export class EmailWorker {
  constructor(
    private db: any,
    private send: ((x: any) => Promise<void>) | null,
  ) {}
  async once() {
    if (!this.send) return 0;
    const row = await this.db.$transaction(async (tx: any) => {
      const x = await tx.$queryRawUnsafe(
        `SELECT * FROM "notifications" WHERE "channel"='EMAIL' AND "delivered_at" IS NULL AND "delivery_attempts"<5 AND ("next_attempt_at" IS NULL OR "next_attempt_at"<=NOW()) FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      if (!x[0]) return null;
      await tx.notification.update({
        where: { id: x[0].id },
        data: {
          deliveryAttempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 60000),
        },
      });
      return x[0];
    });
    if (!row) return 0;
    try {
      await this.send({
        userId: row.user_id,
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
        data: { deliveryError: "SMTP_DELIVERY_FAILED" },
      });
    }
    return 1;
  }
}
