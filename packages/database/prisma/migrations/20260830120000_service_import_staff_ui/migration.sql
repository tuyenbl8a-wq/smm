CREATE TYPE "ProviderDisabledPolicy" AS ENUM ('KEEP_ACTIVE', 'DISABLE_SERVICE', 'REQUIRE_REVIEW');
CREATE TYPE "ProviderSyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "user_permissions" (
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "granted_by" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id", "permission_id"),
  CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

CREATE TABLE "platforms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "icon" VARCHAR(255),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platforms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platforms_name_key" UNIQUE ("name"),
  CONSTRAINT "platforms_slug_key" UNIQUE ("slug"),
  CONSTRAINT "platforms_sort_order_check" CHECK ("sort_order" >= 0)
);
CREATE INDEX "platforms_active_sort_order_idx" ON "platforms"("active", "sort_order");

ALTER TABLE "service_categories" ADD COLUMN "platform_id" UUID;
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "service_categories_platform_id_active_sort_order_idx"
  ON "service_categories"("platform_id", "active", "sort_order");

ALTER TABLE "service_mappings"
  ADD COLUMN "sync_all" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_name" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_cost" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_min" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_max" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_type" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_refill" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_cancel" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_status" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sync_description" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sync_average_time" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "provider_cost_override" DECIMAL(20,8),
  ADD COLUMN "disabled_policy" "ProviderDisabledPolicy" NOT NULL DEFAULT 'REQUIRE_REVIEW';

CREATE TABLE "provider_category_mappings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "provider_category" VARCHAR(255) NOT NULL,
  "platform_id" UUID,
  "category_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_category_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_category_mappings_provider_category_key" UNIQUE ("provider_id", "provider_category"),
  CONSTRAINT "provider_category_mappings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_category_mappings_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "provider_category_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "provider_category_mappings_category_id_idx" ON "provider_category_mappings"("category_id");

CREATE TABLE "provider_sync_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "status" "ProviderSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(3),
  "received" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unchanged" INTEGER NOT NULL DEFAULT 0,
  "stale" INTEGER NOT NULL DEFAULT 0,
  "price_increased" INTEGER NOT NULL DEFAULT 0,
  "price_decreased" INTEGER NOT NULL DEFAULT 0,
  "requires_review" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "error_message" VARCHAR(500),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_sync_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_sync_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "provider_sync_logs_provider_id_started_at_idx" ON "provider_sync_logs"("provider_id", "started_at");
CREATE INDEX "provider_sync_logs_status_started_at_idx" ON "provider_sync_logs"("status", "started_at");

INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), code, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('services.view', 'View services and mappings'), ('pricing.view', 'View internal pricing'),
  ('pricing.manage', 'Manage internal pricing'), ('providers.view', 'View providers'),
  ('staff.view', 'View staff accounts'), ('staff.manage', 'Manage staff accounts'),
  ('users.security.manage', 'Manage user security'), ('settings.view', 'View settings'),
  ('audit.view', 'View audit logs')
) AS requested(code, description)
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" IN ('ADMIN', 'SUPER_ADMIN') AND p."code" IN
  ('services.view','pricing.view','pricing.manage','providers.view','staff.view','staff.manage','users.security.manage','settings.view','audit.view')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "price_groups" ("id", "name", "code", "active", "tier_order", "upgrade_enabled", "upgrade_match_mode", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Khách lẻ', 'KHACH_LE', true, 0, false, 'ALL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Cộng tác viên', 'CTV', true, 10, true, 'ALL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Đại lý', 'DAI_LY', true, 20, true, 'ALL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
UPDATE "price_groups" SET "name" = 'Khách lẻ', "tier_order" = 0 WHERE "code" = 'KHACH_LE';
