-- Initial production schema generated from prisma/schema.prisma
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BANNED', 'DELETED');
CREATE TYPE "RoleCode" AS ENUM ('USER', 'RESELLER', 'SUPPORT', 'STAFF', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'ORDER', 'REFUND', 'ADMIN_ADD', 'ADMIN_SUBTRACT', 'AFFILIATE', 'BONUS', 'ADJUSTMENT');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'CANCELED', 'REFUNDED', 'FAILED');
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED', 'MANUAL_REVIEW');
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'INACTIVE');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ANSWERED', 'CUSTOMER_REPLY', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELED');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNKNOWN');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM');

CREATE TABLE "users" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL UNIQUE,
  "username" VARCHAR(64) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "email_verified_at" TIMESTAMPTZ(3),
  "avatar_key" VARCHAR(512),
  "price_group_id" UUID,
  "referral_code" VARCHAR(32) NOT NULL UNIQUE,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "users_status_created_at_index" ON "users" ("status", "created_at");

CREATE TABLE "roles" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" "RoleCode" NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "permissions" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL UNIQUE,
  "description" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "role_id")
);
CREATE INDEX "user_roles_role_id_index" ON "user_roles" ("role_id");

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("role_id", "permission_id")
);
CREATE INDEX "role_permissions_permission_id_index" ON "role_permissions" ("permission_id");

CREATE TABLE "sessions" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL UNIQUE,
  "ip_address" INET,
  "user_agent" VARCHAR(512),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sessions_user_id_expires_at_index" ON "sessions" ("user_id", "expires_at");

CREATE TABLE "api_keys" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "key_prefix" VARCHAR(16) NOT NULL,
  "key_hash" VARCHAR(128) NOT NULL UNIQUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "rate_limit" INTEGER NOT NULL DEFAULT 60,
  "last_used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "api_keys_user_id_active_index" ON "api_keys" ("user_id", "active");

CREATE TABLE "wallets" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE,
  "balance" NUMERIC(20,8) NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "wallet_transactions" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" NUMERIC(20,8) NOT NULL,
  "balance_before" NUMERIC(20,8) NOT NULL,
  "balance_after" NUMERIC(20,8) NOT NULL,
  "reference_id" VARCHAR(128),
  "idempotency_key" VARCHAR(128) NOT NULL UNIQUE,
  "description" VARCHAR(500),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "wallet_transactions_user_id_created_at_index" ON "wallet_transactions" ("user_id", "created_at");
CREATE INDEX "wallet_transactions_wallet_id_created_at_index" ON "wallet_transactions" ("wallet_id", "created_at");
CREATE INDEX "wallet_transactions_type_reference_id_index" ON "wallet_transactions" ("type", "reference_id");

CREATE TABLE "payment_methods" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  "provider_type" VARCHAR(50) NOT NULL,
  "config_encrypted" TEXT,
  "currency" VARCHAR(10) NOT NULL,
  "min_amount" NUMERIC(20,8) NOT NULL,
  "max_amount" NUMERIC(20,8) NOT NULL,
  "fee_fixed" NUMERIC(20,8) NOT NULL DEFAULT 0,
  "fee_percent" NUMERIC(9,6) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "deposits" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "payment_method_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
  "gross_amount" NUMERIC(20,8) NOT NULL,
  "fee_amount" NUMERIC(20,8) NOT NULL,
  "net_amount" NUMERIC(20,8) NOT NULL,
  "source_currency" VARCHAR(10) NOT NULL,
  "base_currency" CHAR(3) NOT NULL,
  "exchange_rate" NUMERIC(24,12) NOT NULL,
  "external_order_id" VARCHAR(128) UNIQUE,
  "external_transaction_id" VARCHAR(128) UNIQUE,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "deposits_user_id_created_at_index" ON "deposits" ("user_id", "created_at");
CREATE INDEX "deposits_status_expires_at_index" ON "deposits" ("status", "expires_at");

