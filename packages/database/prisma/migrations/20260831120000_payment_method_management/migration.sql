ALTER TABLE "payment_methods"
  ADD COLUMN "icon" VARCHAR(2048),
  ADD COLUMN "exchange_rate" DECIMAL(24,12) NOT NULL DEFAULT 1,
  ADD COLUMN "daily_transaction_limit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "daily_amount_limit" DECIMAL(20,8) NOT NULL DEFAULT 0,
  ADD COLUMN "bonus_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
  ADD COLUMN "instructions" TEXT,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "payment_methods"
  ADD CONSTRAINT "payment_methods_daily_transaction_limit_check" CHECK ("daily_transaction_limit" >= 0),
  ADD CONSTRAINT "payment_methods_daily_amount_limit_check" CHECK ("daily_amount_limit" >= 0),
  ADD CONSTRAINT "payment_methods_sort_order_check" CHECK ("sort_order" >= 0),
  ADD CONSTRAINT "payment_methods_amount_range_check" CHECK ("min_amount" >= 0 AND ("max_amount" = 0 OR "max_amount" >= "min_amount")),
  ADD CONSTRAINT "payment_methods_exchange_rate_check" CHECK ("exchange_rate" > 0);

CREATE INDEX "payment_methods_active_sort_order_idx" ON "payment_methods"("active", "sort_order");
