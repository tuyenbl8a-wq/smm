import assert from "node:assert/strict";
import test from "node:test";

import { decryptSecret, encryptSecret } from "../src/provider/crypto.js";
import {
  normalizeProviderDecimal,
  ProviderError,
  StandardSmmAdapter,
} from "../src/provider/adapter.js";
import { ProviderService } from "../src/provider/service.js";

const SITE_A = "00000000-0000-4000-8000-00000000000a";
const SITE_B = "00000000-0000-4000-8000-00000000000b";
const ROOT_SITE = "00000000-0000-4000-8000-000000000001";

test("provider decimals normalize exact standard and scientific values", () => {
  assert.equal(normalizeProviderDecimal(12), "12");
  assert.equal(normalizeProviderDecimal(12.5), "12.5");
  assert.equal(normalizeProviderDecimal("0012.50000000"), "12.5");
  assert.equal(normalizeProviderDecimal("1.25e3"), "1250");
  assert.equal(normalizeProviderDecimal("1e-8"), "0.00000001");

  // More than 8 decimal places are safely rounded instead of rejecting
  // the whole provider services response.
  assert.equal(normalizeProviderDecimal("0.08981234567"), "0.08981235");

  // Provider service cost uses ceil so cost is never rounded downward.
  assert.equal(normalizeProviderDecimal("0.08981234101", "ceil"), "0.08981235");

  assert.equal(normalizeProviderDecimal("1.000000001", "ceil"), "1.00000001");

  for (const invalid of [
    null,
    undefined,
    "",
    "NaN",
    Infinity,
    -1,
    "1000000000000",
    "1e999",
  ])
    assert.throws(
      () => normalizeProviderDecimal(invalid),
      /provider decimal|precision|overflow/i,
    );
});

test("provider credentials encrypt with authenticated randomized ciphertext", () => {
  const key = "01234567890123456789012345678901",
    a = encryptSecret("secret-api-key", key),
    b = encryptSecret("secret-api-key", key);

  assert.equal(a === b, false);
  assert.equal(decryptSecret(a, key), "secret-api-key");
  assert.throws(() => decryptSecret(a, "wrong-key-wrong-key"));
});

test("provider timeout is an unknown outcome only for create", async () => {
  const old = globalThis.fetch;

  globalThis.fetch = ((_u: any, o: any) =>
    new Promise((_r, reject) =>
      o.signal.addEventListener("abort", () =>
        reject(Object.assign(new Error(), { name: "AbortError" })),
      ),
    )) as any;

  try {
    const adapter = new StandardSmmAdapter(
      "https://provider.invalid",
      "key",
      5,
    );

    await assert.rejects(
      () =>
        adapter.createOrder({
          service: "1",
          link: "https://example.com",
          quantity: 10,
          idempotencyKey: "x",
        }),
      (e: any) => e instanceof ProviderError && e.unknownOutcome,
    );

    await assert.rejects(
      () => adapter.getBalance(),
      (e: any) => e instanceof ProviderError && !e.unknownOutcome,
    );
  } finally {
    globalThis.fetch = old;
  }
});

