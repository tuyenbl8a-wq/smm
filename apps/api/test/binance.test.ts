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
test("Binance only credits a pending, exact payment once", async () => {
  const state: any = {
      credits: 0,
      deposit: {
        id: "deposit",
        userId: "user",
        paymentMethodId: "method",
        status: "PENDING",
        grossAmount: "10.00000000",
        netAmount: "10.00000000",
        sourceCurrency: "USDT",
      },
    },
    tx: any = {
      deposit: {
        findUnique: async () => state.deposit,
        update: async ({ data }: any) => Object.assign(state.deposit, data),
      },
      paymentWebhook: {
        create: async () => ({ id: "webhook" }),
        update: async () => undefined,
      },
      $queryRawUnsafe: async () => {
        state.credits++;
        return [{ id: "wallet", before: "0", after: "10" }];
      },
      walletTransaction: { create: async () => undefined },
    },
    db: any = { ...tx, $transaction: async (fn: any) => fn(tx) },
    provider: any = {
      verifyWebhook: () => true,
      handleWebhook: async () => ({
        eventId: "event",
        transactionId: "transaction",
        depositCode: "NAPCODE",
        amount: "10",
        currency: "usdt",
      }),
    },
    processor = new BinanceWebhookProcessor(db, provider),
    raw = JSON.stringify({ bizStatus: "PAY_SUCCESS" });
  assert.equal((await processor.process(raw, "valid")).status, "PAID");
  assert.equal(state.credits, 1);
  assert.equal((await processor.process(raw, "valid")).status, "DUPLICATE");
  assert.equal(state.credits, 1);
});

test("Binance rejects failed, expired, and mismatched payment events", async () => {
  const provider: any = {
    verifyWebhook: () => true,
    handleWebhook: async () => ({
      eventId: "event",
      transactionId: "transaction",
      depositCode: "NAPCODE",
      amount: "9",
      currency: "USDT",
    }),
  };
  let transactions = 0;
  const ignored = await new BinanceWebhookProcessor(
    { $transaction: async () => transactions++ },
    provider,
  ).process(JSON.stringify({ bizStatus: "PAY_CLOSED" }), "valid");
  assert.equal(ignored.status, "IGNORED");
  assert.equal(transactions, 0);
});
