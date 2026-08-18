# Phase 9 — encrypted providers and adapter contract

Provider API keys use AES-256-GCM authenticated encryption at rest and are only decrypted inside the provider boundary. Admin reads receive a masked key. The generic `ProviderAdapter` defines services, order, status, refill, cancel, and balance operations. The standard SMM adapter uses bounded timeouts and distinguishes an unknown create-order outcome from a safe read failure; raw keys are never logged.
