-- Add stable numeric public identifiers without changing UUID primary/foreign keys.
CREATE SEQUENCE IF NOT EXISTS "users_user_number_seq" START WITH 100001 INCREMENT BY 1;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_number" BIGINT;
WITH numbered AS (
  SELECT "id", 100000 + ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS value
  FROM "users" WHERE "user_number" IS NULL
)
UPDATE "users" u SET "user_number" = numbered.value FROM numbered WHERE u."id" = numbered."id";
SELECT setval('"users_user_number_seq"', GREATEST(COALESCE((SELECT MAX("user_number") FROM "users"), 100000), 100000) + 1, false);
ALTER TABLE "users" ALTER COLUMN "user_number" SET DEFAULT nextval('"users_user_number_seq"');
ALTER TABLE "users" ALTER COLUMN "user_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_user_number_key" ON "users"("user_number");

CREATE SEQUENCE IF NOT EXISTS "services_service_number_seq" START WITH 1001 INCREMENT BY 1;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "service_number" BIGINT;
WITH numbered AS (
  SELECT "id", 1000 + ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS value
  FROM "services" WHERE "service_number" IS NULL
)
UPDATE "services" s SET "service_number" = numbered.value FROM numbered WHERE s."id" = numbered."id";
SELECT setval('"services_service_number_seq"', GREATEST(COALESCE((SELECT MAX("service_number") FROM "services"), 1000), 1000) + 1, false);
ALTER TABLE "services" ALTER COLUMN "service_number" SET DEFAULT nextval('"services_service_number_seq"');
ALTER TABLE "services" ALTER COLUMN "service_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "services_service_number_key" ON "services"("service_number");
