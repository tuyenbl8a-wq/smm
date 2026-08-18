# Phase 1 repository audit

Audit date: 2026-08-18

## Baseline

The repository contained only `.gitkeep` and Git metadata. There was no source
tree, package manifest, environment template, database schema, migration, test,
container definition, or existing runtime behavior to preserve.

## Requested configuration findings

| Item               | Baseline finding | Phase 1 action                                                                |
| ------------------ | ---------------- | ----------------------------------------------------------------------------- |
| `package.json`     | Missing          | Added a private pnpm workspace manifest and root quality commands.            |
| `.env.example`     | Missing          | Added a secret-free configuration contract.                                   |
| `DATABASE_URL`     | Missing          | Added a local-only PostgreSQL example; runtime validation belongs to Phase 2. |
| `REDIS_URL`        | Missing          | Added a local Redis example; runtime validation belongs to Phase 2.           |
| `SESSION_SECRET`   | Missing          | Declared as required and deliberately left empty.                             |
| `JWT_SECRET`       | Missing          | Declared as required and deliberately left empty.                             |
| Database schema    | Missing          | Prisma schema and reviewed migration are Phase 3 deliverables.                |
| Application source | Missing          | Applications are introduced incrementally in subsequent phases.               |

## Risks and controls

1. **Financial concurrency:** wallet changes require a PostgreSQL transaction,
   conditional debit/row locking, and an immutable ledger entry.
2. **Duplicate external effects:** payment credit, refunds, webhook events, and
   provider submission use database-enforced idempotency keys.
3. **Ambiguous provider timeout:** create-order jobs enter reconciliation rather
   than blindly retrying when creation may have succeeded remotely.
4. **Secrets:** provider credentials are encrypted at rest with a versioned
   envelope and are masked from logs and API responses.
5. **Feature breadth:** delivery is phase-gated; incomplete integrations remain
   disabled rather than simulated.

## Decision

Adopt the modular-monolith workspace described in `docs/ARCHITECTURE.md`. This
keeps transactional boundaries local while allowing worker and web processes to
scale independently and modules to be extracted later.
