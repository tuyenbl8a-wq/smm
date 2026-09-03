-- Additive source/routing state for the full service editor. Existing mapped
-- services remain API-backed; no mapping, order, or pricing history is removed.
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) NOT NULL DEFAULT 'API',
  ADD COLUMN IF NOT EXISTS "restrict_from_api" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "services" AS service
SET "source" = 'MANUAL'
WHERE NOT EXISTS (
  SELECT 1 FROM "service_mappings" AS mapping
  WHERE mapping."service_id" = service."id" AND mapping."active" = TRUE
);

ALTER TABLE "services"
  ADD CONSTRAINT "services_source_check" CHECK ("source" IN ('MANUAL', 'API'));

CREATE INDEX IF NOT EXISTS "services_source_active_idx"
  ON "services" ("source", "active");
