-- Defense-in-depth for databases upgraded from pre-tenant releases.
-- Legacy identities are root identities, never wildcard identities.
UPDATE "users"
SET "site_id" = '00000000-0000-4000-8000-000000000001'::uuid
WHERE "site_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "site_id" SET NOT NULL;

-- Snapshot uniqueness must include the tenant or one site's daily aggregate can
-- overwrite another site's aggregate for the same timezone and date.
DROP INDEX IF EXISTS "daily_report_snapshots_date_timezone_key";
ALTER TABLE "daily_report_snapshots"
  DROP CONSTRAINT IF EXISTS "daily_report_snapshots_date_timezone_key";
CREATE UNIQUE INDEX IF NOT EXISTS "daily_report_snapshots_site_date_timezone_key"
  ON "daily_report_snapshots" ("site_id", "date", "timezone");
