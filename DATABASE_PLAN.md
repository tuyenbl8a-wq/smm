# SMM Panel Database Plan

## Database Choice

Use PostgreSQL for the primary database because the project requires relational integrity, transactions, row-level locking, indexes, uniqueness constraints, and reliable financial workflows.

## General Conventions

- Primary keys: UUID or ULID.
- Timestamps: `created_at`, `updated_at` on all mutable tables.
- Soft delete: `deleted_at` for user-facing and admin-managed entities where historical references must remain valid.
- Money: store fixed precision decimal values or integer minor units consistently. Avoid floating point for balances, costs, prices, and commissions.
- Idempotency: store idempotency keys for payments, webhooks, wallet operations, and order creation.
- Auditing: all sensitive admin actions should produce audit log rows.
- Concurrency: wallet/order/payment flows must use database transactions and row locking or equivalent optimistic concurrency controls.

## User and Access Tables

### `users`

Purpose: customer, reseller, support, manager, and admin identities.

Key columns:

- `id`
- `email` unique
- `password_hash`
- `display_name`
- `status` (`ACTIVE`, `PENDING_EMAIL_VERIFICATION`, `BANNED`, `DISABLED`)
- `email_verified_at`
- `last_login_at`
- `created_at`, `updated_at`, `deleted_at`

Indexes:

- Unique lower-case email index.
- Status index.

### `roles`

Roles: `USER`, `RESELLER`, `SUPPORT`, `MANAGER`, `ADMIN`.

Indexes:

- Unique `name`.

### `permissions`

Purpose: granular permission registry.

Indexes:

- Unique `key`.

### `user_roles`

Purpose: many-to-many user role assignment.

Constraints:

- Unique `(user_id, role_id)`.
- Foreign keys to users and roles.

### `user_sessions`

Purpose: session tracking and revocation.

Indexes:

- `user_id`
- `expires_at`
- Unique session token hash.

### `user_security_settings`

Purpose: 2FA and security preferences.

Key columns:

- `user_id` unique
- `two_factor_enabled`
- `two_factor_secret_encrypted`
- `recovery_codes_hash`

## Service Tables

### `categories`

- `id`
- `name`
- `slug` unique
- `description`
- `status`
- `sort_order`
- timestamps and optional `deleted_at`

### `services`

- `id`
- `category_id`
- `name`
- `slug`
- `description`
- `min_quantity`
- `max_quantity`
- `status`
- `supports_refill`
- `supports_cancel`
- `sort_order`
- timestamps and optional `deleted_at`

Constraints:

- Unique `(category_id, slug)`.
- Check `min_quantity > 0` and `max_quantity >= min_quantity`.

### `service_prices`

- `id`
- `service_id`
- `currency`
- `price_per_1000`
- `provider_cost_per_1000`
- `markup_type`
- `markup_value`
- `effective_from`
- `effective_to`

Indexes:

- `(service_id, currency, effective_from)`.

### `providers`

- `id`
- `name`
- `type`
- `base_url`
- `credentials_encrypted`
- `status`
- `last_health_check_at`
- `last_balance_sync_at`

### `service_provider_mappings`

- `id`
- `service_id`
- `provider_id`
- `provider_service_id`
- `priority`
- `provider_cost_per_1000`
- `status`

Constraints:

- Unique `(provider_id, provider_service_id)`.
- Unique `(service_id, provider_id, provider_service_id)`.

## Order Tables

### `orders`

- `id`
- `user_id`
- `service_id`
- `target`
- `quantity`
- `charge_amount`
- `currency`
- `status`
- `start_count`
- `remains`
- `idempotency_key`
- timestamps

Constraints and indexes:

- Unique `(user_id, idempotency_key)` where idempotency key is present.
- Index `(user_id, created_at)`.
- Index `status`.

### `provider_orders`

- `id`
- `order_id`
- `provider_id`
- `provider_order_id`
- `status`
- `raw_status_payload`
- timestamps

Constraints:

- Unique `(provider_id, provider_order_id)`.

### `order_status_history`

- `id`
- `order_id`
- `from_status`
- `to_status`
- `reason`
- `metadata`
- `created_by_user_id` nullable
- `created_at`

### `order_refunds`

- `id`
- `order_id`
- `wallet_transaction_id`
- `amount`
- `reason`
- `status`
- `idempotency_key`
- timestamps

Constraints:

- Unique `idempotency_key`.

### `order_refills`

- `id`
- `order_id`
- `provider_refill_id`
- `status`
- `reason`
- timestamps

## Wallet Tables

### `wallets`

- `id`
- `user_id` unique
- `currency`
- `balance`
- `version`
- timestamps

Constraints:

- Check `balance >= 0`.
- Unique `(user_id, currency)` if multi-currency is supported.

