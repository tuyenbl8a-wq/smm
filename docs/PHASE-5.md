# Phase 5 — Responsive customer dashboard

The customer dashboard is served at `/dashboard` and obtains all metrics from the
session-protected `GET /api/v1/customer/overview` endpoint. The backend derives the
wallet balance, order totals and statuses, historical charge, successful deposits,
open tickets, unread notifications, recent notification entries, and seven UTC days
of order activity directly from PostgreSQL through Prisma.

Dashboard money remains a decimal string across the API boundary. Seven-day chart
aggregation uses integer micro-units rather than JavaScript floating point. Queries
execute concurrently, remain scoped to the authenticated user ID, select only fields
needed by the dashboard, and limit notification results.

The responsive Nexus shell includes navigation, account identity, six metric cards,
an accessible activity chart, notification empty state, mobile/tablet layouts, error
handling, authentication redirect, and a logout action that retains Phase 4 CSRF and
session revocation behavior. No dashboard aggregate accepts a user ID from the
browser, preventing cross-account reads.
