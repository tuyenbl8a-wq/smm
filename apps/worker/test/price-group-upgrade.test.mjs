import assert from "node:assert/strict";
import test from "node:test";
import { PriceGroupUpgradeWorker } from "../dist/price-group-upgrade.js";

const fixture = ({ deposits = "100", spent = "50", completed = 2 } = {}) => {
  let current = "retail";
  const histories = [],
    audits = [];
  const groups = [
    { id: "retail", code: "RETAIL", name: "Khách lẻ", tierOrder: 0 },
    {
      id: "vip",
      code: "CUSTOM_VIP",
      name: "VIP tùy chỉnh",
      tierOrder: 1,
      upgradeEnabled: true,
      upgradeMatchMode: "ALL",
      minSuccessfulDeposits: "100",
      minTotalSpent: "50",
      minCompletedOrders: 2,
    },
  ];
  const tx = {
    user: {
      updateMany: async ({ where, data }) => {
        if (where.priceGroupId !== current) return { count: 0 };
        current = data.priceGroupId;
        return { count: 1 };
      },
    },
    priceGroupHistory: { create: async ({ data }) => histories.push(data) },
    auditLog: { create: async ({ data }) => audits.push(data) },
  };
  const db = {
    setting: {
      findMany: async () => [
        { key: "autoUpgradeEnabled", value: true },
        { key: "autoDowngradeEnabled", value: false },
      ],
    },
    priceGroup: { findMany: async () => groups },
    user: {
      findMany: async () =>
        current === "retail"
          ? [{ id: "user", priceGroupId: current }]
          : [{ id: "user", priceGroupId: current }],
      updateMany: async () => ({ count: 1 }),
    },
    deposit: { aggregate: async () => ({ _sum: { netAmount: deposits } }) },
    order: {
      aggregate: async () => ({ _sum: { charge: spent, refundedAmount: "0" } }),
      count: async () => completed,
    },
    $transaction: async (run) => run(tx),
  };
  return {
    worker: new PriceGroupUpgradeWorker(db),
    histories,
    audits,
    current: () => current,
  };
};

test("qualified user upgrades exactly one dynamic tier and records AUTO history", async () => {
  const state = fixture();
  assert.deepEqual(await state.worker.once(), {
    evaluated: 1,
    upgraded: 1,
    downgraded: 0,
  });
  assert.equal(state.current(), "vip");
  assert.equal(state.histories[0].source, "AUTO");
  assert.equal(state.histories[0].actorId, undefined);
  assert.equal(state.audits[0].action, "USER_PRICE_GROUP_AUTO_UPGRADE");
  assert.deepEqual(await state.worker.once(), {
    evaluated: 1,
    upgraded: 0,
    downgraded: 0,
  });
  assert.equal(state.histories.length, 1);
});

test("missing any ALL condition prevents upgrade and never downgrades", async () => {
  const state = fixture({ deposits: "99.99999999" });
  assert.deepEqual(await state.worker.once(), {
    evaluated: 1,
    upgraded: 0,
    downgraded: 0,
  });
  assert.equal(state.current(), "retail");
  assert.equal(state.histories.length, 0);
});

test("concurrent workers cannot double-upgrade or skip a tier", async () => {
  const state = fixture();
  const results = await Promise.all([state.worker.once(), state.worker.once()]);
  assert.equal(
    results.reduce((sum, row) => sum + row.upgraded, 0),
    1,
  );
  assert.equal(state.current(), "vip");
  assert.equal(state.histories.length, 1);
});
