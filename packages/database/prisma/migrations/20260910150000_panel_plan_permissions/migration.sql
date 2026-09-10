CREATE TABLE "panel_rental_plan_permissions" (
  "plan_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "panel_rental_plan_permissions_pkey" PRIMARY KEY ("plan_id", "permission_id"),
  CONSTRAINT "panel_rental_plan_permissions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "panel_rental_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "panel_rental_plan_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "panel_rental_plan_permissions_permission_id_idx" ON "panel_rental_plan_permissions"("permission_id");

INSERT INTO "permissions" ("code", "description") VALUES
 ('providers.sync','Synchronize tenant-authorized providers'),
 ('reports.read','Read tenant reports'),
 ('wallet.manage','Manage tenant wallets'),
 ('users.security.manage','Manage tenant user security')
ON CONFLICT ("code") DO NOTHING;

WITH profile(code) AS (VALUES
 ('dashboard.view'),('orders.view'),('orders.manage'),('orders.sync'),('orders.refund'),('orders.retry'),
 ('services.view'),('services.presentation.manage'),('services.pricing.manage'),('services.toggle'),
 ('users.view'),('users.manage'),('users.balance.manage'),('users.pricing.manage'),('users.security.manage'),
 ('payments.view'),('payments.manage'),('payments.approve'),('coupons.view'),('coupons.manage'),
 ('support.view'),('support.manage'),('reports.view'),('reports.read'),('settings.view'),('settings.manage'),
 ('staff.view'),('staff.manage'),('audit.view'),('wallet.manage')
)
INSERT INTO "panel_rental_plan_permissions" ("plan_id","permission_id")
SELECT plan."id", permission."id" FROM "panel_rental_plans" plan
CROSS JOIN profile JOIN "permissions" permission ON permission."code"=profile.code
WHERE plan."code"='CHILLPANEL' ON CONFLICT DO NOTHING;

WITH profile(code) AS (VALUES
 ('dashboard.view'),('orders.view'),('orders.manage'),('orders.sync'),('orders.refund'),('orders.retry'),
 ('services.view'),('services.presentation.manage'),('services.pricing.manage'),('services.toggle'),('services.create'),('services.import'),
 ('providers.view'),('providers.manage'),('providers.sync'),
 ('users.view'),('users.manage'),('users.balance.manage'),('users.pricing.manage'),('users.security.manage'),
 ('payments.view'),('payments.manage'),('payments.approve'),('coupons.view'),('coupons.manage'),
 ('support.view'),('support.manage'),('reports.view'),('reports.read'),('settings.view'),('settings.manage'),
 ('staff.view'),('staff.manage'),('audit.view'),('wallet.manage')
)
INSERT INTO "panel_rental_plan_permissions" ("plan_id","permission_id")
SELECT plan."id", permission."id" FROM "panel_rental_plans" plan
CROSS JOIN profile JOIN "permissions" permission ON permission."code"=profile.code
WHERE plan."code"='PANEL_250K' ON CONFLICT DO NOTHING;
