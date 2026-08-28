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

test("deposit enforces method maximum and daily limits before persistence", async () => {
  let created = 0;
  const method = {
      id: "m",
      active: true,
      minAmount: "1",
      maxAmount: "100",
      dailyTransactionLimit: 2,
      dailyAmountLimit: "150",
      exchangeRate: "1",
      currency: "VND",
    },
    db: any = {
      paymentMethod: { findUnique: async () => method },
      deposit: {
        count: async () => 2,
        aggregate: async () => ({ _sum: { grossAmount: "140" } }),
        create: async () => {
          created++;
        },
      },
    },
    service = new DepositService(db);
  await assert.rejects(
    () =>
      service.create("u", {
        paymentMethodId: "m",
        amount: "101",
      }),
    /Amount above maximum/,
  );
  await assert.rejects(
    () =>
      service.create("u", {
        paymentMethodId: "m",
        amount: "10",
      }),
    /Daily transaction limit reached/,
  );
  assert.equal(created, 0);
});
