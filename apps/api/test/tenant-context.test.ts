import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHostname,
  TenantResolver,
  TenantError,
  ROOT_SITE_ID,
  tenantForwardSignature,
} from "../src/tenant/context.js";
test("normalizes DNS host and strips port", () =>
  assert.equal(
    normalizeHostname("Panel.Example.COM:443"),
    "panel.example.com",
  ));
test("rejects malformed host", () => {
  for (const host of [
    "javascript:alert(1)",
    "bad_host.test",
    "a..test",
    "user@example.com",
  ])
    assert.throws(() => normalizeHostname(host), /Invalid hostname/);
});
test("unknown and unverified domains fail closed", async () => {
  const resolver = new TenantResolver(
    {
      site: { findUniqueOrThrow: async () => ({ id: ROOT_SITE_ID }) },
      siteDomain: { findFirst: async () => null },
    },
    new Set(["dichvu1st.com"]),
  );
  await assert.rejects(
    () => resolver.resolve({ headers: { host: "unknown.test" } }),
    /Unknown or unverified/,
  );
  assert.equal(
    (await resolver.resolve({ headers: { host: "dichvu1st.com" } })).id,
    ROOT_SITE_ID,
  );
});
test("suspended ancestor blocks descendant", async () => {
  const sites: any = {
    leaf: { id: "leaf", parentSiteId: "parent", status: "ACTIVE", depth: 2 },
    parent: {
      id: "parent",
      parentSiteId: ROOT_SITE_ID,
      status: "SUSPENDED",
      depth: 1,
    },
  };
  const resolver = new TenantResolver(
    { site: { findUnique: async ({ where }: any) => sites[where.id] } },
    new Set(),
  );
  await assert.rejects(
    () => resolver.assertOperational(sites.leaf),
    /ancestor/,
  );
});
test("accepts only signed fresh internal tenant forwarding", async () => {
  const child = {
    id: "child",
    parentSiteId: ROOT_SITE_ID,
    status: "ACTIVE",
    depth: 1,
  };
  const db = {
    site: { findUniqueOrThrow: async () => ({ id: ROOT_SITE_ID }) },
    siteDomain: {
      findFirst: async ({ where }: any) =>
        where.hostname === "smmlike.site" ? { site: child } : null,
    },
  };
  const secret = "test-internal-secret",
    timestamp = String(Date.now()),
    resolver = new TenantResolver(db, new Set(["api"]), secret);
  const headers = {
    host: "api",
    "x-smm-tenant-host": "smmlike.site",
    "x-smm-tenant-timestamp": timestamp,
    "x-smm-tenant-signature": tenantForwardSignature(
      secret,
      "smmlike.site",
      timestamp,
    ),
  };
  assert.equal((await resolver.resolve({ headers } as any)).id, "child");
  await assert.rejects(
    () =>
      resolver.resolve({
        headers: { ...headers, "x-smm-tenant-signature": "0".repeat(64) },
      } as any),
    /Untrusted/,
  );
  await assert.rejects(
    () =>
      resolver.resolve({
        headers: { host: "api", "x-smm-tenant-host": "smmlike.site" },
      } as any),
    /Untrusted/,
  );
});
