-- Additive reseller capability. Childpanel plans are deliberately excluded.
INSERT INTO "permissions" ("code", "description")
VALUES ('panels.resale.manage', 'Manage panels sold directly by this tenant')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "panel_rental_plan_permissions" ("plan_id", "permission_id")
SELECT plan."id", permission."id"
FROM "panel_rental_plans" plan
JOIN "permissions" permission ON permission."code" = 'panels.resale.manage'
WHERE plan."allow_panel_resale" = TRUE
  AND plan."active" = TRUE
  AND plan."code" <> 'CHILLPANEL'
ON CONFLICT DO NOTHING;
