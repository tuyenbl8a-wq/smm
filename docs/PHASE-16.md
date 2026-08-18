# Phase 16

VietQR rendering encodes bank BIN, account, server amount, and unique transfer content but never proves payment. Bank webhook processing verifies HMAC over raw bytes, deduplicates event and transaction identities in PostgreSQL, reconciles amount/currency, sends mismatches to MANUAL_REVIEW, and atomically marks PAID plus credits the immutable wallet ledger exactly once.