CREATE TABLE "payment_webhooks" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_method_id" UUID NOT NULL,
  "external_event_id" VARCHAR(160) NOT NULL,
  "signature_valid" BOOLEAN NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "payload_hash" VARCHAR(128) NOT NULL,
  "processed_at" TIMESTAMPTZ(3),
  "error_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "payment_webhooks_payment_method_id_external_event_id_unique" ON "payment_webhooks" ("payment_method_id", "external_event_id");
CREATE INDEX "payment_webhooks_status_created_at_index" ON "payment_webhooks" ("status", "created_at");

CREATE TABLE "providers" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL UNIQUE,
  "api_url" VARCHAR(2048) NOT NULL,
  "api_key_encrypted" TEXT NOT NULL,
  "encryption_key_version" INTEGER NOT NULL,
  "currency" VARCHAR(10) NOT NULL,
  "balance" NUMERIC(20,8),
  "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "timeout_ms" INTEGER NOT NULL DEFAULT 15000,
  "max_retries" INTEGER NOT NULL DEFAULT 3,
  "last_success_at" TIMESTAMPTZ(3),
  "last_failure_at" TIMESTAMPTZ(3),
  "last_sync_at" TIMESTAMPTZ(3),
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "providers_status_priority_index" ON "providers" ("status", "priority");

CREATE TABLE "provider_services" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "external_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(255) NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "rate" NUMERIC(20,8) NOT NULL,
  "min" INTEGER NOT NULL,
  "max" INTEGER NOT NULL,
  "refill" BOOLEAN NOT NULL DEFAULT FALSE,
  "cancel" BOOLEAN NOT NULL DEFAULT FALSE,
  "raw" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_synced_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "provider_services_provider_id_external_id_unique" ON "provider_services" ("provider_id", "external_id");
CREATE INDEX "provider_services_provider_id_active_index" ON "provider_services" ("provider_id", "active");

CREATE TABLE "service_categories" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(180) NOT NULL UNIQUE,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "service_categories_active_sort_order_index" ON "service_categories" ("active", "sort_order");

CREATE TABLE "services" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "type" VARCHAR(80) NOT NULL,
  "pricing_model" VARCHAR(40) NOT NULL DEFAULT 'PER_THOUSAND',
  "rate" NUMERIC(20,8) NOT NULL,
  "provider_cost" NUMERIC(20,8) NOT NULL,
  "min" INTEGER NOT NULL,
  "max" INTEGER NOT NULL,
  "average_time" VARCHAR(100),
  "refill" BOOLEAN NOT NULL DEFAULT FALSE,
  "cancel" BOOLEAN NOT NULL DEFAULT FALSE,
  "custom_fields" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "services_category_id_active_sort_order_index" ON "services" ("category_id", "active", "sort_order");

CREATE TABLE "service_mappings" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" UUID NOT NULL,
  "provider_service_id" UUID NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "markup_percent" NUMERIC(9,6),
  "fixed_profit" NUMERIC(20,8),
  "min_profit" NUMERIC(20,8) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "service_mappings_service_id_provider_service_id_unique" ON "service_mappings" ("service_id", "provider_service_id");
CREATE INDEX "service_mappings_service_id_active_priority_index" ON "service_mappings" ("service_id", "active", "priority");

