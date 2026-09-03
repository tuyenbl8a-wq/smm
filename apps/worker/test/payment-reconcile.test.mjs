import assert from "node:assert/strict";
import test from "node:test";
import { PaymentReconciliationWorker } from "../dist/payment-reconcile.js";

const fixture = (attempts = 1, maxAttempts = 8) => {
  const updates = [],
    deposits = [];
  const db = {
    $transaction: async (run) =>
      run({
        $queryRawUnsafe: async () => [
          {
            id: "job",
            deposit_id: "deposit",
            attempts,
            max_attempts: maxAttempts,
          },
        ],
        deposit: {
          findUnique: async () => ({
            id: "deposit",
            code: "NAP1",
            externalOrderId: "external",
          }),
          updateMany: async (input) => deposits.push(input),
        },
        paymentReconciliationJob: {
          update: async (input) => updates.push(input),
        },
        systemLog: { create: async () => undefined },
      }),
    paymentReconciliationJob: { update: async (input) => updates.push(input) },
  };
  return { db, updates, deposits };
};

test("paid reconciliation settles and completes the durable job", async () => {
  const state = fixture();
  const worker = new PaymentReconciliationWorker(
    state.db,
    async () => ({
      status: "PAID",
      transactionId: "tx",
      amount: "10",
      currency: "USDT",
    }),
    async () => ({ status: "PAID" }),
  );
  assert.equal(await worker.once(), 1);
  assert.equal(state.updates.at(-1).data.status, "COMPLETED");
});

test("pending and provider timeout schedule bounded retry", async () => {
  for (const query of [
    async () => ({ status: "PENDING" }),
    async () => {
      throw new Error("PROVIDER_TIMEOUT");
    },
  ]) {
    const state = fixture();
    await new PaymentReconciliationWorker(state.db, query, async () => ({
      status: "PAID",
    })).once();
    assert.equal(state.updates.at(-1).data.status, "UNKNOWN");
  }
});

test("max attempts moves unknown payment to manual review", async () => {
  const state = fixture(8, 8);
  await new PaymentReconciliationWorker(
    state.db,
    async () => ({ status: "UNKNOWN" }),
    async () => ({ status: "PAID" }),
  ).once();
  assert.equal(state.updates.at(-1).data.status, "FAILED");
  assert.equal(state.deposits.at(-1).data.status, "MANUAL_REVIEW");
});

test("expired merchant payment closes job without settlement", async () => {
  const state = fixture();
  let settled = false;
  await new PaymentReconciliationWorker(
    state.db,
    async () => ({ status: "EXPIRED" }),
    async () => ((settled = true), { status: "PAID" }),
  ).once();
  assert.equal(settled, false);
  assert.equal(state.deposits.at(-1).data.status, "EXPIRED");
  assert.equal(state.updates.at(-1).data.status, "COMPLETED");
});
