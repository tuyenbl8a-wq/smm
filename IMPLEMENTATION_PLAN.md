# SMM Panel Implementation Plan

## Guiding Principle

Build this SMM Panel incrementally by phase. Do not implement the full product in one change. Each phase must inspect current code first, then implement only the scoped work, run tests/checks, review changes, and stop for reporting before moving to the next phase.

## Phase 0: Repository Analysis and Planning

Status: documented in this repository.

Deliverables:

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `DATABASE_PLAN.md`
- `API_V2_PLAN.md`

Findings:

- The repository currently contains no application framework or source code.
- There are no existing modules to preserve.
- Future phases may scaffold a new architecture, but should still proceed incrementally.

## Phase 1: Project Foundation

Objectives:

- Select and scaffold the application framework.
- Add environment configuration and `.env.example` without secrets.
- Add formatter, linter, type checker, and test runner.
- Add Docker setup if appropriate.
- Add CI workflow for lint, type checks, tests, and build.
- Add initial health check route.
- Add basic logging configuration.
- Establish web and worker process boundaries.

Acceptance checks:

- Framework starts locally.
- Build command passes.
- Lint passes.
- Type check passes if applicable.
- Test command passes.
- `.env.example` documents required variables with safe placeholders.

## Phase 2: Database Foundation

Objectives:

- Add PostgreSQL schema/migrations for the core data model.
- Add indexes, unique constraints, timestamps, and soft delete columns where appropriate.
- Add database transaction utilities for financial and order workflows.
- Add migration validation in CI.

Acceptance checks:

- Migrations apply cleanly to an empty database.
- Schema includes the entities documented in `DATABASE_PLAN.md`.
- Critical uniqueness and idempotency constraints exist.
- No secret values are committed.

## Phase 3: Authentication and RBAC

Objectives:

- Implement registration, login, logout, email verification, password reset, profile, change password, session management, 2FA foundation, and security logs.
- Implement roles: `USER`, `RESELLER`, `SUPPORT`, `MANAGER`, `ADMIN`.
- Implement ban/unban and role checks.

Acceptance checks:

- Auth tests pass.
- Protected routes reject unauthenticated users.
- Admin-only routes reject non-admin users.
- Sensitive auth events write security/audit logs.

## Phase 4: Wallet and Ledger

Objectives:

- Implement wallets and immutable wallet transactions.
- Add deposit credit, order charge, refund, bonus, referral commission, and admin adjustment transaction types.
- Enforce database transactions, idempotency, non-negative balances, and row-level locking or equivalent concurrency control.

Acceptance checks:

- Unit tests cover double charge, double refund, duplicate transaction, and concurrent requests.
- Every balance change creates a ledger row.
- No wallet balance can go negative.

## Phase 5: Payments and Auto Deposit

Objectives:

- Add `PaymentProviderInterface`.
- Implement create payment, pending/success/failed/expired states, webhook verification, idempotency, reconciliation, history, wallet update, and notifications.
- Never credit a wallet based only on frontend redirect.

Acceptance checks:

- Duplicate webhook test credits only once.
- Invalid webhook signature is rejected.
- Payment success updates wallet only through verified backend flow.

## Phase 6: Service System

Objectives:

- Implement categories, services, service prices, provider mappings, admin CRUD, disable flows, sort order, and customer search/filter/detail.
- Backend validates quantity and calculates price.

Acceptance checks:

- Admin service CRUD tests pass.
- Customer service listing and price calculation tests pass.

## Phase 7: Provider Engine

Objectives:

- Add `ProviderInterface` with service sync, balance, order creation, status, cancel, refill, refill status, health check, logging, retry, timeout, and error handling.
- Keep provider-specific logic out of order engine.

Acceptance checks:

- Mock provider tests cover success, timeout, retry, failure, and partial status.

## Phase 8: Order Engine

Objectives:

- Implement idempotent order creation lifecycle: `PENDING`, `VALIDATING`, `CHARGED`, `SUBMITTING`, `PROCESSING`, `COMPLETED`, plus `PARTIAL`, `CANCELED`, `FAILED`, `REFUNDED`.
- Validate service, target, quantity, price, and balance on backend.
- Charge wallet transactionally before provider submission.
- Handle provider order IDs, tracking, partials, cancel, refund, retry, and history.

