import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
test("financial records have database idempotency constraints", () => {
  for (const name of ["WalletTransaction", "Refill", "Cancellation"]) {
    const body =
      schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ??
      "";
    assert.match(body, /idempotencyKey String @unique/);
  }
});
test("money never uses floating point", () => {
  assert.doesNotMatch(schema, /\bFloat\b/);
  assert.match(schema, /balance Decimal/);
  assert.match(schema, /providerCost Decimal/);
});
test("external payment identities are unique", () => {
  assert.match(schema, /externalTransactionId String\? @unique/);
  assert.match(schema, /@@unique\(\[paymentMethodId, externalEventId\]\)/);
});
