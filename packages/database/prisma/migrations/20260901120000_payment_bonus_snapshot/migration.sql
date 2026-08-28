ALTER TABLE "deposits"
  ADD COLUMN "bonus_rate_snapshot" DECIMAL(9,6) NOT NULL DEFAULT 0,
  ADD COLUMN "credited_amount" DECIMAL(20,8);

UPDATE "deposits" SET "credited_amount" = "net_amount" WHERE "credited_amount" IS NULL;

ALTER TABLE "deposits"
  ALTER COLUMN "credited_amount" SET NOT NULL,
  ADD CONSTRAINT "deposits_bonus_rate_snapshot_check" CHECK ("bonus_rate_snapshot" >= 0),
  ADD CONSTRAINT "deposits_credited_amount_check" CHECK ("credited_amount" >= 0);
