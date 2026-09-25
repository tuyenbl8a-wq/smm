BEGIN;

-- The provider ownership column, index and FK are supplied by the restored
-- 20260911130000_provider_tenant_ownership migration. This migration changes
-- only the explicit site type.
CREATE TYPE "PanelType" AS ENUM ('PANEL', 'CHILD_PANEL');
ALTER TABLE "sites" ADD COLUMN "panel_type" "PanelType";

DO $$
BEGIN
  IF (SELECT count(*) FROM "sites" WHERE "id" = '00000000-0000-4000-8000-000000000001'::uuid AND "parent_site_id" IS NULL) <> 1 THEN
    RAISE EXCEPTION 'PANEL_TYPE_ROOT_UNRESOLVED: expected the canonical ROOT site';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'providers_site_fk'
      AND conrelid = 'providers'::regclass
      AND confrelid = 'sites'::regclass
      AND contype = 'f'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'PANEL_TYPE_PROVIDER_OWNERSHIP_UNRESOLVED: historical provider FK missing or unvalidated';
  END IF;
END $$;

UPDATE "sites"
SET "panel_type" = 'PANEL'
WHERE "id" = '00000000-0000-4000-8000-000000000001'::uuid
  AND "parent_site_id" IS NULL;

-- PANEL_250K was the named legacy full-Panel contract. The historical
-- provider-tenant code granted its site owner provider management, and the
-- resale permission distinguishes it from CHILLPANEL. Require the matching
-- seller/parent, owner and uncapped permission rather than a permission alone.
WITH latest_subscription AS (
  SELECT DISTINCT ON ("site_id") "id", "site_id", "seller_site_id", "plan_id"
  FROM "panel_subscriptions"
  ORDER BY "site_id", "created_at" DESC, "id" DESC
)
UPDATE "sites" site
SET "panel_type" = 'PANEL'
FROM latest_subscription subscription
JOIN "panel_rental_plans" plan
  ON plan."id" = subscription."plan_id"
WHERE site."id" = subscription."site_id"
  AND site."parent_site_id" = subscription."seller_site_id"
  AND site."owner_user_id" IS NOT NULL
  AND plan."seller_site_id" = subscription."seller_site_id"
  AND plan."code" = 'PANEL_250K'
  AND plan."allow_panel_resale" = TRUE
  AND EXISTS (
    SELECT 1 FROM "panel_rental_plan_permissions" link
    JOIN "permissions" permission ON permission."id" = link."permission_id"
    WHERE link."plan_id" = plan."id"
      AND permission."code" = 'providers.manage'
  )
  AND EXISTS (
    SELECT 1 FROM "panel_rental_plan_permissions" link
    JOIN "permissions" permission ON permission."id" = link."permission_id"
    WHERE link."plan_id" = plan."id"
      AND permission."code" = 'panels.resale.manage'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "site_disabled_permissions" disabled
    JOIN "permissions" permission ON permission."id" = disabled."permission_id"
    WHERE disabled."site_id" = site."id"
      AND permission."code" = 'providers.manage'
  );

-- A CHILLPANEL is only classified when the original activated rental intent
-- and current subscription agree and no plan change or independent provider
-- contradicts that original child-only contract.
WITH latest_subscription AS (
  SELECT DISTINCT ON ("site_id") "id", "site_id", "seller_site_id", "plan_id"
  FROM "panel_subscriptions"
  ORDER BY "site_id", "created_at" DESC, "id" DESC
)
UPDATE "sites" site
SET "panel_type" = 'CHILD_PANEL'
FROM latest_subscription subscription
JOIN "panel_rental_plans" plan
  ON plan."id" = subscription."plan_id"
WHERE site."id" = subscription."site_id"
  AND site."panel_type" IS NULL
  AND site."parent_site_id" = subscription."seller_site_id"
  AND plan."seller_site_id" = subscription."seller_site_id"
  AND plan."code" = 'CHILLPANEL'
  AND plan."allow_panel_resale" = FALSE
  AND EXISTS (
    SELECT 1 FROM "panel_rental_intents" intent
    WHERE intent."activated_site_id" = site."id"
      AND intent."plan_id" = subscription."plan_id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "audit_logs" audit
    WHERE audit."action" = 'PANEL_PLAN_CHANGE'
      AND audit."resource_id" = subscription."id"::text
  )
  AND NOT EXISTS (
    SELECT 1 FROM "providers" provider
    WHERE provider."site_id" = site."id"
      AND provider."managed_parent_site_id" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "panel_rental_plan_permissions" link
    JOIN "permissions" permission ON permission."id" = link."permission_id"
    WHERE link."plan_id" = plan."id"
      AND permission."code" = 'providers.manage'
  );

DO $$
DECLARE unresolved_count bigint;
BEGIN
  SELECT count(*) INTO unresolved_count FROM "sites" WHERE "panel_type" IS NULL;
  IF unresolved_count <> 0 THEN
    RAISE EXCEPTION 'PANEL_TYPE_BACKFILL_UNRESOLVED: % site(s) require explicit classification', unresolved_count;
  END IF;
END $$;

ALTER TABLE "sites" ALTER COLUMN "panel_type" SET NOT NULL;
ALTER TABLE "sites" ALTER COLUMN "panel_type" SET DEFAULT 'CHILD_PANEL';
COMMIT;
