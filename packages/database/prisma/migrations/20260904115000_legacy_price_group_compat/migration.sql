BEGIN;

-- The production-applied RBAC migration inserts AGENT with the name "Đại lý".
-- An earlier seed uses that name for legacy DAI_LY on a fresh database.
-- Current production already has AGENT and a distinct legacy name, so this is a no-op there.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "price_groups"
    WHERE "code" = 'DAI_LY' AND "name" = 'Đại lý'
  ) AND NOT EXISTS (
    SELECT 1 FROM "price_groups" WHERE "code" = 'AGENT'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "price_groups" WHERE "name" = 'Legacy DAI_LY'
    ) THEN
      RAISE EXCEPTION 'LEGACY_PRICE_GROUP_NAME_CONFLICT';
    END IF;
    UPDATE "price_groups"
    SET "name" = 'Legacy DAI_LY', "updated_at" = CURRENT_TIMESTAMP
    WHERE "code" = 'DAI_LY' AND "name" = 'Đại lý';
  END IF;
END $$;

COMMIT;
