CREATE TYPE "PriceAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "PriceAlertStatus" AS ENUM ('OPEN', 'RESOLVED');
ALTER TABLE "service_price_history" ADD COLUMN "metadata" JSONB;
CREATE TABLE "price_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_id" UUID,
  "provider_id" UUID,
  "provider_service_id" UUID,
  "type" VARCHAR(50) NOT NULL,
  "severity" "PriceAlertSeverity" NOT NULL,
  "status" "PriceAlertStatus" NOT NULL DEFAULT 'OPEN',
  "title" VARCHAR(180) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "metadata" JSONB,
  "resolved_by" UUID,
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_alerts_status_severity_created_at_idx" ON "price_alerts"("status", "severity", "created_at");
CREATE INDEX "price_alerts_service_id_created_at_idx" ON "price_alerts"("service_id", "created_at");
CREATE INDEX "price_alerts_provider_id_created_at_idx" ON "price_alerts"("provider_id", "created_at");
