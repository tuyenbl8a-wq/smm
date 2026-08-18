import { createDecipheriv, createHash } from "node:crypto";
const decrypt = (value: string, secret: string) => {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("SECRET_INVALID");
  const d = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    Buffer.from(iv, "base64url"),
  );
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(data, "base64url")),
    d.final(),
  ]).toString("utf8");
};
export class SubmitWorker {
  constructor(
    private db: any,
    private encryptionKey: string,
  ) {}
  async once() {
    const claimed = await this.db.$transaction(async (tx: any) => {
      const rows = await tx.$queryRawUnsafe(
        `SELECT * FROM "provider_outbox" WHERE "status"='PENDING' AND "attempts"<5 AND "available_at"<=CURRENT_TIMESTAMP ORDER BY "created_at" FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      if (!rows[0]) return null;
      await tx.providerOutbox.update({
        where: { id: rows[0].id },
        data: {
          status: "PROCESSING",
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      return rows[0];
    });
    if (!claimed) return false;
    const order = await this.db.order.findUnique({
      where: { id: claimed.order_id },
    });
    if (!order || order.providerOrderId)
      return this.complete(claimed.id, "SUBMITTED");
    const provider = await this.db.provider.findUnique({
      where: { id: order.providerId },
    });
    const external = (order.input as any)?.providerExternalServiceId;
    if (!provider || !external)
      return this.fail(
        claimed.id,
        "CONFIG_INVALID",
        false,
        Number(claimed.attempts) + 1,
      );
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), provider.timeoutMs);
    const start = Date.now();
    try {
      const body = new URLSearchParams({
        key: decrypt(provider.apiKeyEncrypted, this.encryptionKey),
        action: "add",
        service: String(external),
        link: order.link,
        quantity: String(order.quantity),
      });
      const response = await fetch(provider.apiUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
      const json = await response.json();
      if (!response.ok || !json?.order) throw new Error("PROVIDER_REJECTED");
      await this.db.$transaction(async (tx: any) => {
        await tx.order.update({
          where: { id: order.id },
          data: { providerOrderId: String(json.order), status: "PROCESSING" },
        });
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            fromStatus: "PENDING",
            toStatus: "PROCESSING",
            details: { source: "provider_submit" },
          },
        });
        await tx.orderProviderLog.create({
          data: {
            orderId: order.id,
            providerId: provider.id,
            operation: "CREATE_ORDER",
            requestId: order.providerSubmitKey,
            status: "SUCCEEDED",
            latencyMs: Date.now() - start,
            requestMasked: { service: external, quantity: order.quantity },
            responseMasked: { order: String(json.order) },
          },
        });
        await tx.providerOutbox.update({
          where: { id: claimed.id },
          data: { status: "SUBMITTED", lockedAt: null },
        });
      });
      return true;
    } catch (error: any) {
      const unknown = error?.name === "AbortError";
      await this.fail(
        claimed.id,
        unknown ? "TIMEOUT_UNKNOWN" : "SUBMIT_FAILED",
        unknown,
        Number(claimed.attempts) + 1,
      );
      return true;
    } finally {
      clearTimeout(timer);
    }
  }
  private complete(id: string, status: string) {
    return this.db.providerOutbox
      .update({ where: { id }, data: { status, lockedAt: null } })
      .then(() => true);
  }
  private fail(id: string, code: string, unknown: boolean, attempts = 1) {
    return this.db.providerOutbox.update({
      where: { id },
      data: unknown
        ? { status: "UNKNOWN", lastError: code, lockedAt: null }
        : {
            status: attempts >= 5 ? "FAILED" : "PENDING",
            lastError: code,
            lockedAt: null,
            availableAt: new Date(Date.now() + 60000),
          },
    });
  }
}
