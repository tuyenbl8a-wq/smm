-- Add canonical granular admin permissions without removing legacy grants.
INSERT INTO "permissions" ("code", "description") VALUES
  ('orders.view', 'View orders'),
  ('orders.manage', 'Manage orders'),
  ('users.view', 'View users'),
  ('users.manage', 'Manage users'),
  ('payments.view', 'View payments'),
  ('coupons.view', 'View coupons'),
  ('coupons.manage', 'Manage coupons'),
  ('support.view', 'View support tickets'),
  ('support.manage', 'Manage support tickets')
ON CONFLICT ("code") DO NOTHING;
