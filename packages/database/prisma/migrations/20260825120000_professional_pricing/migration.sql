CREATE TYPE "PricingMode" AS ENUM ('FIXED','COST_PLUS_PERCENT','COST_PLUS_FIXED','COST_PLUS_PERCENT_AND_FIXED');
CREATE TYPE "PriceSafetyAction" AS ENUM ('AUTO_RAISE','DISABLE_SERVICE','REQUIRE_REVIEW');
CREATE TYPE "PriceReviewStatus" AS ENUM ('OK','PRICE_REVIEW');
ALTER TABLE "providers" ADD COLUMN "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sync_interval_minutes" INTEGER NOT NULL DEFAULT 15, ADD COLUMN "next_sync_at" TIMESTAMPTZ(3), ADD COLUMN "sync_claimed_at" TIMESTAMPTZ(3);
CREATE INDEX "providers_auto_sync_enabled_next_sync_at_idx" ON "providers"("auto_sync_enabled","next_sync_at");
ALTER TABLE "provider_services" ADD COLUMN "stale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "pricing_mode_strategy" "PricingMode" NOT NULL DEFAULT 'COST_PLUS_PERCENT_AND_FIXED', ADD COLUMN "default_markup_percent" DECIMAL(9,6) NOT NULL DEFAULT 0, ADD COLUMN "default_fixed_profit" DECIMAL(20,8) NOT NULL DEFAULT 0, ADD COLUMN "default_min_profit" DECIMAL(20,8) NOT NULL DEFAULT 0, ADD COLUMN "auto_decrease" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "safety_action" "PriceSafetyAction" NOT NULL DEFAULT 'AUTO_RAISE', ADD COLUMN "max_automatic_increase_percent" DECIMAL(9,6) NOT NULL DEFAULT 50, ADD COLUMN "price_review_status" "PriceReviewStatus" NOT NULL DEFAULT 'OK';
ALTER TABLE "price_groups" ADD COLUMN "default_markup_percent" DECIMAL(9,6) NOT NULL DEFAULT 0, ADD COLUMN "default_fixed_profit" DECIMAL(20,8) NOT NULL DEFAULT 0, ADD COLUMN "default_min_profit" DECIMAL(20,8) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "price_group_id_snapshot" UUID, ADD COLUMN "price_group_code_snapshot" VARCHAR(50);
CREATE INDEX "price_rules_service_id_idx" ON "price_rules"("service_id");
CREATE TABLE "service_price_history" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "service_id" UUID NOT NULL, "provider_id" UUID, "provider_service_id" UUID, "old_provider_cost" DECIMAL(20,8) NOT NULL, "new_provider_cost" DECIMAL(20,8) NOT NULL, "old_sale_rate" DECIMAL(20,8) NOT NULL, "new_sale_rate" DECIMAL(20,8) NOT NULL, "change_percent" DECIMAL(20,8) NOT NULL, "reason" VARCHAR(40) NOT NULL, "source" VARCHAR(80) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "service_price_history_pkey" PRIMARY KEY ("id"));
CREATE INDEX "service_price_history_service_id_created_at_idx" ON "service_price_history"("service_id","created_at");
CREATE INDEX "service_price_history_provider_id_created_at_idx" ON "service_price_history"("provider_id","created_at");
CREATE INDEX "service_price_history_provider_service_id_created_at_idx" ON "service_price_history"("provider_service_id","created_at");
CREATE INDEX "service_price_history_created_at_idx" ON "service_price_history"("created_at");
INSERT INTO "price_groups" ("id","name","code","active","default_markup_percent","default_fixed_profit","default_min_profit","created_at","updated_at") VALUES
(gen_random_uuid(),'Khách lẻ','KHACH_LE',true,30,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'Cộng tác viên','CTV',true,25,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'Đại lý','DAI_LY',true,20,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'Đại lý VIP','DAI_LY_VIP',true,15,0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
