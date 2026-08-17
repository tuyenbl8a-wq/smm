# Architecture Overview

## Goals

Build a production-ready SMM panel with a modern responsive UI, secure account system, wallet ledger, payment webhooks, provider integrations, order automation, support workflows, reseller capabilities, API access, and operational administration.

## System architecture

The target architecture is a modular web application with clear boundaries:

```text
Browser / API Client
        |
        v
Frontend Application  ---> Public REST API
        |                    |
        |                    v
        |              Backend Application
        |                    |
        |     +--------------+---------------+
        |     |              |               |
        v     v              v               v
   Auth/RBAC Wallet      Orders          Admin/Support
              |              |               |
              +-------+------+---------------+
                      |
                      v
                 PostgreSQL
                      |
       +--------------+--------------+
       |                             |
       v                             v
 Redis Queue / Workers          Object Storage
       |
       v
Provider APIs / Payment Gateways / Email & Notification Providers
```

## Recommended stack

The first implementation phase should choose concrete tooling, but this architecture assumes:

- **Frontend**: TypeScript SPA or SSR-capable framework with responsive components, dark mode, accessible forms, and API client generation.
- **Backend**: TypeScript or another strongly typed server framework with explicit service modules, validation, RBAC middleware, transaction support, and queue integration.
- **Database**: PostgreSQL for relational integrity, transactions, row locking, idempotency keys, and audit trails.
- **Cache/Queue**: Redis-backed queue for provider submission, polling, reconciliation, notifications, and retries.
- **Workers**: Dedicated worker processes for long-running and scheduled jobs.
- **Storage**: Object storage for ticket attachments and future uploads.
- **Deployment**: Docker-based local and production environments with separate web, worker, database, Redis, and reverse-proxy services.

## Module boundaries

- **Identity module**: registration, login, sessions, password reset, email verification, 2FA, account status, and security logs.
- **Authorization module**: roles, permissions, policy checks, API-key permissions, and admin scoping.
- **Wallet module**: balances, immutable ledger entries, deposits, order charges, refunds, bonuses, commissions, admin adjustments, and idempotency.
- **Payment module**: gateway abstraction, payment creation, webhook verification, idempotent webhook processing, and reconciliation.
- **Service catalog module**: categories, services, price rules, provider mappings, min/max quantity constraints, refill/cancel support.
- **Provider module**: provider interface, credentials, health checks, balance sync, service sync, order submission, status polling, retries, and error logging.
- **Order module**: validation, pricing, wallet charge, provider submission, status transitions, partial handling, cancellation, refunds, and history.
- **Automation module**: queues, scheduled jobs, retries, backoff, dead-letter handling, and reconciliation tasks.
- **Support module**: tickets, replies, attachments, assignment, internal notes, statuses, and notifications.
- **Referral module**: referral codes, commission rules, commission ledger, payout workflow, and anti-abuse controls.
- **Notification module**: in-app notifications, email notifications, event routing, templates, and delivery logs.
- **Admin module**: management dashboards, reports, settings, security review, logs, and sensitive-action audit trails.

## Authentication and authorization

- Passwords must be hashed with a modern password hashing algorithm.
- Sessions must be revocable and stored server-side or backed by a secure session strategy.
- API keys must be separately generated, hashed at rest, permission-scoped, rate-limited, and auditable.
- Role-based access control must be enforced at every API endpoint, not only in the frontend.
- Sensitive actions require audit logs and may require 2FA confirmation for admins.

## Payment flow

```text
User creates deposit request
        |
Backend creates pending payment
        |
Gateway checkout/invoice is created
        |
User pays at gateway
        |
Gateway sends webhook
        |
Backend verifies signature
        |
Backend checks webhook/payment idempotency
        |
Backend records payment transaction
        |
Backend credits wallet in one DB transaction
        |
Notification is sent
```

A browser redirect can only update UI state. It must never credit a wallet or mark a payment successful without a verified gateway webhook or reconciliation result.

## Provider flow

```text
Admin configures provider credentials
        |
Worker syncs provider services and balance
        |
Order engine creates validated internal order
        |
Wallet charge is committed
        |
Submission job sends order through ProviderInterface
        |
Provider order ID is stored idempotently
        |
Polling jobs update provider status
        |
Order status, partials, cancellations, and refunds are reconciled
```

Provider-specific code must live behind provider adapters. The core order engine should depend on a provider interface, not individual provider payload shapes.

## Order state machine

Primary path:

```text
PENDING -> VALIDATING -> CHARGED -> SUBMITTING -> PROCESSING -> COMPLETED
```

Supported branches:

```text
PROCESSING -> PARTIAL
PROCESSING -> CANCELED
PROCESSING -> FAILED
FAILED -> REFUNDED
CANCELED -> REFUNDED
PARTIAL -> REFUNDED when partial refund is required
```

Every transition must be validated, recorded in `order_status_history`, and correlated with the actor or job that caused it.

## Wallet and ledger architecture

The wallet balance is a derived operational value protected by database transactions and row locks. Every balance-changing operation must create an immutable `wallet_transactions` record with:

- user wallet
- transaction type
- amount
- currency
- direction
- balance before
- balance after
- idempotency key
- source entity type and ID
- actor or system job reference

Financial operations must be idempotent and must fail closed if the ledger cannot be written.

## Background jobs and cron

Initial job categories:

- submit pending provider orders
- poll processing provider orders
- process failed/canceled/partial refunds
- process refills and refill status checks
- sync provider services
- sync provider balances
- reconcile pending payments
- send notifications
- monitor provider health
- clean expired sessions/tokens
- rotate or archive operational logs

Jobs must include retry limits, exponential backoff, idempotency keys, and dead-letter handling.

## Security principles

- Validate all input at the API boundary.
- Authorize every endpoint and every sensitive service method.
- Use CSRF protection for cookie-authenticated browser flows.
- Apply strict CORS rules.
- Sanitize user-generated content to mitigate XSS.
- Use parameterized queries or ORM query builders to avoid SQL injection.
- Restrict outbound provider/payment calls to configured hosts to reduce SSRF risk.
- Validate file uploads by type, size, and storage policy.
- Store secrets only in environment variables or a secret manager.
- Keep audit logs for authentication, authorization failures, admin actions, payment changes, provider changes, and wallet changes.

## Phase 0 decision

There are no architecture conflicts that block Phase 1. The safest next step is to initialize the project skeleton, select concrete framework tooling, add Docker services for PostgreSQL and Redis, create environment examples, configure linting/testing, and add CI without implementing business modules yet.
