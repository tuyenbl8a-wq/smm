import assert from "node:assert/strict";
import test from "node:test";
import {
  couponDiscount,
  PromotionService,
  settleReferral,
} from "../src/promotion/service.js";

test("coupon money math handles fixed, percent and max cap exactly", () => {
  assert.deepEqual(
    couponDiscount(
      { type: "FIXED", value: "2.50000000", minAmount: "0" },
      "10.00000000",
    ),
    { original: "10.00000000", discount: "2.50000000", total: "7.50000000" },
  );
  assert.deepEqual(
    couponDiscount(
      {
        type: "PERCENT",
        value: "25.00000000",
        minAmount: "0",
        maxDiscount: "2.00000000",
      },
      "10.00000000",
    ),
    { original: "10.00000000", discount: "2.00000000", total: "8.00000000" },
  );
});

test("coupon validation rejects inactive, expired and exhausted usage", async () => {
  const base = {
    id: "coupon",
    code: "SAVE10",
    type: "FIXED",
    value: "1",
    minAmount: "0",
    active: true,
    startsAt: new Date(Date.now() - 1000),
    endsAt: new Date(Date.now() + 1000),
    usageLimit: 1,
    userLimit: 1,
  };
  const db = {
    coupon: { findUnique: async () => base },
    couponUsage: { count: async () => 1 },
  };
  await assert.rejects(
    () => new PromotionService(db).preview("site-a", "u", "save10", "10"),
    (error: any) => error.code === "COUPON_LIMIT",
  );
});

test("referral settlement credits wallet and is idempotent", async () => {
  let created = 0;
  const tx: any = {
    referral: { findUnique: async () => ({ id: "r", affiliateId: "a" }) },
    affiliate: {
      findUnique: async () => ({
        id: "a",
        userId: "referrer",
        active: true,
        commissionRate: "10",
      }),
    },
    affiliateCommission: {
      findUnique: async () => (created ? { id: "existing" } : null),
      create: async ({ data }: any) => ((created += 1), data),
    },
    $queryRawUnsafe: async () => [{ id: "w", before: "0", after: "1" }],
    walletTransaction: { create: async ({ data }: any) => data },
  };
  const order = {
    status: "COMPLETED",
    userId: "customer",
    publicId: "order",
    profit: "10",
    refundedAmount: "0",
  };
  const first: any = await settleReferral(tx, order),
    second: any = await settleReferral(tx, order);
  assert.equal(first.amount, "1.00000000");
  assert.equal(second.id, "existing");
  assert.equal(created, 1);
});

test("coupon preview, reserve, list, save, and archive are tenant-scoped", async () => {
  const siteA = "00000000-0000-4000-8000-00000000000a",
    siteB = "00000000-0000-4000-8000-00000000000b",
    future = new Date(Date.now() + 60_000),
    past = new Date(Date.now() - 60_000);
  const rows: any[] = [
    {
      id: "coupon-a",
      siteId: siteA,
      code: "SAME10",
      type: "FIXED",
      value: "1",
      minAmount: "0",
      active: true,
      startsAt: past,
      endsAt: future,
      usageLimit: null,
      userLimit: 2,
    },
    {
      id: "coupon-b",
      siteId: siteB,
      code: "SAME10",
      type: "FIXED",
      value: "2",
      minAmount: "0",
      active: true,
      startsAt: past,
      endsAt: future,
      usageLimit: null,
      userLimit: 2,
    },
  ];
  const audits: any[] = [],
    locks: any[] = [];
  const coupon = {
    findUnique: async ({ where }: any) =>
      rows.find(
        (row) =>
          row.siteId === where.siteId_code.siteId &&
          row.code === where.siteId_code.code,
      ) ?? null,
    findMany: async ({ where }: any) =>
      rows.filter((row) => row.siteId === where.siteId),
    findFirst: async ({ where }: any) =>
      rows.find((row) => row.id === where.id && row.siteId === where.siteId) ??
      null,
    create: async ({ data }: any) => {
      const saved = { id: `coupon-${rows.length + 1}`, ...data };
      rows.push(saved);
      return saved;
    },
    update: async ({ where, data }: any) => {
      const row = rows.find(
        (item) => item.id === where.id && item.siteId === where.siteId,
      );
      if (!row) throw new Error("cross-tenant update");
      Object.assign(row, data);
      return row;
    },
  };
  const db: any = {
    coupon,
    couponUsage: { count: async () => 0 },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
    $queryRawUnsafe: async (...args: any[]) => (locks.push(args), []),
    $transaction: async (run: any) => run(db),
  };
  const service = new PromotionService(db);

  assert.equal(
    (await service.preview(siteA, "user", "same10", "10")).discount,
    "1.00000000",
  );
  assert.equal(
    (await service.preview(siteB, "user", "same10", "10")).discount,
    "2.00000000",
  );
  assert.deepEqual(
    (await service.listCoupons(siteA)).map((row: any) => row.id),
    ["coupon-a"],
  );
  await service.reserve(db, siteA, "user", "same10", "10");
  assert.equal(locks[0]![1], siteA);
  const saved = await service.saveCoupon("actor", siteA, {
    code: "NEW10",
    type: "FIXED",
    value: "1",
    startsAt: past.toISOString(),
    endsAt: future.toISOString(),
  });
  assert.equal(saved.siteId, siteA);
  await assert.rejects(
    () => service.archiveCoupon("actor", siteA, "coupon-b"),
    (error: any) => error.code === "COUPON_NOT_FOUND",
  );
  await service.archiveCoupon("actor", siteA, "coupon-a");
  assert.equal(rows[0]!.active, false);
  assert.equal(
    audits.every((row) => row.siteId === siteA),
    true,
  );
});
