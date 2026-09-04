import { createDecipheriv, createHash } from "node:crypto";
import {
  applyOrderTargetRefund,
  moneyToUnits,
  partialRefundTarget,
} from "@smm/database";
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
          status: { in: ["PENDING", "PROCESSING", "IN_PROGRESS"] },
          providerOrderId: { not: null },
          manualOverride: false,
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
        } catch (error: any) {
          console.error(
            JSON.stringify({
              level: "error",
              service: "worker",
              event: "provider_status_sync_failed",
              orderId: String(o.id),
              code: error?.name ?? "ERROR",
            }),
          );
        }
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
    const remains = Number(x.remains ?? 0),
      startCount = x.start_count == null ? null : Number(x.start_count);
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
      remains > order.quantity ||
      (startCount !== null && (!Number.isInteger(startCount) || startCount < 0))
    )
      return;
    await this.db.$transaction(async (tx: any) => {
      if (tx.$executeRawUnsafe)
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          order.id,
        );
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (
        !current ||
        current.manualOverride ||
        ["COMPLETED", "CANCELED", "REFUNDED"].includes(current.status)
      )
        return;
      if (status === "PARTIAL") {
        const calculated = partialRefundTarget(
          current.charge,
          remains,
          current.quantity,
        );
        const refund = await applyOrderTargetRefund(
          tx,
          current,
          moneyToUnits(calculated) < moneyToUnits(current.refundedAmount)
            ? current.refundedAmount
            : calculated,
          "Partial order refund",
        );
        await tx.order.update({
          where: { id: current.id },
          data: {
            status,
            remains,
            refundedAmount: refund.target,
            startCount: startCount ?? undefined,
          },
        });
      } else
        await tx.order.update({
          where: { id: current.id },
          data: {
            status,
            remains,
            startCount: startCount ?? undefined,
          },
        });
      await tx.orderHistory.create({
        data: {
          orderId: current.id,
          fromStatus: current.status,
          toStatus: status,
          details: { source: "WORKER_PROVIDER_SYNC", remains, startCount },
        },
      });
      await tx.auditLog?.create({
        data: {
          action: "ORDER_PROVIDER_SYNC",
          resource: "Order",
          resourceId: current.publicId,
          before: {
            status: current.status,
            remains: current.remains,
            startCount: current.startCount,
            refundedAmount: String(current.refundedAmount),
          },
          after: { status, remains, startCount },
        },
      });
    });
  }
  private async actions(kind: "refill" | "cancel") {
    const model = kind === "refill" ? this.db.refill : this.db.cancellation;
    const table = kind === "refill" ? "refills" : "cancellations";
    // A worker dying after an external request leaves an unknowable outcome.
    // Recover it to UNKNOWN for manual/provider reconciliation rather than
    // risking a duplicate external mutation.
    await this.db.$executeRawUnsafe(
      `UPDATE "${table}" SET "status"='UNKNOWN',"last_error"='STALE_CLAIM_UNKNOWN' WHERE "status"='PROCESSING' AND "claimed_at" < NOW() - INTERVAL '5 minutes'`,
    );
    for (let n = 0; n < 20; n++) {
      const claimed = await this.db.$transaction(async (tx: any) => {
        const rows = await tx.$queryRawUnsafe(
          `SELECT * FROM "${table}" WHERE "status"='PENDING' AND "attempts" < 5 AND "next_attempt_at" <= NOW() ORDER BY "created_at" FOR UPDATE SKIP LOCKED LIMIT 1`,
        );
        if (!rows[0]) return null;
        await (kind === "refill" ? tx.refill : tx.cancellation).update({
          where: { id: rows[0].id },
          data: {
            status: "PROCESSING",
            claimedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        return rows[0];
      });
      if (!claimed) break;
      const row = { ...claimed, orderId: claimed.order_id };
      const o = await this.db.order.findUnique({ where: { id: row.orderId } });
      if (!o?.providerOrderId) {
        await model.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            claimedAt: null,
            lastError: "PROVIDER_ORDER_MISSING",
          },
        });
        continue;
      }
      const p = await this.db.provider.findUnique({
        where: { id: o.providerId },
      });
      if (!p) {
        await model.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            claimedAt: null,
            lastError: "PROVIDER_MISSING",
          },
        });
        continue;
      }
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), p.timeoutMs);
      try {
        const r = await fetch(p.apiUrl, {
          method: "POST",
          body: new URLSearchParams({
            key: dec(p.apiKeyEncrypted, this.key),
            action: kind,
            order: o.providerOrderId,
            request_id: row.idempotency_key,
          }),
          signal: controller.signal,
        });
        const x = await r.json();
        if (!r.ok || x?.error) throw Error("REJECTED");
        await model.update({
          where: { id: row.id },
          data: {
            status: "COMPLETED",
            claimedAt: null,
            ...(kind === "refill" && x.refill
              ? { providerRefillId: String(x.refill) }
              : {}),
          },
        });
      } catch (error: any) {
        const unknown = error?.name === "AbortError";
        const attempts = Number(claimed.attempts ?? 0) + 1;
        await model.update({
          where: { id: row.id },
          data: unknown
            ? {
                status: "UNKNOWN",
                claimedAt: null,
                lastError: "PROVIDER_TIMEOUT_UNKNOWN",
              }
            : attempts >= 5
              ? {
                  status: "FAILED",
                  claimedAt: null,
                  lastError: "PROVIDER_REJECTED",
                }
              : {
                  status: "PENDING",
                  claimedAt: null,
                  lastError: "PROVIDER_REJECTED",
                  nextAttemptAt: new Date(
                    Date.now() + Math.min(300000, 1000 * 2 ** attempts),
                  ),
                },
        });
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
