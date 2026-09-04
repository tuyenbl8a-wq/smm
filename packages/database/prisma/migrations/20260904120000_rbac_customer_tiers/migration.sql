INSERT INTO "price_groups" ("id","name","code","active","tier_order","created_at","updated_at") VALUES
(gen_random_uuid(),'Khách hàng','CUSTOMER',true,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'Đại lý','AGENT',true,10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'Nhà phân phối','DISTRIBUTOR',true,20,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "name"=EXCLUDED."name", "active"=true, "tier_order"=EXCLUDED."tier_order", "updated_at"=CURRENT_TIMESTAMP;
INSERT INTO "price_rules" ("id","price_group_id","service_id","fixed_rate","markup_percent","fixed_profit","min_profit","created_at","updated_at")
SELECT gen_random_uuid(), target."id", rule."service_id", rule."fixed_rate", rule."markup_percent", rule."fixed_profit", rule."min_profit", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "price_rules" rule JOIN "price_groups" old ON old."id"=rule."price_group_id"
JOIN "price_groups" target ON target."code"=CASE WHEN old."tier_order"<=0 THEN 'CUSTOMER' WHEN old."tier_order"<=10 THEN 'AGENT' ELSE 'DISTRIBUTOR' END
WHERE old."code" NOT IN ('CUSTOMER','AGENT','DISTRIBUTOR') ON CONFLICT ("price_group_id","service_id") DO NOTHING;
UPDATE "users" u SET "price_group_id"=target."id", "price_group_evaluated_at"=CURRENT_TIMESTAMP FROM "price_groups" old JOIN "price_groups" target ON target."code"=CASE WHEN old."tier_order"<=0 THEN 'CUSTOMER' WHEN old."tier_order"<=10 THEN 'AGENT' ELSE 'DISTRIBUTOR' END WHERE u."price_group_id"=old."id" AND old."code" NOT IN ('CUSTOMER','AGENT','DISTRIBUTOR');
UPDATE "price_groups" SET "active"=false WHERE "code" NOT IN ('CUSTOMER','AGENT','DISTRIBUTOR');
INSERT INTO "permissions" ("code","description") VALUES
('dashboard.view','Xem tổng quan'),('orders.view','Xem đơn'),('orders.manage','Chỉnh đơn'),('orders.sync','Đồng bộ đơn NCC'),('orders.refund','Hoàn tiền đơn'),('services.view','Xem dịch vụ'),('services.manage','Quản lý dịch vụ'),('services.import','Nhập dịch vụ NCC'),('providers.view','Xem NCC'),('providers.manage','Quản lý NCC'),('users.view','Xem khách hàng'),('users.manage','Quản lý khách hàng'),('users.balance.manage','Điều chỉnh số dư'),('payments.view','Xem thanh toán'),('payments.manage','Quản lý thanh toán'),('payments.approve','Duyệt thanh toán'),('coupons.view','Xem coupon'),('coupons.manage','Quản lý coupon'),('support.view','Xem hỗ trợ'),('support.manage','Quản lý hỗ trợ'),('reports.view','Xem báo cáo'),('settings.view','Xem cài đặt'),('settings.manage','Quản lý cài đặt'),('staff.view','Xem nhân viên'),('staff.manage','Quản lý nhân viên'),('audit.view','Xem audit') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions" ("role_id","permission_id","created_at","updated_at") SELECT r."id",p."id",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP FROM "roles" r CROSS JOIN "permissions" p WHERE r."code"='SUPER_ADMIN' ON CONFLICT DO NOTHING;
