import assert from "node:assert/strict";
import test from "node:test";
import { orderAmount, OrderService } from "../src/order/service.js";
test("order charge uses exact per-thousand arithmetic", () => {
  assert.equal(orderAmount("1.23456789", 1000), "1.23456789");
  assert.equal(orderAmount("1.00000001", 3), "0.00300000");
});
test("order validation rejects invalid link before persistence", async () => {
  await assert.rejects(
    () =>
      new OrderService({}).create(
        "u",
        "00000000-0000-4000-8000-000000000001",
        { serviceId: "s", quantity: 10, link: "javascript:bad" },
        "valid-key-1234",
      ),
    /Link must be HTTP/,
  );
});
test("order list is strictly scoped to authenticated user", async () => {
  let where: any;
  const db = {
    order: {
      count: async (q: any) => ((where = q.where), 0),
      findMany: async () => [],
    },
  };
  await new OrderService(db).list(
    "user-a",
    "00000000-0000-4000-8000-000000000001",
    1,
    20,
  );
  assert.deepEqual(where, {
    userId: "user-a",
    siteId: "00000000-0000-4000-8000-000000000001",
  });
});

const routingDatabase = (source: "MANUAL" | "API") => {
  let outbox = 0;
  const service = {
      id: "service-1",
      siteId: "00000000-0000-4000-8000-000000000001",
      source,
      active: true,
      deletedAt: null,
      priceReviewStatus: "OK",
      min: 1,
      max: 1000,
      rate: "1.00000000",
      providerCost: "0.50000000",
      pricingMode: "FIXED",
      defaultMarkupPercent: "0",
      defaultFixedProfit: "0",
      defaultMinProfit: "0",
    },
    mapping = {
      id: "mapping-1",
      serviceId: service.id,
      providerServiceId: "provider-service-1",
      active: true,
      priority: 0,
      syncAll: true,
    },
    providerService = {
      id: "provider-service-1",
      providerId: "provider-1",
      externalId: "123",
      active: true,
      stale: false,
      rate: "0.50000000",
    },
    tx: any = {
      service: {
        findFirst: async () => service,
        findUnique: async () => service,
      },
      user: {
        findFirst: async () => ({ siteId: service.siteId }),
        findUnique: async () => ({ priceGroupId: null }),
      },
      serviceMapping: {
        findMany: async () => (source === "API" ? [mapping] : []),
      },
      providerService: {
        findMany: async () => (source === "API" ? [providerService] : []),
      },
      provider: {
        findMany: async () =>
          source === "API" ? [{ id: "provider-1", status: "ACTIVE" }] : [],
      },
      order: {
        findFirst: async () => null,
        findUnique: async () => null,
        create: async ({ data }: any) => ({
          id: 1n,
          publicId: "order-1",
          ...data,
        }),
      },
      walletTransaction: { create: async () => ({}) },
      orderHistory: { create: async () => ({}) },
      providerOutbox: { create: async () => (outbox++, {}) },
      $queryRawUnsafe: async (sql: string) =>
        sql.startsWith("SELECT")
          ? [{ balance: "10.00000000" }]
          : [
              {
                id: "wallet-1",
                before: "10.00000000",
                after: "9.99900000",
              },
            ],
    };
  const db: any = {
    ...tx,
    $transaction: async (run: any) => run(tx),
  };
  return { db, outbox: () => outbox };
};

test("manual order is persisted without provider adapter outbox or fake provider id", async () => {
  const { db, outbox } = routingDatabase("MANUAL");
  const order = await new OrderService(db).create(
    "user-1",
    "00000000-0000-4000-8000-000000000001",
    { serviceId: "service-1", quantity: 1, link: "https://example.com/post" },
    "manual-order-123",
  );
  assert.equal(outbox(), 0);
  assert.equal(order.status, "PENDING");
});

test("API order snapshots mapping and creates exactly one provider outbox", async () => {
  const { db, outbox } = routingDatabase("API");
  await new OrderService(db).create(
    "user-1",
    "00000000-0000-4000-8000-000000000001",
    { serviceId: "service-1", quantity: 1, link: "https://example.com/post" },
    "provider-order-123",
  );
  assert.equal(outbox(), 1);
});

test("foreign service UUID guessing is hidden from child order creation", async () => {
  const child = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const candidate = {
    id: "root-service",
    siteId: "00000000-0000-4000-8000-000000000001",
    active: true,
    min: 1,
    max: 100,
  };
  const tx: any = {
    service: { findFirst: async () => candidate },
    siteServiceRule: { findUnique: async () => null },
  };
  const db: any = {
    order: { findFirst: async () => null },
    $transaction: async (run: any) => run(tx),
  };
  await assert.rejects(
    () =>
      new OrderService(db).create(
        "child-user",
        child,
        {
          serviceId: candidate.id,
          quantity: 10,
          link: "https://example.com/post",
        },
        "foreign-service-key",
      ),
    (error: any) => error.code === "SERVICE_UNAVAILABLE",
  );
});
