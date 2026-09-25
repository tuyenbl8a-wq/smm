import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";
import { PanelManagementService, PanelService } from "../src/tenant/panel-service.js";

const ROOT = "00000000-0000-4000-8000-000000000001";
const ROOT_2 = "00000000-0000-4000-8000-000000000002";
const RENTER_A = "root-renter-a";
const RENTER_B = "root-renter-b";

function ownershipFixture() {
  const sites: any[] = [
    { id: "child-a", siteNumber: 101n, parentSiteId: ROOT, ownerUserId: "child-a-user", name: "Child A", deletedAt: null },
    { id: "child-b", siteNumber: 102n, parentSiteId: ROOT, ownerUserId: "child-b-user", name: "Child B", deletedAt: null },
    { id: "child-c", siteNumber: 201n, parentSiteId: ROOT_2, ownerUserId: "child-c-user", name: "Child C", deletedAt: null },
  ];
  const subscriptions: any[] = [
    { id: "sub-a", siteId: "child-a", sellerSiteId: ROOT, renterUserId: RENTER_A, planId: "plan-a", status: "ACTIVE", expiresAt: new Date("2027-01-01"), graceUntil: new Date("2027-01-08"), autoRenew: false, createdAt: new Date("2026-01-01") },
    { id: "sub-b", siteId: "child-b", sellerSiteId: ROOT, renterUserId: RENTER_B, planId: "plan-b", status: "ACTIVE", expiresAt: new Date("2027-02-01"), graceUntil: new Date("2027-02-08"), autoRenew: false, createdAt: new Date("2026-02-01") },
    { id: "sub-c", siteId: "child-c", sellerSiteId: ROOT_2, renterUserId: RENTER_A, planId: "plan-c", status: "ACTIVE", expiresAt: new Date("2027-03-01"), graceUntil: new Date("2027-03-08"), autoRenew: false, createdAt: new Date("2026-03-01") },
  ];
  const domains: any[] = [
    { id: "verified-a", siteId: "child-a", hostname: "a.example", type: "CUSTOM", status: "VERIFIED", isPrimary: false, providerZoneId: "zone-a", assignedNameservers: ["ns1.test", "ns2.test"] },
    { id: "pending-a", siteId: "child-a", hostname: "pending-a.example", type: "CUSTOM", status: "PENDING", isPrimary: false, providerZoneId: "zone-pending-a", assignedNameservers: ["ns1.test", "ns2.test"] },
    { id: "domain-b", siteId: "child-b", hostname: "b.example", type: "CUSTOM", status: "VERIFIED", isPrimary: true, providerZoneId: "zone-b", assignedNameservers: ["ns1.test", "ns2.test"] },
    { id: "domain-c", siteId: "child-c", hostname: "c.example", type: "CUSTOM", status: "VERIFIED", isPrimary: true, providerZoneId: "zone-c", assignedNameservers: ["ns1.test", "ns2.test"] },
  ];
  const settings = new Map<string, unknown>();
  const events: any[] = [];
  const auditEvents: any[] = [];
  const db: any = {
    site: {
      findMany: async ({ where }: any) => sites.filter((site) =>
        where.id?.in.includes(site.id) && site.parentSiteId === where.parentSiteId &&
        site.deletedAt === null && (where.siteNumber === undefined || site.siteNumber === where.siteNumber)),
      update: async ({ where, data }: any) => {
        const site = sites.find((row) => row.id === where.id);
        Object.assign(site, data);
        return site;
      },
    },
    panelSubscription: {
      findMany: async ({ where }: any) => subscriptions
        .filter((row) => row.sellerSiteId === where.sellerSiteId && row.renterUserId === where.renterUserId && (!where.siteId || row.siteId === where.siteId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      findUnique: async ({ where }: any) => subscriptions.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const row = subscriptions.find((item) => item.id === where.id);
        Object.assign(row, data);
        events.push(["auto-renew", row.siteId, row.autoRenew]);
        return row;
      },
    },
    panelRentalPlan: { findUnique: async ({ where }: any) => ({ id: where.id, allowCustomDomain: true }) },
    siteDomain: {
      findMany: async ({ where }: any) => domains.filter((domain) => domain.siteId === where.siteId && (where.isPrimary === undefined || domain.isPrimary === where.isPrimary) && (where.status === undefined || domain.status === where.status)).map((domain) => where.select?.hostname ? { hostname: domain.hostname } : domain),
      findFirst: async ({ where }: any) => domains.find((domain) => Object.entries(where).every(([key, value]) => (domain as any)[key] === value)) ?? null,
      create: async ({ data }: any) => { const domain = { id: `domain-${domains.length}`, ...data }; domains.push(domain); events.push(["domain-create", domain.siteId]); return domain; },
      updateMany: async ({ where, data }: any) => {
        const rows = domains.filter((domain) => Object.entries(where).every(([key, value]) => (domain as any)[key] === value));
        rows.forEach((domain) => Object.assign(domain, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: any) => {
        const domain = domains.find((row) => row.id === where.id);
        Object.assign(domain, data);
        return domain;
      },
    },
    setting: {
      findMany: async ({ where }: any) => [...settings].filter(([key]) => String(key).startsWith(`${where.siteId}:`)).map(([key, value]) => ({ key: String(key).split(":")[1], value })),
      upsert: async ({ where, create, update }: any) => settings.set(`${where.siteId_group_key.siteId}:${where.siteId_group_key.key}`, update.value ?? create.value),
    },
    auditLog: { create: async ({ data }: any) => {
      const event = { ...data, createdAt: new Date() };
      auditEvents.push(event);
      return event;
    } },
    $queryRawUnsafe: async (_sql: string, subscriptionId: string, panelId: string, sellerSiteId: string, renterUserId: string) => {
      const row = subscriptions.find((item) =>
        item.id === subscriptionId && item.siteId === panelId &&
        item.sellerSiteId === sellerSiteId && item.renterUserId === renterUserId);
      return row ? [{ auto_renew: row.autoRenew }] : [];
    },
    $transaction: async (run: any) => run(db),
  };
  const dns: any = {
    createZone: async (hostname: string) => ({ zoneId: `zone-${hostname}`, nameservers: ["ns1.test", "ns2.test"], created: true }),
    getZoneStatus: async () => "ACTIVE",
    getAssignedNameservers: async () => ["ns1.test", "ns2.test"],
    ensurePanelRouting: async () => undefined,
    deleteZone: async () => undefined,
  };
  const renewalCalls: any[] = [];
  const rental: any = { renew: async (...args: any[]) => (renewalCalls.push(args), { expiresAt: new Date("2027-01-31") }) };
  const service = new PanelManagementService(db, rental, dns);
  return { db, sites, subscriptions, domains, settings, events, auditEvents, renewalCalls, service };
}

function getRequest(path: string) {
  return { method: "GET", url: path, headers: {}, socket: {}, on: () => undefined } as any;
}

async function httpGet(service: PanelManagementService, userId: string, path: string) {
  const handler: any = Reflect.construct(AuthHandler, [
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: "ownership-test-secret-with-entropy" } as any,
    ...Array(12).fill(undefined),
    service,
  ]);
  handler.authenticate = async () => ({ user: { id: userId, siteId: ROOT }, access: { roles: ["CUSTOMER"], permissions: [] }, rawToken: "test-token" });
  const response: any = { statusCode: 200, setHeader: () => undefined, end: (value: string) => { response.body = JSON.parse(value); } };
  await handler.handle(getRequest(path), response, path, { id: ROOT, siteNumber: 100000n, parentSiteId: null, status: "ACTIVE", depth: 0 });
  return response;
}

test("parent renter owns panels through subscription scope, while child-local owner identity remains separate", async () => {
  const f = ownershipFixture();
  const list = await httpGet(f.service, RENTER_A, "/api/v1/customer/panels");
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.body.data.items.map((row: any) => row.id), ["child-a"]);
  assert.equal(list.body.data.items[0].ownerUserId, "child-a-user");

  const detail = await httpGet(f.service, RENTER_A, "/api/v1/customer/panels/101");
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.body.data.id, "child-a");
  assert.equal(detail.body.data.ownerUserId, "child-a-user");
  assert.equal(f.auditEvents.length, 0);
  assert.equal(f.subscriptions[0].autoRenew, false);
  assert.equal((await httpGet(f.service, RENTER_A, "/api/v1/customer/panels/102")).statusCode, 422);
  assert.equal((await httpGet(f.service, RENTER_A, "/api/v1/customer/panels/201")).statusCode, 422);
  assert.deepEqual((await f.service.panels(ROOT, RENTER_B)).map((row: any) => row.id), ["child-b"]);
  assert.equal(f.sites.find((site) => site.id === "child-a").ownerUserId, "child-a-user");
});

