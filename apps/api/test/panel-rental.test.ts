import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PanelService } from "../src/tenant/panel-service.js";
import type { PanelDnsProvider } from "../src/tenant/panel-dns-provider.js";
import { createPanelDnsProvider } from "../src/tenant/panel-dns-config.js";

const dns = (): PanelDnsProvider & { calls: string[] } => ({
  calls: [],
  async createZone(domain) {
    this.calls.push(`create:${domain}`);
    return {
      zoneId: "zone-real",
      nameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
      created: true,
    };
  },
  async getAssignedNameservers() {
    this.calls.push("nameservers");
    return ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"];
  },
  async getZoneStatus() {
    this.calls.push("status");
    return "ACTIVE";
  },
  async ensurePanelRouting(_zone, domain) {
    this.calls.push(`route:${domain}`);
  },
  async deleteZone() {
    this.calls.push("delete");
  },
});

const intent = {
  id: "11111111-1111-4111-8111-111111111111",
  sellerSiteId: "seller",
  renterUserId: "user",
  planId: "plan",
  name: "Panel test",
  slug: "panel",
  hostname: "panel.example.com",
  providerZoneId: "zone-real",
  assignedNameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
  status: "PENDING_DNS",
  autoRenew: true,
  activationKey: "panel-activate:stable",
  expiresAt: new Date(Date.now() + 60_000),
};

test("pending rental provisions a provider zone and never debits the wallet", async () => {
  let walletTouched = false;
  const provider = dns();
  const db: any = {
    panelRentalIntent: {
      findUnique: async () => null,
      create: async ({ data }: any) => ({ ...intent, ...data }),
    },
    site: {
      findUnique: async () => ({ id: "seller", status: "ACTIVE", depth: 0 }),
      count: async () => 0,
    },
    panelRentalPlan: {
      findFirst: async () => ({
        id: "plan",
        active: true,
        allowCustomDomain: true,
        maxDepth: 2,
        maxDirectChildren: 5,
      }),
    },
    user: { findFirst: async () => ({ id: "user" }) },
    $queryRawUnsafe: async () => {
      walletTouched = true;
    },
  };
  const result = await new PanelService(db, provider).rent(
    "seller",
    "user",
    { planId: "plan", name: "Panel test", domain: "panel.example.com" },
    "request-key-12345",
  );
  assert.equal(walletTouched, false);
  assert.equal(result.rental.status, "PENDING_DNS");
  assert.deepEqual(result.nameservers, [
    "aria.ns.cloudflare.com",
    "nick.ns.cloudflare.com",
  ]);
  assert.deepEqual(provider.calls, ["create:panel.example.com"]);
});

test("verified NS with insufficient balance returns PAYMENT_REQUIRED without site creation", async () => {
  let siteCreated = false;
  const provider = dns();
  const state = { ...intent };
  const db: any = {
    panelRentalIntent: { findFirst: async () => state },
    site: { findUnique: async () => ({ status: "ACTIVE", depth: 0 }) },
    $transaction: async (fn: any) =>
      fn({
        $queryRawUnsafe: async (sql: string) =>
          sql.startsWith("SELECT") ? [] : [],
        panelRentalIntent: {
          findUnique: async () => state,
          update: async ({ data }: any) => Object.assign(state, data),
        },
        site: {
          findUnique: async () => ({ status: "ACTIVE", depth: 0 }),
          create: async () => {
            siteCreated = true;
          },
        },
        panelRentalPlan: {
          findUnique: async () => ({
            id: "plan",
            active: true,
            price: "100.00000000",
            billingDays: 30,
          }),
        },
        user: {
          findFirst: async () => ({ id: "user", siteId: "seller" }),
        },
      }),
  };
  await assert.rejects(
    () => new PanelService(db, provider).activate("seller", "user", intent.id),
    (error: any) => error.code === "PAYMENT_REQUIRED",
  );
  assert.equal(state.status, "PAYMENT_REQUIRED");
  assert.equal(siteCreated, false);
  assert.equal(
    Boolean(provider.calls.includes("route:panel.example.com")),
    false,
  );
});

