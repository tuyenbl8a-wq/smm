import assert from "node:assert/strict";
import test from "node:test";
import { PanelService } from "../src/tenant/panel-service.js";

function renewalHarness() {
  const ledger = new Map<string, any>();
  let balance = 1000;
  let expiry = Date.now();
  let debits = 0;
  const db: any = {
    $transaction: async (fn: any) =>
      fn({
        walletTransaction: {
          findUnique: async ({ where }: any) => ledger.get(where.idempotencyKey) ?? null,
          create: async ({ data }: any) => {
            if (ledger.has(data.idempotencyKey)) throw new Error("UNIQUE_CONFLICT");
            ledger.set(data.idempotencyKey, data);
          },
        },
        panelSubscription: {
          findFirst: async () => ({
            id: "sub-a",
            siteId: "child-a",
            renterUserId: "user-a",
            sellerSiteId: "seller-a",
            planId: "plan-a",
            expiresAt: new Date(expiry),
          }),
          update: async ({ data }: any) => {
            expiry = new Date(data.expiresAt).getTime();
            return { id: "sub-a", expiresAt: new Date(expiry), ...data };
          },
        },
        panelRentalPlan: { findUnique: async () => ({ price: "100.00000000", billingDays: 30 }) },
        $queryRawUnsafe: async (_sql: string, price: string) => {
          const amount = Number(price);
          if (balance < amount) return [];
          const before = balance;
          balance -= amount;
          debits += 1;
          return [{ id: "wallet-a", before: String(before), after: String(balance) }];
        },
        site: { update: async () => undefined },
      }),
  };
  const service = new PanelService(db, {} as any);
  return { service, ledger, get balance() { return balance; }, get debits() { return debits; } };
}

test("manual renewal retries with the same key return the previous result and debit once", async () => {
  const h = renewalHarness();
  const first = await h.service.renew("child-a", "user-a", "attempt-00000001");
  const retry = await h.service.renew("child-a", "user-a", "attempt-00000001");
  assert.equal(h.debits, 1);
  assert.equal(h.balance, 900);
  assert.equal(h.ledger.size, 1);
  assert.equal(retry.expiresAt.getTime(), first.expiresAt.getTime());
});

test("a later intentional renewal key charges once as a separate period", async () => {
  const h = renewalHarness();
  await h.service.renew("child-a", "user-a", "attempt-00000001");
  await h.service.renew("child-a", "user-a", "attempt-00000002");
  assert.equal(h.debits, 2);
  assert.equal(h.balance, 800);
  assert.equal(h.ledger.size, 2);
});

test("renewal rejects absent and blank idempotency keys", async () => {
  const h = renewalHarness();
  for (const key of ["", "   "])
    await assert.rejects(
      () => h.service.renew("child-a", "user-a", key),
      (error: any) => error.code === "IDEMPOTENCY_KEY_INVALID",
    );
  assert.equal(h.debits, 0);
});
