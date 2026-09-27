import assert from "node:assert/strict";
import test from "node:test";
import { OrderService } from "../src/order/service.js";
import { SiteSettlementService } from "../src/order/site-settlement.js";

const ROOT = "00000000-0000-4000-8000-000000000001";
const PARENT = "00000000-0000-4000-8000-000000000002";
const CHILD = "00000000-0000-4000-8000-000000000003";
const SIBLING = "00000000-0000-4000-8000-000000000004";
const FOREIGN = "00000000-0000-4000-8000-000000000005";
const CUSTOMER = "00000000-0000-4000-8000-000000000006";
const RENTER = "00000000-0000-4000-8000-000000000007";

function fixture(seller: string, source: string, panelType = "PANEL", inheritedRule: any = { active: true, fixedRate: "3.00000000" }) {
  const sites: Record<string, any> = {
    [ROOT]: { id: ROOT, parentSiteId: null, panelType: "PANEL", status: "ACTIVE" },
    [PARENT]: { id: PARENT, parentSiteId: ROOT, panelType: "PANEL", status: "ACTIVE", ownerUserId: "parent-owner" },
    [CHILD]: { id: CHILD, parentSiteId: PARENT, panelType, status: "ACTIVE", ownerUserId: RENTER },
    [SIBLING]: { id: SIBLING, parentSiteId: PARENT, panelType: "CHILD_PANEL", status: "ACTIVE" },
    [FOREIGN]: { id: FOREIGN, parentSiteId: null, panelType: "PANEL", status: "ACTIVE" },
  };
  const service = {
    id: "source-service", siteId: source, source: "API", active: true,
    deletedAt: null, priceReviewStatus: "OK", min: 1, max: 1000,
    rate: "2.00000000", providerCost: "1.00000000", pricingMode: "FIXED",
    defaultMarkupPercent: "0", defaultFixedProfit: "0", defaultMinProfit: "0",
  };
  const mapping = { id: "mapping", serviceId: service.id, providerServiceId: "provider-service", active: true, priority: 0, syncAll: true };
  let state = {
    wallets: new Map([
      [`${seller}:${CUSTOMER}`, "10.00000000"],
      [`${PARENT}:${RENTER}`, "10.00000000"],
      [`${SIBLING}:sibling-owner`, "10.00000000"],
      [`${FOREIGN}:foreign-owner`, "10.00000000"],
    ]),
    orders: [] as any[],
    transactions: [] as any[],
    settlements: [] as any[],
    outbox: [] as any[],
    nextId: 1n,
  };
  let failUpstreamOnce = false;
  const tx: any = {
    site: { findUnique: async ({ where }: any) => sites[where.id] ?? null },
    siteServiceRule: {
      findUnique: async ({ where }: any) =>
        where.siteId_serviceId.siteId === CHILD && source === PARENT
          ? inheritedRule
          : null,
    },
    service: {
      findFirst: async () => service,
      findUnique: async () => service,
    },
    user: {
      findFirst: async ({ where }: any) => where.siteId === seller && where.id === CUSTOMER ? { siteId: seller } : null,
      findUnique: async () => ({ priceGroupId: null }),
    },
    serviceMapping: { findMany: async () => [mapping] },
    providerService: {
      findMany: async () => [{ id: "provider-service", providerId: "provider", externalId: "123", active: true, stale: false, rate: "1.00000000" }],
    },
    provider: { findMany: async () => [{ id: "provider", siteId: source, status: "ACTIVE" }] },
    order: {
      findFirst: async ({ where }: any) => state.orders.find(x => x.providerSubmitKey === where.providerSubmitKey && x.siteId === where.siteId && x.userId === where.userId) ?? null,
      create: async ({ data }: any) => {
        const order = { id: state.nextId++, publicId: "fixture-order", ...data };
        state.orders.push(order);
        return order;
      },
    },
    walletTransaction: { create: async ({ data }: any) => { state.transactions.push(data); return data; } },
    orderSiteSettlement: { create: async ({ data }: any) => { state.settlements.push({ ...data, refundedAmount: "0.00000000" }); return data; } },
    orderHistory: { create: async () => ({}) },
    providerOutbox: { create: async ({ data }: any) => { state.outbox.push(data); return data; } },
    $queryRawUnsafe: async (sql: string, ...args: any[]) => {
      if (sql.includes('FROM "sites"')) return [{ id: args[0] }];
      const key = sql.startsWith("SELECT")
        ? `${args[1]}:${args[0]}`
        : `${args[2]}:${args[1]}`;
      const before = state.wallets.get(key);
      if (!before) return [];
      if (sql.startsWith("SELECT")) return [{ balance: before }];
      if (failUpstreamOnce && args[1] === RENTER) { failUpstreamOnce = false; return []; }
      const after = (Number(before) - Number(args[0])).toFixed(8);
      if (Number(after) < 0) return [];
      state.wallets.set(key, after);
      return [{ id: key, before, after }];
    },
  };
  const db: any = {
    order: { findFirst: tx.order.findFirst },
    $transaction: async (run: any) => {
      const snapshot = structuredClone(state);
      try { return await run(tx); }
      catch (error) { state = snapshot; throw error; }
    },
  };
  return {
    db, tx, service,
    state: () => state,
    failNextUpstream: () => { failUpstreamOnce = true; },
  };
}

