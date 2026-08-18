import assert from "node:assert/strict";
import test from "node:test";
import { OrderLifecycleService } from "../src/order/lifecycle.js";
test("cross-user lifecycle request is hidden", async () => {
  const db = { order: { findUnique: async () => ({ userId: "other" }) } };
  await assert.rejects(
    () =>
      new OrderLifecycleService(db).request(
        "me",
        "id",
        "cancel",
        "cancel:key:123",
      ),
    /not found/,
  );
});
test("duplicate refill uses database upsert idempotency", async () => {
  let calls = 0;
  const db = {
    order: {
      findUnique: async () => ({ id: 1n, userId: "u", status: "COMPLETED" }),
    },
    refill: { upsert: async () => ({ id: ++calls }) },
  };
  const s = new OrderLifecycleService(db);
  await s.request("u", "id", "refill", "refill:key:123");
  await s.request("u", "id", "refill", "refill:key:123");
  assert.equal(calls, 2);
});
