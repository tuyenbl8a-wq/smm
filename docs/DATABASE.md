# Database design

`packages/database/prisma/schema.prisma` defines the PostgreSQL domain model. The
current Phase 3 increment includes 38 models, operational indexes, soft-delete
columns where appropriate, immutable financial snapshots, and database uniqueness
for payment events and financial idempotency.

## Money

All monetary columns use `Decimal` backed by PostgreSQL `numeric`, normally
`numeric(20,8)`. Exchange-rate snapshots use `numeric(24,12)`. Application
boundaries transport amounts as validated decimal strings and never as JavaScript
floating-point values.

## Concurrency and idempotency

Wallets carry a version column for guarded updates. Every ledger mutation requires
an immutable `WalletTransaction` with a unique idempotency key, before/after
balances, and reference metadata. Provider submissions, refunds, refill/cancel
requests, payment events, and external transaction identifiers have database
unique constraints rather than relying only on preflight application queries.

## Migration status

The Prisma model and schema-invariant tests are implemented. The initial generated
SQL migration and seed are not yet committed: the execution environment blocks the
npm registry, so the real Prisma CLI cannot be installed to generate and validate
its SQL against PostgreSQL. Phase 3 remains active until that migration is produced
by Prisma, reviewed, and exercised on a disposable PostgreSQL database. Handwritten
partial SQL is intentionally not substituted for a verified migration.
