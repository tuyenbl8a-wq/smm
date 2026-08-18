# SMM Panel

Production-oriented SMM panel, developed as a modular monolith and delivered in
independently verified phases. The repository was empty at the start of Phase 1;
the architecture and delivery gates are therefore established before runtime code.

## Status

Phase 1 (repository audit and architecture) is complete. Runtime services are not
implemented yet. See [ROADMAP.md](ROADMAP.md) for the explicit completion criteria
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
