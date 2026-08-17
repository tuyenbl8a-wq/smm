# API Contracts

## Global conventions

- Base path: `/api/v1`.
- Request and response bodies use JSON.
- Authenticated browser requests use secure sessions. External clients use hashed API keys.
- Mutating endpoints that create payments, orders, refunds, or wallet changes require an `Idempotency-Key` header.
- All errors use a consistent envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Public authentication

- `POST /auth/register`: create account and send verification email.
- `POST /auth/login`: create session after validating credentials and account status.
- `POST /auth/logout`: revoke current session.
- `POST /auth/forgot-password`: create password reset token.
- `POST /auth/reset-password`: reset password with token.
- `POST /auth/email/verify`: verify email token.
- `POST /auth/2fa/enable`: start 2FA setup.
- `POST /auth/2fa/confirm`: confirm 2FA setup.
- `POST /auth/2fa/disable`: disable 2FA after confirmation.

## Customer API

- `GET /me`: current user profile, roles, permissions, and security status.
- `PATCH /me`: update profile.
- `POST /me/change-password`: change password.
- `GET /wallet`: current wallet balance and currency.
- `GET /wallet/transactions`: paginated ledger history.
- `POST /payments/deposits`: create a pending deposit checkout.
- `GET /payments`: payment history.
- `GET /services`: searchable and filterable active service catalog.
- `GET /services/{id}`: service detail and current server-calculated price.
- `POST /orders`: validate, charge wallet, and create an order.
- `GET /orders`: paginated order history.
- `GET /orders/{id}`: order detail.
- `POST /orders/{id}/cancel`: request cancellation when supported.
- `POST /orders/{id}/refill`: request refill when supported.
- `GET /notifications`: notification list.
- `PATCH /notifications/{id}/read`: mark notification as read.
- `GET /tickets`: ticket list.
- `POST /tickets`: create support ticket.
- `POST /tickets/{id}/messages`: reply to ticket.
- `GET /referral`: referral code, stats, and commissions.

## Reseller API

- `GET /reseller/dashboard`: reseller metrics and profit summary.
- `GET /reseller/customers`: downstream customers.
- `GET /reseller/orders`: reseller order view.
- `GET /reseller/pricing`: active reseller pricing rules.

## Public API-key endpoints

- `GET /api/v1/services`: list services available to API client.
- `POST /api/v1/order`: submit order with server-side validation and idempotency.
- `GET /api/v1/order/{id}`: get one order.
- `GET /api/v1/orders`: list orders.
- `GET /api/v1/balance`: get wallet balance.

## Admin and operations API

- `GET /admin/overview`: revenue, profit, orders, deposits, active users, provider status, payment status.
- `GET /admin/users`: user management list.
- `PATCH /admin/users/{id}`: update user status or roles.
- `GET /admin/orders`: operational order list.
- `PATCH /admin/orders/{id}`: scoped order action.
- `GET /admin/services`: service management list.
- `POST /admin/services`: create service.
- `PATCH /admin/services/{id}`: update service.
- `POST /admin/categories`: create category.
- `PATCH /admin/categories/{id}`: update category.
- `GET /admin/providers`: provider list.
- `POST /admin/providers`: create provider configuration.
- `PATCH /admin/providers/{id}`: update provider configuration.
- `POST /admin/providers/{id}/sync-services`: enqueue service sync.
- `GET /admin/payments`: deposits and payments.
- `GET /admin/transactions`: wallet transaction review.
- `POST /admin/wallet-adjustments`: create authorized balance adjustment.
- `GET /admin/tickets`: support queue.
- `PATCH /admin/tickets/{id}`: assign or update ticket.
- `GET /admin/audit-logs`: audit review.
- `GET /admin/settings`: system settings.
- `PATCH /admin/settings/{key}`: update setting with audit log.

## Webhooks

- `POST /webhooks/payments/{gateway}`: receive payment gateway events.

Webhook handlers must verify signatures, persist raw events, enforce idempotency by gateway event ID, and credit wallets only inside a database transaction after validation.
