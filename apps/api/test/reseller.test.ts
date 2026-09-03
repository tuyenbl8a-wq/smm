import assert from "node:assert/strict";
import test from "node:test";
import { ResellerService } from "../src/reseller/service.js";
test("raw API key is returned once while only hash persists", async () => {
  let data: any;
  const db = {
    apiKey: {
      updateMany: async () => ({}),
      create: async (x: any) => ((data = x.data), {}),
    },
  };
  const x = await new ResellerService(db, {} as any).generate("u");
  assert.equal(x.key.startsWith("smm_"), true);
  assert.equal(data.keyHash.includes(x.key), false);
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
    { id: "key", userId: "u" },
  );
  assert.deepEqual(result, { refill: "refill-id" });
  assert.deepEqual(requests[0], [
    "u",
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
