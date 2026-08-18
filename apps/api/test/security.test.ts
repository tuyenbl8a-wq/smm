import assert from "node:assert/strict";
import test from "node:test";
import {
  csrfValue,
  hashPassword,
  tokenHash,
  verifyCsrf,
  verifyPassword,
} from "../src/auth/security.js";

test("password hashes are salted and verifiable", async () => {
  const first = await hashPassword("StrongPassword123");
  const second = await hashPassword("StrongPassword123");
  assert.equal(first === second, false);
  assert.equal(await verifyPassword("StrongPassword123", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
});

test("session token hashes are deterministic without exposing the token", () => {
  const hash = tokenHash("private-session-token");
  assert.equal(hash.length, 64);
  assert.equal(hash.includes("private-session-token"), false);
});

test("CSRF values are bound to the current session", () => {
  const value = csrfValue("session-a", "csrf-secret");
  assert.equal(verifyCsrf(value, "session-a", "csrf-secret"), true);
  assert.equal(verifyCsrf(value, "session-b", "csrf-secret"), false);
});
