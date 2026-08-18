# Phase 2 — runtime and infrastructure foundation

## Delivered

- Runnable TypeScript web, API, and worker processes with graceful termination.
- Fail-fast, typed environment parsing with protocol, range, and production-secret validation.
- Liveness endpoints for every process and PostgreSQL/Redis-aware readiness endpoints for API and worker.
- Shared health and API contract packages, with configuration and probe tests.
- Multi-stage, non-root Docker image and Compose services for web, API, worker, PostgreSQL, and Redis.
- Persistent database/Redis volumes, dependency health gates, bounded health timeouts, and localhost-only public application ports.
- A responsive infrastructure dashboard, root development launcher, and reproducible workspace quality commands.

## Run locally

```bash
cp .env.example .env
# Fill SESSION_SECRET, JWT_SECRET, ENCRYPTION_KEY, and POSTGRES_PASSWORD.
docker compose up --build
```

Web is available at `http://localhost:3000`; API liveness and readiness are at
`http://localhost:4000/health` and `http://localhost:4000/health/ready`.
PostgreSQL and Redis have no host-published ports in Compose.

For processes running outside Docker, point `DATABASE_URL` and `REDIS_URL` at locally reachable infrastructure, build, then run:

```bash
pnpm dev
```

## Verification note

The source, environment tests, health tests, lint, typecheck, and production compilation pass in the current environment. Docker CLI is not installed in the execution container, so Compose runtime validation must be repeated on a Docker-capable host before deployment.
