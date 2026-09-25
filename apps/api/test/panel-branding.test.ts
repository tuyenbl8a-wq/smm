import assert from "node:assert/strict";
import test from "node:test";
import { PanelManagementService } from "../src/tenant/panel-service.js";

test("branding PATCH reads the exact saved values back through owned panel detail", async () => {
  const childA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const childB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const root = "00000000-0000-4000-8000-000000000001";
  const settings = new Map<string, unknown>();
  const db: any = {
    site: {
      findMany: async ({ where }: any) =>
        where.parentSiteId === root &&
        where.id.in.includes(childA) &&
        where.siteNumber === 101n
          ? [{ id: childA, siteNumber: 101n, parentSiteId: root, ownerUserId: "child-owner-a", name: "Old site name" }]
          : [],
    },
    panelSubscription: {
      findMany: async ({ where }: any) =>
        where.sellerSiteId === root && where.renterUserId === "renter-a"
          ? [{ siteId: childA, sellerSiteId: root, renterUserId: "renter-a", planId: "plan-a", status: "ACTIVE", autoRenew: false }]
          : [],
      update: async () => { throw new Error("GET or branding must not write autoRenew"); },
    },
    panelRentalPlan: { findUnique: async () => null },
    siteDomain: { findMany: async () => [] },
    setting: {
      findMany: async ({ where }: any) =>
        [...settings].filter(([key]) => where.siteId === childA && key.startsWith(`${childA}:`))
          .map(([key, value]) => ({ key: key.split(":")[1], value })),
      upsert: async ({ where, create, update }: any) => {
        const { siteId, key } = where.siteId_group_key;
        settings.set(`${siteId}:${key}`, update.value ?? create.value);
      },
    },
    $transaction: async (fn: any) => fn(db),
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  await service.branding(root, "renter-a", "101", {
    siteName: "A brand",
    logo: "https://a.example/logo.png",
    siteDescription: "Child A description",
  });
  const detail = await service.owned(root, "renter-a", "101");
  assert.equal(detail.subscriptions[0].autoRenew, false);
  assert.deepEqual(detail.branding, {
    siteName: "A brand",
    logo: "https://a.example/logo.png",
    siteDescription: "Child A description",
  });
  assert.equal(settings.has(`${root}:siteName`), false);
  assert.equal(settings.has(`${childB}:siteName`), false);
  await assert.rejects(
    () => service.branding(root, "renter-b", "101", { siteName: "B takeover" }),
    (error: any) => error.code === "PANEL_FORBIDDEN",
  );
});
