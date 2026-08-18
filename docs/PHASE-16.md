# Phase 16 — VietQR and verified bank settlement

Customer deposits expose only configured public bank details and a server-built
VietQR image. `POST /webhooks/payments/casso` authenticates the raw delivery with
`CASSO_WEBHOOK_SECURE_TOKEN`, matches the unique `NAP…` code, verifies exact
amount/currency, and credits wallet, immutable ledger, and deposit in one database
transaction. Event IDs, bank transaction IDs, and ledger idempotency keys prevent
duplicate credit. Unknown or mismatched transactions remain uncredited and enter
manual review. The integration fails closed when its token is absent.

VietQR rendering encodes bank BIN, account, server amount, and unique transfer content but never proves payment. Bank webhook processing verifies HMAC over raw bytes, deduplicates event and transaction identities in PostgreSQL, reconciles amount/currency, sends mismatches to MANUAL_REVIEW, and atomically marks PAID plus credits the immutable wallet ledger exactly once.
