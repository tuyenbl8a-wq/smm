import assert from "node:assert/strict";
import test from "node:test";
import { PanelManagementService } from "../src/tenant/panel-service.js";

const panelBase = {
  id: "child-site",
  siteNumber: 100001n,
  parentSiteId: "parent-site",
  ownerUserId: "owner",
  status: "ACTIVE",
};

function harness(panelType: "PANEL" | "CHILD_PANEL", activeOrders = 0) {
  const panel: any = { ...panelBase, panelType };
  const writes: any[] = [];
  const locks: string[] = [];
  const impactQueries: any[] = [];
  const tx: any = {
    $queryRawUnsafe: async (sql: string) => {
      locks.push(sql);
      return [];
    },
    site: {
      findUnique: async () => ({ ...panel }),
      update: async ({ data }: any) => {
        writes.push(["site.update", data]);
        Object.assign(panel, data);
        return { ...panel };
      },
    },
    provider: {
      findMany: async (query: any) => {
        impactQueries.push(["provider.findMany", query]);
        return [{ id: "provider-owned" }];
      },
      updateMany: async (query: any) => writes.push(["provider.updateMany", query]),
    },
    providerService: {
      findMany: async (query: any) => {
        impactQueries.push(["providerService.findMany", query]);
        return [{ id: "provider-service-a" }];
      },
    },
    serviceMapping: {
      findMany: async (query: any) => {
        impactQueries.push(["serviceMapping.findMany", query]);
        return [
          { id: "mapping-a", serviceId: "external-service-a", active: true },
          { id: "mapping-b", serviceId: "external-service-b", active: true },
        ];
      },
      updateMany: async (query: any) => writes.push(["serviceMapping.updateMany", query]),
    },
    service: {
      findMany: async (query: any) => {
        impactQueries.push(["service.findMany", query]);
        return [{ id: "external-service-a" }];
      },
      updateMany: async (query: any) => writes.push(["service.updateMany", query]),
    },
    order: {
      count: async (query: any) => {
        impactQueries.push(["order.count", query]);
        return activeOrders;
      },
    },
    auditLog: {
      create: async ({ data }: any) => (writes.push(["audit", data]), data),
    },
  };
  const db: any = {
    site: { findFirst: async () => ({ ...panel }) },
    $transaction: async (run: any) => run(tx),
    provider: tx.provider,
    providerService: tx.providerService,
    serviceMapping: tx.serviceMapping,
    service: tx.service,
    order: tx.order,
  };
  return {
    panel,
    writes,
    locks,
    impactQueries,
    service: new PanelManagementService(db, {} as any, {} as any),
  };
}

test("Child Panel upgrade changes only explicit type and preserves tenant identity without billing", async () => {
  const h = harness("CHILD_PANEL");
  const result = await h.service.convertPanelType(
    "super-admin",
    "100001",
    "PANEL",
    "Được phép quản lý nguồn dịch vụ",
  );

  assert.equal(result.panelType, "PANEL");
  assert.equal(h.panel.id, "child-site");
  assert.equal(h.panel.siteNumber, 100001n);
  assert.equal(h.panel.parentSiteId, "parent-site");
  assert.deepEqual(h.writes[0], ["site.update", { panelType: "PANEL" }]);
  assert.equal(h.writes.some(([kind]) => /wallet|order|subscription|domain|user/i.test(kind)), false);
  assert.equal(h.writes[h.writes.length - 1][1].action, "PANEL_TYPE_CONVERSION");
  assert.equal(h.impactQueries.length, 0);
});

test("downgrade preview counts only providers, mappings, active external services and active provider orders", async () => {
  const h = harness("PANEL", 2);
  const result = await h.service.panelTypeConversionPreview("100001", "CHILD_PANEL");

  assert.equal(result.allowed, false);
  assert.deepEqual(result.impact, {
    externalProviders: 1,
    mappings: 2,
    servicesRemovedFromCatalog: 1,
    activeExternalOrders: 2,
  });
  const orderQuery = h.impactQueries.find(([kind]) => kind === "order.count")[1];
  assert.deepEqual(orderQuery.where.status.in, ["PENDING", "PROCESSING", "IN_PROGRESS"]);
  assert.deepEqual(h.writes, []);
});

