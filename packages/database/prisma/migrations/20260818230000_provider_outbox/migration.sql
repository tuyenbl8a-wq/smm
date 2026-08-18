CREATE TABLE "provider_outbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_outbox_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "provider_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "provider_outbox_status_check" CHECK ("status" IN ('PENDING','PROCESSING','SUBMITTED','FAILED','UNKNOWN')),
  CONSTRAINT "provider_outbox_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 5)
);
CREATE INDEX "provider_outbox_status_available_at_idx" ON "provider_outbox"("status", "available_at");