test("API DNS bootstrap is optional and panel rent fails clearly when unconfigured", async () => {
  const provider = createPanelDnsProvider({});
  await assert.rejects(
    () => provider.createZone("panel.example.com"),
    (error: any) => error.code === "PANEL_DNS_NOT_CONFIGURED",
  );
});

test("activation persists provider metadata before routing and activates afterward", async () => {
  const provider = dns();
  const state: any = { ...intent };
  let domainData: any;
  let childOwnerData: any;
  let assignedOwnerId: string | undefined;
  let siteStatus = "PENDING";
  let transactionCount = 0;
  const tx: any = {
    $queryRawUnsafe: async (sql: string) =>
      sql.startsWith("SELECT")
        ? []
        : [{ id: "wallet", before: "200", after: "100" }],
    panelRentalIntent: {
      findUnique: async () => state,
      update: async ({ data }: any) => Object.assign(state, data),
    },
    site: {
      findUnique: async () => ({ id: "seller", status: "ACTIVE", depth: 0 }),
      create: async ({ data }: any) => {
        siteStatus = data.status;
        return data;
      },
      update: async ({ data }: any) => {
        if (data.ownerUserId) assignedOwnerId = data.ownerUserId;
        siteStatus = data.status;
        return { id: state.activatedSiteId, status: siteStatus };
      },
    },
    panelRentalPlan: {
      findUnique: async () => ({
        id: "plan",
        code: "PRO",
        active: true,
        price: "100.00000000",
        billingDays: 30,
      }),
    },
    user: {
      findFirst: async () => ({
        id: "user",
        siteId: "seller",
        email: "owner@example.com",
        username: "owner",
        passwordHash: "hash",
        status: "ACTIVE",
      }),
      create: async ({ data }: any) => ({
        ...(childOwnerData = data),
        id: "child-owner",
      }),
    },
    role: { findUniqueOrThrow: async () => ({ id: "admin-role" }) },
    userRole: { create: async () => undefined },
    permission: {
      findMany: async () =>
        [1, 2, 3, 4].map((id) => ({ id: `permission-${id}` })),
    },
    userPermission: { createMany: async () => ({ count: 4 }) },
    wallet: { create: async () => undefined },
    affiliate: { create: async () => undefined },
    siteDomain: {
      create: async ({ data }: any) => {
        if (data.providerZoneId) domainData = data;
      },
    },
    panelSubscription: { create: async () => undefined },
    walletTransaction: { create: async () => undefined },
    auditLog: { create: async () => undefined },
  };
  const db: any = {
    panelRentalIntent: { findFirst: async () => state },
    site: { findUnique: async () => ({ id: "seller", status: "ACTIVE" }) },
    $transaction: async (fn: any) => {
      transactionCount += 1;
      return fn(tx);
    },
  };
  const result = await new PanelService(db, provider).activate(
    "seller",
    "user",
    intent.id,
  );
  assert.equal(result.activated, true);
  assert.equal(transactionCount, 2);
  assert.equal(siteStatus, "ACTIVE");
  assert.equal(state.status, "ACTIVATED");
  assert.equal(domainData.providerZoneId, "zone-real");
  assert.deepEqual(domainData.assignedNameservers, intent.assignedNameservers);
  assert.equal(childOwnerData.siteId, state.activatedSiteId);
  assert.equal(assignedOwnerId, "child-owner");
  assert.equal(provider.calls.at(-1), "route:panel.example.com");
});

