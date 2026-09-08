CREATE TYPE "PanelRentalIntentStatus" AS ENUM (
  'PENDING_DNS',
  'PAYMENT_REQUIRED',
  'ACTIVATED',
  'CANCELED',
  'EXPIRED'
);

CREATE TABLE "panel_rental_intents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "seller_site_id" UUID NOT NULL REFERENCES "sites"("id"),
  "renter_user_id" UUID NOT NULL REFERENCES "users"("id"),
  "plan_id" UUID NOT NULL REFERENCES "panel_rental_plans"("id"),
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "hostname" VARCHAR(253) NOT NULL UNIQUE,
  "provider_zone_id" VARCHAR(160) NOT NULL UNIQUE,
  "assigned_nameservers" JSONB NOT NULL,
  "status" "PanelRentalIntentStatus" NOT NULL DEFAULT 'PENDING_DNS',
  "auto_renew" BOOLEAN NOT NULL DEFAULT FALSE,
  "request_key" VARCHAR(128) NOT NULL UNIQUE,
  "activation_key" VARCHAR(128) NOT NULL UNIQUE,
  "activated_site_id" UUID REFERENCES "sites"("id"),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "panel_rental_intents_seller_site_id_renter_user_id_status_idx"
  ON "panel_rental_intents"("seller_site_id", "renter_user_id", "status");
CREATE INDEX "panel_rental_intents_status_expires_at_idx"
  ON "panel_rental_intents"("status", "expires_at");

ALTER TABLE "site_domains"
  ADD COLUMN "provider_zone_id" VARCHAR(160),
  ADD COLUMN "assigned_nameservers" JSONB;
CREATE UNIQUE INDEX "site_domains_provider_zone_id_key"
  ON "site_domains"("provider_zone_id");
