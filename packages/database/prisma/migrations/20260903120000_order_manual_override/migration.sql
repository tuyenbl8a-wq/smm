ALTER TABLE "orders"
  ADD COLUMN "manual_override" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "manual_override_at" TIMESTAMPTZ(3);

CREATE INDEX "orders_manual_override_status_updated_at_idx"
  ON "orders" ("manual_override", "status", "updated_at");
