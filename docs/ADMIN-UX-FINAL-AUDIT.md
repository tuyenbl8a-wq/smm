# Final Admin UX audit (2026-09-03)

## Code complete

- The primary navigation contains nine operator destinations: overview, orders,
  services, pricing, users, payments, providers, support, and settings. Reports,
  audit logs, coupons, and staff permissions remain available under Settings.
- Navigation and mutation actions are hidden according to the current staff
  permissions. API authorization remains authoritative.
- The dashboard prioritizes orders, exceptions, revenue, profit, users, provider
  health, payment review, and open tickets.
- Order operations expose order, user, service, provider, status, and date filters.
- Service source and provider synchronization controls remain available in a
  collapsed advanced section.
- Pricing retains the database-driven provider → platform → category → service
  cascade, three operator-facing tiers, compact display formatting, safety-floor
  warnings, and preview invalidation before apply.
- User detail now owns wallet balance management. Credit and debit requests use the
  existing atomic ledger service, mandatory reason, optional internal note,
  idempotency key, nonnegative balance guard, and audit log.
- Payment settlement remains separate from manual wallet adjustment.

## Page review

| Page               | Daily task presented first                     | Advanced capability retained                            |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------- |
| `/admin`           | Operational metrics and short trend            | Detailed reports under Settings                         |
| `/admin/orders`    | Search and exception filters                   | Provider identifiers remain in rows/detail              |
| `/admin/services`  | Platform/category groups and edit action       | Source routing and sync controls in editor              |
| `/admin/pricing`   | Four-step scope and three profit percentages   | Alerts/history and professional engine in Advanced      |
| `/admin/users`     | Customer search, status, group, account detail | Staff permissions and bulk tier controls retained       |
| `/admin/providers` | Test, sync, enable/disable, import             | Masked credentials and sync logs retained               |
| `/admin/payments`  | Payment methods and transaction history        | Adapter credentials remain in setup modal               |
| `/admin/support`   | Ticket list and conversation                   | Internal notes are visually labelled                    |
| `/admin/settings`  | General settings                               | Reports, audit, coupons, staff and modules grouped here |

Responsive tables scroll within their cards; forms collapse to one column on narrow
screens. Loading, empty, error, disabled-preview, and permission-hidden states are
explicit in the rendered pages.

## External live acceptance pending

Live provider, Casso, VietQR, Binance Merchant, SMTP, and S3 acceptance was not
performed because this checkout has no production credentials or corresponding
operator runtime. Unit mocks are test evidence only and are not represented as live
production acceptance.
