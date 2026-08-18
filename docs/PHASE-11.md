# Phase 11 — transactional order creation

Customer orders are validated and priced on the server from the authenticated user, service, price group, and highest-priority active mapping. Exact fixed-point math snapshots sale rate, charge, provider rate/cost, and profit. One PostgreSQL transaction creates the order/history, executes a guarded wallet debit, and writes the immutable ledger. The order request idempotency key is database-unique; concurrent retries return the same order and cannot double debit. No provider HTTP request occurs in this phase.
