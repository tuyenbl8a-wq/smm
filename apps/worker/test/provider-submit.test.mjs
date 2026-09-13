import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { SubmitWorker } from "../dist/provider-submit.js";

const secret = "worker-encryption-secret";
const encrypt = (value) => {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256").update(secret).digest(),
      iv,
    ),
    data = Buffer.concat([cipher.update(value), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
};

const fixture = ({ response, fetchError, commitError = false }) => {
  const updates = [],
    logs = [],
    orderUpdates = [];
  let providerWhere;
  let transactions = 0;
  const claimed = { id: "outbox", order_id: 7n, attempts: 0 };
  const order = {
    id: 7n,
    siteId: "site",
    providerId: "provider",
    providerOrderId: null,
    providerSubmitKey: "submit-key",
    input: { providerExternalServiceId: "55" },
    link: "https://example.com/post",
    quantity: 100,
  };
  const provider = {
    id: "provider",
    apiUrl: "https://provider.example/api",
    apiKeyEncrypted: encrypt("super-secret-api-key"),
    timeoutMs: 10,
  };
  const db = {
    $transaction: async (run) => {
      transactions++;
      if (transactions === 1)
        return run({
          $queryRawUnsafe: async () => [claimed],
          providerOutbox: { update: async ({ data }) => updates.push(data) },
        });
      if (commitError) throw new Error("database secret should not leak");
      return run({
        order: { update: async () => ({}) },
        orderHistory: { create: async () => ({}) },
        orderProviderLog: { create: async () => ({}) },
        providerOutbox: { update: async ({ data }) => updates.push(data) },
      });
    },
    order: {
      findUnique: async () => order,
      update: async ({ data }) => orderUpdates.push(data),
    },
    provider: {
      findFirst: async ({ where }) => ((providerWhere = where), provider),
    },
    providerOutbox: { update: async ({ data }) => updates.push(data) },
    orderProviderLog: {
      upsert: async (args) => (logs.push(args), args),
    },
  };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    if (fetchError) throw fetchError;
    return response;
  };
  return {
    worker: new SubmitWorker(db, secret),
    updates,
    logs,
    orderUpdates,
    providerWhere: () => providerWhere,
    restore: () => (globalThis.fetch = oldFetch),
  };
};

test("provider submit resolves only an active provider owned by the order tenant", async () => {
  const f = fixture({
    response: response(200, JSON.stringify({ order: "123" })),
  });
  try {
    await f.worker.once();
    assert.deepEqual(f.providerWhere(), {
      id: "provider",
      siteId: "site",
      deletedAt: null,
    });
  } finally {
    f.restore();
  }
});

const safeJson = (value) =>
  JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? String(item) : item,
  );

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

for (const scenario of [
  {
    name: "JSON rejection",
    response: response(200, JSON.stringify({ error: "Invalid link" })),
    code: "PROVIDER_REJECTED",
    message: "Invalid link",
    unknown: false,
  },
  {
    name: "non-2xx authentication response",
    response: response(
      403,
      JSON.stringify({ error: "Invalid API key super-secret-api-key" }),
    ),
    code: "PROVIDER_AUTH_FAILED",
    message: "[REDACTED]",
    unknown: false,
  },
  {
    name: "malformed JSON",
    response: response(200, "<html>upstream failure</html>"),
    code: "PROVIDER_MALFORMED_RESPONSE",
    unknown: true,
  },
  {
    name: "network error",
    fetchError: new TypeError("socket included super-secret-api-key"),
    code: "NETWORK_ERROR",
    unknown: true,
  },
  {
    name: "timeout",
    fetchError: Object.assign(new Error("timeout"), { name: "AbortError" }),
    code: "TIMEOUT_UNKNOWN",
    unknown: true,
  },
])
  test(`provider submit records sanitized ${scenario.name}`, async () => {
    const state = fixture(scenario);
    try {
      assert.equal(await state.worker.once(), true);
      const final = state.updates.at(-1);
      assert.match(final.lastError, new RegExp(`^${scenario.code}:`));
      assert.equal(final.status, scenario.unknown ? "UNKNOWN" : "PENDING");
      assert.equal(state.logs[0].create.errorCode, scenario.code);
      if (scenario.message)
        assert.match(
          safeJson(state.logs[0]),
          new RegExp(scenario.message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
      assert.doesNotMatch(
        safeJson({ updates: state.updates, logs: state.logs }),
        /super-secret-api-key|apiKeyEncrypted|authorization/i,
      );
      assert.equal(state.orderUpdates.length, scenario.unknown ? 1 : 0);
    } finally {
      state.restore();
    }
  });

test("provider acceptance followed by local commit failure becomes UNKNOWN without resubmission", async () => {
  const state = fixture({
    response: response(200, JSON.stringify({ order: "accepted-123" })),
    commitError: true,
  });
  try {
    assert.equal(await state.worker.once(), true);
    assert.equal(state.updates.at(-1).status, "UNKNOWN");
    assert.match(
      state.updates.at(-1).lastError,
      /^PROVIDER_ACCEPTED_LOCAL_COMMIT_FAILED:/,
    );
    assert.equal(state.orderUpdates[0].manualOverride, true);
    assert.doesNotMatch(
      safeJson(state.logs),
      /database secret|super-secret-api-key/,
    );
  } finally {
    state.restore();
  }
});
