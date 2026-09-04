import assert from "node:assert/strict";
import test from "node:test";
import { applyOrderTargetRefund, partialRefundTarget } from "../dist/index.js";

test("partial refund uses actual charge and never exceeds it", () => {
  assert.equal(partialRefundTarget("100.00000000", 250, 1000), "25.00000000");
  assert.equal(partialRefundTarget("80.00000000", 250, 1000), "20.00000000");
  assert.equal(partialRefundTarget("80.00000000", 1000, 1000), "80.00000000");
});

const order = {
  charge: "100.00000000",
  refundedAmount: "30.00000000",
  userId: "user",
  publicId: "order",
};
function transaction() {
  const credits = [],
    walletTransactions = [];
  return {
    credits,
    walletTransactions,
    tx: {
      $queryRawUnsafe: async (_sql, amount) => (
        credits.push(amount),
        [{ id: "wallet", before: "10", after: "30" }]
      ),
      walletTransaction: {
        create: async ({ data }) => (walletTransactions.push(data), data),
      },
    },
  };
}
test("target refund is incremental and repeated target is idempotent", async () => {
  const first = transaction();
  assert.deepEqual(
    await applyOrderTargetRefund(first.tx, order, "50", "reason"),
    { target: "50.00000000", added: "20.00000000" },
  );
  assert.deepEqual(first.credits, ["20.00000000"]);
  const second = transaction();
  assert.deepEqual(
    await applyOrderTargetRefund(
      second.tx,
      { ...order, refundedAmount: "50" },
      "50",
      "reason",
    ),
    { target: "50.00000000", added: "0.00000000" },
  );
  assert.equal(second.credits.length, 0);
});
test("target below existing or above charge is rejected", async () => {
  const { tx } = transaction();
  await assert.rejects(
    () => applyOrderTargetRefund(tx, order, "20", "reason"),
    /REFUND_BELOW_EXISTING/,
  );
  await assert.rejects(
    () => applyOrderTargetRefund(tx, order, "101", "reason"),
    /REFUND_EXCEEDS_CHARGE/,
  );
});
