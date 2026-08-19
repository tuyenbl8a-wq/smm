# Final audit (2026-08-19)

This document records evidence from the current codebase. `PASS` means an
automated check or explicit implementation exists; it does not claim that an
external merchant, SMTP, object-storage, or production network was exercised.

| Area                      | Status  | Evidence                                                                                                          | Remaining work                                                              |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Authentication and RBAC   | PASS    | Session/CSRF middleware, permission checks, self-ban/self-demotion protection and auth tests                      | Operator acceptance with production cookie/domain settings                  |
| Wallet ledger             | PASS    | Transactional exact-decimal mutations, immutable ledger guards and idempotency/concurrency tests                  | Production database load test                                               |
| Order lifecycle           | PASS    | Transactional creation, outbox submission, bounded refill/cancel recovery and exact-once refunds                  | Live provider acceptance                                                    |
| Provider integration      | PARTIAL | Encrypted credentials, masked reads, stable request identity, service sync and strict decimal normalization       | Provider-specific failover policy and live endpoint certification           |
| API v2                    | PASS    | Key isolation, standard actions, Redis atomic limiter, idempotency and route tests                                | Multi-instance staging soak test                                            |
| VietQR/Casso deposits     | PASS    | Verified webhook, exact amount matching, transaction uniqueness, atomic exact-once credit and replay tests        | Live Casso/VietQR credentials                                               |
| Binance deposits          | PARTIAL | Fail-closed signed webhook with exact amount/currency and replay protection                                       | Scheduled official merchant reconciliation and live credentials             |
| Support/notifications     | PARTIAL | Customer/admin conversations, hidden internal notes, read/unread operations and bounded email queue               | Durable private attachments and SMTP delivery                               |
| Reports                   | PARTIAL | Database-backed range totals, top services/providers and formula-safe CSV                                         | Persisted snapshots and time-series visualization                           |
| Coupon/referral           | PARTIAL | Schema foundations and financial constraints                                                                      | Atomic redemption/commission services and operational UI                    |
| UI and accessibility      | PARTIAL | Separate Vietnamese customer/admin navigation, responsive tables/forms, explicit DOM lookup and translated states | Real-device accessibility/user acceptance testing                           |
| Production infrastructure | PARTIAL | Non-root images, Compose dependencies, health probes and backup/recovery runbook                                  | Staging deployment, reverse proxy selection and monitoring integration      |
| Automated tests           | PASS    | Workspace unit/regression suites and browser smoke contract                                                       | Authenticated live-browser run is blocked when Chromium/services are absent |

## Security conclusions

- Secrets are encrypted or masked at service boundaries and are not rendered in
  customer responses. Blank secret updates preserve existing encrypted values.
- Webhook settlement and wallet mutation share a transaction and uniqueness keys;
  browser actions cannot mark deposits paid.
- Invalid filters are rejected before Prisma, API JSON serialization supports
  nested BigInt/Decimal/Date values, and expected domain errors do not expose raw
  Prisma messages.
- Production must provide independent high-entropy secrets, HTTPS, private
  PostgreSQL/Redis networks, durable storage, log redaction and tested backups.

## Release recommendation

The completed core is suitable for a staging/user-acceptance deployment. Do not
declare every roadmap phase complete: Binance reconciliation, SMTP/attachments,
coupon/referral settlement, report snapshots and live-browser infrastructure
remain `PARTIAL` or externally blocked.
