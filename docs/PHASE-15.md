# Phase 15

Defines a gateway-neutral PaymentProvider contract and PostgreSQL DepositService. Deposits are created PENDING from authenticated user input after server-side amount/method validation and retain gross, fee, net, source/base currency, exchange-rate snapshot, expiry, and unique transfer code. Browser actions can never mark deposits paid or credit wallets.
