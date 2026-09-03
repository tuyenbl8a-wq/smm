import assert from "node:assert/strict";
import test from "node:test";
import { DepositService } from "../src/payment/service.js";
test("deposit amount is server validated and starts pending", async () => {
  let data: any;
  const db: any = {
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
  db.$transaction = async (fn: any) => fn(db);
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
  db.$transaction = async (fn: any) => fn(db);
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

test("deposit snapshots bonus and credited amount with fixed-point math", async () => {
  let saved: any;
  const db: any = {
    paymentMethod: {
      findUnique: async () => ({
        id: "m",
        active: true,
        minAmount: "0",
        maxAmount: "0",
        currency: "VND",
        exchangeRate: "1",
        bonusPercent: "5",
      }),
    },
    deposit: { create: async ({ data }: any) => ((saved = data), data) },
  };
  db.$transaction = async (fn: any) => fn(db);
  await new DepositService(db).create("u", {
    paymentMethodId: "m",
    amount: "1000000",
  });
  assert.equal(saved.grossAmount, "1000000.00000000");
  assert.equal(saved.bonusRateSnapshot, "5");
  assert.equal(saved.creditedAmount, "1050000.00000000");
  assert.equal(saved.netAmount, "1050000.00000000");
});

test("concurrent deposit reservations cannot exceed daily count", async () => {
  const deposits: any[] = [];
  let queue = Promise.resolve();
  const db: any = {
    paymentMethod: {
      findUnique: async () => ({
        id: "m",
        active: true,
        minAmount: "0",
        maxAmount: "0",
        currency: "VND",
        bonusPercent: "0",
        dailyTransactionLimit: 1,
        dailyAmountLimit: "0",
      }),
    },
    deposit: {
      count: async () => deposits.length,
      create: async ({ data }: any) => {
        deposits.push(data);
        return data;
      },
    },
  };
  db.$transaction = async (fn: any) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await fn(db);
    } finally {
      release();
    }
  };
  const service = new DepositService(db),
    results = await Promise.allSettled([
      service.create("a", { paymentMethodId: "m", amount: "10" }),
      service.create("b", { paymentMethodId: "m", amount: "10" }),
    ]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(results.filter((row) => row.status === "rejected").length, 1);
  assert.equal(deposits.length, 1);
});
