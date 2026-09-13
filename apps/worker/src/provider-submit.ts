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

type SubmitFailureCode =
  | "PROVIDER_REJECTED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_MALFORMED_RESPONSE"
  | "NETWORK_ERROR"
  | "TIMEOUT_UNKNOWN"
  | "PROVIDER_ACCEPTED_LOCAL_COMMIT_FAILED"
  | "CONFIG_INVALID";

class SubmitFailure extends Error {
  constructor(
    readonly code: SubmitFailureCode,
    message: string,
    readonly unknownOutcome: boolean,
    readonly httpStatus?: number,
  ) {
    super(message);
  }
}

const safeMessage = (value: unknown, secrets: string[] = []) => {
  let message = String(value ?? "Provider request failed")
    .replace(/[\r\n\t]+/g, " ")
    .replace(
      /\b(?:authorization|api[_ -]?key|token|secret)\b\s*[:=]\s*[^\s,;]+/gi,
      "[REDACTED]",
    )
    .slice(0, 300);
  for (const secret of secrets.filter(Boolean))
    message = message.split(secret).join("[REDACTED]");
  return message || "Provider request failed";
};

const diagnostic = (failure: SubmitFailure) => ({
  error: {
    code: failure.code,
    message: failure.message,
    ...(failure.httpStatus ? { httpStatus: failure.httpStatus } : {}),
  },
});

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
    if (!provider || !external) {
      const failure = new SubmitFailure(
        "CONFIG_INVALID",
        "Provider or external service configuration is missing",
        false,
      );
      await this.recordFailure(claimed, order, provider, failure);
      return this.fail(claimed.id, failure, Number(claimed.attempts) + 1);
    }

    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), provider.timeoutMs),
      start = Date.now();
    let acceptedProviderOrderId: string | null = null;
    let apiKey = "";
    try {
      try {
        apiKey = decrypt(provider.apiKeyEncrypted, this.encryptionKey);
      } catch {
        throw new SubmitFailure(
          "CONFIG_INVALID",
          "Provider credentials could not be decrypted",
          false,
        );
      }
      const body = new URLSearchParams({
        key: apiKey,
        action: "add",
        service: String(external),
        link: order.link,
        quantity: String(order.quantity),
      });
      let response: Response;
      try {
        response = await fetch(provider.apiUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        });
      } catch (error: any) {
        if (error?.name === "AbortError")
          throw new SubmitFailure(
            "TIMEOUT_UNKNOWN",
            "Provider request timed out; acceptance is unknown",
            true,
          );
        throw new SubmitFailure(
          "NETWORK_ERROR",
          "Provider network request failed; acceptance is unknown",
          true,
        );
      }

      let responseText: string;
      try {
        responseText = await response.text();
      } catch {
        throw new SubmitFailure(
          "NETWORK_ERROR",
          "Provider response could not be read; acceptance is unknown",
          true,
          response.status,
        );
      }
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch {
        throw new SubmitFailure(
          "PROVIDER_MALFORMED_RESPONSE",
          safeMessage(
            `Provider returned malformed JSON (HTTP ${response.status})`,
          ),
          response.ok,
          response.status,
        );
      }
      if (!response.ok) {
        const code = [401, 403].includes(response.status)
          ? "PROVIDER_AUTH_FAILED"
          : "PROVIDER_REJECTED";
        throw new SubmitFailure(
          code,
          safeMessage(
            json?.error ?? `Provider returned HTTP ${response.status}`,
            [apiKey],
          ),
          false,
          response.status,
        );
      }
      if (json?.error) {
        const message = safeMessage(json.error, [apiKey]);
        throw new SubmitFailure(
          /auth|api.?key|unauthor|forbidden/i.test(String(json.error))
            ? "PROVIDER_AUTH_FAILED"
            : "PROVIDER_REJECTED",
          message,
          false,
          response.status,
        );
      }
      if (!json?.order)
        throw new SubmitFailure(
          "PROVIDER_MALFORMED_RESPONSE",
          "Provider response did not contain an order ID; acceptance is unknown",
          true,
          response.status,
        );

      acceptedProviderOrderId = String(json.order);
      try {
        await this.db.$transaction(async (tx: any) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              providerOrderId: acceptedProviderOrderId,
              status: "PROCESSING",
            },
          });
          await tx.orderHistory.create({
            data: {
              siteId: order.siteId,
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
              status: "COMPLETED",
              latencyMs: Date.now() - start,
              requestMasked: { service: external, quantity: order.quantity },
              responseMasked: { order: acceptedProviderOrderId },
            },
          });
          await tx.providerOutbox.update({
            where: { id: claimed.id },
            data: { status: "SUBMITTED", lockedAt: null, lastError: null },
          });
        });
      } catch {
        throw new SubmitFailure(
          "PROVIDER_ACCEPTED_LOCAL_COMMIT_FAILED",
          "Provider accepted the order but local commit failed",
          true,
        );
      }
      return true;
    } catch (error: any) {
      const failure =
        error instanceof SubmitFailure
          ? error
          : new SubmitFailure(
              acceptedProviderOrderId
                ? "PROVIDER_ACCEPTED_LOCAL_COMMIT_FAILED"
                : "CONFIG_INVALID",
              safeMessage(error?.message, [apiKey]),
              acceptedProviderOrderId !== null,
            );
      await this.recordFailure(claimed, order, provider, failure, start);
      if (failure.unknownOutcome && this.db.order?.update)
        await this.db.order.update({
          where: { id: order.id },
          data: { manualOverride: true, manualOverrideAt: new Date() },
        });
      await this.fail(claimed.id, failure, Number(claimed.attempts) + 1);
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  private async recordFailure(
    claimed: any,
    order: any,
    provider: any,
    failure: SubmitFailure,
    start = Date.now(),
  ) {
    if (!order || !provider || !this.db.orderProviderLog?.upsert) return;
    await this.db.orderProviderLog.upsert({
      where: {
        providerId_requestId_operation: {
          providerId: provider.id,
          requestId: order.providerSubmitKey,
          operation: "CREATE_ORDER",
        },
      },
      create: {
        orderId: order.id,
        providerId: provider.id,
        operation: "CREATE_ORDER",
        requestId: order.providerSubmitKey,
        status: "FAILED",
        latencyMs: Date.now() - start,
        requestMasked: {
          service: (order.input as any)?.providerExternalServiceId,
          quantity: order.quantity,
        },
        responseMasked: diagnostic(failure),
        errorCode: failure.code,
      },
      update: {
        status: "FAILED",
        latencyMs: Date.now() - start,
        responseMasked: diagnostic(failure),
        errorCode: failure.code,
      },
    });
  }

  private complete(id: string, status: string) {
    return this.db.providerOutbox
      .update({ where: { id }, data: { status, lockedAt: null } })
      .then(() => true);
  }

  private fail(id: string, failure: SubmitFailure, attempts = 1) {
    const lastError = `${failure.code}: ${failure.message}`.slice(0, 500);
    return this.db.providerOutbox.update({
      where: { id },
      data: failure.unknownOutcome
        ? { status: "UNKNOWN", lastError, lockedAt: null }
        : {
            status: attempts >= 5 ? "FAILED" : "PENDING",
            lastError,
            lockedAt: null,
            availableAt: new Date(Date.now() + 60000),
          },
    });
  }
}
