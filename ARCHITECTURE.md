# SMM Panel Architecture Assessment

## Phase 0 Scope

This document records the repository inspection for Phase 0 only. No application code has been implemented in this phase. The goal is to document the current state and define a safe architecture direction for future phases.

## Current Repository State

- Repository root: `/workspace/smm`.
- Current branch: `work`.
- Tracked project files before Phase 0: only `.gitkeep`.
- No application source code is currently present.
- No framework files are currently present.
- No database schema, migrations, seeders, or ORM configuration are currently present.
- No existing routes, API handlers, frontend components, authentication, admin panel, tests, CI, Docker, or environment examples are currently present.
- No `AGENTS.md` instruction files were found under `/workspace` during inspection.

## Framework Assessment

Because the repository is effectively empty, there is no existing framework to preserve or extend. Future phases should choose a stack deliberately and document the decision before implementation.

Recommended production-ready direction for this project:

- Frontend and backend: a full-stack TypeScript framework such as Next.js or a split frontend/API architecture using React plus a Node.js backend.
- Database: PostgreSQL as the primary relational database.
- ORM/query layer: Prisma, Drizzle, or another typed migration-capable database layer.
- Cache and jobs: Redis-backed queue such as BullMQ or a framework-native queue abstraction.
- Background workers: separate worker process for provider sync, order status updates, payment reconciliation, notifications, and retries.
- Authentication: secure server-side session or token architecture with RBAC and audit logging.
- Deployment: Dockerized services for web, worker, database, Redis, and reverse proxy.

The final technology choice should be confirmed in Phase 1 before scaffolding code.

## Target Layered Architecture

```text
Public Website / Customer UI / Admin UI
        ↓
HTTP Routes / API V2 / Webhooks
        ↓
Application Services / Use Cases
        ↓
Domain Modules and Policies
        ↓
Database / Cache / Queue
        ↓
Payment Providers / SMM Providers / Email
```

## Target Modules

The system should be organized as modular domains:

- Authentication and sessions
- Users, roles, permissions, and security settings
- Services, categories, pricing, and provider mappings
- Orders, provider orders, status history, refills, cancellations, and refunds
- Wallets and immutable ledger transactions
- Payments, payment transactions, and webhook events
- Provider engine behind a `ProviderInterface`
- Payment engine behind a `PaymentProviderInterface`
- API V2 and API key management
- Reseller and custom pricing
- Referral and affiliate commissions
- Support tickets and attachments
- Notifications
- Admin panel
- Reports and analytics
- Audit logs and activity logs
- System settings
- Queue workers, scheduled jobs, monitoring, and health checks

## Production-Critical Design Rules

- All balance mutations must be performed inside database transactions.
- Every balance mutation must create an immutable ledger transaction.
- Payment webhooks must be verified, idempotent, and never trust frontend redirects.
- Order creation must be idempotent and must recalculate price on the backend.
- Provider-specific code must live behind a provider interface.
- Payment-specific code must live behind a payment provider interface.
- Background work must use queues/workers for retries, backoff, failure isolation, and observability.
- Sensitive admin operations must write audit logs.
- Secrets must only be supplied through environment variables or secret storage.
- API V2 must live under `/api/v2/`; do not introduce `/api/v1/` unless explicit compatibility is required.

## Reuse Opportunities

There is currently no application code to reuse. The repository can be safely scaffolded in Phase 1, but the scaffolding must be incremental and must not attempt to implement every module at once.

## Current Risks and Gaps

- No framework or runtime exists yet.
- No database schema or migration strategy exists yet.
- No authentication, authorization, or admin model exists yet.
- No test, lint, type-check, CI, Docker, or deployment foundation exists yet.
- No queue/worker architecture exists yet.
- No API contract or OpenAPI documentation exists yet.

These gaps are expected at Phase 0 and should be addressed in the ordered phases documented in `IMPLEMENTATION_PLAN.md`.
