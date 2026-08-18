import { createDecipheriv, createHash } from "node:crypto";
const dec = (v: string, k: string) => {
  const [x, i, t, d] = v.split(".");
  if (x !== "v1") throw Error("SECRET");
  const c = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(k).digest(),
    Buffer.from(i!, "base64url"),
  );
  c.setAuthTag(Buffer.from(t!, "base64url"));
  return Buffer.concat([
    c.update(Buffer.from(d!, "base64url")),
    c.final(),
  ]).toString("utf8");
};
export class LifecycleWorker {
  private running = false;
  constructor(
    private db: any,
    private key: string,
  ) {}
  async run() {
    if (this.running) return 0;
    this.running = true;
    try {
      let count = 0;
      const orders = await this.db.order.findMany({
        where: {
          status: { in: ["PROCESSING", "IN_PROGRESS"] },
          providerOrderId: { not: null },
        },
        take: 50,
        orderBy: { updatedAt: "asc" },
      });
      for (const o of orders) {
        try {
          const p = await this.db.provider.findUnique({
              where: { id: o.providerId },
            }),
            controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), p.timeoutMs);
          try {
            const r = await fetch(p.apiUrl, {
              method: "POST",
              body: new URLSearchParams({
                key: dec(p.apiKeyEncrypted, this.key),
                action: "status",
                order: o.providerOrderId,
              }),
              signal: controller.signal,
            });
            const x = await r.json();
            if (r.ok && x?.status) await this.apply(o, x);
          } finally {
            clearTimeout(timer);
          }
          count++;
        } catch {}
      }
      await this.actions("refill");
      await this.actions("cancel");
      return count;
    } finally {
      this.running = false;
    }
  }

  private async apply(order: any, x: any) {
    const status = String(x.status).toUpperCase().replaceAll(" ", "_");
    const remains = Number(x.remains ?? 0);
    if (
      ![
        "PENDING",
        "PROCESSING",
        "IN_PROGRESS",
        "COMPLETED",
        "PARTIAL",
        "CANCELED",
        "FAILED",
      ].includes(status) ||
      !Number.isInteger(remains) ||
      remains < 0 ||
      remains > order.quantity
    )
      return;
    await this.db.$transaction(async (tx: any) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (
        !current ||
        ["COMPLETED", "CANCELED", "REFUNDED"].includes(current.status)
      )
        return;
      if (
        status === "PARTIAL" &&
        String(current.refundedAmount).replace(/\.0+$/, "") === "0"
      ) {
        const rate = BigInt(
            String(current.saleRate).replace(".", "").padEnd(8, "0"),
          ),
          refundUnits = (rate * BigInt(remains)) / 1000n,
          refund = `${refundUnits / 100000000n}.${String(refundUnits % 100000000n).padStart(8, "0")}`;
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
          refund,
          current.userId,
        );
        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId: current.userId,
            type: "REFUND",
            amount: refund,
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: current.publicId,
            idempotencyKey: `refund:order:${current.publicId}`,
          },
        });
        await tx.order.update({
          where: { id: current.id },
          data: {
            status,
            remains,
            refundedAmount: refund,
            startCount:
              x.start_count == null ? undefined : Number(x.start_count),
          },
        });
      } else
        await tx.order.update({
          where: { id: current.id },
          data: {
            status,
            remains,
            startCount:
              x.start_count == null ? undefined : Number(x.start_count),
          },
        });
      await tx.orderHistory.create({
        data: {
          orderId: current.id,
          fromStatus: current.status,
          toStatus: status,
          details: { remains },
        },
      });
    });
  }
  private async actions(kind: "refill" | "cancel") {
    const model = kind === "refill" ? this.db.refill : this.db.cancellation;
    for (let n = 0; n < 20; n++) {
      const table = kind === "refill" ? "refills" : "cancellations";
      const claimed = await this.db.$transaction(async (tx: any) => {
        const rows = await tx.$queryRawUnsafe(
          `SELECT * FROM "${table}" WHERE "status"='PENDING' ORDER BY "created_at" FOR UPDATE SKIP LOCKED LIMIT 1`,
        );
        if (!rows[0]) return null;
        await (kind === "refill" ? tx.refill : tx.cancellation).update({
          where: { id: rows[0].id },
          data: { status: "PROCESSING" },
        });
        return rows[0];
      });
      if (!claimed) break;
      const row = { ...claimed, orderId: claimed.order_id };
      const o = await this.db.order.findUnique({ where: { id: row.orderId } });
      if (!o?.providerOrderId) continue;
      const p = await this.db.provider.findUnique({
        where: { id: o.providerId },
      });
      try {
        const r = await fetch(p.apiUrl, {
          method: "POST",
          body: new URLSearchParams({
            key: dec(p.apiKeyEncrypted, this.key),
            action: kind,
            order: o.providerOrderId,
          }),
        });
        const x = await r.json();
        if (!r.ok || x?.error) throw Error("REJECTED");
        await model.update({
          where: { id: row.id },
          data: {
            status: "SUCCEEDED",
            ...(kind === "refill" && x.refill
              ? { providerRefillId: String(x.refill) }
              : {}),
          },
        });
      } catch {
        await model.update({
          where: { id: row.id },
          data: { status: "FAILED" },
        });
      }
    }
  }
}
