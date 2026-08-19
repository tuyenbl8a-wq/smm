import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
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
  const root = new URL("../prisma/migrations/", import.meta.url);
  const migration = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      readFileSync(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    )
    .join("\n");
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
test("wallet migration enforces nonnegative balances and immutable ledger", () => {
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260818190000_wallet_guards/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /CHECK \("balance" >= 0\)/);
  assert.match(migration, /"balance_after" = "balance_before" \+ "amount"/);
  assert.match(migration, /BEFORE UPDATE ON "wallet_transactions"/);
  assert.match(migration, /BEFORE DELETE ON "wallet_transactions"/);
});

test("provider outbox migration prevents duplicate jobs and bounds attempts", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260818230000_provider_outbox/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /UNIQUE \("order_id"\)/);
  assert.match(sql, /FOR UPDATE|attempts_check|attempts.*<= 5/s);
});

test("lifecycle action migration persists bounded retry and stale claims", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260819030000_lifecycle_retry/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /"attempts" BETWEEN 0 AND 5/);
  assert.match(sql, /"next_attempt_at"/);
  assert.match(sql, /"claimed_at"/);
  assert.match(sql, /status_next_attempt_at_index/);
});

test("phase 17-20 migration adds durable reconciliation, promotion snapshots and reports", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260819160000_phase17_19_20_completion/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /payment_reconciliation_jobs/);
  assert.match(sql, /claim_token/);
  assert.match(sql, /payment_reconciliation_jobs_deposit_id_key/);
  assert.match(sql, /attempts_check/);
  assert.match(sql, /original_charge/);
  assert.match(sql, /discount_amount/);
  assert.match(sql, /daily_report_snapshots_date_timezone_key/);
});
