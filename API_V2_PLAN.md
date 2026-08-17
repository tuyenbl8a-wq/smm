# Customer API V2 Plan

## Scope

The official customer API must live under `/api/v2/`. Do not introduce `/api/v1/` unless explicit backwards compatibility is required in a later phase.

## Design Goals

- Stable external API for customers and resellers.
- API key authentication.
- Permission scopes.
- Rate limiting.
- Idempotency for mutating endpoints.
- Request logging and traceability.
- Standard response envelope.
- Predictable error codes.
- Pagination for list endpoints.
- OpenAPI documentation.

## Authentication

Recommended header:

```http
Authorization: Bearer <api_key>
```

API keys must be stored hashed in the database. Raw API keys should only be shown once at creation time.

## Standard Headers

Requests:

- `Authorization: Bearer <api_key>`
- `Idempotency-Key: <key>` for mutating endpoints
- `Content-Type: application/json`

Responses:

- `X-Request-Id`
- Rate limit headers such as `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`

## Standard Success Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_..."
  }
}
```

## Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  },
  "meta": {
    "request_id": "req_..."
  }
}
```

## Error Code Categories

- `AUTHENTICATION_REQUIRED`
- `INVALID_API_KEY`
- `API_KEY_DISABLED`
- `INSUFFICIENT_SCOPE`
- `RATE_LIMITED`
- `VALIDATION_ERROR`
- `SERVICE_NOT_FOUND`
- `SERVICE_DISABLED`
- `INSUFFICIENT_BALANCE`
- `DUPLICATE_IDEMPOTENCY_KEY`
- `ORDER_NOT_FOUND`
- `ORDER_NOT_REFILLABLE`
- `ORDER_NOT_CANCELABLE`
- `PROVIDER_UNAVAILABLE`
- `INTERNAL_ERROR`

## Endpoints

### `GET /api/v2/services`

Purpose: list active services available to the authenticated API user.

Query parameters:

- `category_id`
- `search`
- `page`
- `per_page`

Response data:

```json
{
  "items": [
    {
      "id": "svc_...",
      "category_id": "cat_...",
      "name": "Instagram Followers",
      "description": "...",
      "min_quantity": 100,
      "max_quantity": 10000,
      "price_per_1000": "1.2500",
      "currency": "USD",
      "supports_refill": true,
      "supports_cancel": false
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 100
  }
}
```

### `POST /api/v2/order`

Purpose: create an order idempotently.

Required headers:

- `Idempotency-Key`

Request body:

```json
{
  "service_id": "svc_...",
  "target": "https://example.com/profile",
  "quantity": 1000
}
```

Server requirements:

- Validate service status.
- Validate target and quantity.
- Recalculate price on backend.
- Check wallet balance inside a transaction.
- Charge wallet through ledger transaction.
- Queue provider submission.
- Return existing order for duplicate idempotency key with identical payload.

Response data:

```json
{
  "order_id": "ord_...",
  "status": "PENDING",
  "charge_amount": "1.2500",
  "currency": "USD"
}
```

### `GET /api/v2/order/{id}`

Purpose: fetch a single order owned by the authenticated API user.

Response data:

```json
{
  "id": "ord_...",
  "service_id": "svc_...",
  "target": "https://example.com/profile",
  "quantity": 1000,
  "charge_amount": "1.2500",
  "currency": "USD",
  "status": "PROCESSING",
  "start_count": 120,
  "remains": 300,
  "created_at": "2026-08-17T00:00:00Z"
}
```

### `GET /api/v2/orders`

Purpose: paginated order history.

Query parameters:

- `status`
- `service_id`
- `from`
- `to`
- `page`
- `per_page`

### `GET /api/v2/balance`

Purpose: return current wallet balance for the authenticated API user.

Response data:

```json
{
  "balance": "100.0000",
  "currency": "USD"
}
```

### `POST /api/v2/refill`

Purpose: request refill for eligible orders.

Request body:

```json
{
  "order_id": "ord_..."
}
```

Rules:

- Order must belong to the user.
- Service/order must support refill.
- Refill must be allowed by time window and provider state.
- Request must be idempotent where appropriate.

### `GET /api/v2/refill/{id}`

Purpose: fetch refill request status.

### `POST /api/v2/cancel`

Purpose: request cancellation for eligible orders.

Request body:

```json
{
  "order_id": "ord_..."
}
```

Rules:

- Order must belong to the user.
- Service/order must support cancellation.
- Cancellation must be queued through provider engine.

## Rate Limiting

Initial recommended policy:

- Per API key fixed or sliding window rate limit.
- Separate stricter limit for mutating endpoints.
- Persist counters in Redis for speed and optionally summarize to database.

## Logging

Each request should write an API log containing:

- Request ID
- API key ID
- User ID
- Route
- Method
- Status code
- Idempotency key
- IP address
- User agent
- Duration
- Timestamp

Sensitive data must not be logged in raw form.

## OpenAPI

Phase 13 must generate or maintain OpenAPI documentation for all `/api/v2/` endpoints, request schemas, response schemas, authentication, rate limit headers, and error codes.
