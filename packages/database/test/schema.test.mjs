import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
test("financial records have database idempotency constraints", () => {
  for (const name of ["WalletTransaction", "Refill", "Cancellation"]) {
    const body =
      schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ??
      "";
    assert.match(body, /idempotencyKey String @unique/);
  }
});
test("money never uses floating point", () => {
  assert.doesNotMatch(schema, /\bFloat\b/);
  assert.match(schema, /balance Decimal/);
  assert.match(schema, /providerCost Decimal/);
});
test("all Prisma enum values use multiline declarations", () => {
  assert.doesNotMatch(schema, /enum\s+\w+\s*\{[^\n{}]+\}/);
  const enums = [...schema.matchAll(/enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
  assert.equal(enums.length, 12);
  for (const [, , body] of enums) {
    const values = body
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    assert.equal(
      values.every((value) => !/\s/.test(value)),
      true,
    );
  }
});
test("external payment identities are unique", () => {
  assert.match(schema, /externalTransactionId String\? @unique/);
  assert.match(schema, /@@unique\(\[paymentMethodId, externalEventId\]\)/);
});
test("initial migration creates every mapped model table", () => {
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260818130000_initial/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const table of schema.matchAll(/@@map\("([^"]+)"\)/g))
    assert.match(migration, new RegExp(`CREATE TABLE "${table[1]}"`));
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  assert.match(migration, /FOREIGN KEY/);
});
test("development seed requires environment credentials and blocks production", () => {
  const seed = readFileSync(
    new URL("../prisma/seed.mjs", import.meta.url),
    "utf8",
  );
  assert.match(seed, /NODE_ENV === "production"/);
  assert.match(seed, /required\("DEV_SEED_ADMIN_PASSWORD"\)/);
  assert.doesNotMatch(seed, /password\s*=\s*["'][^"']+["']/i);
});
