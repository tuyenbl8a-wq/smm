# Phase 14 — reseller API v2

`POST /api/v2` authenticates a hashed API key and consumes a Redis-backed,
namespaced per-key/per-IP minute bucket before dispatch. Rejected requests return
HTTP 429 and `Retry-After`; Redis failure returns 503 rather than silently falling
back to a per-process counter. `/api-docs` manages one-time raw keys and documents
JSON/form payloads, idempotency, errors, and rate limiting.

Reseller API keys are random, shown only at generation, and stored only as SHA-256 hashes with prefix/active/last-used metadata. The compatibility dispatcher supports services, add, status, and balance using API-key authentication (not browser sessions), per-key limits, user-scoped reads, and the same transactional OrderService.