CREATE TABLE "orders" (
  "id" BIGSERIAL NOT NULL PRIMARY KEY,
  "public_id" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "provider_id" UUID,
  "provider_order_id" VARCHAR(128),
  "provider_submit_key" VARCHAR(128) NOT NULL UNIQUE,
  "link" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "start_count" INTEGER,
  "remains" INTEGER,
  "sale_rate" NUMERIC(20,8) NOT NULL,
  "charge" NUMERIC(20,8) NOT NULL,
  "provider_rate" NUMERIC(20,8) NOT NULL,
  "provider_cost" NUMERIC(20,8) NOT NULL,
  "profit" NUMERIC(20,8) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "input" JSONB,
  "refunded_amount" NUMERIC(20,8) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "orders_provider_id_provider_order_id_unique" ON "orders" ("provider_id", "provider_order_id");
CREATE INDEX "orders_user_id_created_at_index" ON "orders" ("user_id", "created_at");
CREATE INDEX "orders_status_updated_at_index" ON "orders" ("status", "updated_at");
CREATE INDEX "orders_service_id_created_at_index" ON "orders" ("service_id", "created_at");

CREATE TABLE "order_history" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus" NOT NULL,
  "details" JSONB,
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "order_history_order_id_created_at_index" ON "order_history" ("order_id", "created_at");

CREATE TABLE "order_provider_logs" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "provider_id" UUID NOT NULL,
  "operation" VARCHAR(60) NOT NULL,
  "request_id" VARCHAR(128) NOT NULL,
  "status" "RequestStatus" NOT NULL,
  "latency_ms" INTEGER,
  "request_masked" JSONB,
  "response_masked" JSONB,
  "error_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "order_provider_logs_provider_id_request_id_operation_unique" ON "order_provider_logs" ("provider_id", "request_id", "operation");
CREATE INDEX "order_provider_logs_order_id_created_at_index" ON "order_provider_logs" ("order_id", "created_at");

CREATE TABLE "refills" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "provider_refill_id" VARCHAR(128),
  "idempotency_key" VARCHAR(128) NOT NULL UNIQUE,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "refills_order_id_created_at_index" ON "refills" ("order_id", "created_at");

CREATE TABLE "cancellations" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" BIGINT NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL UNIQUE,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "cancellations_order_id_created_at_index" ON "cancellations" ("order_id", "created_at");

CREATE TABLE "tickets" (
  "id" BIGSERIAL NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "assignee_id" UUID,
  "subject" VARCHAR(255) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
  "closed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "tickets_user_id_status_updated_at_index" ON "tickets" ("user_id", "status", "updated_at");
CREATE INDEX "tickets_assignee_id_status_updated_at_index" ON "tickets" ("assignee_id", "status", "updated_at");

CREATE TABLE "ticket_messages" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" BIGINT NOT NULL,
  "author_id" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT FALSE,
  "attachments" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ticket_messages_ticket_id_created_at_index" ON "ticket_messages" ("ticket_id", "created_at");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_user_id_read_at_created_at_index" ON "notifications" ("user_id", "read_at", "created_at");

CREATE TABLE "coupons" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "type" "DiscountType" NOT NULL,
  "value" NUMERIC(20,8) NOT NULL,
  "min_amount" NUMERIC(20,8),
  "max_discount" NUMERIC(20,8),
  "usage_limit" INTEGER,
  "user_limit" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "coupons_active_starts_at_ends_at_index" ON "coupons" ("active", "starts_at", "ends_at");

CREATE TABLE "coupon_usages" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "reference_id" VARCHAR(128) NOT NULL,
  "discount" NUMERIC(20,8) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "coupon_usages_coupon_id_user_id_reference_id_unique" ON "coupon_usages" ("coupon_id", "user_id", "reference_id");
CREATE INDEX "coupon_usages_user_id_created_at_index" ON "coupon_usages" ("user_id", "created_at");

CREATE TABLE "affiliates" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE,
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "commission_rate" NUMERIC(9,6) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "referrals" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_id" UUID NOT NULL,
  "referrer_id" UUID NOT NULL,
  "referred_user_id" UUID NOT NULL UNIQUE,
  "qualified_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "referrals_referrer_id_created_at_index" ON "referrals" ("referrer_id", "created_at");

CREATE TABLE "affiliate_commissions" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_id" UUID NOT NULL,
  "referral_id" UUID NOT NULL,
  "reference_id" VARCHAR(128) NOT NULL,
  "amount" NUMERIC(20,8) NOT NULL,
  "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "affiliate_commissions_affiliate_id_reference_id_unique" ON "affiliate_commissions" ("affiliate_id", "reference_id");
CREATE INDEX "affiliate_commissions_status_created_at_index" ON "affiliate_commissions" ("status", "created_at");

CREATE TABLE "price_groups" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "price_rules" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "price_group_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "fixed_rate" NUMERIC(20,8),
  "markup_percent" NUMERIC(9,6),
  "fixed_profit" NUMERIC(20,8),
  "min_profit" NUMERIC(20,8) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "price_rules_price_group_id_service_id_unique" ON "price_rules" ("price_group_id", "service_id");

CREATE TABLE "audit_logs" (
  "id" BIGSERIAL NOT NULL PRIMARY KEY,
  "actor_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "resource" VARCHAR(100) NOT NULL,
  "resource_id" VARCHAR(128),
  "before" JSONB,
  "after" JSONB,
  "ip_address" INET,
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_actor_id_created_at_index" ON "audit_logs" ("actor_id", "created_at");
CREATE INDEX "audit_logs_resource_resource_id_created_at_index" ON "audit_logs" ("resource", "resource_id", "created_at");

CREATE TABLE "login_history" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "email" VARCHAR(320) NOT NULL,
  "success" BOOLEAN NOT NULL,
  "reason" VARCHAR(100),
  "ip_address" INET,
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_history_email_created_at_index" ON "login_history" ("email", "created_at");
CREATE INDEX "login_history_ip_address_created_at_index" ON "login_history" ("ip_address", "created_at");

CREATE TABLE "settings" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "group" VARCHAR(80) NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "encrypted" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "settings_group_key_unique" ON "settings" ("group", "key");

CREATE TABLE "cron_job_logs" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_name" VARCHAR(100) NOT NULL,
  "run_key" VARCHAR(128) NOT NULL UNIQUE,
  "status" "RequestStatus" NOT NULL,
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "finished_at" TIMESTAMPTZ(3),
  "details" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "cron_job_logs_job_name_started_at_index" ON "cron_job_logs" ("job_name", "started_at");

CREATE TABLE "webhook_logs" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" VARCHAR(80) NOT NULL,
  "external_event_id" VARCHAR(160) NOT NULL,
  "status" "RequestStatus" NOT NULL,
  "signature_valid" BOOLEAN NOT NULL,
  "payload_hash" VARCHAR(128) NOT NULL,
  "response_code" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "webhook_logs_source_external_event_id_unique" ON "webhook_logs" ("source", "external_event_id");
CREATE INDEX "webhook_logs_status_created_at_index" ON "webhook_logs" ("status", "created_at");

CREATE TABLE "system_logs" (
  "id" BIGSERIAL NOT NULL PRIMARY KEY,
  "level" VARCHAR(20) NOT NULL,
  "service" VARCHAR(80) NOT NULL,
  "event" VARCHAR(120) NOT NULL,
  "message" TEXT NOT NULL,
  "context" JSONB,
  "trace_id" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "system_logs_service_level_created_at_index" ON "system_logs" ("service", "level", "created_at");
CREATE INDEX "system_logs_trace_id_index" ON "system_logs" ("trace_id");

ALTER TABLE "users" ADD CONSTRAINT "users_price_group_id_fkey" FOREIGN KEY ("price_group_id") REFERENCES "price_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_webhooks" ADD CONSTRAINT "payment_webhooks_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_mappings" ADD CONSTRAINT "service_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_mappings" ADD CONSTRAINT "service_mappings_provider_service_id_fkey" FOREIGN KEY ("provider_service_id") REFERENCES "provider_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_provider_logs" ADD CONSTRAINT "order_provider_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_provider_logs" ADD CONSTRAINT "order_provider_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refills" ADD CONSTRAINT "refills_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_price_group_id_fkey" FOREIGN KEY ("price_group_id") REFERENCES "price_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
