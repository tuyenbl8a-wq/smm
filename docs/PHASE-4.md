# Phase 4 — Authentication, roles, and permissions

The API now persists users, salted scrypt password hashes, opaque hashed sessions,
password-reset tokens, login histories, roles, and permissions in PostgreSQL through
Prisma. Browser sessions use HTTP-only, SameSite cookies (plus `Secure` in
production) and state-changing authenticated requests require a session-bound CSRF
cookie/header pair.

Implemented endpoints under `/api/v1` include registration, login, logout, forgot
and reset password, change password, current user, active sessions, session revoke,
customer protection, and backend-enforced admin authorization. Auth entry points
apply per-process burst limiting plus persisted recent-failure limiting; deployments
with multiple API replicas should additionally enforce the documented edge/Redis
limit in the security-hardening phase.

The web process serves real login, registration, and forgot-password forms that call
the API with credentialed requests. Successful users enter `/dashboard`; users with
`SUPER_ADMIN` enter `/admin`. Both panels verify authorization against the API and
logout revokes the PostgreSQL session before clearing cookies.

Password-reset delivery is deliberately not simulated: development returns the token
only in development mode, while production records a valid one-time token without
logging or exposing it. Queued SMTP delivery is connected in the email phase.