test("provider sync upserts stable external identities without duplicates", async () => {
  const rows = new Map<string, any>();

  const tx: any = {
    providerService: {
      findUnique: async ({ where }: any) =>
        rows.get(where.providerId_externalId.externalId),

      upsert: async ({ where, create, update }: any) => {
        const id = where.providerId_externalId.externalId,
          old = rows.get(id),
          value = old ? { ...old, ...update } : { id, ...create };

        rows.set(id, value);
        return value;
      },
    },

    provider: {
      update: async () => ({}),
    },

    auditLog: {
      create: async () => ({}),
    },
  };

  const db: any = {
    provider: {
      findFirst: async () => ({
        id: "p",
        apiUrl: "https://p",
        apiKeyEncrypted: "x",
        timeoutMs: 1,
      }),
    },

    $transaction: async (fn: any) => fn(tx),
  };

  const service = new ProviderService(db, "secret-secret-secret");

  (service as any).adapter = () => ({
    getServices: async () => [
      {
        externalId: "1",
        name: "One",
        category: "Social",
        type: "Default",
        rate: "1.00000000",
        min: 10,
        max: 100,
        refill: false,
        cancel: false,
      },
    ],
  });

  assert.deepEqual(await service.sync("admin", "site-a", "p"), {
    received: 1,
    created: 1,
    updated: 0,
  });

  assert.deepEqual(await service.sync("admin", "site-a", "p"), {
    received: 1,
    created: 0,
    updated: 1,
  });

  assert.equal(rows.size, 1);
});
test("provider create/update strictly validate scheduling and preserve blank secrets", async () => {
  const key = "01234567890123456789012345678901";
  let stored: any = {
    id: "p1",
    name: "P",
    status: "ACTIVE",
    apiKeyEncrypted: encryptSecret("existing-secret", key),
  };
  const audits: any[] = [];
  const tx: any = {
    provider: {
      create: async ({ data }: any) => (stored = { id: "p1", ...data }),
      update: async ({ data }: any) => (stored = { ...stored, ...data }),
    },
    auditLog: { create: async ({ data }: any) => (audits.push(data), data) },
  };
  const db: any = {
    provider: { findFirst: async () => stored },
    $transaction: async (fn: any) => fn(tx),
  };
  for (const interval of [5, 10, 15, 30, 60]) {
    const result = await new ProviderService(db, key).create(
      "admin",
      "site-a",
      {
        name: "Provider",
        apiUrl: "https://provider.test",
        apiKey: "secret-key",
        autoSyncEnabled: false,
        syncIntervalMinutes: interval,
      },
    );
    assert.deepEqual(result, { id: "p1", name: "Provider" });
    assert.equal(JSON.stringify(result).includes("apiKey"), false);
  }
  for (const interval of [0, -1, 1.5, NaN, Infinity, 6, 20, "5", "anything"])
    await assert.rejects(() =>
      new ProviderService(db, key).create("admin", "site-a", {
        name: "Provider",
        apiUrl: "https://provider.test",
        apiKey: "secret-key",
        autoSyncEnabled: false,
        syncIntervalMinutes: interval,
      }),
    );
  await assert.rejects(() =>
    new ProviderService(db, key).update("admin", "site-a", "p1", {
      autoSyncEnabled: "false",
    }),
  );
  const encrypted = stored.apiKeyEncrypted;
  const result = await new ProviderService(db, key).update(
    "admin",
    "site-a",
    "p1",
    { apiKey: "", syncIntervalMinutes: 30 },
  );
  assert.equal(stored.apiKeyEncrypted, encrypted);
  assert.equal(JSON.stringify(result).includes("apiKey"), false);
  assert.equal(JSON.stringify(audits).includes("existing-secret"), false);
});

test("interactive provider administration is tenant-scoped and never exposes credentials", async () => {
  const key = "01234567890123456789012345678901";
  const rows = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      siteId: SITE_A,
      name: "Panel A NCC",
      apiUrl: "https://a.test",
      apiKeyEncrypted: encryptSecret("panel-a-secret", key),
      timeoutMs: 1000,
      balance: null,
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      siteId: SITE_B,
      name: "Panel B NCC",
      apiUrl: "https://b.test",
      apiKeyEncrypted: encryptSecret("panel-b-secret", key),
      timeoutMs: 1000,
      balance: null,
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      siteId: ROOT_SITE,
      name: "ROOT NCC",
      apiUrl: "https://root.test",
      apiKeyEncrypted: encryptSecret("root-secret", key),
      timeoutMs: 1000,
      balance: null,
      deletedAt: null,
    },
  ];
  const matches = (where: any, row: any) =>
    Object.entries(where).every(([field, value]) =>
      field === "deletedAt" ? row.deletedAt === value : row[field] === value,
    );
  const db: any = {
    provider: {
      findMany: async ({ where }: any) =>
        rows.filter((row) => matches(where, row)),
      findFirst: async ({ where }: any) =>
        rows.find((row) => matches(where, row)) ?? null,
    },
    providerService: { findMany: async () => [] },
    orderProviderLog: { findMany: async () => [] },
  };
  const service = new ProviderService(db, key);

  const listed = await service.list(SITE_A);
  assert.deepEqual(
    listed.map((row: any) => row.id),
    [rows[0]!.id],
  );
  assert.equal(JSON.stringify(listed).includes("apiKeyEncrypted"), false);
  assert.equal(JSON.stringify(listed).includes("panel-a-secret"), false);
  await assert.rejects(
    () => service.detail(SITE_A, rows[1]!.id),
    (error: any) => error.code === "PROVIDER_NOT_FOUND",
  );
  await assert.rejects(
    () => service.detail(SITE_B, rows[0]!.id),
    (error: any) => error.code === "PROVIDER_NOT_FOUND",
  );
  await assert.rejects(
    () => service.detail(SITE_A, rows[2]!.id),
    (error: any) => error.code === "PROVIDER_NOT_FOUND",
  );
  assert.deepEqual(
    (await service.list(ROOT_SITE)).map((row: any) => row.id),
    [rows[2]!.id],
  );
});
