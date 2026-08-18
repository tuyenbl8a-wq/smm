# Phase 17

The official merchant adapter creates signed Binance Pay orders, returns official QR/deeplink references, queries payment state for reconciliation, and verifies webhook signatures. It is fail-closed (`BINANCE_DISABLED`) until merchant credentials are configured; it never scrapes Binance, accepts customer passwords, or simulates successful payment.
