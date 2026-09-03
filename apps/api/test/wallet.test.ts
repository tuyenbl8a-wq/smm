import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAmount,
  WalletError,
  WalletService,
} from "../src/wallet/service.js";
class FakeDb {
  balances = new Map([
    ["user-a", 10_00000000n],
    ["user-b", 3_00000000n],
  ]);
  ledgers: any[] = [];
  audits: any[] = [];
  chain = Promise.resolve();
  wallet = {
    findUnique: async ({ where }: any) =>
      this.balances.has(where.userId)
        ? {
            id: `wallet-${where.userId}`,
            balance: this.text(this.balances.get(where.userId)!),
            currency: "USD",
            updatedAt: new Date(),
          }
        : null,
  };
  walletTransaction = {
    findUnique: async ({ where }: any) =>
      this.ledgers.find((x) => x.idempotencyKey === where.idempotencyKey) ??
      null,
    count: async ({ where }: any) =>
      this.ledgers.filter((x) => x.userId === where.userId).length,
    findMany: async ({ where, skip, take }: any) =>
      this.ledgers
        .filter((x) => x.userId === where.userId)
        .slice(skip, skip + take),
  };
  async $transaction(fn: (tx: any) => Promise<any>) {
    let release!: () => void;
    const previous = this.chain;
    this.chain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn(this.tx());
    } finally {
      release();
    }
  }
  private tx() {
    return {
      wallet: this.wallet,
      walletTransaction: {
        findUnique: this.walletTransaction.findUnique,
        create: async ({ data }: any) => {
          if (
            this.ledgers.some((x) => x.idempotencyKey === data.idempotencyKey)
          ) {
            const e: any = new Error();
            e.code = "P2002";
            throw e;
          }
          const row = {
            id: `tx-${this.ledgers.length + 1}`,
            createdAt: new Date(),
            ...data,
          };
          this.ledgers.unshift(row);
          return row;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          this.audits.push(data);
        },
      },
      $queryRawUnsafe: async (_sql: string, signed: string, userId: string) => {
        const current = this.balances.get(userId);
        if (current === undefined) return [];
        const delta = this.units(signed);
        if (current + delta < 0n) return [];
        this.balances.set(userId, current + delta);
        return [
          {
            id: `wallet-${userId}`,
            balanceBefore: this.text(current),
            balanceAfter: this.text(current + delta),
          },
        ];
      },
    };
  }
  private units(value: string) {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace("-", "").split(".");
    const result =
      BigInt(whole!) * 100_000000n + BigInt(fraction.padEnd(8, "0"));
    return negative ? -result : result;
  }
  private text(value: bigint) {
    return `${value / 100_000000n}.${String(value % 100_000000n).padStart(8, "0")}`;
  }
}
const mutation = (overrides: Record<string, unknown> = {}) => ({
  userId: "user-a",
  amount: "2.5",
  type: "ADMIN_ADD" as const,
  direction: "credit" as const,
  idempotencyKey: "wallet:test:0001",
  ...overrides,
});
test("amount normalization preserves eight-place precision and rejects invalid values", () => {
  assert.equal(normalizeAmount("1.00000001"), "1.00000001");
  assert.throws(() => normalizeAmount("0"), /greater than zero/);
  assert.throws(() => normalizeAmount("1.000000001"), /8 decimal/);
});
test("credit, debit, and ledger before/after balances are exact", async () => {
  const db = new FakeDb();
  const service = new WalletService(db);
  const credit = await service.mutate(mutation());
  assert.equal(credit.balanceBefore, "10.00000000");
  assert.equal(credit.balanceAfter, "12.50000000");
  const debit = await service.mutate(
    mutation({
      type: "ADMIN_SUBTRACT",
      direction: "debit",
      amount: "1.25",
      idempotencyKey: "wallet:test:0002",
    }),
  );
  assert.equal(debit.amount, "-1.25000000");
  assert.equal(debit.balanceAfter, "11.25000000");
});
test("insufficient and concurrent debits never overspend", async () => {
  const db = new FakeDb();
  const service = new WalletService(db);
  const results = await Promise.allSettled([
    service.mutate(
      mutation({
        type: "ORDER",
        direction: "debit",
        amount: "8",
        idempotencyKey: "wallet:order:001",
      }),
    ),
    service.mutate(
      mutation({
        type: "ORDER",
        direction: "debit",
        amount: "8",
        idempotencyKey: "wallet:order:002",
      }),
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await service.summary("user-a")).balance, "2.00000000");
});
test("a debit larger than balance is rejected without a ledger row", async () => {
  const db = new FakeDb();
  const service = new WalletService(db);
  await assert.rejects(
    () =>
      service.mutate(
        mutation({
          type: "ORDER",
          direction: "debit",
          amount: "10.00000001",
          idempotencyKey: "wallet:order:too-large",
        }),
      ),
    (error: unknown) =>
      error instanceof WalletError && error.code === "INSUFFICIENT_BALANCE",
  );
  assert.equal(db.ledgers.length, 0);
  assert.equal((await service.summary("user-a")).balance, "10.00000000");
});
test("idempotency retries do not double credit and conflicts are rejected", async () => {
  const db = new FakeDb();
  const service = new WalletService(db);
  const first = await service.mutate(mutation());
  const retry = await service.mutate(mutation());
  assert.equal(first.id, retry.id);
  assert.equal((await service.summary("user-a")).balance, "12.50000000");
  await assert.rejects(
    () => service.mutate(mutation({ amount: "3" })),
    /another operation/,
  );
});
test("history is user-scoped and admin mutation creates audit", async () => {
  const db = new FakeDb();
  const service = new WalletService(db);
  await service.mutate(
    mutation({
      actorId: "admin-id",
      audit: true,
      description: "Điều chỉnh theo yêu cầu",
      metadata: { internalNote: "Phiếu hỗ trợ 123" },
    }),
  );
  await service.mutate(
    mutation({ userId: "user-b", idempotencyKey: "wallet:test:userb" }),
  );
  const history = await service.history("user-a", 1, 20);
  assert.equal(history.total, 1);
  assert.equal(history.items[0]?.userId, "user-a");
  assert.equal(db.audits.length, 1);
  assert.equal(db.audits[0].after.reason, "Điều chỉnh theo yêu cầu");
});
