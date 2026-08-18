ALTER TABLE "refills"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_error" VARCHAR(100),
  ADD CONSTRAINT "refills_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5);
CREATE INDEX "refills_status_next_attempt_at_index" ON "refills" ("status", "next_attempt_at");

ALTER TABLE "cancellations"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_error" VARCHAR(100),
  ADD CONSTRAINT "cancellations_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5);
CREATE INDEX "cancellations_status_next_attempt_at_index" ON "cancellations" ("status", "next_attempt_at");