### `wallet_transactions`

Immutable ledger table.

- `id`
- `wallet_id`
- `user_id`
- `type`
- `direction` (`CREDIT`, `DEBIT`)
- `amount`
- `balance_before`
- `balance_after`
- `currency`
- `reference_type`
- `reference_id`
- `idempotency_key`
- `metadata`
- `created_at`

Constraints:

- Unique `idempotency_key`.
- Check `amount > 0`.
- Check `balance_after >= 0`.

### `balance_adjustments`

- `id`
- `wallet_id`
- `admin_user_id`
- `wallet_transaction_id`
- `amount`
- `reason`
- timestamps

## Payment Tables

### `payment_methods`

- `id`
- `provider`
- `display_name`
- `status`
- `configuration_encrypted`
- timestamps

### `payments`

- `id`
- `user_id`
- `payment_method_id`
- `amount`
- `currency`
- `status`
- `external_payment_id`
- `checkout_url`
- `expires_at`
- `idempotency_key`
- timestamps

Constraints:

- Unique `(payment_method_id, external_payment_id)` where present.
- Unique `(user_id, idempotency_key)` where present.

### `payment_transactions`

- `id`
- `payment_id`
- `external_transaction_id`
- `status`
- `amount`
- `currency`
- `raw_payload`
- timestamps

### `payment_webhook_events`

- `id`
- `payment_method_id`
- `external_event_id`
- `signature_valid`
- `processed_at`
- `status`
- `raw_headers`
- `raw_body_hash`
- `error_message`
- `created_at`

Constraints:

- Unique `(payment_method_id, external_event_id)`.

## API Tables

### `api_keys`

- `id`
- `user_id`
- `key_hash`
- `name`
- `scopes`
- `status`
- `last_used_at`
- `expires_at`
- timestamps

Constraints:

- Unique `key_hash`.

### `api_logs`

- `id`
- `api_key_id`
- `user_id`
- `route`
- `method`
- `status_code`
- `request_id`
- `idempotency_key`
- `ip_address`
- `user_agent`
- `duration_ms`
- `created_at`

### `api_rate_limits`

- `id`
- `api_key_id`
- `window_start`
- `window_end`
- `request_count`

Constraints:

- Unique `(api_key_id, window_start, window_end)`.

## Support Tables

### `tickets`

- `id`
- `user_id`
- `assigned_user_id`
- `category`
- `priority`
- `status`
- `subject`
- timestamps

### `ticket_messages`

- `id`
- `ticket_id`
- `author_user_id`
- `message`
- `is_internal_note`
- timestamps

### `ticket_attachments`

- `id`
- `ticket_message_id`
- `storage_key`
- `file_name`
- `content_type`
- `size_bytes`
- timestamps

## Referral Tables

### `referral_codes`

- `id`
- `user_id`
- `code` unique
- `status`
- timestamps

### `referrals`

- `id`
- `referrer_user_id`
- `referred_user_id` unique
- `referral_code_id`
- timestamps

### `referral_commissions`

- `id`
- `referral_id`
- `wallet_transaction_id`
- `amount`
- `currency`
- `status`
- timestamps

### `referral_payouts`

- `id`
- `user_id`
- `amount`
- `currency`
- `status`
- `approved_by_user_id`
- timestamps

## System Tables

### `notifications`

- `id`
- `user_id`
- `type`
- `title`
- `body`
- `read_at`
- `metadata`
- timestamps

### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before_data`
- `after_data`
- `ip_address`
- `user_agent`
- `created_at`

### `activity_logs`

- `id`
- `user_id`
- `event`
- `metadata`
- `created_at`

### `system_settings`

- `id`
- `key` unique
- `value_encrypted_or_json`
- `is_secret`
- timestamps

## Required Transactional Workflows

### Wallet Credit from Verified Payment

1. Verify webhook signature.
2. Insert webhook event with unique external event ID.
3. Lock payment row.
4. Lock wallet row.
5. Confirm payment is not already credited.
6. Create wallet transaction.
7. Update wallet balance.
8. Mark payment successful.
9. Commit transaction.
10. Queue notification.

### Order Creation

1. Validate authenticated user and idempotency key.
2. Validate service is active.
3. Validate quantity and target.
4. Recalculate price on backend.
5. Lock wallet row.
6. Ensure sufficient balance.
7. Create order.
8. Create debit wallet transaction.
9. Update wallet balance.
10. Queue provider submission.
11. Commit transaction.

### Refund

1. Lock order row.
2. Verify refundable state and amount.
3. Lock wallet row.
4. Ensure refund idempotency key has not been processed.
5. Create credit wallet transaction.
6. Update wallet balance.
7. Create order refund row.
8. Update order status/history.
9. Commit transaction.
