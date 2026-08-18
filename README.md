# SMM Panel

Production-oriented SMM panel, developed as a modular monolith and delivered in
independently verified phases. The repository was empty at the start of Phase 1;
the architecture and delivery gates are therefore established before runtime code.

## Status

Phases 1–7 are complete, including the runnable infrastructure, Prisma database,
persisted authentication/RBAC, and responsive customer dashboard. See [ROADMAP.md](ROADMAP.md) for the explicit completion criteria
and current status; no roadmap item is represented as complete without its checks.

## Target architecture

- `apps/web`: Next.js customer, public, and admin interfaces.
- `apps/api`: NestJS versioned REST API and verified webhook ingress.
- `apps/worker`: BullMQ consumers and scheduled reconciliation jobs.
- `packages/database`: Prisma schema, migrations, seed, and database client.
- `packages/config`: fail-fast, typed environment validation.
- `packages/shared`: contracts, money utilities, errors, and security primitives.
- `packages/ui`: accessible shared components.

PostgreSQL is the source of truth. Redis is used for queues, short-lived caches,
rate limits, and distributed locks, never as the authoritative wallet ledger.
Architecture decisions and trust boundaries are documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- Node.js 20 LTS or newer
- pnpm 10
- Docker Engine with Compose v2 (from Phase 2)

## Repository setup

```bash
pnpm install
cp .env.example .env
openssl rand -base64 48 # generate each required secret independently
```

The values in `.env.example` are development examples only. Never use them in a
public environment. `.env` and all `.env.*` variants except `.env.example` are
ignored by Git.

## Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Workspace commands intentionally run only scripts provided by implemented
packages. Each phase adds package-specific checks alongside its production code.

## Operations

Docker, migrations, backup/restore, deployment, and incident procedures will be
added in their owning phases. Until those phases are complete this repository
must not be presented or deployed as a production-ready service.

## Development runtime

Copy `.env.example` to `.env`, generate independent secrets, set a local-only
`POSTGRES_PASSWORD`, then start the complete stack:

```bash
docker compose up --build
```

The web and API bind to loopback ports 3000 and 4000 by default. PostgreSQL and
Redis are reachable only by Compose services. To run application processes on the
host against separately available infrastructure, use `pnpm dev`. Health routes
are `/health` on every process and `/health/ready` on API and worker. See
[docs/PHASE-2.md](docs/PHASE-2.md) for the delivered runtime contract.

## Database schema

The PostgreSQL/Prisma domain schema lives in
`packages/database/prisma/schema.prisma`. Run its dependency-free structural and
financial-safety checks with `pnpm --filter @smm/database db:validate`. Database
money is represented as decimal strings at TypeScript boundaries. Migration,
seeding, and concurrency rules are documented in
[docs/DATABASE.md](docs/DATABASE.md).

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm db:seed
```

The development seed refuses production mode and requires
`DEV_SEED_ADMIN_EMAIL` plus a 12-character-or-longer
`DEV_SEED_ADMIN_PASSWORD`; no administrator password is embedded in the
repository.
