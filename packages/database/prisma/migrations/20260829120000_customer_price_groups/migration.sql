CREATE TYPE "UpgradeMatchMode" AS ENUM ('ALL', 'ANY');
CREATE TYPE "PriceGroupChangeSource" AS ENUM ('MANUAL', 'AUTO');
ALTER TABLE "users" ADD COLUMN "price_group_evaluated_at" TIMESTAMPTZ(3);
CREATE INDEX "users_status_price_group_evaluated_at_idx" ON "users"("status", "price_group_evaluated_at");
ALTER TABLE "price_groups"
  ADD COLUMN "tier_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "public_description" TEXT,
  ADD COLUMN "upgrade_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "upgrade_match_mode" "UpgradeMatchMode" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "min_successful_deposits" DECIMAL(20,8),
  ADD COLUMN "min_total_spent" DECIMAL(20,8),
  ADD COLUMN "min_completed_orders" INTEGER;
CREATE INDEX "price_groups_active_tier_order_idx" ON "price_groups"("active", "tier_order");
CREATE TABLE "price_group_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "old_price_group_id" UUID,
  "old_price_group_code" VARCHAR(50),
  "old_price_group_name" VARCHAR(100),
  "new_price_group_id" UUID NOT NULL,
  "new_price_group_code" VARCHAR(50) NOT NULL,
  "new_price_group_name" VARCHAR(100) NOT NULL,
  "source" "PriceGroupChangeSource" NOT NULL,
  "actor_id" UUID,
  "reason" VARCHAR(500),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_group_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_group_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "price_group_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
ALTER TABLE "price_groups"
  ADD CONSTRAINT "price_groups_tier_order_check" CHECK ("tier_order" >= 0),
  ADD CONSTRAINT "price_groups_min_successful_deposits_check" CHECK ("min_successful_deposits" IS NULL OR "min_successful_deposits" >= 0),
  ADD CONSTRAINT "price_groups_min_total_spent_check" CHECK ("min_total_spent" IS NULL OR "min_total_spent" >= 0),
  ADD CONSTRAINT "price_groups_min_completed_orders_check" CHECK ("min_completed_orders" IS NULL OR "min_completed_orders" >= 0);
CREATE INDEX "price_group_history_user_id_created_at_idx" ON "price_group_history"("user_id", "created_at");
CREATE INDEX "price_group_history_actor_id_created_at_idx" ON "price_group_history"("actor_id", "created_at");
CREATE INDEX "price_group_history_source_created_at_idx" ON "price_group_history"("source", "created_at");
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'users.pricing.manage', 'Manage customer price groups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" IN ('ADMIN', 'SUPER_ADMIN') AND p."code" = 'users.pricing.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
