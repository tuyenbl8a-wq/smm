import assert from "node:assert/strict";
import test from "node:test";
import { BinanceMerchantProvider } from "../src/payment/binance.js";
test("Binance integration stays disabled without merchant credentials", async () =>
  await assert.rejects(
    () =>
      new BinanceMerchantProvider(
        "https://pay.binance.com",
        "",
        "",
        "hook",
      ).createPayment({}),
    /DISABLED/,
  ));
test("Binance webhook signature is deterministic", () => {
  const p = new BinanceMerchantProvider("x", "a", "b", "hook");
  assert.equal(p.verifyWebhook("{}", "bad"), false);
});
import { BinanceWebhookProcessor } from "../src/payment/binance.js";
test("invalid Binance signature never reaches database", async () => {
  let touched = false;
  const db = {
    $transaction: async () => {
      touched = true;
    },
  };
  const provider: any = { verifyWebhook: () => false };
  await assert.rejects(
    () => new BinanceWebhookProcessor(db, provider).process("{}", "bad"),
    /SIGNATURE/,
  );
  assert.equal(touched, false);
});
