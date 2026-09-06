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

test("manual deposit approval is atomic, reasoned and idempotent", async () => {
  const state: any = {
    deposit: { id: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222", status: "PENDING", creditedAmount: "125.00000000" },
    ledger: null,
    credits: 0,
    audits: [],
  };
  const tx: any = {
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes('FROM "deposits"')) return [state.deposit];
      state.credits++;
      return [{ id: "wallet", balanceBefore: "10", balanceAfter: "135" }];
    },
    deposit: {
      findUnique: async () => state.deposit,
      update: async ({ data }: any) => (state.deposit = { ...state.deposit, ...data }),
    },
    walletTransaction: {
      findUnique: async () => state.ledger,
      create: async ({ data }: any) => (state.ledger = { id: "ledger", ...data }),
    },
    auditLog: { create: async ({ data }: any) => state.audits.push(data) },
  };
  const service = new DepositService({ $transaction: async (fn: any) => fn(tx) });
  const first = await service.adminOperate("actor", state.deposit.id, "APPROVE", "Đã đối soát ngân hàng");
  assert.equal(first.idempotent, false);
  assert.equal(state.deposit.status, "PAID");
  assert.equal(state.credits, 1);
  assert.equal(state.ledger.type, "DEPOSIT");
  assert.equal(state.audits[0].after.reason, "Đã đối soát ngân hàng");
  const again = await service.adminOperate("actor", state.deposit.id, "APPROVE", "Đã đối soát ngân hàng");
  assert.equal(again.idempotent, true);
  assert.equal(state.credits, 1);
});

test("manual deposit operations require a reason and valid transition", async () => {
  const deposit = { id: "11111111-1111-4111-8111-111111111111", userId: "u", status: "PAID", creditedAmount: "1" };
  const tx: any = { $queryRawUnsafe: async () => [deposit], deposit: { findUnique: async () => deposit }, walletTransaction: { findUnique: async () => null } };
  const service = new DepositService({ $transaction: async (fn: any) => fn(tx) });
  await assert.rejects(() => service.adminOperate("actor", deposit.id, "REJECT", ""), (error: any) => error.code === "REASON_REQUIRED");
  await assert.rejects(() => service.adminOperate("actor", deposit.id, "REJECT", "Không hợp lệ"), (error: any) => error.code === "DEPOSIT_TRANSITION_INVALID");
});
