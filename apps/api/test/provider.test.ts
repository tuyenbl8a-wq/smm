import assert from "node:assert/strict";
import test from "node:test";

import { decryptSecret, encryptSecret } from "../src/provider/crypto.js";
import {
  normalizeProviderDecimal,
  ProviderError,
  StandardSmmAdapter,
} from "../src/provider/adapter.js";
import { ProviderService } from "../src/provider/service.js";

test("provider decimals normalize exact standard and scientific values", () => {
  assert.equal(normalizeProviderDecimal(12), "12");
  assert.equal(normalizeProviderDecimal(12.5), "12.5");
  assert.equal(normalizeProviderDecimal("0012.50000000"), "12.5");
  assert.equal(normalizeProviderDecimal("1.25e3"), "1250");
  assert.equal(normalizeProviderDecimal("1e-8"), "0.00000001");

  // More than 8 decimal places are safely rounded instead of rejecting
  // the whole provider services response.
  assert.equal(
    normalizeProviderDecimal("0.08981234567"),
    "0.08981235",
  );

  // Provider service cost uses ceil so cost is never rounded downward.
  assert.equal(
    normalizeProviderDecimal("0.08981234101", "ceil"),
    "0.08981235",
  );

  assert.equal(
    normalizeProviderDecimal("1.000000001", "ceil"),
    "1.00000001",
  );

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
      findUnique: async () => ({
        id: "p",
        apiUrl: "https://p",
        apiKeyEncrypted: "x",
        timeoutMs: 1,
      }),
    },

    $transaction: async (fn: any) => fn(tx),
  };

  const service = new ProviderService(
    db,
    "secret-secret-secret",
  );

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

  assert.deepEqual(
    await service.sync("admin", "p"),
    {
      received: 1,
      created: 1,
      updated: 0,
    },
  );

  assert.deepEqual(
    await service.sync("admin", "p"),
    {
      received: 1,
      created: 0,
      updated: 1,
    },
  );

  assert.equal(rows.size, 1);
});