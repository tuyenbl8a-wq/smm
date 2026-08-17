# Database ERD and Table Plan

## Design principles

- Use PostgreSQL with foreign keys, indexes, unique constraints, and explicit transaction boundaries.
- Use immutable ledger rows for every wallet balance change.
- Store provider/payment webhook payloads for audit and reconciliation, but never store secrets in plaintext application records.
- Prefer soft-disable status fields for business entities that are referenced by historical records.
- Use unique idempotency keys for duplicate-safe financial, payment, and order operations.

## Entity relationship overview

```text
users --< user_roles >-- roles --< role_permissions >-- permissions
users --< user_sessions
users --1 user_security_settings
users --1 wallets --< wallet_transactions
users --< api_keys --< api_logs
users --< orders --< order_status_history
orders --< provider_orders
orders --< order_refunds
orders --< order_refills
categories --< services --< service_prices
services --< service_provider_mappings >-- providers
payment_methods --< payments --< payment_transactions
payments --< payment_webhook_events
users --< tickets --< ticket_messages
referral_codes --< referrals --< referral_commissions
referral_commissions --< referral_payouts
users --< notifications
users --< audit_logs
```

## Core tables

### Users and authorization

- `users`: identity, email, password hash, display name, status, email verification status, timestamps.
- `roles`: role key and description.
- `permissions`: permission key and description.
- `user_roles`: many-to-many user role assignment with unique `(user_id, role_id)`.
- `role_permissions`: many-to-many role permission assignment with unique `(role_id, permission_id)`.
- `user_sessions`: session token hash, user agent, IP, expiry, revocation timestamps.
- `user_security_settings`: 2FA settings, recovery state, login notification preferences.

### Services and providers

- `categories`: name, slug, status, sort order.
- `services`: category, name, type/platform, min/max quantity, description, status, refill/cancel flags, sort order.
- `service_prices`: service, audience scope, currency, unit price, effective dates, unique active scope.
- `providers`: provider name, adapter key, encrypted credential reference, health status, balance snapshot, status.
- `service_provider_mappings`: service/provider mapping, provider service ID, provider cost, priority, status, unique `(service_id, provider_id, provider_service_id)`.

### Orders

- `orders`: user, service, target, quantity, calculated unit price, total price, status, idempotency key, timestamps.
- `order_items`: optional extension for multi-item orders if required later.
- `order_status_history`: order, previous status, next status, reason, metadata, actor/job reference.
- `provider_orders`: order, provider, provider order ID, provider status, submitted payload, last sync timestamps, unique provider reference.
- `order_refunds`: order, wallet transaction, amount, reason, idempotency key, status.
- `order_refills`: order, provider order, status, reason, provider refill ID, timestamps.

### Wallet

- `wallets`: user, currency, available balance, held balance, status, unique `(user_id, currency)`.
- `wallet_transactions`: wallet, type, direction, amount, balance before, balance after, source entity, idempotency key, metadata, created timestamp.
- `balance_adjustments`: admin adjustment request, approval status, linked wallet transaction, reason, actor, approver.

### Payments

- `payment_methods`: gateway key, display name, status, supported currencies, configuration reference.
- `payments`: user, method, amount, currency, status, gateway payment ID, idempotency key, expiry.
- `payment_transactions`: payment, gateway transaction ID, amount, status, raw event reference, unique gateway transaction ID.
- `payment_webhook_events`: gateway key, event ID, signature verification result, processing status, payload, unique `(gateway_key, event_id)`.

### API

- `api_keys`: user, key hash, prefix, permissions, status, last used timestamp, expiry.
- `api_logs`: API key/user, route, method, status code, latency, idempotency key, request metadata.
- `api_rate_limits`: subject, route bucket, window start, request count, unique active bucket.

### Support

- `tickets`: user, category, priority, status, assigned staff, subject.
- `ticket_messages`: ticket, sender, message body, visibility, timestamps.
- `ticket_attachments`: message, storage key, original name, MIME type, size, validation status.

### Referral

- `referral_codes`: owner, code, status, commission rule.
- `referrals`: code, referrer, referred user, status, anti-abuse metadata.
- `referral_commissions`: referral, source order/payment, amount, status, linked wallet transaction.
- `referral_payouts`: owner, amount, status, request and approval timestamps.

### System

- `notifications`: user, type, channel, title, body, read timestamp, delivery status.
- `audit_logs`: actor, action, entity type, entity ID, IP, user agent, metadata, timestamp.
- `system_settings`: key, value, type, update audit reference.
- `activity_logs`: user/system subject, activity type, metadata, timestamp.

## Required indexes and constraints

- Unique email on `users`.
- Unique active wallet per `(user_id, currency)`.
- Unique idempotency key per financial operation scope.
- Unique payment gateway references per gateway.
- Unique webhook event ID per gateway.
- Index order lists by `(user_id, created_at)`, `(status, updated_at)`, and provider polling fields.
- Index wallet transactions by `(wallet_id, created_at)` and source entity.
- Index audit logs by actor, entity, action, and timestamp.
- Index tickets by user, assigned staff, status, and priority.

## Transaction boundaries

- **Deposit credit**: lock payment and wallet rows, verify idempotency, insert payment transaction, insert wallet transaction, update wallet, mark payment status, enqueue notification.
- **Order creation and charge**: lock wallet row, validate service price server-side, create order, insert wallet charge transaction, update wallet, enqueue provider submission.
- **Refund**: lock order and wallet rows, verify refundable amount and idempotency, insert refund record, insert wallet transaction, update wallet, transition order if needed.
- **Admin adjustment**: require authorization and audit log, lock wallet row, insert adjustment record, insert wallet transaction, update wallet.
