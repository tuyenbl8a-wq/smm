# Phase 10 — idempotent provider synchronization

Administrators with `providers.manage` can create encrypted provider configurations, test balance connectivity, and explicitly synchronize services. Sync upserts on the database unique identity `(providerId, externalId)`, snapshots sanitized raw service data, updates provider health timestamps, and audits counts. Repeated sync does not duplicate services. Scheduled invocation can use the same idempotent service; no credential is required until an administrator enables and invokes a real provider.
