-- A managed provider represents a child -> parent API connection, never the parent's NCC.
ALTER TABLE "providers"
  ADD COLUMN "managed_parent_site_id" UUID,
  ADD COLUMN "managed_api_key_id" UUID;
CREATE UNIQUE INDEX "providers_managed_parent_key"
  ON "providers"("site_id", "managed_parent_site_id")
  WHERE "managed_parent_site_id" IS NOT NULL;
CREATE INDEX "providers_managed_api_key_idx" ON "providers"("managed_api_key_id");
ALTER TABLE "providers" ADD CONSTRAINT "providers_managed_parent_site_id_fkey"
  FOREIGN KEY ("managed_parent_site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "providers" ADD CONSTRAINT "providers_managed_api_key_id_fkey"
  FOREIGN KEY ("managed_api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
