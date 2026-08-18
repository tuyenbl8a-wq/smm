# Production readiness checklist

## Before deployment

- Generate independent high-entropy `SESSION_SECRET`, `JWT_SECRET`, and
  `ENCRYPTION_KEY`; never reuse development seed credentials.
- Configure PostgreSQL backups and test a restore into an isolated database.
- Run `pnpm db:generate`, `pnpm db:validate`, and `pnpm db:migrate:deploy` before
  starting API/worker processes. Never run the development seed in production.
- Put web/API behind an HTTPS reverse proxy, preserve the original client IP, set
  request body limits, and expose only `/webhooks/payments/*` publicly where needed.
- Register the exact HTTPS Casso/VietQR/Binance webhook URLs and rotate webhook
  secrets through a controlled deployment. Never credit a deposit from a browser
  redirect.
- Configure Redis persistence/availability because API v2 rate limiting and worker
  coordination fail closed when their dependency is unavailable.
- Configure durable S3-compatible attachment storage and SMTP before enabling those
  production features.

## Runtime checks

- Monitor `/health` and `/health/ready` independently for web, API, and worker.
- Alert on manual-review deposits, failed provider submissions, stale/unknown
  lifecycle actions, webhook authentication failures, and exhausted email retries.
- Restrict database and Redis ports to the private network. Retain audit, webhook,
  provider, and system logs according to the applicable privacy policy.

## Recovery

1. Stop mutation traffic and workers.
2. Restore the latest PostgreSQL backup and verify immutable wallet-ledger totals.
3. Run migration status/validation without re-running development seed data.
4. Resume API first, then a single worker, verify outbox/payment idempotency, and
   finally scale workers and API instances.
