import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260907120000_multi_tenant_panels/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const walletGuards = readFileSync(
  new URL(
    "../prisma/migrations/20260818190000_wallet_guards/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("tenant foundation and settlement snapshots exist", () => {
  for (const model of [
    "Site",
    "SiteDomain",
    "PanelRentalPlan",
    "PanelSubscription",
    "SiteServiceRule",
    "OrderSiteSettlement",
  ])
    assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /@@unique\(\[siteId, email\]\)/);
  assert.match(schema, /@@unique\(\[orderId, childSiteId\]\)/);
});

test("tenant migration backfills immutable history without row updates", () => {
  assert.match(migration, /00000000-0000-4000-8000-000000000001/);
  assert.match(migration, /'wallet_transactions'/);
  assert.match(
    migration,
    /ADD COLUMN site_id UUID NOT NULL DEFAULT %L::uuid/,
  );
  assert.match(migration, /ALTER COLUMN site_id DROP DEFAULT/);
  assert.doesNotMatch(migration, /UPDATE\s+(?:%I|wallet_transactions)\s+SET\s+site_id/i);
  assert.doesNotMatch(
    migration,
    /(?:DISABLE|DROP)\s+TRIGGER|DROP\s+FUNCTION\s+prevent_wallet_ledger_mutation/i,
  );
  assert.match(walletGuards, /BEFORE UPDATE ON "wallet_transactions"/);
  assert.match(walletGuards, /BEFORE DELETE ON "wallet_transactions"/);
  assert.doesNotMatch(
    migration,
    /UPDATE\s+wallet_transactions[\s\S]*?(?:amount|balance_before|balance_after|idempotency_key|wallet_id|user_id)/i,
  );
  assert.doesNotMatch(
    migration,
    /\b(TRUNCATE|DROP TABLE|DELETE FROM users|DELETE FROM wallet_transactions)\b/i,
  );
});
