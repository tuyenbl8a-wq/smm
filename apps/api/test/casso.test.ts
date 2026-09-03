import assert from "node:assert/strict";
import test from "node:test";
import { CassoWebhook } from "../src/payment/casso.js";

const deposit = {
  id: "deposit-id",
  userId: "user-id",
  paymentMethodId: "method-id",
  code: "NAPABCDEF123456",
  status: "PENDING",
  grossAmount: "100.00000000",
  netAmount: "100.00000000",
  sourceCurrency: "VND",
};
function database() {
  const state: any = { walletCredits: 0, ledger: [], deposit: { ...deposit } };
  const tx: any = {
    deposit: {
      findUnique: async ({ where }: any) =>
        where.code === state.deposit.code ? state.deposit : null,
      update: async ({ data }: any) => Object.assign(state.deposit, data),
    },
    paymentWebhook: {
      create: async () => ({ id: "hook" }),
      update: async () => undefined,
    },
    webhookLog: { create: async () => undefined },
    $queryRawUnsafe: async () => {
      state.walletCredits++;
      return [{ id: "wallet", before: "0", after: "100" }];
    },
    walletTransaction: {
      create: async ({ data }: any) => state.ledger.push(data),
    },
  };
  return {
    state,
    db: {
      ...tx,
      $transaction: async (fn: any) => fn(tx),
    },
  };
}

test("Casso rejects missing/invalid webhook authentication", async () => {
  const { db } = database();
  await assert.rejects(
    () => new CassoWebhook(db, "secure").process("{}", "wrong"),
    /CASSO_AUTH_INVALID/,
  );
});

test("Casso exact-match credits wallet and immutable ledger", async () => {
  const { db, state } = database(),
    raw = JSON.stringify({
      data: [
        {
          id: "bank-1",
          amount: "100.00000000",
          currency: "VND",
          description: `transfer ${deposit.code}`,
        },
      ],
    });
  const result = await new CassoWebhook(db, "secure").process(raw, "secure");
  assert.equal(result.results[0].status, "PAID");
  assert.equal(state.walletCredits, 1);
  assert.equal(state.ledger[0].idempotencyKey, "casso:bank-1");
  assert.equal(state.deposit.status, "PAID");
  const duplicate = await new CassoWebhook(db, "secure").process(raw, "secure");
  assert.equal(duplicate.results[0].status, "DUPLICATE");
  assert.equal(state.walletCredits, 1);
});

test("Casso wrong amount enters manual review without wallet credit", async () => {
  const { db, state } = database(),
    raw = JSON.stringify({
      data: {
        id: "bank-2",
        amount: "99.00000000",
        currency: "VND",
        description: deposit.code,
      },
    });
  const result = await new CassoWebhook(db, "secure").process(raw, "secure");
  assert.equal(result.results[0].status, "MANUAL_REVIEW");
  assert.equal(state.walletCredits, 0);
});

test("Casso never credits an expired deposit or an unknown transfer code", async () => {
  const { db, state } = database();
  state.deposit.expiresAt = new Date(Date.now() - 60_000);
  const expired = await new CassoWebhook(db, "secure").process(
    JSON.stringify({
      data: {
        id: "bank-expired",
        amount: "100.00000000",
        currency: "VND",
        description: deposit.code,
      },
    }),
    "secure",
  );
  assert.equal(expired.results[0].status, "MANUAL_REVIEW");
  assert.equal(state.walletCredits, 0);

  const unknown = await new CassoWebhook(db, "secure").process(
    JSON.stringify({
      data: {
        id: "bank-unknown",
        amount: "100.00000000",
        description: "no matching transfer code",
      },
    }),
    "secure",
  );
  assert.equal(unknown.results[0].status, "MANUAL_REVIEW");
  assert.equal(state.walletCredits, 0);
});
