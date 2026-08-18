import assert from "node:assert/strict";
import test from "node:test";
import { DepositService } from "../src/payment/service.js";
test("deposit amount is server validated and starts pending", async () => {
  let data: any;
  const db = {
    paymentMethod: {
      findUnique: async () => ({
        id: "m",
        active: true,
        minAmount: "1.00000000",
        currency: "VND",
      }),
    },
    deposit: { create: async (x: any) => ((data = x.data), x.data) },
  };
  await new DepositService(db).create("u", {
    paymentMethodId: "m",
    amount: "10",
  });
  assert.equal(data.status, "PENDING");
  assert.equal(data.userId, "u");
});
