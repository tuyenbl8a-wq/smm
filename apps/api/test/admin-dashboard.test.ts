import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminActivity, canAccessAdmin } from "../src/admin/dashboard.js";

test("ordinary users cannot access admin APIs", () => {
  assert.equal(canAccessAdmin({ roles: ["USER"], permissions: [] }), false);
});

test("SUPER_ADMIN and explicitly permitted staff can access admin APIs", () => {
  assert.equal(
    canAccessAdmin({ roles: ["SUPER_ADMIN"], permissions: [] }),
    true,
  );
  assert.equal(
    canAccessAdmin({ roles: ["STAFF"], permissions: ["reports.read"] }),
    true,
  );
  assert.equal(
    canAccessAdmin({ roles: ["STAFF"], permissions: ["orders.read"] }),
    false,
  );
});

test("admin activity uses order snapshots and exact eight-place decimals", () => {
  const result = buildAdminActivity(
    [
      {
        createdAt: new Date("2026-08-18T01:00:00Z"),
        charge: "10.00000001",
        providerCost: "7.00000000",
        profit: "3.00000001",
      },
      {
        createdAt: new Date("2026-08-18T20:00:00Z"),
        charge: "0.00000002",
        providerCost: "0.00000001",
        profit: "0.00000001",
      },
    ],
    new Date("2026-08-18T22:00:00Z"),
  );
  assert.equal(result.length, 7);
  assert.deepEqual(result[6], {
    date: "2026-08-18",
    orders: 2,
    revenue: "10.00000003",
    providerCost: "7.00000001",
    profit: "3.00000002",
  });
});
