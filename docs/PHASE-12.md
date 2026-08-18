# Phase 12 — transactional outbox and safe provider submission

Order creation now inserts a unique provider outbox row in the same transaction as the order, guarded wallet debit, ledger, and history. The worker claims work with PostgreSQL `FOR UPDATE SKIP LOCKED`, submits once, and transactionally records provider ID, status history, masked request/response, and completion. Successful or already-submitted orders cannot duplicate. A create timeout is `UNKNOWN` and is never retried blindly; deterministic failures use bounded delayed retries enforced by database attempt constraints.