const place = (db: any, seller: string, key: string) =>
  new OrderService(db).create(
    CUSTOMER, seller,
    { serviceId: "source-service", quantity: 1000, link: "https://example.com/post" },
    key,
  );

for (const panelType of ["PANEL", "CHILD_PANEL"]) {
  test(`${panelType} sells its direct parent's service with one correctly owned settlement`, async () => {
    const f = fixture(CHILD, PARENT, panelType);
    const order = await place(f.db, CHILD, `direct-parent-${panelType}`);
    assert.equal(f.state().orders[0].siteId, CHILD);
    assert.equal(f.state().orders[0].serviceId, f.service.id);
    assert.equal(f.state().orders[0].providerId, "provider");
    assert.equal(f.state().settlements.length, 1);
    assert.deepEqual(
      { child: f.state().settlements[0].childSiteId, parent: f.state().settlements[0].parentSiteId, payer: f.state().settlements[0].payerUserId },
      { child: CHILD, parent: PARENT, payer: RENTER },
    );
    assert.equal(f.state().wallets.get(`${CHILD}:${CUSTOMER}`), "7.00000000");
    assert.equal(f.state().wallets.get(`${PARENT}:${RENTER}`), "8.00000000");
    assert.equal(f.state().wallets.get(`${SIBLING}:sibling-owner`), "10.00000000");
    assert.equal(f.state().wallets.get(`${FOREIGN}:foreign-owner`), "10.00000000");
    assert.equal(f.state().transactions.length, 2);
    assert.equal(f.state().outbox.length, 1);
    await place(f.db, CHILD, `direct-parent-${panelType}`);
    assert.equal(f.state().orders.length, 1);
    assert.equal(f.state().settlements.length, 1);
    assert.equal(f.state().transactions.length, 2);
    assert.equal(order.charge, "3.00000000");
  });
}

test("fractional inherited markup is identical in customer order and settlement", async () => {
  const f = fixture(CHILD, PARENT, "CHILD_PANEL", {
    active: true, fixedRate: null, markupPercent: "12.50000000",
    fixedProfit: "0", minProfit: "0",
  });
  const order = await place(f.db, CHILD, "fractional-markup-order");
  assert.equal(order.saleRate, "2.25000000");
  assert.equal(order.charge, "2.25000000");
  assert.equal(f.state().settlements[0].upstreamRate, "2.00000000");
  assert.equal(f.state().wallets.get(`${CHILD}:${CUSTOMER}`), "7.75000000");
  assert.equal(f.state().transactions.length, 2);
});

