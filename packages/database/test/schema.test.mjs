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
  assert.equal(enums.length, 21);
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

test("service import and staff migration is additive, indexed and permissioned", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260830120000_service_import_staff_ui/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const contract of [
    "platforms",
    "user_permissions",
    "provider_category_mappings",
    "provider_sync_logs",
    "sync_all",
    "sync_cost",
    "disabled_policy",
    "pricing.manage",
    "staff.manage",
  ])
    assert.match(sql, new RegExp(contract.replace(".", "\\.")));
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE/);
});

test("development seed defines exactly three default customer tiers without VIP", () => {
  const seed = readFileSync(
    new URL("../prisma/seed.mjs", import.meta.url),
    "utf8",
  );
  assert.match(seed, /code: "CUSTOMER"/);
  assert.match(seed, /code: "AGENT"/);
  assert.match(seed, /code: "DISTRIBUTOR"/);
  assert.doesNotMatch(seed, /code: "DAI_LY_VIP"|code: "VIP"/);
});

test("payment method management migration is additive and guarded", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260831120000_payment_method_management/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const contract of [
    "exchange_rate",
    "daily_transaction_limit",
    "daily_amount_limit",
    "bonus_percent",
    "payment_methods_amount_range_check",
    "payment_methods_active_sort_order_idx",
  ])
    assert.match(sql, new RegExp(contract));
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE/);
});

test("payment bonus snapshot migration backfills safely and preserves deposits", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260901120000_payment_bonus_snapshot/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /ADD COLUMN "bonus_rate_snapshot"/);
  assert.match(sql, /ADD COLUMN "credited_amount"/);
  assert.match(sql, /UPDATE "deposits" SET "credited_amount" = "net_amount"/);
  assert.match(sql, /ALTER COLUMN "credited_amount" SET NOT NULL/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DROP COLUMN/i);
});

test("customer price-group migration is additive, indexed and permissioned", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260829120000_customer_price_groups/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "price_group_history"/);
  assert.match(sql, /price_group_history_user_id_created_at_idx/);
  assert.match(sql, /price_groups_active_tier_order_idx/);
  assert.match(sql, /users\.pricing\.manage/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/);
});

test("professional pricing migration is additive and indexed", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260825120000_professional_pricing/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /service_price_history/);
  assert.match(sql, /default_markup_percent/);
  assert.match(sql, /price_group_id_snapshot/);
  assert.match(sql, /providers_auto_sync_enabled_next_sync_at_idx/);
  assert.match(sql, /service_price_history_service_id_created_at_idx/);
});

test("pricing operations migration adds alert workflow and history metadata", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260827120000_pricing_operations/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /PriceAlertSeverity/);
  assert.match(sql, /service_price_history.*metadata/s);
  assert.match(sql, /price_alerts_status_severity_created_at_idx/);
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

test("service editor migration preserves identities and only adds routing state", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260902120000_service_source_editor/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "source"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "restrict_from_api"/);
  assert.match(sql, /NOT EXISTS[\s\S]+service_mappings/);
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM/i);
});

test("granular admin permission migration is additive and idempotent", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260903120000_granular_admin_permissions/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const permission of [
    "orders.view",
    "orders.manage",
    "users.view",
    "users.manage",
    "payments.view",
    "coupons.view",
    "coupons.manage",
    "support.view",
    "support.manage",
  ])
    assert.match(sql, new RegExp(`'${permission.replace(".", "\\.")}'`));
  assert.match(sql, /ON CONFLICT \("code"\) DO NOTHING/);
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM/i);
});

test("wallet manage permission migration preserves legacy grants additively", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260904090000_wallet_manage_permission/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /'wallet\.manage'/);
  assert.match(sql, /'wallets\.adjust'/);
  assert.match(sql, /user_permissions/);
  assert.match(sql, /ON CONFLICT \("user_id", "permission_id"\) DO NOTHING/);
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM/i);
});

test("admin profile migration is additive and canonical tiers preserve users", () => {
  const profile = readFileSync(
    new URL(
      "../prisma/migrations/20260904160000_user_admin_profile/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const tiers = readFileSync(
    new URL(
      "../prisma/migrations/20260904120000_rbac_customer_tiers/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(profile, /ADD COLUMN "full_name"/);
  assert.match(profile, /ADD COLUMN "phone"/);
  for (const code of ["CUSTOMER", "AGENT", "DISTRIBUTOR"])
    assert.match(tiers, new RegExp(`'${code}'`));
  assert.match(tiers, /UPDATE "?users"?/);
  assert.doesNotMatch(profile + tiers, /DELETE FROM "users"|TRUNCATE/i);
});

test("canonical tier migration maps the real legacy fixture without tier-order inference", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260904120000_rbac_customer_tiers/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /'KHACH_LE',customer_id/);
  assert.match(sql, /'NORMAL',customer_id/);
  assert.match(sql, /'CTV',agent_id/);
  assert.match(sql, /'DAI_LY',distributor_id/);
  assert.match(sql, /'DAI_LY_VIP',distributor_id/);
  assert.match(sql, /WHERE name='Đại lý'/);
  assert.doesNotMatch(sql, /old\."tier_order"|old\.tier_order/);
  assert.match(sql, /ON CONFLICT\(price_group_id,service_id\) DO NOTHING/);
  assert.match(sql, /UPDATE price_groups SET active=false/);
});

test("legacy grants are copied to canonical Vietnamese permissions", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260904120000_rbac_customer_tiers/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const pair of [
    "'orders.read','orders.view'",
    "'users.read','users.view'",
    "'wallet.manage','users.balance.manage'",
    "'wallets.adjust','users.balance.manage'",
  ])
    assert.match(sql, new RegExp(pair.replaceAll(".", "\\.")));
  assert.match(sql, /Xem đơn hàng/);
  assert.match(sql, /Điều chỉnh số dư khách hàng/);
});

test("provider retry permission migration is additive and restricted to super admin", () => {
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/20260905120000_order_provider_retry_permission/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /'orders\.retry'/);
  assert.match(sql, /SUPER_ADMIN/);
  assert.match(sql, /ON CONFLICT/);
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM/i);
});

test("User price group stays a scalar foreign key without an implicit Prisma relation", () => {
  const userModel = schema.slice(
    schema.indexOf("model User {"),
    schema.indexOf("model Role {"),
  );
  assert.match(userModel, /priceGroupId String\?/);
  assert.doesNotMatch(userModel, /^\s*priceGroup\s+PriceGroup/m);
});
