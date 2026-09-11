import assert from "node:assert/strict";
import test from "node:test";
import { PanelManagementService } from "../src/tenant/panel-service.js";

const panel = {
  id: "child",
  siteNumber: 100001n,
  parentSiteId: "root",
  ownerUserId: "owner",
  name: "SMMLike",
  slug: "smmlike",
  status: "ACTIVE",
  createdAt: new Date(),
};

test("numeric and UUID panel references return safe human-readable detail without provider secrets", async () => {
  const references: any[] = [];
  const db: any = {
    site: {
      findFirst: async ({ where }: any) => {
        references.push(where);
        return panel;
      },
      findUnique: async () => ({
        id: "root",
        siteNumber: 100000n,
        name: "dichvu1st.com",
      }),
    },
    siteDomain: {
      findMany: async () => [
        { hostname: "shop.dichvu1st.com", type: "SUBDOMAIN", isPrimary: false },
        { hostname: "smmlike.site", type: "CUSTOM", isPrimary: true },
      ],
    },
    user: {
      findFirst: async () => ({
        id: "owner",
        username: "tenant-owner",
        email: "owner@example.com",
      }),
    },
    panelSubscription: {
      findFirst: async () => ({
        id: "subscription",
        siteId: "child",
        sellerSiteId: "root",
        planId: "plan",
        status: "ACTIVE",
      }),
    },
    panelRentalPlan: {
      findFirst: async () => ({
        id: "plan",
        code: "PANEL_250K",
        permissions: [{ permission: { code: "providers.manage" } }],
      }),
    },
    siteDisabledPermission: { findMany: async () => [] },
    panelRentalPlanPermission: {
      findMany: async () => [{ planId: "plan", permissionId: "provider-perm" }],
    },
    permission: {
      findMany: async () => [{ id: "provider-perm", code: "providers.manage" }],
    },
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  for (const reference of ["100001", "11111111-1111-4111-8111-111111111111"]) {
    const detail = await service.adminPanel(reference);
    assert.equal(detail.panelNumber, "100001");
    assert.equal(detail.primaryDomain, "smmlike.site");
    assert.equal(detail.systemDomain, "shop.dichvu1st.com");
    assert.equal(detail.type, "Panels");
    assert.equal("apiKey" in detail, false);
    assert.equal("configEncrypted" in detail, false);
  }
  assert.equal(references[0].siteNumber, 100001n);
  assert.equal(references[1].id, "11111111-1111-4111-8111-111111111111");
});

test("plan changes preserve site identity and tenant data while changing only subscription entitlement", async () => {
  const writes: any[] = [];
  const tx: any = {
    panelSubscription: {
      findFirst: async () => ({
        id: "sub",
        siteId: "child",
        sellerSiteId: "root",
        planId: "child-plan",
        status: "ACTIVE",
      }),
      update: async ({ data }: any) => {
        writes.push(["subscription", data]);
        return data;
      },
    },
    panelRentalPlan: {
      findFirst: async () => ({ id: "panel-plan", active: true }),
    },
    auditLog: { create: async ({ data }: any) => writes.push(["audit", data]) },
  };
  const db: any = {
    site: { findFirst: async () => panel },
    $transaction: async (fn: any) => fn(tx),
  };
  await new PanelManagementService(db, {} as any, {} as any).changePlan(
    "actor",
    "100001",
    "panel-plan",
    "Nâng cấp theo yêu cầu",
  );
  assert.deepEqual(writes[0], ["subscription", { planId: "panel-plan" }]);
  assert.deepEqual(writes[1][1].after, {
    oldPlanId: "child-plan",
    newPlanId: "panel-plan",
    reason: "Nâng cấp theo yêu cầu",
  });
  assert.equal(
    writes.some(([kind]) =>
      ["site", "wallet", "order", "domain", "provider"].includes(kind),
    ),
    false,
  );
});

test("per-panel overrides can remove plan permissions but never add outside the plan ceiling", async () => {
  const db: any = {
    site: {
      findFirst: async () => panel,
      findUnique: async () => ({ name: "root" }),
    },
    siteDomain: { findMany: async () => [] },
    user: { findFirst: async () => ({ username: "owner" }) },
    panelSubscription: {
      findFirst: async () => ({ planId: "plan", sellerSiteId: "root" }),
    },
    panelRentalPlan: {
      findFirst: async () => ({
        id: "plan",
        permissionCodes: ["orders.view"],
        permissions: [{ permission: { code: "orders.view" } }],
      }),
    },
    siteDisabledPermission: { findMany: async () => [] },
    panelRentalPlanPermission: {
      findMany: async () => [{ planId: "plan", permissionId: "orders-perm" }],
    },
    permission: {
      findMany: async () => [{ id: "orders-perm", code: "orders.view" }],
    },
    $transaction: async (fn: any) =>
      fn({
        permission: {
          findMany: async () => [{ id: "perm", code: "orders.view" }],
        },
        siteDisabledPermission: {
          deleteMany: async () => ({}),
          createMany: async () => ({ count: 1 }),
        },
        auditLog: { create: async () => ({}) },
      }),
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  assert.deepEqual(
    await service.setPermissionOverrides("actor", "100001", ["orders.view"]),
    { disabledPermissionCodes: ["orders.view"] },
  );
  await assert.rejects(
    () =>
      service.setPermissionOverrides("actor", "100001", ["providers.manage"]),
    (e: any) => e.code === "PANEL_PERMISSION_EXCEEDS_PLAN",
  );
});

test("reseller authorization is current, hard-denies Childpanels, and does not require SUPER_ADMIN", async () => {
  let code = "PANEL_250K";
  let resale = true;
  let permission = true;
  const db: any = {
    site: {
      findUnique: async ({ where }: any) =>
        where.id === "seller"
          ? { id: "seller", parentSiteId: "root", status: "ACTIVE" }
          : { id: "root", parentSiteId: null, status: "ACTIVE" },
    },
    panelSubscription: {
      findFirst: async () => ({
        planId: "plan",
        expiresAt: new Date(Date.now() + 60_000),
        plan: { code, active: true, allowPanelResale: resale },
      }),
    },
    panelRentalPlanPermission: {
      findFirst: async () =>
        permission ? { permissionId: "resale-permission" } : null,
    },
    siteDisabledPermission: { findFirst: async () => null },
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  assert.equal(await service.assertResellerAccess("seller"), "seller");
  permission = false;
  await assert.rejects(
    () => service.assertResellerAccess("seller"),
    (error: any) => error.code === "PANEL_RESALE_DENIED",
  );
  permission = true;
  code = "CHILLPANEL";
  await assert.rejects(
    () => service.assertResellerAccess("seller"),
    (error: any) => error.code === "PANEL_RESALE_DENIED",
  );
  code = "PANEL_250K";
  resale = false;
  await assert.rejects(
    () => service.assertResellerAccess("seller"),
    (error: any) => error.code === "PANEL_RESALE_DENIED",
  );
});

test("numeric and UUID lookups apply direct seller scope in the database query", async () => {
  const queries: any[] = [];
  const db: any = {
    site: {
      findFirst: async ({ where }: any) => {
        queries.push(where);
        return null;
      },
    },
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  for (const reference of ["100001", "11111111-1111-4111-8111-111111111111"])
    await assert.rejects(() => service.adminPanel(reference, "seller"));
  assert.deepEqual(
    queries.map((where) => where.parentSiteId),
    ["seller", "seller"],
  );
  assert.equal(queries[0].siteNumber, 100001n);
  assert.equal(queries[1].id, "11111111-1111-4111-8111-111111111111");
});
