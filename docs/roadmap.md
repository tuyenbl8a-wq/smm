# Implementation Roadmap

## Phase 0 complete

This repository contains the architectural baseline required before writing application business logic:

- requirements analysis
- role model
- frontend/backend/database/queue architecture
- database ERD and table plan
- API contracts
- authentication and authorization approach
- payment flow
- provider flow
- order state machine
- wallet ledger architecture
- background jobs and cron plan
- security principles

## Phase 1 status

Phase 1 now provides the runnable project foundation:

1. TypeScript npm workspace structure.
2. API, web, worker, and shared package layout.
3. PostgreSQL and Redis Docker Compose services.
4. Environment variable example.
5. TypeScript lint checks, build scripts, API smoke test, and GitHub Actions CI.
6. Local development instructions in `README.md`.

## Phase 1 remaining work

Before Phase 2 begins, consider adding:

- database migration tooling selection
- ORM/query builder selection
- queue library selection
- formatter configuration
- API contract generation or OpenAPI scaffolding

## Later phases

Follow the requested phase order:

1. Phase 2: database migrations and models.
2. Phase 3: authentication and user system.
3. Phase 4: wallet, balance, and ledger.
4. Phase 5: payment system.
5. Phase 6: service management.
6. Phase 7: provider system.
7. Phase 8: order engine.
8. Phase 9: automation engine.
9. Phase 10-22: dashboards, reseller, API, referral, support, admin, pricing, notifications, security, testing, UI polish, and production deployment.

Each phase must include tests, linting, migration checks where applicable, API-contract review, security review, a change summary, and remaining tasks.
