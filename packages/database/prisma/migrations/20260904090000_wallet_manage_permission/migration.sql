-- Add the operator-facing wallet permission without removing legacy grants.
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'wallet.manage', 'Manage customer wallet balances', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Preserve access for staff explicitly granted the old permission.
INSERT INTO "user_permissions" ("user_id", "permission_id", "granted_by", "created_at", "updated_at")
SELECT up."user_id", replacement."id", up."granted_by", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user_permissions" up
JOIN "permissions" legacy ON legacy."id" = up."permission_id" AND legacy."code" = 'wallets.adjust'
CROSS JOIN "permissions" replacement
WHERE replacement."code" = 'wallet.manage'
ON CONFLICT ("user_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" IN ('ADMIN', 'SUPER_ADMIN') AND p."code" = 'wallet.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
