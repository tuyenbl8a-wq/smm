-- Canonical customer tiers and admin permissions. This migration is intentionally
-- additive/idempotent so it can run against installations containing legacy tiers.
DO $$
DECLARE
  customer_id UUID;
  agent_id UUID;
  distributor_id UUID;
BEGIN
  -- Reuse rows whose unique name is already present before assigning canonical codes.
  SELECT id INTO customer_id FROM price_groups WHERE code='CUSTOMER' OR name='Khách hàng' ORDER BY (code='CUSTOMER') DESC LIMIT 1;
  IF customer_id IS NULL THEN INSERT INTO price_groups(id,name,code,active,default_markup_percent,tier_order,created_at,updated_at) VALUES(gen_random_uuid(),'Khách hàng','CUSTOMER',true,30,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id INTO customer_id; END IF;
  UPDATE price_groups SET code='CUSTOMER',name='Khách hàng',active=true,tier_order=0,default_markup_percent=30,updated_at=CURRENT_TIMESTAMP WHERE id=customer_id;

  SELECT id INTO agent_id FROM price_groups WHERE code='AGENT' OR name='Cộng tác viên' ORDER BY (code='AGENT') DESC LIMIT 1;
  IF agent_id IS NULL THEN INSERT INTO price_groups(id,name,code,active,default_markup_percent,tier_order,created_at,updated_at) VALUES(gen_random_uuid(),'Đại lý','AGENT',true,25,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id INTO agent_id; END IF;
  -- Avoid the legacy DAI_LY/name=Đại lý unique-name collision before the rename.
  UPDATE price_groups SET name='Đại lý (cũ)' WHERE name='Đại lý' AND id<>agent_id;
  UPDATE price_groups SET code='AGENT',name='Đại lý',active=true,tier_order=10,default_markup_percent=25,updated_at=CURRENT_TIMESTAMP WHERE id=agent_id;

  SELECT id INTO distributor_id FROM price_groups WHERE code='DISTRIBUTOR' OR code='DAI_LY' ORDER BY (code='DISTRIBUTOR') DESC LIMIT 1;
  IF distributor_id IS NULL THEN INSERT INTO price_groups(id,name,code,active,default_markup_percent,tier_order,created_at,updated_at) VALUES(gen_random_uuid(),'Nhà phân phối','DISTRIBUTOR',true,20,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id INTO distributor_id; END IF;
  UPDATE price_groups SET code='DISTRIBUTOR',name='Nhà phân phối',active=true,tier_order=20,default_markup_percent=20,updated_at=CURRENT_TIMESTAMP WHERE id=distributor_id;

  -- Preserve users while mapping by explicit legacy code (never tier_order).
  UPDATE users SET price_group_id=customer_id,price_group_evaluated_at=CURRENT_TIMESTAMP WHERE price_group_id IN (SELECT id FROM price_groups WHERE code IN ('KHACH_LE','NORMAL'));
  UPDATE users SET price_group_id=agent_id,price_group_evaluated_at=CURRENT_TIMESTAMP WHERE price_group_id IN (SELECT id FROM price_groups WHERE code='CTV');
  UPDATE users SET price_group_id=distributor_id,price_group_evaluated_at=CURRENT_TIMESTAMP WHERE price_group_id IN (SELECT id FROM price_groups WHERE code IN ('DAI_LY','DAI_LY_VIP'));

  -- Prefer source rules in the required order and keep canonical rules on reruns.
  INSERT INTO price_rules(id,price_group_id,service_id,fixed_rate,markup_percent,fixed_profit,min_profit,created_at,updated_at)
  SELECT gen_random_uuid(), target_id, service_id, fixed_rate, markup_percent, fixed_profit, min_profit, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM (
    SELECT DISTINCT ON (r.service_id, m.target_id) r.*,m.target_id
    FROM price_rules r JOIN price_groups old ON old.id=r.price_group_id
    JOIN (VALUES ('KHACH_LE',customer_id,1),('NORMAL',customer_id,2),('CTV',agent_id,1),('DAI_LY',distributor_id,1),('DAI_LY_VIP',distributor_id,2)) m(code,target_id,priority) ON old.code=m.code
    ORDER BY r.service_id,m.target_id,m.priority
  ) preferred
  ON CONFLICT(price_group_id,service_id) DO NOTHING;

  UPDATE price_groups SET active=false WHERE id NOT IN (customer_id,agent_id,distributor_id);
END $$;

INSERT INTO permissions(code,description) VALUES
('dashboard.view','Xem tổng quan'),('orders.view','Xem đơn hàng'),('orders.manage','Chỉnh sửa đơn hàng'),('orders.sync','Đồng bộ đơn từ nhà cung cấp'),('orders.refund','Hoàn tiền đơn hàng'),('services.view','Xem dịch vụ'),('services.manage','Quản lý dịch vụ'),('services.import','Nhập dịch vụ từ nhà cung cấp'),('providers.view','Xem nhà cung cấp'),('providers.manage','Quản lý nhà cung cấp'),('users.view','Xem khách hàng'),('users.manage','Quản lý khách hàng'),('users.balance.manage','Điều chỉnh số dư khách hàng'),('payments.view','Xem thanh toán'),('payments.manage','Quản lý thanh toán'),('payments.approve','Duyệt thanh toán'),('coupons.view','Xem mã giảm giá'),('coupons.manage','Quản lý mã giảm giá'),('support.view','Xem yêu cầu hỗ trợ'),('support.manage','Quản lý hỗ trợ'),('reports.view','Xem báo cáo'),('settings.view','Xem cài đặt'),('settings.manage','Quản lý cài đặt'),('staff.view','Xem nhân viên'),('staff.manage','Quản lý nhân viên'),('audit.view','Xem nhật ký kiểm toán')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description,updated_at=CURRENT_TIMESTAMP;

-- Copy legacy role and direct grants to canonical permission codes without deleting history.
WITH mapping(legacy,canonical) AS (VALUES ('orders.read','orders.view'),('users.read','users.view'),('wallet.manage','users.balance.manage'),('wallets.adjust','users.balance.manage'),('services.read','services.view'),('providers.read','providers.view'),('payments.read','payments.view'))
INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
SELECT DISTINCT rp.role_id,target.id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM role_permissions rp JOIN permissions old ON old.id=rp.permission_id JOIN mapping m ON m.legacy=old.code JOIN permissions target ON target.code=m.canonical ON CONFLICT DO NOTHING;
WITH mapping(legacy,canonical) AS (VALUES ('orders.read','orders.view'),('users.read','users.view'),('wallet.manage','users.balance.manage'),('wallets.adjust','users.balance.manage'),('services.read','services.view'),('providers.read','providers.view'),('payments.read','payments.view'))
INSERT INTO user_permissions(user_id,permission_id,granted_by,created_at,updated_at)
SELECT DISTINCT up.user_id,target.id,up.granted_by,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM user_permissions up JOIN permissions old ON old.id=up.permission_id JOIN mapping m ON m.legacy=old.code JOIN permissions target ON target.code=m.canonical ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT r.id,p.id,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM roles r CROSS JOIN permissions p WHERE r.code='SUPER_ADMIN' AND p.code IN ('dashboard.view','orders.view','orders.manage','orders.sync','orders.refund','services.view','services.manage','services.import','providers.view','providers.manage','users.view','users.manage','users.balance.manage','payments.view','payments.manage','payments.approve','coupons.view','coupons.manage','support.view','support.manage','reports.view','settings.view','settings.manage','staff.view','staff.manage','audit.view') ON CONFLICT DO NOTHING;
