import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "@smm/config";
import { createApiServer } from "../src/server.js";
import { DepositService } from "../src/payment/service.js";

const config = {
  environment: "test",
  host: "127.0.0.1",
  port: 4000,
  appUrl: new URL("http://localhost:3000"),
  apiUrl: new URL("http://localhost:4000"),
  databaseUrl: new URL("postgresql://127.0.0.1:1/smm"),
  redisUrl: new URL("redis://127.0.0.1:1"),
  sessionSecret: "x",
  jwtSecret: "x",
  encryptionKey: "x",
  healthTimeoutMs: 100,
} satisfies AppConfig;

test("Casso HTTP route forwards the untouched body and secure token", async () => {
  const received: Array<[string, string]> = [];
  const casso: any = {
    process: async (raw: string, token: string) => {
      received.push([raw, token]);
      return { success: true, results: [{ status: "PAID" }] };
    },
  };
  const server = createApiServer(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    casso,
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = ((server as any).address() as any).port,
      raw = '{"data":{"id":"bank-event-1","amount":"100"}}',
      response = await fetch(
        `http://127.0.0.1:${port}/webhooks/payments/casso`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "secure-token": "webhook-secret",
          },
          body: raw,
        },
      );
    assert.equal(response.status, 200);
    assert.deepEqual(received, [[raw, "webhook-secret"]]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("deposit detail exposes only public VietQR instructions", async () => {
  const db: any = {
    deposit: {
      findFirst: async () => ({
        id: "deposit",
        userId: "user",
        paymentMethodId: "method",
        code: "NAPABCDEF123456",
        grossAmount: "100.00000000",
      }),
    },
    paymentMethod: {
      findUnique: async () => ({
        code: "CASSO",
        name: "Bank transfer",
        providerType: "CASSO",
      }),
    },
  };
  const detail = await new DepositService(db, {
    bin: "970436",
    name: "Vietcombank",
    account: "123456789",
    accountName: "SMM PANEL",
  }).detail("user", "deposit");
  assert.equal(detail.payment.transferContent, "NAPABCDEF123456");
  assert.match(detail.payment.qrUrl, /^https:\/\/img\.vietqr\.io\//);
  assert.doesNotMatch(JSON.stringify(detail), /secret|api[_-]?key/i);
});
