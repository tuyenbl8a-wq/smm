# Phase 13 — lifecycle reliability

Provider reconciliation and refill/cancel execution run in the worker. Action
requests use database `SKIP LOCKED` claiming, bounded retries with persisted
backoff, and stale claims become `UNKNOWN` rather than being blindly resent.
This deliberately avoids duplicating an external mutation whose outcome cannot be
known after a worker crash or timeout.

Idempotent status reconciliation validates terminal transitions and provider remains. PARTIAL performs one atomic wallet refund with a database-unique ledger key, snapshots refunded amount, and writes history. Customer refill/cancel requests are user-scoped and database-idempotent; terminal orders are never polled or mutated again.
