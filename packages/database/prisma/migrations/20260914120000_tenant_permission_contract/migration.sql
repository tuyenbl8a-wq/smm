-- Additive repair of the canonical tenant permission ceiling for existing plans.
-- Plan inactivity controls new sales only, so both active and inactive existing plans are repaired.
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), code, description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('orders.retry', 'Retry failed provider orders'),
  ('services.presentation.manage', 'Manage tenant service presentation'),
  ('services.pricing.manage', 'Manage tenant service selling prices'),
  ('services.toggle', 'Enable or disable tenant services'),
  ('providers.sync', 'Synchronize tenant providers'),
  ('reports.read', 'Read tenant reports'),
  ('users.security.manage', 'Manage tenant user security'),
  ('wallet.manage', 'Manage tenant wallets'),
  ('audit.view', 'View tenant audit log')
) AS required(code, description)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "panel_rental_plan_permissions" ("plan_id", "permission_id", "created_at", "updated_at")
SELECT plan."id", permission."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "panel_rental_plans" plan
JOIN "permissions" permission ON permission."code" IN (
  'orders.retry','services.presentation.manage','services.pricing.manage','services.toggle',
  'reports.read','users.security.manage','wallet.manage','audit.view'
)
WHERE plan."code" IN ('PANEL_250K','CHILLPANEL')
ON CONFLICT DO NOTHING;

INSERT INTO "panel_rental_plan_permissions" ("plan_id", "permission_id", "created_at", "updated_at")
SELECT plan."id", permission."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "panel_rental_plans" plan
JOIN "permissions" permission ON permission."code" = 'providers.sync'
WHERE plan."code" = 'PANEL_250K'
ON CONFLICT DO NOTHING;
