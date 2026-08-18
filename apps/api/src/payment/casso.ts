import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeAmount } from "../wallet/service.js";
import { decryptSecret } from "../provider/crypto.js";

const equal = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Verified Casso bank-feed settlement.
 *
 * The inbound webhook authenticates with a dedicated secure token.
 * When Admin payment settings contain a Casso token, that database value
 * is used. Encrypted settings are decrypted with ENCRYPTION_KEY.
 *
 * The environment token is only a fallback when no database token has
 * been configured yet.
 */
export class CassoWebhook {
  constructor(
    private readonly db: any,
    private readonly fallbackSecureToken: string,
    private readonly encryptionKey: string,
  ) {}

  async process(raw: string, suppliedToken: string) {
    const secureToken = await this.resolveSecureToken();

    if (!secureToken || !equal(secureToken, suppliedToken))
      throw new Error("CASSO_AUTH_INVALID");

    const payload = JSON.parse(raw);
    const transactions = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.transactions)
        ? payload.transactions
        : [payload.data ?? payload];

    const results = [];
    for (const item of transactions) {
      results.push(await this.settle(item, raw));
    }

    return { success: true, results };
  }

  private async resolveSecureToken(): Promise<string> {
    const rows = await this.db.setting.findMany({
      where: {
        group: "payments.casso",
        key: {
          in: ["enabled", "webhookSecureToken"],
        },
      },
    });

    const enabledRow = rows.find((row: any) => row.key === "enabled");
    const tokenRow = rows.find(
      (row: any) => row.key === "webhookSecureToken",
    );

    if (enabledRow && enabledRow.value !== true)
      throw new Error("CASSO_DISABLED");

    if (!tokenRow) return this.fallbackSecureToken;

    const stored = String(tokenRow.value ?? "");
    if (!stored) throw new Error("CASSO_CONFIG_INVALID");

    if (!tokenRow.encrypted) return stored;

    try {
      return decryptSecret(stored, this.encryptionKey);
    } catch {
      throw new Error("CASSO_CONFIG_INVALID");
    }
  }

  private async settle(item: any, raw: string) {
    const transactionId = String(
        item.id ?? item.tid ?? item.transactionId ?? "",
      ),
      description = String(item.description ?? item.content ?? ""),
      code = description.toUpperCase().match(/NAP[A-F0-9]{12}/)?.[0],
      eventId = String(item.eventId ?? `casso:${transactionId}`);

    if (!transactionId) throw new Error("CASSO_TRANSACTION_INVALID");
    if (!code)
      return this.unmatched(eventId, raw, "DEPOSIT_CODE_NOT_FOUND");

    try {
      return await this.db.$transaction(async (tx: any) => {
        const deposit = await tx.deposit.findUnique({ where: { code } });

        if (!deposit)
          return this.unmatched(eventId, raw, "DEPOSIT_NOT_FOUND", tx);

        const webhook = await tx.paymentWebhook.create({
          data: {
            paymentMethodId: deposit.paymentMethodId,
            externalEventId: eventId,
            signatureValid: true,
            status: "PENDING",
            payload: item,
            payloadHash: createHash("sha256").update(raw).digest("hex"),
          },
        });

        if (deposit.status === "PAID") return { status: "DUPLICATE" };

        const amount = normalizeAmount(
            String(item.amount ?? item.creditAmount ?? ""),
          ),
          currency = String(item.currency ?? "VND").toUpperCase();

        if (
          normalizeAmount(String(deposit.grossAmount)) !== amount ||
          deposit.sourceCurrency.toUpperCase() !== currency
        ) {
          await tx.deposit.update({
            where: { id: deposit.id },
            data: {
              status: "MANUAL_REVIEW",
              externalTransactionId: transactionId,
            },
          });

          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: {
              status: "FAILED",
              errorCode: "AMOUNT_OR_CURRENCY_MISMATCH",
              processedAt: new Date(),
            },
          });

          return { status: "MANUAL_REVIEW" };
        }

        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
          String(deposit.netAmount),
          deposit.userId,
        );

        if (!rows.length) throw new Error("WALLET_NOT_FOUND");

        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId: deposit.userId,
            type: "DEPOSIT",
            amount: String(deposit.netAmount),
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: deposit.id,
            idempotencyKey: `casso:${transactionId}`,
          },
        });

        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            externalTransactionId: transactionId,
          },
        });

        await tx.paymentWebhook.update({
          where: { id: webhook.id },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
          },
        });

        return { status: "PAID" };
      });
    } catch (error: any) {
      if (error?.code === "P2002") return { status: "DUPLICATE" };
      throw error;
    }
  }

  private async unmatched(
    eventId: string,
    raw: string,
    reason: string,
    client = this.db,
  ) {
    await client.webhookLog
      .create({
        data: {
          source: "CASSO",
          externalEventId: eventId,
          status: "FAILED",
          signatureValid: true,
          payloadHash: createHash("sha256").update(raw).digest("hex"),
          responseCode: 202,
        },
      })
      .catch((error: any) => {
        if (error?.code !== "P2002") throw error;
      });

    return { status: "MANUAL_REVIEW", reason };
  }
}