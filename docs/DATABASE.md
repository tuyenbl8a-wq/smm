# Database design

`packages/database/prisma/schema.prisma` defines 38 PostgreSQL models with operational indexes, soft deletion where appropriate, immutable financial snapshots, foreign-key-backed migration tables, and uniqueness for payment/provider idempotency.

## Money and concurrency

All monetary columns use `Decimal` backed by PostgreSQL `numeric`, normally `numeric(20,8)`; exchange-rate snapshots use `numeric(24,12)`. TypeScript boundaries transport validated decimal strings, never floating-point values. Wallets carry a version for guarded updates and every ledger mutation requires a unique idempotency key plus before/after balances. Provider submissions, refund/refill/cancel requests, webhook events, and external payment identities are protected by database uniqueness.

## Prisma commands

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate             # development only: creates new migrations
pnpm db:migrate:deploy      # applies committed migrations
pnpm db:seed
```

The committed initial migration creates extensions, enums, all model tables, indexes, unique constraints, and foreign keys. Prisma Client generation is part of the Docker build.

## Development seed safety

Seeding is rejected when `NODE_ENV=production`. `DEV_SEED_ADMIN_EMAIL` and `DEV_SEED_ADMIN_PASSWORD` are mandatory and the password must contain at least 12 characters. Demo-customer credentials are optional but must be supplied as a pair. No credential is embedded in source. The seed upserts roles, permissions, SUPER_ADMIN grants, wallets, safe defaults, a category, and an inactive demonstration service.

## Local versus Docker URLs

For host processes, use a host-reachable URL such as `postgresql://smm:password@localhost:5432/smm?schema=public`. Compose overrides `DATABASE_URL` inside containers to use hostname `postgres`, so `.env` can retain the host URL. Apply and seed in Compose with:

```bash
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```