test("repeated verify of an activated rental never charges again", async () => {
  let walletTouched = false;
  const activated = { ...intent, status: "ACTIVATED", activatedSiteId: "site" };
  const db: any = {
    panelRentalIntent: { findFirst: async () => activated },
    site: { findUnique: async () => ({ id: "site", siteNumber: 100001n }) },
    $queryRawUnsafe: async () => {
      walletTouched = true;
    },
  };
  const result = await new PanelService(db, dns()).activate(
    "seller",
    "user",
    intent.id,
  );
  assert.equal(result.charged, false);
  assert.equal(walletTouched, false);
});

import { CloudflarePanelDnsProvider } from "../src/tenant/cloudflare-panel-dns.js";

test("Cloudflare adapter creates a missing zone and prepares proxied routing", async () => {
  const requests: Array<{ url: string; method: string; body?: any }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? "GET";
    requests.push({ url, method, body: init?.body });
    const result = url.includes("/zones?name=")
      ? []
      : method === "POST" && url.endsWith("/zones")
        ? {
            id: "zone-1",
            name_servers: ["ARIA.NS.CLOUDFLARE.COM.", "nick.ns.cloudflare.com"],
          }
        : url.includes("dns_records?")
          ? []
          : url.endsWith("/zone-1")
            ? {
                id: "zone-1",
                status: "active",
                name_servers: [
                  "aria.ns.cloudflare.com",
                  "nick.ns.cloudflare.com",
                ],
              }
            : { id: "record-1" };
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const provider = new CloudflarePanelDnsProvider({
    apiToken: "token",
    accountId: "account",
    routingTarget: "panels.internal.example",
    apiBaseUrl: "https://cloudflare.invalid",
    fetcher,
  });
  const zone = await provider.createZone("panel.example.com");
  assert.deepEqual(zone, {
    zoneId: "zone-1",
    nameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
    created: true,
  });
  assert.equal(
    requests.filter(
      (request) => request.url.endsWith("/zones") && request.method === "POST",
    ).length,
    1,
  );
  assert.equal(await provider.getZoneStatus(zone.zoneId), "ACTIVE");
  await provider.ensurePanelRouting(zone.zoneId, "panel.example.com");
  assert.equal(
    requests.some(
      (request) =>
        request.url.includes("/dns_records") && request.method === "POST",
    ),
    true,
  );
  assert.equal(
    requests.every((request) =>
      request.url.startsWith("https://cloudflare.invalid"),
    ),
    true,
  );
});

test("Cloudflare adapter reuses an exact account zone without POST", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? "GET";
    requests.push({ url, method });
    return new Response(
      JSON.stringify({
        success: true,
        result: [
          {
            id: "existing-zone",
            name: "Panel.Example.Com.",
            account: { id: "account" },
            name_servers: [
              " ARIA.NS.CLOUDFLARE.COM. ",
              "nick.ns.cloudflare.com",
            ],
          },
        ],
      }),
      { status: 200 },
    );
  };
  const provider = new CloudflarePanelDnsProvider({
    apiToken: "token",
    accountId: "account",
    routingTarget: "panels.internal.example",
    apiBaseUrl: "https://cloudflare.invalid",
    fetcher,
  });
  assert.deepEqual(await provider.createZone("PANEL.EXAMPLE.COM."), {
    zoneId: "existing-zone",
    nameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
    created: false,
  });
  assert.equal(
    requests.some((request) => request.method === "POST"),
    false,
  );
  assert.match(
    requests[0]!.url,
    /name=panel\.example\.com&account\.id=account$/,
  );
});

test("rental intent failure preserves reused zones and cleans newly-created zones", async () => {
  for (const created of [false, true]) {
    const provider = dns();
    provider.createZone = async () => ({
      zoneId: "zone-real",
      nameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
      created,
    });
    const db: any = {
      panelRentalIntent: {
        findUnique: async () => null,
        create: async () => {
          throw new Error("DB_FAILED");
        },
      },
      site: {
        findUnique: async () => ({ id: "seller", status: "ACTIVE", depth: 0 }),
        count: async () => 0,
      },
      panelRentalPlan: {
        findFirst: async () => ({
          id: "plan",
          active: true,
          allowCustomDomain: true,
          maxDepth: 2,
          maxDirectChildren: 5,
        }),
      },
      user: { findFirst: async () => ({ id: "user" }) },
    };
    await assert.rejects(
      () =>
        new PanelService(db, provider).rent(
          "seller",
          "user",
          { planId: "plan", name: "Panel test", domain: "panel.example.com" },
          `request-key-${created}`,
        ),
      /DB_FAILED/,
    );
    assert.equal(provider.calls.includes("delete"), created);
  }
});

