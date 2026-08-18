import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/index.js";
const valid: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  DATABASE_URL: "postgresql://localhost/smm",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "session",
  JWT_SECRET: "jwt",
  ENCRYPTION_KEY: "encryption",
};
test("loads and normalizes a complete environment", () => {
  const config = loadConfig(valid);
  assert.equal(config.port, 4000);
  assert.equal(config.databaseUrl.protocol, "postgresql:");
});
test("reports the exact missing setting", () => {
  const env = { ...valid };
  delete env.JWT_SECRET;
  assert.throws(() => loadConfig(env), /JWT_SECRET/);
});
test("rejects short production secrets", () => {
  assert.throws(
    () => loadConfig({ ...valid, NODE_ENV: "production" }),
    /SESSION_SECRET/,
  );
});
test("rejects unsafe database schemes", () => {
  assert.throws(
    () => loadConfig({ ...valid, DATABASE_URL: "https://example.com" }),
    /DATABASE_URL/,
  );
});