test("all customer panel actions use the same renter ownership scope", async () => {
  const f = ownershipFixture();
  assert.deepEqual((await f.service.domains(ROOT, RENTER_A, "101")).map((row: any) => row.siteId), ["child-a", "child-a"]);
  await f.service.branding(ROOT, RENTER_A, "101", { siteName: "A brand", logo: "https://a.example/logo.png", siteDescription: "A only" });
  assert.equal(f.settings.get("child-a:siteName"), "A brand");
  assert.equal(f.subscriptions[0].autoRenew, false);
  assert.equal(f.auditEvents.length, 0);
  await assert.rejects(() => f.service.branding(ROOT, RENTER_A, "102", { siteName: "A takeover" }), (error: any) => error.code === "PANEL_FORBIDDEN");
  await assert.rejects(() => f.service.branding(ROOT, RENTER_A, "201", { siteName: "Cross-tenant" }), (error: any) => error.code === "PANEL_FORBIDDEN");
  await assert.rejects(() => f.service.domains(ROOT, RENTER_A, "102"), (error: any) => error.code === "PANEL_FORBIDDEN");

  const added = await f.service.addDomain(ROOT, RENTER_A, "101", "new-a.example");
  assert.equal(added.siteId, "child-a");
  await f.service.verifyDomain(ROOT, RENTER_A, "101", "pending-a");
  await f.service.primaryDomain(ROOT, RENTER_A, "101", "verified-a");
  await f.service.removeDomain(ROOT, RENTER_A, "101", "domain-4");
  await f.service.autoRenew(ROOT, RENTER_A, "101", true);
  await f.service.renew(ROOT, RENTER_A, "101", "renewal-key-0001");
  assert.equal(f.renewalCalls.length, 1);
  assert.deepEqual(f.renewalCalls[0], ["child-a", RENTER_A, "renewal-key-0001"]);
  assert.equal(f.events.some((event) => event[1] === "child-b" || event[1] === "child-c"), false);

  for (const attempt of [
    () => f.service.addDomain(ROOT, RENTER_A, "102", "other.example"),
    () => f.service.verifyDomain(ROOT, RENTER_A, "102", "domain-b"),
    () => f.service.primaryDomain(ROOT, RENTER_A, "102", "domain-b"),
    () => f.service.removeDomain(ROOT, RENTER_A, "102", "domain-b"),
    () => f.service.autoRenew(ROOT, RENTER_A, "102", true),
    () => f.service.renew(ROOT, RENTER_A, "102", "renewal-key-0002"),
    () => f.service.renew(ROOT, RENTER_A, "201", "renewal-key-0003"),
  ])
    await assert.rejects(attempt, (error: any) => error.code === "PANEL_FORBIDDEN");
  assert.equal(f.renewalCalls.length, 1);
  assert.equal(f.sites.find((site) => site.id === "child-a").ownerUserId, "child-a-user");
});

