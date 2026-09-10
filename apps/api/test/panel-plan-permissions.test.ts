import assert from "node:assert/strict";
import test from "node:test";
import { applyPanelEntitlement, PrismaAuthStore } from "../src/auth/store.js";
import { PanelManagementService } from "../src/tenant/panel-service.js";
import {
  CHILLPANEL_PERMISSION_CODES,
  PANEL_250K_PERMISSION_CODES,
} from "../src/tenant/panel-permissions.js";

const management = (db: any) =>
  new PanelManagementService(db, {} as any, {} as any);

test("plan create deduplicates and persists permissionCodes transactionally", async () => {
  const writes: any[] = [];
  const tx: any = {
    permission: {
      findMany: async ({ where }: any) =>
        where.code.in.map((code: string) => ({ id: `p:${code}`, code })),
    },
    panelRentalPlan: {
      create: async ({ data }: any) => ({ id: "plan", ...data }),
    },
    panelRentalPlanPermission: {
      deleteMany: async (query: any) => writes.push(["delete", query]),
      createMany: async (query: any) => writes.push(["create", query]),
    },
  };
  const db = { $transaction: async (fn: any) => fn(tx) };
  const result = await management(db).savePlan("seller", {
    code: "CHILLPANEL",
    name: "Chill",
    price: "1",
    billingDays: 30,
    maxDirectChildren: 0,
    maxDepth: 1,
    permissionCodes: ["services.view", "services.view", "orders.view"],
  });
  assert.deepEqual(result.permissionCodes, ["services.view", "orders.view"]);
  assert.equal(writes[1][1].data.length, 2);
});

test("plan list returns permissionCodes and edit replaces only seller-owned mappings", async () => {
  const db: any = {
    panelRentalPlan: {
      findMany: async ({ where }: any) => [
        { id: "plan", sellerSiteId: where.sellerSiteId },
      ],
      findFirst: async ({ where }: any) => ({
        id: where.id,
        sellerSiteId: where.sellerSiteId,
      }),
    },
    panelRentalPlanPermission: {
      findMany: async () => [{ planId: "plan", permissionId: "permission" }],
    },
    permission: {
      findMany: async () => [{ id: "permission", code: "services.view" }],
    },
  };
  assert.deepEqual(
    (await management(db).adminPlans("seller"))[0].permissionCodes,
    ["services.view"],
  );
  assert.deepEqual(
    (await management(db).adminPlan("seller", "plan")).permissionCodes,
    ["services.view"],
  );
  const foreign = {
    $transaction: async (fn: any) =>
      fn({ panelRentalPlan: { findFirst: async () => null } }),
  };
  await assert.rejects(
    () =>
      management(foreign).savePlan(
        "seller-a",
        {
          code: "X",
          name: "X",
          price: "1",
          billingDays: 1,
          maxDirectChildren: 0,
          maxDepth: 1,
          permissionCodes: [],
        },
        "foreign-plan",
      ),
    (error: any) => error.code === "PLAN_NOT_FOUND",
  );
});

test("plan edit transaction replaces mappings for the seller-owned plan", async () => {
  const writes: string[] = [];
  const tx: any = {
    panelRentalPlan: {
      findFirst: async ({ where }: any) =>
        where.sellerSiteId === "seller" ? { id: "plan" } : null,
      update: async ({ data }: any) => ({ id: "plan", ...data }),
    },
    permission: {
      findMany: async ({ where }: any) =>
        where.code.in.map((code: string) => ({ id: code, code })),
    },
    panelRentalPlanPermission: {
      deleteMany: async () => writes.push("delete"),
      createMany: async () => writes.push("create"),
    },
  };
  const result = await management({
    $transaction: async (fn: any) => fn(tx),
  }).savePlan(
    "seller",
    {
      code: "CHILLPANEL",
      name: "Chill",
      price: "1",
      billingDays: 30,
      maxDirectChildren: 0,
      maxDepth: 1,
      permissionCodes: ["services.view"],
    },
    "plan",
  );
  assert.deepEqual(writes, ["delete", "create"]);
  assert.deepEqual(result.permissionCodes, ["services.view"]);
});

test("unknown and non-tenant-safe plan permissions are rejected", async () => {
  const service = management({});
  const base = {
    code: "X",
    name: "X",
    price: "1",
    billingDays: 1,
    maxDirectChildren: 0,
    maxDepth: 1,
  };
  await assert.rejects(
    () =>
      service.savePlan("seller", {
        ...base,
        permissionCodes: ["unknown.permission"],
      }),
    (error: any) => error.code === "PLAN_PERMISSION_UNSAFE",
  );
  await assert.rejects(
    () =>
      service.savePlan("seller", { ...base, permissionCodes: "services.view" }),
    (error: any) => error.code === "PLAN_PERMISSIONS_INVALID",
  );
});

test("CHILLPANEL and PANEL_250K profiles enforce the required capability boundary", () => {
  for (const code of ["services.create", "services.import", "providers.manage"])
    assert.equal(CHILLPANEL_PERMISSION_CODES.includes(code as any), false);
  for (const code of [
    "services.presentation.manage",
    "services.pricing.manage",
    "services.toggle",
  ])
    assert.equal(CHILLPANEL_PERMISSION_CODES.includes(code as any), true);
  for (const code of [
    "services.create",
    "services.import",
    "providers.manage",
    "providers.sync",
  ])
    assert.equal(PANEL_250K_PERMISSION_CODES.includes(code as any), true);
  assert.equal(
    PANEL_250K_PERMISSION_CODES.includes("SUPER_ADMIN" as any),
    false,
  );
});

test("active subscription entitlement is read on every request so stale grants cannot bypass plan edits", async () => {
  let entitled = ["services.view", "providers.manage"];
  const db: any = {
    site: { findUnique: async () => ({ ownerUserId: "owner" }) },
    panelSubscription: { findFirst: async () => ({ planId: "plan" }) },
    panelRentalPlanPermission: {
      findMany: async () => entitled.map((code) => ({ permissionId: code })),
    },
    permission: {
      findMany: async ({ where }: any) =>
        where.id.in.map((code: string) => ({ code })),
    },
  };
  const store = new PrismaAuthStore(db);
  assert.deepEqual(
    (await store.panelEntitlements("child"))!.permissionCodes,
    entitled,
  );
  entitled = ["services.view"];
  assert.deepEqual((await store.panelEntitlements("child"))!.permissionCodes, [
    "services.view",
  ]);
});

test("owner receives plan permissions while staff grants are intersected with the plan ceiling", () => {
  const entitlement = {
    ownerUserId: "owner",
    permissionCodes: ["services.view"],
  };
  assert.deepEqual(
    applyPanelEntitlement(
      "owner",
      { roles: ["ADMIN"], permissions: [] },
      entitlement,
    ).permissions,
    ["services.view"],
  );
  const staff = applyPanelEntitlement(
    "staff",
    {
      roles: ["STAFF", "SUPER_ADMIN"],
      permissions: ["services.view", "providers.manage"],
    },
    entitlement,
  );
  assert.deepEqual(staff.permissions, ["services.view"]);
  assert.deepEqual(staff.roles, ["STAFF"]);
});
