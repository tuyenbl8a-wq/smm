# Phase 8 — service catalog and exact pricing

Phase 8 delivers PostgreSQL/Prisma-backed category, service, price-group and pricing-rule management. It reuses the models and constraints introduced by the initial migration, so no new migration is required.

## API and authorization

- `GET /api/v1/customer/catalog` returns only active categories/services, scoped to the authenticated user's price group, with pagination and search. Provider cost is not returned.
- `GET /api/v1/admin/catalog` and all `/api/v1/admin/catalog/*` mutations require `services.manage` (or `SUPER_ADMIN`).
- Mutations support category/service create and update, price-group create, and price-rule upsert. Browser mutations retain session-bound CSRF validation and rate limiting.
- Every administrative mutation writes an `AuditLog` inside the same database transaction.

## Pricing

Pricing uses eight-decimal fixed-point `BigInt` arithmetic at the TypeScript boundary. A rule can set a fixed rate or add percentage/fixed profit; the minimum-profit floor ensures the result cannot fall below provider cost plus the configured minimum profit. Provider credentials and provider cost never appear in the customer response.

## UI

`/services` provides a responsive, searchable customer catalog. `/admin/catalog` provides real category, service, price-group, pricing-rule and service active-state controls. Phase 9 provider configuration is intentionally not represented.
