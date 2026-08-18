# Architecture

## Style

The system is a modular monolith with three deployable processes: web, API, and
worker. Business modules own their application services and persistence access;
controllers and queue processors are adapters, not locations for business rules.

## Dependency direction

`web -> API contracts`, `API/worker -> application modules -> domain -> database
ports`. Provider, payment, notification, and storage implementations satisfy
explicit ports. Domain modules do not import vendor SDKs.

## Planned modules

- Identity, sessions, RBAC, and API keys
- Wallet and immutable ledger
- Catalog, price groups, and provider mappings
- Orders, provider dispatch, reconciliation, refill, cancellation, and refunds
- Deposits, payment providers, and idempotent webhook processing
- Tickets, notifications, coupons, affiliates, settings, reports, and audit

## Data and transaction boundaries

PostgreSQL is authoritative for identity, money, orders, and idempotency. Money is
stored as `numeric` and represented at TypeScript boundaries as decimal strings or
an arbitrary-precision decimal type—never JavaScript floating point.

Wallet debit creates the order, balance mutation, and ledger row in one database
transaction. Payment confirmation locks the deposit, claims a unique external
transaction ID, credits the wallet, and writes the ledger in one transaction.
Unique constraints remain the final defense against duplicate processing.

## Async processing

BullMQ carries bounded-retry jobs. A transactional outbox bridges PostgreSQL
commits to Redis jobs so a successful business transaction cannot silently lose
its work item. Distributed locks protect schedulers, while database idempotency
protects the actual side effect. Provider create-order timeouts are quarantined
for reconciliation because retrying an ambiguous request can duplicate an order.

## Security boundaries

- Browser sessions use secure, HTTP-only, same-site cookies and CSRF protection.
- Reseller keys are accepted in request bodies/headers, stored as hashes, masked
  in logs, rate-limited by key and IP, and shown only at creation/rotation.
- Admin authorization is enforced by API permission guards.
- Webhook adapters verify signatures before business processing and enforce
  timestamp/replay rules supported by each provider.
- External secrets are environment-provided; stored provider secrets use
  authenticated encryption with key versioning.
- Uploads are private by default, MIME/size checked, randomly named, and served
  without execute permissions through the storage abstraction.

## Availability and extraction path

API and worker processes are stateless and horizontally scalable. Modules interact
through application interfaces and durable events. A module can later be split
into a service by replacing an in-process adapter without rewriting its domain
rules. Health endpoints distinguish liveness from readiness and never expose
credentials or raw provider responses.
