import assert from "node:assert/strict";
import test from "node:test";
import { ResellerService } from "../src/reseller/service.js";
test("raw API key is returned once while only hash persists", async () => {
  let data: any;
  const db: any = {
    $transaction: async (run: any) => run(db),
    apiKey: {
      updateMany: async () => ({}),
      create: async (x: any) => ((data = x.data), {}),
    },
  };
  const x = await new ResellerService(db, {} as any).generate("u");
  assert.equal(x.key.startsWith("smm_"), true);
  assert.equal(data.keyHash.includes(x.key), false);
});
test("API key settings return only safe masked metadata", async () => {
  let query: any;
  const key = {
    id: "key-1",
    keyPrefix: "smm_abcdefgh",
    active: true,
    rateLimit: 60,
    lastUsedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const service = new ResellerService(
    {
      apiKey: {
        findMany: async (input: any) => {
          query = input;
          return [key];
        },
      },
    } as any,
    {} as any,
  );
  const [result] = await service.list("user-1", "site-1");
  assert.deepEqual(query.where, { userId: "user-1", siteId: "site-1" });
  assert.equal(query.select.key, undefined);
  assert.equal(query.select.keyHash, undefined);
  assert.equal("key" in result, false);
  assert.equal("keyHash" in result, false);
  assert.equal(result.keyPrefix, key.keyPrefix);
});

test("rotation atomically disables the old key and persists only an irreversible hash", async () => {
  const rows: any[] = [];
  const tx: any = {
    apiKey: {
      updateMany: async ({ where, data }: any) => {
        for (const row of rows)
          if (row.userId === where.userId && row.siteId === where.siteId)
            Object.assign(row, data);
        return { count: rows.length };
      },
      create: async ({ data }: any) => {
        const row = { id: `key-${rows.length + 1}`, active: true, ...data };
        rows.push(row);
        return row;
      },
    },
  };
  const db: any = {
    $transaction: async (run: any) => run(tx),
    apiKey: {
      findMany: async ({ where }: any) =>
        rows
          .filter((row) => row.userId === where.userId && row.siteId === where.siteId)
          .map(({ keyHash: _hash, ...safe }: any) => safe),
      findUnique: async ({ where }: any) =>
        rows.find((row) => row.keyHash === where.keyHash) ?? null,
      update: async ({ where, data }: any) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
  const service = new ResellerService(db, {} as any);
  const first = await service.generate("user-1", "site-1");
  const second = await service.generate("user-1", "site-1");

  assert.notEqual(first.key, second.key);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].keyHash.includes(first.key), false);
  assert.equal(JSON.stringify(rows).includes(first.key), false);
  await assert.rejects(
    () => service.authenticate(first.key),
    (error: any) => error.code === "INVALID_KEY",
  );
  const authenticated = await service.authenticate(second.key);
  assert.equal(authenticated.id, rows[1].id);

  const listed = await service.list("user-1", "site-1");
  assert.equal(JSON.stringify(listed).includes(second.key), false);
  assert.equal(JSON.stringify(listed).includes("keyHash"), false);
});
test("status cannot cross user boundary", async () => {
  const db: any = {
    apiKey: {
      findUnique: async () => ({
        id: "k",
        userId: "u",
        active: true,
        rateLimit: 10,
      }),
      update: async () => ({}),
    },
    order: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.userId, "u");
        return null;
      },
    },
  };
  await assert.rejects(
    () =>
      new ResellerService(db, {} as any).execute("key", {
        action: "status",
        order: "1",
      }),
    /not found/,
  );
});

test("API v2 refill reuses ownership-safe lifecycle service", async () => {
  const requests: any[] = [],
    db: any = {
      order: {
        findFirst: async ({ where }: any) => {
          assert.equal(where.userId, "u");
          return { id: 1n, publicId: "public", userId: "u" };
        },
      },
    },
    lifecycle: any = {
      request: async (...args: any[]) => {
        requests.push(args);
        return { id: "refill-id" };
      },
    },
    service = new ResellerService(db, {} as any, lifecycle);
  const result = await service.execute(
    "unused",
    { action: "refill", order: "1", idempotency_key: "refill-request-123" },
    {
      id: "key",
      userId: "u",
      siteId: "00000000-0000-4000-8000-000000000001",
    },
  );
  assert.deepEqual(result, { refill: "refill-id" });
  assert.deepEqual(requests[0], [
    "u",
    "00000000-0000-4000-8000-000000000001",
    "public",
    "refill",
    "refill-request-123",
  ]);
});

test("API v2 multiple status remains scoped and bounded", async () => {
  let where: any;
  const service = new ResellerService(
    {
      order: {
        findMany: async (input: any) => {
          where = input.where;
          return [
            {
              id: 1n,
              charge: "1.00000000",
              startCount: 10,
              status: "COMPLETED",
              remains: 0,
            },
          ];
        },
      },
    } as any,
    {} as any,
  );
  const result = await service.execute(
    "unused",
    { action: "status", orders: "1,2" },
    { userId: "u" },
  );
  assert.equal(where.userId, "u");
  assert.equal(result["1"].status, "COMPLETED");
});

test("API v2 accepts a numeric public service identifier", async () => {
  let received: any;
  const orders: any = {
    create: async (_userId: string, _siteId: string, input: any) => {
      received = input;
      return { id: "100123" };
    },
  };
  const result = await new ResellerService({} as any, orders).execute(
    "unused",
    {
      action: "add",
      service: "1001",
      link: "https://example.com/post",
      quantity: 10,
      idempotency_key: "numeric-service-1001",
    },
    {
      userId: "user",
      siteId: "00000000-0000-4000-8000-000000000001",
    },
  );
  assert.equal(received.serviceId, "1001");
  assert.deepEqual(result, { order: "100123" });
});
