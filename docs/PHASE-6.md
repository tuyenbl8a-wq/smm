# Phase 6 — Protected admin dashboard

`GET /api/v1/admin/overview` requires an authenticated PostgreSQL session and grants
access only to `SUPER_ADMIN` or a role with `reports.read`. The user ID and access
claims are loaded server-side; the endpoint accepts no identity selector. Ordinary
users receive HTTP 403 before any aggregate query executes.

The dashboard runs bounded, concurrent Prisma aggregates for users, order states,
order snapshot revenue/provider cost/profit, paid and pending deposits, tickets,
provider and service health, seven-day activity, alerts, and eight recent orders.
Responses contain no provider configuration, API key, password hash, session token,
or payment secret. Monetary values cross the boundary as exact decimal strings, and
the seven-day series aggregates eight-decimal fixed-point units with `BigInt`.

The responsive `/admin` Nexus shell provides dedicated operational navigation,
loading/error/empty states, metric cards, order/revenue/profit activity, system
alerts, recent-order snapshots, administrator identity, and real CSRF-protected
logout. Navigation entries prepare later modules without simulating their behavior.
No migration is required because Phase 6 reads the existing operational schema.
