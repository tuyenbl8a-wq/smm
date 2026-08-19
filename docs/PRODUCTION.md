# Production readiness checklist

## Required environment

- Set `NODE_ENV=production`, canonical HTTPS `APP_URL`/`API_URL`, PostgreSQL
  `DATABASE_URL`, and a private TLS-capable `REDIS_URL`.
- Generate independent 32-byte-or-longer values for `SESSION_SECRET`,
  `JWT_SECRET`, and `ENCRYPTION_KEY` (for example with a cryptographically secure
  password generator). Rotate one secret at a time; rotating the encryption key
  requires a controlled re-encryption procedure for stored provider/payment
  credentials.
- Configure Casso with `CASSO_WEBHOOK_SECURE_TOKEN`; `CASSO_API_KEY` is only for
  outbound reconciliation. Configure the public bank/VietQR fields and register
  `${API_URL}/webhooks/payments/casso` in the merchant portal. Never place these
  values in the web container or client-side JavaScript.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and
  `SMTP_FROM` before enabling email delivery. Production attachments require the
  documented durable S3-compatible storage credentials; local filesystem storage
  is development-only.

## Network and application security

- Terminate HTTPS at a trusted reverse proxy, forward the original protocol/IP,
  enforce request-size and timeout limits, and allow CORS only from `APP_URL`.
  Session cookies are `HttpOnly`, `SameSite=Lax`, and must be `Secure` in
  production.
- Expose web and the required API/webhook paths only. PostgreSQL and Redis remain
  private. Rate limits depend on Redis and intentionally fail closed when Redis is
  unavailable.
- Send application logs to a centralized sink with retention and alerts. Never log
  cookies, authorization headers, provider keys, SMTP credentials, or webhook
  tokens.

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
- Probe `/health` for liveness and `/health/ready` for dependency readiness. Alert
  on repeated 5xx responses, queue lag, exhausted retries, and balance/ledger
  invariant failures.

## Deployment and backup

1. Build immutable Docker images and scan them before promotion.
2. Back up PostgreSQL, verify the restore, then run `pnpm db:generate`,
   `pnpm db:validate`, and `pnpm db:migrate:deploy` exactly once per release.
3. Start API and worker processes, wait for readiness, then enable web traffic.
4. Never run `pnpm db:seed` in production; it is guarded for development and may
   create test identities.
5. Perform scheduled encrypted backups with retention, off-site replication, and
   routine restore drills. Record secret rotation and migration events in the
   operational change log.

## Recovery

1. Stop mutation traffic and workers.
2. Restore the latest PostgreSQL backup and verify immutable wallet-ledger totals.
3. Run migration status/validation without re-running development seed data.
4. Resume API first, then a single worker, verify outbox/payment idempotency, and
   finally scale workers and API instances.