test("downgrade with active external orders is blocked before any mutation", async () => {
  const h = harness("PANEL", 1);
  await assert.rejects(
    () => h.service.convertPanelType("super-admin", "100001", "CHILD_PANEL", "Giảm quyền NCC"),
    (error: any) => error.code === "PANEL_ACTIVE_EXTERNAL_ORDERS",
  );

  assert.deepEqual(h.writes, []);
  assert.equal(h.panel.panelType, "PANEL");
  assert.equal(h.locks.length, 1);
});

test("safe downgrade disables provider use and local external catalog while preserving hierarchy and audit history", async () => {
  const h = harness("PANEL");
  const result = await h.service.convertPanelType(
    "super-admin",
    "100001",
    "CHILD_PANEL",
    "Chuyển sang mô hình dùng dịch vụ cha",
  );

  assert.equal(result.panelType, "CHILD_PANEL");
  assert.equal(h.panel.id, "child-site");
  assert.equal(h.panel.siteNumber, 100001n);
  assert.equal(h.panel.parentSiteId, "parent-site");
  const providerWrite = h.writes.find(([kind]) => kind === "provider.updateMany")[1];
  assert.deepEqual(providerWrite.where, { id: { in: ["provider-owned"] }, siteId: "child-site" });
  assert.equal(providerWrite.data.status, "INACTIVE");
  assert.equal(providerWrite.data.autoSyncEnabled, false);
  const mappingWrite = h.writes.find(([kind]) => kind === "serviceMapping.updateMany")[1];
  assert.deepEqual(mappingWrite.where.providerServiceId.in, ["provider-service-a"]);
  assert.deepEqual(mappingWrite.data, { active: false });
  const serviceWrite = h.writes.find(([kind]) => kind === "service.updateMany")[1];
  assert.deepEqual(serviceWrite.where.id.in.sort(), ["external-service-a", "external-service-b"]);
  assert.equal(serviceWrite.where.siteId, "child-site");
  assert.deepEqual(serviceWrite.data, { active: false });
  const audit = h.writes.find(([kind]) => kind === "audit")[1];
  assert.equal(audit.action, "PANEL_TYPE_CONVERSION");
  assert.equal(audit.after.reason, "Chuyển sang mô hình dùng dịch vụ cha");
  assert.deepEqual(audit.after.impact, result.impact);
  assert.equal(h.writes.some(([kind]) => /wallet|order|refund/i.test(kind)), false);
});


test("reseller conversion preview and change reject panels outside the direct seller scope", async () => {
  const queries: any[] = [];
  let transactionStarted = false;
  const db: any = {
    site: { findFirst: async ({ where }: any) => {
      queries.push(where);
      return where.parentSiteId === "parent-site" ? { ...panelBase, panelType: "CHILD_PANEL" } : null;
    } },
    $transaction: async () => { transactionStarted = true; },
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  const own = await service.panelTypeConversionPreview("100001", "PANEL", "parent-site");
  assert.equal(own.siteId, panelBase.id);
  await assert.rejects(() => service.panelTypeConversionPreview("100001", "PANEL", "other-seller"),
    (error: any) => error.code === "PANEL_NOT_FOUND");
  await assert.rejects(() => service.convertPanelType("actor", "100001", "PANEL", "Upgrade", "other-seller"),
    (error: any) => error.code === "PANEL_NOT_FOUND");
  assert.equal(transactionStarted, false);
  assert.deepEqual(queries.map((where) => where.parentSiteId), ["parent-site", "other-seller", "other-seller"]);
});

test("conversion impact excludes the managed parent connection", async () => {
  const h = harness("PANEL");
  await h.service.panelTypeConversionPreview("100001", "CHILD_PANEL");
  const providerQuery = h.impactQueries.find(([kind]) => kind === "provider.findMany")[1];
  assert.deepEqual(providerQuery.where, { siteId: "child-site", managedParentSiteId: null, deletedAt: null });
});