Acceptance checks:

- Duplicate order request does not create unintended duplicate provider order.
- Failed provider submission is isolated and recoverable.
- Refund logic is transactional and idempotent.

## Phase 9: Automation Engine

Objectives:

- Add queue/worker jobs for pending order submission, status polling, refunds, refills, provider service sync, provider balance sync, price sync, payment reconciliation, notifications, and provider health monitoring.
- Add retries, backoff, failed job records, and job logs.

Acceptance checks:

- Worker can process and retry jobs.
- Failed jobs are observable.
- Provider failure does not crash the system.

## Phase 10: Customer Website

Objectives:

- Build public landing, features, services, FAQ, login, register, dashboard, quick order, services, orders, deposit, transactions, notifications, support, API, referral, profile, and settings UI.
- Add responsive layout and dark/light mode foundation.

Acceptance checks:

- Core pages render on desktop and mobile.
- Authentication-aware navigation works.
- Screenshot review is performed for perceptible UI changes.

## Phase 11: Quick Order

Objectives:

- Implement guided quick order: platform, category, service, description, target, quantity, price, confirm, order.
- Backend always recalculates price and checks balance.

Acceptance checks:

- Quantity validation works.
- Price from frontend cannot manipulate backend charge.

## Phase 12: Order Management

Objectives:

- Customer order history, search, filter, detail, status, progress, refill, cancel, refund status.
- Admin order search, filters, bulk operations, detail, provider info, refund, refill, logs.

Acceptance checks:

- Authorization tests prevent users from viewing others' orders.
- Admin actions write audit logs.

## Phase 13: API V2

Objectives:

- Implement `/api/v2/` endpoints described in `API_V2_PLAN.md`.
- Add API key authentication, permissions, rate limiting, idempotency, logging, standardized responses, validation, pagination, authorization, OpenAPI docs.

Acceptance checks:

- API V2 contract tests pass.
- Rate limiting and API key auth work.
- No `/api/v1/` is introduced unless explicitly required.

## Phase 14: Reseller

Objectives:

- Reseller role, dashboard, balance, pricing, customer management, reseller API, profit statistics, custom pricing, API key management.

## Phase 15: Referral and Affiliate

Objectives:

- Referral code, URL, commission rules, commission ledger, statistics, withdrawal requests, admin approval, anti-abuse controls.

## Phase 16: Support

Objectives:

- Tickets, categories, priority, status, replies, attachments, assignment, internal notes, notifications.

## Phase 17: Admin Panel

Objectives:

- Admin dashboard and menus for users, resellers, orders, services, categories, providers, payments, deposits, transactions, refunds, tickets, referral, API, reports, notifications, logs, security, settings.

## Phase 18: Pricing Engine

Objectives:

- Global, category, service, user-specific, reseller pricing, provider cost, automatic margin.
- Backend always recalculates price.

## Phase 19: Notifications

Objectives:

- In-app and email notifications for deposit, order, refund, ticket, security, and provider events.

## Phase 20: Security Review

Objectives:

- Review authentication, authorization, RBAC, CSRF, XSS, SQL injection, SSRF, rate limiting, input validation, file validation, API security, webhook security, secrets, audit logs, session security, and admin security.

## Phase 21: Testing Expansion

Objectives:

- Unit, integration, and E2E tests for wallet, ledger, pricing, order state, refund, referral, payment, webhook, provider, order, API V2, and full user journey.

## Phase 22: UI/UX Finalization

Objectives:

- Responsive behavior, loading states, skeletons, empty states, errors, toasts, modals, form validation, accessibility, design consistency, typography, spacing, and navigation clarity.

## Phase 23: Production Readiness

Objectives:

- Production environment, Docker, Nginx, HTTPS, backups, Redis, workers, cron, monitoring, error tracking, log rotation, health checks, CI/CD, migrations, rollback, disaster recovery.
