# Delivery roadmap

Legend: ✅ complete · 🚧 active · ⬜ pending

Each phase is complete only after formatting, lint, type checking, relevant tests,
migration validation, and build checks applicable to the code introduced by it.

| Phase | Scope                                                                                | Status |
| ----- | ------------------------------------------------------------------------------------ | ------ |
| 1     | Repository audit, architecture, workspace policy, configuration inventory            | ✅     |
| 2     | Typed environment validation, Docker development PostgreSQL/Redis, health foundation | ✅     |
| 3     | Production Prisma schema, indexes, constraints, migration, development seed          | ✅     |
| 4     | Authentication, sessions, password recovery/verification, RBAC permissions           | ✅     |
| 5     | Responsive customer shell and dashboard                                              | ✅     |
| 6     | Responsive protected admin shell and dashboard                                       | ✅     |
| 7     | Atomic wallet service and immutable transaction ledger                               | ✅     |
| 8     | Categories, services, price groups, and pricing rules                                | ✅     |
| 9     | Encrypted provider configuration and provider adapter contract                       | ✅     |
| 10    | Idempotent provider service import and scheduled synchronization                     | ✅     |
| 11    | Validated, server-priced, transactional order creation                               | ✅     |
| 12    | Outbox and safe provider submission worker                                           | ✅     |
| 13    | Status reconciliation, partial refund, refill, and cancellation                      | ✅     |
| 14    | Rate-limited reseller compatibility API v2                                           | ✅     |
| 15    | Deposit model and payment provider abstraction                                       | ✅     |
| 16    | VietQR display plus verified, idempotent bank webhook processing                     | ✅     |
| 17    | Official Binance merchant adapter, webhook, and reconciliation                       | 🚧     |
| 18    | Tickets, secure attachments, notification center, queued email                       | 🚧     |
| 19    | Coupon rules and abuse-resistant affiliate/referral ledger                           | ⬜     |
| 20    | Snapshot-based reports, charts, filters, and safe CSV export                         | 🚧     |
| 21    | Security hardening, audit/search/logging, maintenance and system status              | 🚧     |
| 22    | Critical integration, authorization, idempotency, and concurrency tests              | 🚧     |
| 23    | Production images, Compose, reverse proxy, backup and deployment runbooks            | 🚧     |
| 24    | Final functional/security/infrastructure audit and `FINAL_AUDIT.md`                  | 🚧     |

## Phase 1 evidence

- Created: `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`,
  `README.md`, `ROADMAP.md`, `docs/PHASE-1-AUDIT.md`, and
  `docs/ARCHITECTURE.md`.
- Existing application files modified: none; the baseline had no application code.
- Architecture: PostgreSQL-backed modular monolith with independently deployable
  Next.js web, NestJS API, and BullMQ worker processes.

## Current completion evidence and gaps

- Phase 17 verifies official Binance webhook signatures, exact amount/currency and
  exact-once settlement. Scheduled Binance reconciliation still requires live
  merchant API credentials and a production adapter contract.
- Phase 18 provides customer/admin ticket conversations, private internal notes,
  notification unread/read-all operations, authenticated private attachment routes,
  an implicit-TLS SMTP transport and bounded email retries. A production durable
  object-storage adapter and live SMTP acceptance remain incomplete.
- Phase 19 has database entities only; coupon redemption and affiliate commission
  settlement are intentionally not presented as complete without atomic services.
- Phase 20 now has database-backed range reports and formula-safe CSV export;
  persisted report snapshots and time-series charts remain incomplete.
- Phases 21–23 now include enforced customer/API maintenance mode, bounded dependency
  status checks, security regressions, Docker/runbook foundations and an Nginx TLS
  example. Live dependency E2E and production deployment require operator acceptance.
- Phase 24 evidence and limitations are recorded in `docs/FINAL_AUDIT.md`.
