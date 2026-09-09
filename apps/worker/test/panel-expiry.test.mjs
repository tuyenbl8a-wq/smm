import test from "node:test";
import assert from "node:assert/strict";
import { PanelExpiryWorker } from "../dist/panel-expiry.js";

test("panel expiry advances lifecycle without deleting data or touching root", async () => {
  const updates = [],
    sites = [];
  const db = {
    $transaction: (fn) =>
      fn({
        panelSubscription: {
          findMany: async ({ where }) =>
            where.autoRenew
              ? []
              : where.status === "ACTIVE"
                ? [{ id: "s1", siteId: "child" }]
                : [{ id: "s1", siteId: "child" }],
          update: async (x) => updates.push(x),
        },
        site: { updateMany: async (x) => sites.push(x) },
      }),
  };
  const result = await new PanelExpiryWorker(db).once(new Date());
  assert.deepEqual(result, {
    renewed: 0,
    renewFailed: 0,
    pastDue: 1,
    suspended: 1,
  });
  assert.equal(updates.length, 2);
  assert.deepEqual(sites[0].where, {
    id: "child",
    parentSiteId: { not: null },
  });
});

test("panel expiry automatically renews once with an idempotent wallet debit", async () => {
  const created = [],
    subscriptions = [],
    sites = [];
  const row = {
    id: "sub",
    siteId: "child",
    sellerSiteId: "seller",
    renterUserId: "user",
    expiresAt: new Date("2026-09-01T00:00:00Z"),
    plan: { price: "100.00000000", billingDays: 30 },
  };
  const db = {
    $transaction: (fn) =>
      fn({
        panelSubscription: {
          findMany: async ({ where }) => (where.autoRenew ? [row] : []),
          update: async (x) => subscriptions.push(x),
        },
        walletTransaction: {
          findUnique: async () => null,
          create: async (x) => created.push(x),
        },
        site: { updateMany: async (x) => sites.push(x) },
        $queryRawUnsafe: async () => [
          { id: "wallet", before: "200", after: "100" },
        ],
      }),
  };
  const result = await new PanelExpiryWorker(db).once(
    new Date("2026-09-08T00:00:00Z"),
  );
  assert.deepEqual(result, {
    renewed: 1,
    renewFailed: 0,
    pastDue: 0,
    suspended: 0,
  });
  assert.equal(created[0].data.type, "PANEL_RENEWAL");
  assert.match(created[0].data.idempotencyKey, /^panel-auto-renew:/);
  assert.equal(subscriptions[0].data.status, "ACTIVE");
  assert.equal(sites[0].data.status, "ACTIVE");
});
