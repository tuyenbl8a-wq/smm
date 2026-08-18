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
