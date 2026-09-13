-- Additive metadata used by tenant-scoped Admin order workflows.
ALTER TABLE "orders" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "orders_tags_idx" ON "orders" USING GIN ("tags");