test("multi-level settlement carries fractional parent markup into the next edge", async () => {
  const sites: Record<string, any> = {
    [ROOT]: { id: ROOT, parentSiteId: null },
    [PARENT]: { id: PARENT, parentSiteId: ROOT, ownerUserId: "parent-owner" },
    [CHILD]: { id: CHILD, parentSiteId: PARENT, ownerUserId: RENTER },
  };
  const tx: any = {
    site: { findUnique: async ({ where }: any) => sites[where.id] },
    siteServiceRule: { findUnique: async () => ({ active: true, fixedRate: null, markupPercent: "12.50000000", fixedProfit: "0", minProfit: "0" }) },
  };
  const edges = await new SiteSettlementService({}).quote(tx, CHILD, { id: "root-service", siteId: ROOT, rate: "100" }, 1000);
  assert.equal(edges[0]!.upstreamRate, "100");
  assert.equal(edges[1]!.upstreamRate, "112.50000000");
  assert.equal(edges[1]!.upstreamCharge, "112.50000000");
});

test("ROOT own service and descendant PANEL own provider have no upstream settlement", async () => {
  for (const seller of [ROOT, CHILD]) {
    const f = fixture(seller, seller);
    await place(f.db, seller, `own-provider-${seller}`);
    assert.equal(f.state().orders[0].siteId, seller);
    assert.equal(f.state().orders[0].providerId, "provider");
    assert.equal(f.state().settlements.length, 0);
    assert.equal(f.state().transactions.length, 1);
    assert.equal(f.state().wallets.get(`${PARENT}:${RENTER}`), "10.00000000");
  }
});

test("failed upstream debit rolls back and retry creates only one debit and settlement", async () => {
  const f = fixture(CHILD, PARENT);
  f.failNextUpstream();
  await assert.rejects(() => place(f.db, CHILD, "retry-parent-order"), (error: any) => error.code === "PANEL_UPSTREAM_BALANCE_LOW");
  assert.equal(f.state().orders.length, 0);
  assert.equal(f.state().transactions.length, 0);
  assert.equal(f.state().wallets.get(`${CHILD}:${CUSTOMER}`), "10.00000000");
  await place(f.db, CHILD, "retry-parent-order");
  await place(f.db, CHILD, "retry-parent-order");
  assert.equal(f.state().orders.length, 1);
  assert.equal(f.state().settlements.length, 1);
  assert.equal(f.state().transactions.length, 2);
});

test("historical refund remains idempotent and credits only the recorded upstream payer", async () => {
  const f = fixture(CHILD, PARENT);
  await place(f.db, CHILD, "refund-parent-order");
  f.tx.orderSiteSettlement.findMany = async () => f.state().settlements;
  f.tx.orderSiteSettlement.update = async ({ where, data }: any) => {
    const row = f.state().settlements.find(x => x.id === where.id);
    row.refundedAmount = data.refundedAmount;
  };
  f.state().settlements[0].id = "settlement-1";
  f.tx.wallet = {
    findFirstOrThrow: async () => ({ id: `${PARENT}:${RENTER}`, balance: f.state().wallets.get(`${PARENT}:${RENTER}`) }),
    update: async ({ data }: any) => {
      const key = `${PARENT}:${RENTER}`;
      const balance = (Number(f.state().wallets.get(key)) + Number(data.balance.increment)).toFixed(8);
      f.state().wallets.set(key, balance);
      return { balance };
    },
  };
  const settlement = new SiteSettlementService(f.db);
  const order = f.state().orders[0];
  await settlement.refund(f.tx, order, 1000);
  await settlement.refund(f.tx, order, 1000);
  assert.equal(f.state().wallets.get(`${PARENT}:${RENTER}`), "10.00000000");
  assert.equal(f.state().wallets.get(`${SIBLING}:sibling-owner`), "10.00000000");
  assert.equal(f.state().wallets.get(`${FOREIGN}:foreign-owner`), "10.00000000");
  assert.equal(f.state().transactions.filter(x => x.type === "REFUND").length, 1);
});

test("service source outside the ancestry cannot create a settlement edge", async () => {
  const f = fixture(CHILD, FOREIGN);
  await assert.rejects(
    () => new SiteSettlementService(f.db).quote(f.tx, CHILD, f.service, 1000),
    (error: any) => error.code === "SERVICE_UNAVAILABLE",
  );
});
