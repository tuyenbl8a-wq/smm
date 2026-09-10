-- Child panels may customize only their assigned service presentation and pricing.
ALTER TABLE "site_service_rules"
  ADD COLUMN "display_name" VARCHAR(240),
  ADD COLUMN "display_description" TEXT;

INSERT INTO "permissions" ("code", "description") VALUES
  ('services.presentation.manage', 'Manage tenant-local service presentation'),
  ('services.pricing.manage', 'Manage tenant-local service selling price'),
  ('services.toggle', 'Enable or disable an assigned tenant service'),
  ('services.create', 'Create master services')
ON CONFLICT ("code") DO NOTHING;

-- Existing master-service managers retain their prior capabilities explicitly.
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
SELECT DISTINCT rp."role_id", granular."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "role_permissions" rp
JOIN "permissions" legacy ON legacy."id" = rp."permission_id" AND legacy."code" = 'services.manage'
CROSS JOIN "permissions" granular
WHERE granular."code" IN ('services.presentation.manage','services.pricing.manage','services.toggle','services.create')
ON CONFLICT DO NOTHING;

INSERT INTO "user_permissions" ("user_id", "permission_id", "granted_by", "created_at", "updated_at")
SELECT DISTINCT up."user_id", granular."id", up."granted_by", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user_permissions" up
JOIN "permissions" legacy ON legacy."id" = up."permission_id" AND legacy."code" = 'services.manage'
CROSS JOIN "permissions" granular
WHERE granular."code" IN ('services.presentation.manage','services.pricing.manage','services.toggle','services.create')
ON CONFLICT DO NOTHING;
