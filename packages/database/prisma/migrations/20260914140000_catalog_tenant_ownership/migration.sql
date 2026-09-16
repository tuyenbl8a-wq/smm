-- Add tenant ownership without recreating or deleting existing catalog rows.
ALTER TABLE "platforms" ADD COLUMN "site_id" UUID;
ALTER TABLE "service_categories" ADD COLUMN "site_id" UUID;

UPDATE "platforms" SET "site_id" = '00000000-0000-4000-8000-000000000001' WHERE "site_id" IS NULL;
UPDATE "service_categories" SET "site_id" = '00000000-0000-4000-8000-000000000001' WHERE "site_id" IS NULL;

ALTER TABLE "platforms" ALTER COLUMN "site_id" SET NOT NULL;
ALTER TABLE "service_categories" ALTER COLUMN "site_id" SET NOT NULL;
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "platforms_name_key";
DROP INDEX IF EXISTS "platforms_slug_key";
DROP INDEX IF EXISTS "service_categories_slug_key";
CREATE UNIQUE INDEX "platforms_site_id_slug_key" ON "platforms"("site_id", "slug");
CREATE INDEX "platforms_site_active_sort_idx" ON "platforms"("site_id", "active", "sort_order");
CREATE UNIQUE INDEX "service_categories_site_id_slug_key" ON "service_categories"("site_id", "slug");
CREATE INDEX "service_categories_site_active_sort_idx" ON "service_categories"("site_id", "active", "sort_order");
CREATE INDEX "service_categories_site_platform_active_sort_idx" ON "service_categories"("site_id", "platform_id", "active", "sort_order");
