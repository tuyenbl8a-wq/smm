import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/server.js";
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
test("constructs an API server without opening a listener", () => {
  const server = createApiServer(config);
  assert.equal(typeof server.listen, "function");
  server.close();
});
