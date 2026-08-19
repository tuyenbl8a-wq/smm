import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./service.js";
import { normalizeAmount } from "../wallet/service.js";
export class BinanceMerchantProvider implements PaymentProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private secret: string,
    private webhookSecret: string,
  ) {}
  private async call(path: string, body: any) {
    if (!this.apiKey || !this.secret) throw new Error("BINANCE_DISABLED");
    const timestamp = Date.now().toString(),
      nonce = crypto.randomUUID(),
      payload = JSON.stringify(body),
      signature = createHmac("sha512", this.secret)
        .update(timestamp + "\n" + nonce + "\n" + payload + "\n")
        .digest("hex")
        .toUpperCase();
    const r = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": this.apiKey,
        "BinancePay-Signature": signature,
      },
      body: payload,
    });
    const x = await r.json();
    if (!r.ok || x?.status === "FAIL") throw new Error("BINANCE_REJECTED");
    return x.data;
  }
  createPayment(d: any) {
    return this.call("/binancepay/openapi/v3/order", {
      merchantTradeNo: d.code,
      orderAmount: String(d.grossAmount),
      currency: d.sourceCurrency,
      goods: {
        goodsType: "02",
        goodsCategory: "Z000",
        referenceGoodsId: d.id,
        goodsName: "Wallet deposit",
      },
    }).then((x) => ({
      externalOrderId: x.prepayId,
      qr: x.qrcodeLink,
      deeplink: x.deeplink,
    }));
  }
  verifyPayment = async () => false;
  async handleWebhook(payload: any) {
    return {
      eventId: String(payload.bizId),
      transactionId: String(payload.data?.transactionId ?? payload.bizId),
      depositCode: String(payload.data?.merchantTradeNo),
      amount: String(payload.data?.totalFee),
      currency: String(payload.data?.currency),
    };
  }
  queryTransaction = (id: string) =>
    this.call("/binancepay/openapi/v2/order/query", { prepayId: id });
  verifyWebhook(raw: string, signature: string) {
    if (!this.webhookSecret || !signature) return false;
    const x = createHmac("sha512", this.webhookSecret)
      .update(raw)
      .digest("hex");
    return (
      x.length === signature.length &&
      timingSafeEqual(Buffer.from(x), Buffer.from(signature))
    );
  }
}
export interface BinancePaymentEvent {
  eventId: string;
  transactionId: string;
  depositCode: string;
  amount: string;
  currency: string;
}
export class BinanceWebhookProcessor {
  constructor(
    private db: any,
    private provider: BinanceMerchantProvider,
  ) {}
  async process(raw: string, signature: string) {
    if (!this.provider.verifyWebhook(raw, signature))
      throw new Error("SIGNATURE_INVALID");
    const payload = JSON.parse(raw),
      event = await this.provider.handleWebhook(payload),
      eventStatus = String(
        payload.bizStatus ?? payload.data?.bizStatus ?? "PAY_SUCCESS",
      );
    if (eventStatus !== "PAY_SUCCESS")
      return { status: "IGNORED", reason: "PAYMENT_NOT_SUCCESSFUL" };
    return this.settle(event, payload, true);
  }
  reconcile(event: BinancePaymentEvent, payload: Record<string, unknown> = {}) {
    return this.settle(event, payload, false);
  }
  private async settle(
    event: BinancePaymentEvent,
    payload: Record<string, unknown>,
    signatureValid: boolean,
  ) {
    try {
      return await this.db.$transaction(async (tx: any) => {
        const deposit = await tx.deposit.findUnique({
          where: { code: event.depositCode },
        });
        if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");
        const webhook = await tx.paymentWebhook.create({
          data: {
            paymentMethodId: deposit.paymentMethodId,
            externalEventId: event.eventId,
            signatureValid,
            status: "PENDING",
            payload,
            payloadHash: createHmac("sha256", "binance-payload")
              .update(JSON.stringify(payload))
              .digest("hex"),
          },
        });
        if (deposit.status === "PAID") return { status: "DUPLICATE" };
        if (
          deposit.status !== "PENDING" ||
          (deposit.expiresAt && new Date(deposit.expiresAt) <= new Date())
        ) {
          await tx.paymentWebhook.update({
            where: { id: webhook.id },
            data: {
              status: "FAILED",
              errorCode: "DEPOSIT_NOT_PAYABLE",
              processedAt: new Date(),
            },
          });
          return { status: "MANUAL_REVIEW" };
        }
        if (
          normalizeAmount(String(deposit.grossAmount)) !==
            normalizeAmount(event.amount) ||
          deposit.sourceCurrency.toUpperCase() !== event.currency.toUpperCase()
        ) {
          await tx.deposit.update({
            where: { id: deposit.id },
            data: {
              status: "MANUAL_REVIEW",
              externalTransactionId: event.transactionId,
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
        if (!rows[0]) throw new Error("WALLET_NOT_FOUND");
        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId: deposit.userId,
            type: "DEPOSIT",
            amount: String(deposit.netAmount),
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: deposit.id,
            idempotencyKey: `deposit:${event.transactionId}`,
          },
        });
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            externalTransactionId: event.transactionId,
          },
        });
        await tx.paymentWebhook.update({
          where: { id: webhook.id },
          data: { status: "SUCCEEDED", processedAt: new Date() },
        });
        return { status: "PAID" };
      });
    } catch (error: any) {
      if (error?.code === "P2002") return { status: "DUPLICATE" };
      throw error;
    }
  }
}
