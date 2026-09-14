import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PromotionService } from "../src/promotion/service.js";
import { SiteSettlementService } from "../src/order/site-settlement.js";
import { CHILLPANEL_PERMISSION_CODES, PANEL_250K_PERMISSION_CODES } from "../src/tenant/panel-permissions.js";

const requiredNavPermissions = [
  "reports.read", "orders.view", "users.view", "staff.view", "services.view",
  "providers.view", "users.pricing.manage", "services.pricing.manage",
  "payments.view", "coupons.view", "support.view", "audit.view", "settings.view",
];

test("Admin navigation uses only canonical grantable panel permissions", async () => {
  const source = await readFile(new URL("../../../web-v2/src/admin.ts", import.meta.url), "utf8");
  for (const permission of requiredNavPermissions) {
    assert.match(source, new RegExp(`\\"${permission.replaceAll(".", "\\.")}\\"`));
    assert.equal(PANEL_250K_PERMISSION_CODES.includes(permission as any), true);
  }
  assert.doesNotMatch(source, /"(?:pricing\.view|pricing\.manage|audit\.read|logs\.read)"/);
  for (const forbidden of ["services.create", "services.import", "providers.manage", "providers.sync", "panels.resale.manage"])
    assert.equal(CHILLPANEL_PERMISSION_CODES.includes(forbidden as any), false);
});

test("affiliate administration and customer summary are tenant scoped", async () => {
  const calls: any[] = [];
  const db: any = {
    affiliate: { findFirst: async ({ where }: any) => (calls.push(["affiliate", where]), { id: "a", code: "A", siteId: where.siteId }) },
    referral: {
      count: async ({ where }: any) => (calls.push(["count", where]), 0),
      findMany: async ({ where }: any) => (calls.push(["referrals", where]), []),
    },
    affiliateCommission: { findMany: async ({ where }: any) => (calls.push(["commissions", where]), []) },
  };
  const service = new PromotionService(db);
  await service.referralSummary("user-a", "tenant-a");
  await service.adminReferrals("tenant-a");
  assert.equal(calls.every(([, where]) => where.siteId === "tenant-a"), true);
});

test("child settlement starts at the service-owning parent and cannot cross hierarchy", async () => {
  const sites: any = {
    root: { id: "root", parentSiteId: null },
    panel: { id: "panel", parentSiteId: "root" },
    child: { id: "child", parentSiteId: "panel", ownerUserId: "child-owner" },
  };
  const tx: any = {
    site: { findUnique: async ({ where }: any) => sites[where.id] },
    siteServiceRule: { findUnique: async () => ({ active: true, fixedRate: "25.00000000" }) },
  };
  const edges = await new SiteSettlementService({}).quote(
    tx,
    "child",
    { id: "service", siteId: "panel", rate: "20.00000000" },
    1000,
  );
  assert.deepEqual(edges, [{
    childSiteId: "child", parentSiteId: "panel", payerUserId: "child-owner",
    upstreamRate: "20.00000000", upstreamCharge: "20.00000000",
  }]);
  await assert.rejects(
    () => new SiteSettlementService({}).quote(tx, "child", { id: "foreign", siteId: "sibling", rate: "1" }, 1000),
    (error: any) => error.code === "SERVICE_UNAVAILABLE",
  );
});