test("panel activation executes advisory locks without expecting query rows", async () => {
  const source = await readFile(
    new URL("../../src/tenant/panel-service.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    (
      source.match(
        /\$executeRawUnsafe\?\.\(\s*"SELECT pg_advisory_xact_lock/g,
      ) ?? []
    ).length,
    2,
  );
  assert.equal(
    /\$queryRawUnsafe\?\.\(\s*"SELECT pg_advisory_xact_lock/.test(source),
    false,
  );
});

test("legacy panel owner repair is idempotent and never touches billing ledger", async () => {
  const childSiteId = "a626afa7-23ce-4079-9e0d-e3283907b882";
  const sellerSiteId = "00000000-0000-4000-8000-000000000001";
  let ownerUserId: string | null = null;
  let childOwner: any = null;
  let createdUsers = 0;
  let walletUpserts = 0;
  let affiliateUpserts = 0;
  let ledgerWrites = 0;
  let requestedPermissions: string[] = [];
  let grantedPermissions: any[] = [];
  const tx: any = {
    site: {
      findUnique: async () => ({ id: childSiteId, ownerUserId }),
      update: async ({ data }: any) => ((ownerUserId = data.ownerUserId), {}),
    },
    panelSubscription: {
      findFirst: async () => ({
        siteId: childSiteId,
        sellerSiteId,
        renterUserId: "root-renter",
      }),
    },
    user: {
      findFirst: async ({ where }: any) => {
        if (where.id === "root-renter")
          return {
            id: "root-renter",
            siteId: sellerSiteId,
            email: "owner@example.com",
            username: "owner",
            passwordHash: "hash",
            referralCode: "ROOTCODE",
          };
        if (where.siteId === childSiteId) return childOwner;
        return null;
      },
      create: async ({ data }: any) => {
        createdUsers += 1;
        childOwner = { id: "child-owner", ...data };
        return childOwner;
      },
    },
    role: { findUniqueOrThrow: async () => ({ id: "admin-role" }) },
    userRole: { upsert: async () => ({}) },
    permission: {
      findMany: async ({ where }: any) => {
        requestedPermissions = where.code.in;
        return requestedPermissions.map((code) => ({ id: code }));
      },
    },
    userPermission: {
      createMany: async ({ data }: any) => {
        grantedPermissions = data;
        return { count: data.length };
      },
    },
    wallet: { upsert: async () => (walletUpserts += 1) },
    affiliate: { upsert: async () => (affiliateUpserts += 1) },
    walletTransaction: { create: async () => (ledgerWrites += 1) },
  };
  const db = { $transaction: async (run: any) => run(tx) };
  const service = new PanelService(db, dns());
  const first = await service.repairLegacyOwner(childSiteId);
  const second = await service.repairLegacyOwner(childSiteId);
  assert.equal(first.ownerUserId, "child-owner");
  assert.equal(first.renterUserId, "root-renter");
  assert.equal(second.ownerUserId, "child-owner");
  assert.equal(createdUsers, 1);
  assert.equal(walletUpserts, 2);
  assert.equal(affiliateUpserts, 2);
  assert.equal(ledgerWrites, 0);
  assert.deepEqual(requestedPermissions, [
    "services.view",
    "services.presentation.manage",
    "services.pricing.manage",
    "services.toggle",
  ]);
  assert.equal(
    requestedPermissions.some((code) =>
      ["services.create", "services.import", "providers.manage"].includes(code),
    ),
    false,
  );
  assert.equal(
    grantedPermissions.every((grant) => grant.userId === "child-owner"),
    true,
  );
});

test("rental without a custom domain reserves a unique system subdomain without Cloudflare", async () => {
  const provider = dns();
  let created: any;
  const db: any = {
    panelRentalIntent: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => (created = { ...intent, ...data }),
    },
    siteDomain: { findFirst: async () => null },
    site: {
      findUnique: async () => ({ id: "seller", status: "ACTIVE", depth: 0 }),
      count: async () => 0,
    },
    panelRentalPlan: {
      findFirst: async () => ({
        id: "plan",
        active: true,
        allowCustomDomain: false,
        maxDepth: 2,
        maxDirectChildren: 5,
      }),
    },
    user: { findFirst: async () => ({ id: "user" }) },
  };
  const result = await new PanelService(db, provider).rent(
    "seller",
    "user",
    { planId: "plan", name: "Shop ABC", slug: "shopabc" },
    "system-subdomain-1",
  );
  assert.equal(created.hostname, "shopabc.dichvu1st.com");
  assert.equal(created.providerZoneId, null);
  assert.deepEqual(result.nameservers, []);
  assert.deepEqual(provider.calls, []);
});

test("custom domains remain blocked by a plan while duplicate and reserved subdomains fail closed", async () => {
  let claimed = false;
  const db: any = {
    panelRentalIntent: {
      findUnique: async () => null,
      findFirst: async () => null,
    },
    siteDomain: {
      findFirst: async () => (claimed ? { id: "existing" } : null),
    },
    site: {
      findUnique: async () => ({ status: "ACTIVE", depth: 0 }),
      count: async () => 0,
    },
    panelRentalPlan: {
      findFirst: async () => ({
        id: "plan",
        active: true,
        allowCustomDomain: false,
        maxDepth: 2,
        maxDirectChildren: 5,
      }),
    },
    user: { findFirst: async () => ({ id: "user" }) },
  };
  const service = new PanelService(db, dns());
  await assert.rejects(
    () =>
      service.rent(
        "seller",
        "user",
        { planId: "plan", name: "Shop", domain: "shop.test" },
        "custom-blocked-1",
      ),
    (e: any) => e.code === "CUSTOM_DOMAIN_NOT_ALLOWED",
  );
  await assert.rejects(
    () =>
      service.rent(
        "seller",
        "user",
        { planId: "plan", name: "Admin", slug: "admin" },
        "reserved-slug-1",
      ),
    (e: any) => e.code === "PANEL_SLUG_RESERVED",
  );
  claimed = true;
  await assert.rejects(
    () =>
      service.rent(
        "seller",
        "user",
        { planId: "plan", name: "Shop", slug: "shop" },
        "duplicate-slug-1",
      ),
    (e: any) => e.code === "PANEL_SUBDOMAIN_TAKEN",
  );
});

test("inactive rental plans remain unavailable for new sales", async () => {
  let planWhere: any;
  const db: any = {
    panelRentalIntent: { findUnique: async () => null },
    site: {
      findUnique: async () => ({ id: "seller", status: "ACTIVE", depth: 0 }),
    },
    panelRentalPlan: {
      findFirst: async ({ where }: any) => ((planWhere = where), null),
    },
    user: {
      findFirst: async () => ({
        id: "renter",
        siteId: "seller",
        status: "ACTIVE",
      }),
    },
  };
  await assert.rejects(
    () =>
      new PanelService(db, dns()).rent(
        "seller",
        "renter",
        { planId: "inactive-plan", name: "Panel" },
        "inactive-plan-sale",
      ),
    (error: any) => error.code === "PANEL_PLAN_UNAVAILABLE",
  );
  assert.equal(planWhere.active, true);
  assert.equal(planWhere.sellerSiteId, "seller");
});