test("auto-renew changes create one safe, correctly scoped audit event per actual change", async () => {
  const f = ownershipFixture();
  await f.service.autoRenew(ROOT, RENTER_A, "101", true);
  await f.service.autoRenew(ROOT, RENTER_A, "101", true);
  await f.service.autoRenew(ROOT, RENTER_A, "101", false);
  assert.equal(f.subscriptions[0].autoRenew, false);
  assert.equal(f.auditEvents.length, 2);
  for (const event of f.auditEvents) {
    assert.equal(event.action, "PANEL_AUTO_RENEW_CHANGED");
    assert.equal(event.actorId, RENTER_A);
    assert.equal(event.siteId, "child-a");
    assert.equal(event.resource, "PanelSubscription");
    assert.equal(event.resourceId, "sub-a");
    assert.equal(event.createdAt instanceof Date, true);
    assert.equal(/password|api.?key|secret|token/i.test(JSON.stringify(event)), false);
  }
  assert.deepEqual(f.auditEvents.map((event) => [event.before, event.after]), [
    [{ autoRenew: false }, { autoRenew: true }],
    [{ autoRenew: true }, { autoRenew: false }],
  ]);
});

test("cross-renter, cross-tenant, invalid and failed auto-renew requests cannot create a success audit", async () => {
  const f = ownershipFixture();
  for (const attempt of [
    () => f.service.autoRenew(ROOT, RENTER_A, "102", true),
    () => f.service.autoRenew(ROOT, RENTER_A, "201", true),
    () => f.service.autoRenew(ROOT_2, RENTER_B, "201", true),
  ]) await assert.rejects(attempt, (error: any) => error.code === "PANEL_FORBIDDEN");
  await assert.rejects(
    () => f.service.autoRenew(ROOT, RENTER_A, "101", "false"),
    (error: any) => error.code === "AUTO_RENEW_VALUE_INVALID",
  );
  const originalUpdate = f.db.panelSubscription.update;
  f.db.panelSubscription.update = async () => { throw new Error("simulated subscription write failure"); };
  await assert.rejects(
    () => f.service.autoRenew(ROOT, RENTER_A, "101", true),
    /simulated subscription write failure/,
  );
  f.db.panelSubscription.update = originalUpdate;
  assert.equal(f.subscriptions[0].autoRenew, false);
  assert.equal(f.auditEvents.length, 0);
});
