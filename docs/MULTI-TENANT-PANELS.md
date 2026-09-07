# Multi-tenant child panels

## Architecture and root site

Every business row belongs to a `Site`. The deterministic root site is `00000000-0000-4000-8000-000000000001` (`DichVu1st`, depth 0); the additive migration backfills existing rows without replacing UUIDs or numeric public identifiers. `Site.parentSiteId` forms an unbounded self-referencing tree. Parents are immutable in application workflows, depth is derived on the server, self-parenting is constrained, and traversal is guarded against corrupt cycles.

## Tenant resolution and authentication

The API normalizes the HTTP `Host` (lowercase, port/trailing dot removed, strict DNS labels) and resolves only configured root hosts or a `VERIFIED` `SiteDomain`. Unknown and unverified hosts fail closed. Browser `siteId`, `tenantId`, and `panelId` are never authority. Users, password-reset lookup, sessions, API keys, and resource filters must match the resolved site. Email and username uniqueness is per site; `userNumber` remains global.

Custom domains should terminate at Web V2 and expose `/api/...` on the same origin through an infrastructure reverse proxy with a fixed internal API upstream. The proxy must allow only API paths, preserve method/body/content type, Host, HttpOnly `Set-Cookie`, and CSRF headers, enforce body/time limits, and must never be a general URL proxy. Credentialed wildcard CORS is prohibited and tokens remain in HttpOnly cookies.

## Hierarchy, ownership, rentals, and lifecycle

A child owner is a user on its parent site. Rental plans belong to the seller site and specify Decimal price, billing period, direct-child/depth limits, and custom-domain, resale, API, and theme entitlements. A child seller cannot grant capabilities above its own active subscription. Rental validates all limits and atomically locks/debits the parent-site wallet, creates one Site/domain/subscription/ledger/audit record, and uses one idempotency key. Renewal extends from `max(now, expiresAt)`.

The expiry worker changes `ACTIVE` to `PAST_DUE` at expiry and then to `SUSPENDED` after grace; it never deletes data or suspends the root. Operational checks walk ancestors so a suspended parent blocks descendant orders and new rentals while history, support, subscription view, and renewal can remain available.

## Services, pricing, orders, and refunds

`SiteServiceRule` is an explicit child allowlist. The parent's effective customer rate is the child's contractual upstream cost; the shared `PricingMode` concepts calculate the child price with Decimal precision and reject below-cost sales. Provider cost and provider configuration remain root-only. Price groups, coupons, payment methods, settings, reports, and customer records are site-scoped.

One leaf order creates one provider outbox submission. Before commit, the settlement service walks the hierarchy, calculates every edge, conditionally debits every required wallet in the same database transaction, and records immutable `OrderSiteSettlement` rate/charge snapshots. Any failed ancestor debit raises `PANEL_UPSTREAM_BALANCE_LOW`, rolling back all debits, the order, coupon reservation, and provider outbox.

Refund entry points (worker sync, admin sync, and manual late refund) call the same helper. Each edge target is `upstreamCharge * remains / quantity`; only a positive delta over `refundedAmount` is credited, equal targets are no-ops, decreasing targets are rejected, and ledger keys include order, edge, and target.

## Domains and branding

Generated subdomains are normalized and verified when provisioned by the application. Custom domains begin `PENDING`; owners receive DNS instructions and an unpredictable verification token, then may verify, select a single primary domain, disable, or remove the mapping. This does **not** modify Cloudflare. Public automatic subdomains require wildcard DNS and TLS for `*.dichvu1st.com` routed to Web V2/API before launch.

Site settings provide name, description, logo, favicon, support contacts, one of the shared 20 themes, text content, and safe HTTP(S) CTA URLs. No raw HTML, script, or CSS is accepted.

## Isolation and security boundaries

All repositories must include resolved `siteId` for users, wallets/ledger, orders/history, deposits, payment methods/webhooks, tickets, notifications, API keys, coupons/affiliate, price groups, settings, audit logs, and reports. Payment webhooks bind the exact method, site, deposit, and user before exact-once credit. A panel owner receives site-scoped capabilities rather than global `ADMIN`; only root `SUPER_ADMIN` can deliberately aggregate sites or manage providers and root secrets.

Deployment requires a database backup, isolated migration rehearsal, maintenance window, generated Prisma client, hostname configuration, wildcard/custom-domain TLS routing, and worker rollout. Never run the migration against production from an interactive development task; operators deploy and verify backfill counts separately.
