import assert from "node:assert/strict";
import test from "node:test";
import { PanelManagementService } from "../src/tenant/panel-service.js";

test("admin Panel list loads plan metadata by planId without querying a missing relation", async () => {
  const subscriptionQuery: any[] = [];
  const db: any = {
    site: {
      findMany: async () => [
        {
          id: "child-site",
          siteNumber: 100001n,
          parentSiteId: "parent-site",
          panelType: "PANEL",
          ownerUserId: "owner",
          name: "Child Panel",
          slug: "child-panel",
          status: "ACTIVE",
          depth: 1,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
        },
      ],
      findUnique: async () => ({ siteNumber: 100000n, name: "Parent Panel" }),
    },
    user: { findUnique: async () => ({ username: "owner", email: "owner@example.test" }) },
    siteDomain: { findFirst: async () => ({ hostname: "child.example.test" }) },
    panelSubscription: {
      findFirst: async (query: any) => {
        subscriptionQuery.push(query);
        return {
          status: "ACTIVE",
          startedAt: new Date("2026-01-01T00:00:00Z"),
          expiresAt: new Date("2026-02-01T00:00:00Z"),
          graceUntil: new Date("2026-02-08T00:00:00Z"),
          autoRenew: true,
          planId: "plan-1",
        };
      },
    },
    panelRentalPlan: {
      findUnique: async ({ where, select }: any) => {
        assert.deepEqual(where, { id: "plan-1" });
        assert.equal(select.permissions.select.permission.select.code, true);
        return {
          id: "plan-1",
          name: "Professional",
          code: "PRO",
          allowThemes: true,
          permissions: [{ permission: { code: "providers.manage" } }],
        };
      },
    },
  };
  const service = new PanelManagementService(db, {} as any, {} as any);
  const [row] = await service.adminPanels(new URLSearchParams());

  assert.equal(subscriptionQuery[0].select.plan, undefined);
  assert.equal(subscriptionQuery[0].select.planId, true);
  assert.equal(row.type, "PANELS");
  assert.equal(row.primaryDomain, "child.example.test");
  assert.equal(row.subscription.plan.name, "Professional");
  assert.equal(row.subscription.plan.allowThemes, true);
  assert.deepEqual(row.subscription.plan.permissionCodes, ["providers.manage"]);
});
