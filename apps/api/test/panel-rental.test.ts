import assert from "node:assert/strict";
import test from "node:test";
import { PanelService } from "../src/tenant/panel-service.js";
import type { PanelDnsProvider } from "../src/tenant/panel-dns-provider.js";

const dns = (): PanelDnsProvider & { calls: string[] } => ({
  calls: [],
  async createZone(domain) {
    this.calls.push(`create:${domain}`);
    return {
      zoneId: "zone-real",
      nameservers: ["aria.ns.cloudflare.com", "nick.ns.cloudflare.com"],
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
    true,
  );
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

test("Cloudflare adapter obtains assigned NS and prepares proxied routing through injected transport", async () => {
  const requests: Array<{ url: string; method: string; body?: any }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input),
      method = init?.method ?? "GET";
    requests.push({ url, method, body: init?.body });
    const result =
      method === "POST" && url.endsWith("/zones")
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
  });
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
