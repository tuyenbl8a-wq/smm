import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/server.js";
import { DistributedRateLimiter } from "../src/reseller/rate-limit.js";
import type { AppConfig } from "@smm/config";

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

test("the real v2 route returns 429 and Retry-After from distributed limiter", async () => {
  let count = 0;
  const limiter = new DistributedRateLimiter({
    incr: async () => ++count,
    expire: async () => undefined,
  });
  const reseller: any = {
    authenticate: async () => ({ id: "key", rateLimit: 1 }),
    execute: async () => ({ balance: "1.00000000" }),
  };
  const server = createApiServer(
    config,
    undefined,
    reseller,
    undefined,
    undefined,
    limiter,
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = ((server as any).address() as any).port,
    send = () =>
      fetch(`http://127.0.0.1:${port}/api/v2`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "secret", action: "balance" }),
      });
  assert.equal((await send()).status, 200);
  const limited = await send();
  assert.equal(limited.status, 429);
  assert.equal(Number(limited.headers.get("retry-after")) > 0, true);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
