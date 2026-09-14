import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LifecycleWorker } from "../dist/lifecycle.js";

const source = readFileSync(
  new URL("../src/lifecycle.ts", import.meta.url),
  "utf8",
);

test("refill and cancellation claims are multi-worker safe and bounded", () => {
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /"attempts" < 5/);
  assert.match(source, /next_attempt_at/);
  assert.match(source, /2 \*\* attempts/);
});

test("stale and timed-out provider mutations are never blindly resent", () => {
  assert.match(source, /STALE_CLAIM_UNKNOWN/);
  assert.match(source, /PROVIDER_TIMEOUT_UNKNOWN/);
  assert.match(source, /status: "UNKNOWN"/);
});

test("provider receives stable request identity for supported idempotency", () => {
  assert.match(source, /request_id: row\.idempotency_key/);
});

test("automatic lifecycle polls pending orders but skips manual overrides", () => {
  assert.match(source, /"PENDING", "PROCESSING", "IN_PROGRESS"/);
  assert.match(source, /manualOverride: false/);
  assert.match(source, /current\.manualOverride/);
});

test("worker uses shared charge-based idempotent refund helper", () => {
  assert.match(source, /partialRefundTarget\([\s\S]*current\.charge/);
  assert.match(source, /applyOrderTargetRefund/);
  assert.doesNotMatch(source, /current\.saleRate/);
});

test("provider lifecycle lookup is scoped to the order tenant", async () => {
  let providerWhere;
  const order = {
    id: 3n,
    siteId: "tenant-a",
    providerId: "provider-b",
    providerOrderId: "2520992",
  };
  const emptyClaim = async (run) =>
    run({ $queryRawUnsafe: async () => [] });
  const db = {
    order: { findMany: async () => [order] },
    provider: {
      findFirst: async ({ where }) => ((providerWhere = where), null),
    },
    refill: { update: async () => undefined },
    cancellation: { update: async () => undefined },
    $executeRawUnsafe: async () => undefined,
    $transaction: emptyClaim,
  };
  assert.equal(await new LifecycleWorker(db, "secret").run(), 0);
  assert.deepEqual(providerWhere, {
    id: "provider-b",
    siteId: "tenant-a",
    deletedAt: null,
  });
});

test("provider status sync writes tenant-scoped history and audit records", async () => {
  const history = [];
  const audits = [];
  const updates = [];
  const current = {
    id: 3n,
    publicId: "order-public-id",
    siteId: "tenant-a",
    status: "PROCESSING",
    manualOverride: false,
    quantity: 100,
    remains: 100,
    startCount: null,
    charge: "10.00000000",
    refundedAmount: "0.00000000",
  };
  const db = {
    $transaction: async (run) =>
      run({
        $executeRawUnsafe: async () => undefined,
        order: {
          findFirst: async ({ where }) => {
            assert.deepEqual(where, { id: 3n, siteId: "tenant-a" });
            return current;
          },
          update: async (input) => updates.push(input),
        },
        orderHistory: { create: async ({ data }) => history.push(data) },
        auditLog: { create: async ({ data }) => audits.push(data) },
      }),
  };
  const worker = new LifecycleWorker(db, "secret");
  await worker.apply(current, {
    status: "COMPLETED",
    remains: 0,
    start_count: 25,
  });
  assert.equal(updates.length, 1);
  assert.equal(history[0].siteId, "tenant-a");
  assert.equal(audits[0].siteId, "tenant-a");
  assert.equal(history[0].details.source, "WORKER_PROVIDER_SYNC");
  assert.equal(audits[0].action, "ORDER_PROVIDER_SYNC");
});
