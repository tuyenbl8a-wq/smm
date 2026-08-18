import assert from "node:assert/strict";
import test from "node:test";
import { orderAmount, OrderService } from "../src/order/service.js";
test("order charge uses exact per-thousand arithmetic", () => {
  assert.equal(orderAmount("1.23456789", 1000), "1.23456789");
  assert.equal(orderAmount("1.00000001", 3), "0.00300000");
});
test("order validation rejects invalid link before persistence", async () => {
  await assert.rejects(
    () =>
      new OrderService({}).create(
        "u",
        { serviceId: "s", quantity: 10, link: "javascript:bad" },
        "valid-key-1234",
      ),
    /Link must be HTTP/,
  );
});
test("order list is strictly scoped to authenticated user", async () => {
  let where: any;
  const db = {
    order: {
      count: async (q: any) => ((where = q.where), 0),
      findMany: async () => [],
    },
  };
  await new OrderService(db).list("user-a", 1, 20);
  assert.deepEqual(where, { userId: "user-a" });
});
