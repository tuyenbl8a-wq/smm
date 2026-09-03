# Final audit (2026-09-02)

This document records evidence from the current codebase. `PASS` means an
automated check or explicit implementation exists; it does not claim that an
external merchant, SMTP, object-storage, or production network was exercised.

| Area                      | Status | Evidence                                                                                                              | Remaining work                                                |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Authentication and RBAC   | PASS   | Session/CSRF middleware, permission checks, self-ban/self-demotion protection and auth tests                          | Operator acceptance with production cookie/domain settings    |
| Wallet ledger             | PASS   | Transactional exact-decimal mutations, immutable ledger guards and idempotency/concurrency tests                      | Production database load test                                 |
| Order lifecycle           | PASS   | Transactional creation, outbox submission, bounded refill/cancel recovery and exact-once refunds                      | Live provider acceptance                                      |
| Provider integration      | PASS   | Encrypted credentials, masked reads, stable request identity, service sync and strict decimal normalization           | Live endpoint certification                                   |
| API v2                    | PASS   | Key isolation, standard actions, Redis atomic limiter, idempotency and route tests                                    | Multi-instance staging soak test                              |
| VietQR/Casso deposits     | PASS   | Verified webhook, exact amount matching, transaction uniqueness, atomic exact-once credit and replay tests            | Live Casso/VietQR credentials                                 |
| Binance deposits          | PASS   | Signed webhook and durable reconciliation share exact-once settlement; claims and retries persist                     | Live merchant credential acceptance                           |
| Support/notifications     | PASS   | Customer/admin conversations, private files via local/SigV4 S3 storage, read/unread operations and bounded SMTP queue | Live S3 and SMTP credential acceptance                        |
| Reports                   | PASS   | Timezone daily snapshots, idempotent rebuild/worker, ordered trends, charts and formula-safe CSV                      | Production data acceptance                                    |
| Coupon/referral           | PASS   | Atomic coupon reservation/order snapshots and exact-once referral wallet commission with customer/admin UI            | Business-rule acceptance                                      |
| UI and accessibility      | PASS   | Separate Vietnamese customer/admin navigation, responsive tables/forms, explicit DOM lookup and translated states     | Real-device accessibility/user acceptance testing             |
| Maintenance/status        | PASS   | Customer/API maintenance enforcement, webhook and health bypass, bounded database/Redis probes                        | Production operator acceptance                                |
| Production infrastructure | PASS   | Non-root images, Compose, health probes, Nginx TLS example and backup/rollback runbook                                | Staging deployment and monitoring integration                 |
| Automated tests           | PASS   | Workspace unit/regression suites and browser smoke contract                                                           | Authenticated live-browser run requires Chromium and services |

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

## External live acceptance pending

- Live provider order/refill/cancel and reconciliation certification requires
  provider endpoint credentials.
- Live VietQR/Casso and Binance settlement certification requires merchant and
  webhook credentials.
- Live S3-compatible attachment and SMTP delivery certification requires storage
  and mail credentials.
- Staging deployment, monitoring integration, database load testing and real-device
  browser/accessibility acceptance require operator infrastructure.

These are external acceptance gates only; none can be safely simulated or completed from
repository source without the corresponding external systems and credentials.

## Release recommendation

All roadmap implementation phases are complete and suitable for a staging/user-
acceptance deployment. Production promotion remains blocked until the external
acceptance items above have passed in operator-controlled infrastructure.
