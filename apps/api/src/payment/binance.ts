import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./service.js";
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
    const x = createHmac("sha512", this.webhookSecret)
      .update(raw)
      .digest("hex");
    return (
      x.length === signature.length &&
      timingSafeEqual(Buffer.from(x), Buffer.from(signature))
    );
  }
}
