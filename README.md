# SMM Panel

This repository is being built phase-by-phase into a production-ready SMM panel for customers, resellers, support staff, managers, and administrators.

## Current status

**Phase 1 — Project Initialization** is now started with a runnable development skeleton:

- TypeScript npm workspace monorepo.
- API app with Express and health/status endpoints.
- Web app with Vite and React placeholder UI.
- Worker app scaffold for future queue processors.
- Shared package for cross-app code.
- Docker Compose services for PostgreSQL and Redis.
- Environment example, TypeScript checks, tests, build scripts, and CI workflow.

Business features are intentionally not implemented yet. Future phases must add database migrations, authentication, wallet ledger, payments, service management, provider integrations, orders, and automation incrementally.

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- Docker with Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment file

```bash
cp .env.example .env
```

The example values are safe for local development only. Replace secrets before using any shared or production environment.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

### 4. Run the API

```bash
npm run dev:api
```

The API listens on `http://localhost:4000` by default. Try:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/status
```

### 5. Run the web app

In another terminal:

```bash
npm run dev:web
```

Open `http://localhost:5173`.

### 6. Run the worker scaffold

In another terminal:

```bash
npm run dev:worker
```

The worker currently logs a startup message only. Queue processors will be added in later phases.

## Checks

```bash
npm run lint
npm run build
npm test
```

## UI mockups

You can preview the initial visual direction as static SVG mockups:

- [Customer sales dashboard mockup](docs/mockups/customer-dashboard.svg)
- [Admin operations dashboard mockup](docs/mockups/admin-dashboard.svg)

These are design previews only. The functional customer and admin dashboards will be implemented in later UI phases after the backend money, order, payment, provider, and automation flows are stable.

## Documentation

- [Architecture overview](docs/architecture.md)
- [Database ERD and table plan](docs/database-erd.md)
- [API contracts](docs/api-contracts.md)
- [Implementation roadmap](docs/roadmap.md)

## Roles

The system is designed around these roles:

- **User**: buys services, deposits funds, manages orders, opens support tickets, uses API keys if enabled.
- **Reseller**: receives reseller pricing, manages downstream customers, places orders through UI/API, tracks profit.
- **Support**: handles tickets, views order/payment context needed for support, cannot perform unrestricted financial actions.
- **Manager**: manages operations such as services, providers, orders, tickets, and reports with scoped financial permissions.
- **Admin**: owns global configuration, security settings, payment methods, provider credentials, user administration, and audit review.

## Development rules

1. Work phase by phase; do not implement the full application in one giant change.
2. Inspect existing implementation before modifying code.
3. Keep business logic separated into modules/services.
4. Use database transactions for all financial operations.
5. Every balance-changing operation must create an immutable ledger transaction.
6. Payment webhooks and order submissions must be idempotent.
7. Never trust frontend price or balance calculations.
8. Never expose provider API keys, payment secrets, JWT secrets, or other credentials to the frontend.
9. Add validation and authorization to every API endpoint.
10. Use queues/workers for asynchronous work and provider/payment synchronization.
11. Keep audit logs for sensitive admin, security, and financial actions.
12. Do not mark deposits successful from browser redirects alone.
13. Do not hard-code provider-specific logic into the core order engine.
14. Run tests, lint, migration checks, API-contract checks, and security review after each phase.
