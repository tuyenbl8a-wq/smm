-- System subdomains require no external DNS zone per rental intent.
ALTER TABLE "panel_rental_intents" ALTER COLUMN "provider_zone_id" DROP NOT NULL;

CREATE TABLE "site_disabled_permissions" (
  "site_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_disabled_permissions_pkey" PRIMARY KEY ("site_id","permission_id"),
  CONSTRAINT "site_disabled_permissions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "site_disabled_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "site_disabled_permissions_permission_id_idx" ON "site_disabled_permissions"("permission_id");
