-- Tenant-local presentation overlays for inherited platform/category records.
CREATE TABLE "site_platform_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "site_id" UUID NOT NULL,
  "platform_id" UUID NOT NULL, "display_name" VARCHAR(120),
  "display_description" TEXT, "display_icon" VARCHAR(2048), "sort_order" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "site_platform_rules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "site_category_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "site_id" UUID NOT NULL,
  "category_id" UUID NOT NULL, "display_name" VARCHAR(160),
  "display_description" TEXT, "display_icon" VARCHAR(2048), "sort_order" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "site_category_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_platform_rules_site_id_platform_id_key" ON "site_platform_rules"("site_id", "platform_id");
CREATE INDEX "site_platform_rules_site_active_sort_idx" ON "site_platform_rules"("site_id", "active", "sort_order");
CREATE UNIQUE INDEX "site_category_rules_site_id_category_id_key" ON "site_category_rules"("site_id", "category_id");
CREATE INDEX "site_category_rules_site_active_sort_idx" ON "site_category_rules"("site_id", "active", "sort_order");
ALTER TABLE "site_platform_rules" ADD CONSTRAINT "site_platform_rules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_platform_rules" ADD CONSTRAINT "site_platform_rules_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_category_rules" ADD CONSTRAINT "site_category_rules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_category_rules" ADD CONSTRAINT "site_category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
