-- Additive tenant ownership for providers. Existing provider rows and all dependent
-- services, mappings, orders, logs, and encrypted credentials remain unchanged.
ALTER TABLE "providers"
  ADD COLUMN "site_id" UUID NOT NULL
  DEFAULT '00000000-0000-4000-8000-000000000001'::uuid;

ALTER TABLE "providers" ALTER COLUMN "site_id" DROP DEFAULT;

ALTER TABLE "providers"
  ADD CONSTRAINT "providers_site_fk"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") NOT VALID;
ALTER TABLE "providers" VALIDATE CONSTRAINT "providers_site_fk";

ALTER TABLE "providers" DROP CONSTRAINT "providers_name_key";
CREATE UNIQUE INDEX "providers_site_name_key" ON "providers"("site_id", "name");
CREATE INDEX "providers_site_status_priority_idx"
  ON "providers"("site_id", "status", "priority");
