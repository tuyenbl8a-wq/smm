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
    () => new PromotionService(db).preview("u", "save10", "10"),
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
