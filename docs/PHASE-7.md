# Phase 7 — Atomic wallet and immutable ledger

`WalletService` is the only money-mutation boundary. It validates positive decimal
amounts at PostgreSQL `numeric(20,8)` precision, requires a database-unique
idempotency key, and runs the guarded balance update, ledger insert, and optional
admin audit record in one Prisma transaction.

Debits use one conditional PostgreSQL `UPDATE ... WHERE balance + delta >= 0
RETURNING` statement. No unguarded read/check/write sequence exists. Concurrent
requests therefore serialize at the wallet row; a losing debit changes neither the
balance nor ledger. Concurrent duplicate idempotency keys are resolved by the unique
constraint: the failed transaction rolls back, then the original compatible result
is returned. Reusing a key for different user/type/amount is rejected.

The new migration adds database checks for nonnegative wallet/ledger balances,
nonzero ledger amounts, and `balanceAfter = balanceBefore + amount`. PostgreSQL
triggers reject ledger UPDATE and DELETE, so corrections require a compensating new
transaction.

Customers can read only their session-owned summary and paginated history at
`/wallet`. Admin read APIs require admin reporting access; mutation additionally
requires `wallets.adjust`, a CSRF token, an `Idempotency-Key` header, validated input,
and creates `AuditLog` in the same transaction. The `/admin/wallet` interface exposes
these controls without implementing deposits or other later payment phases.
