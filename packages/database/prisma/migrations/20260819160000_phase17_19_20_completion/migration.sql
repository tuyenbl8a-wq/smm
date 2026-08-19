CREATE TABLE "payment_reconciliation_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "deposit_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 8,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMPTZ(3),
  "claim_token" UUID,
  "last_error" VARCHAR(120),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_reconciliation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_reconciliation_jobs_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= "max_attempts"),
  CONSTRAINT "payment_reconciliation_jobs_max_attempts_check" CHECK ("max_attempts" BETWEEN 1 AND 20),
  CONSTRAINT "payment_reconciliation_jobs_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "payment_reconciliation_jobs_deposit_id_key" ON "payment_reconciliation_jobs"("deposit_id");
CREATE UNIQUE INDEX "payment_reconciliation_jobs_claim_token_key" ON "payment_reconciliation_jobs"("claim_token");
CREATE INDEX "payment_reconciliation_jobs_provider_status_next_attempt_at_idx" ON "payment_reconciliation_jobs"("provider", "status", "next_attempt_at");
CREATE INDEX "payment_reconciliation_jobs_status_claimed_at_idx" ON "payment_reconciliation_jobs"("status", "claimed_at");

ALTER TABLE "orders" ADD COLUMN "original_charge" DECIMAL(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_code" VARCHAR(50);
UPDATE "orders" SET "original_charge"="charge" WHERE "original_charge"=0;
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_bounds" CHECK ("discount_amount">=0 AND "charge">=0 AND "original_charge">="charge");

CREATE TABLE "daily_report_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "date" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "revenue" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "provider_cost" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "gross_profit" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "deposit_amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "refunded_amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "total_orders" INTEGER NOT NULL DEFAULT 0,
  "failed_orders" INTEGER NOT NULL DEFAULT 0,
  "partial_orders" INTEGER NOT NULL DEFAULT 0,
  "new_users" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_report_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "daily_report_snapshots_date_timezone_key" ON "daily_report_snapshots"("date", "timezone");
CREATE INDEX "daily_report_snapshots_timezone_date_idx" ON "daily_report_snapshots"("timezone", "date");
