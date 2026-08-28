import assert from "node:assert/strict";
import test from "node:test";
import { ProviderService } from "../src/provider/service.js";
import { repriceMappedServices } from "../src/catalog/repricing.js";

const provider = {
  id: "provider",
  name: "Nhà cung cấp A",
  apiUrl: "https://provider.example/api",
  apiKeyEncrypted: "unused",
  timeoutMs: 1000,
  deletedAt: null,
};
const records = [
  {
    externalId: "101",
    name: "Followers chất lượng",
    category: "Social > Followers",
    type: "Default",
    rate: "100.00000000",
    min: 100,
    max: 10_000,
    refill: true,
    cancel: false,
    raw: {},
  },
  {
    externalId: "102",
    name: "Likes nhanh",
    category: "Social > Likes",
    type: "Default",
    rate: "50.00000000",
    min: 50,
    max: 5_000,
    refill: false,
    cancel: true,
    raw: {},
  },
];

test("provider fetch is server-side, sanitized and paginated", async () => {
  const service = new ProviderService(
    { provider: { findFirst: async () => provider } },
    "secret",
  );
  (service as any).adapter = () => ({ getServices: async () => records });
  const result = await service.fetchServices("provider", { page: 1, limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  assert.equal((result.items[0] as any).raw, undefined);
  assert.equal(JSON.stringify(result).includes("apiKey"), false);
});

test("import preview uses existing professional pricing for three default tiers", async () => {
  const service = new ProviderService(
    {
      provider: { findFirst: async () => provider },
      serviceCategory: {
        findFirst: async () => ({
          id: "category",
          name: "Followers",
          platformId: "platform",
        }),
      },
      platform: {
        findUnique: async () => ({ id: "platform", name: "Social" }),
      },
      priceGroup: {
        findMany: async () => [
          {
            code: "KHACH_LE",
            defaultMarkupPercent: "20",
            defaultFixedProfit: "0",
            defaultMinProfit: "0",
          },
          {
            code: "CTV",
            defaultMarkupPercent: "10",
            defaultFixedProfit: "0",
            defaultMinProfit: "0",
          },
          {
            code: "DAI_LY",
            defaultMarkupPercent: "5",
            defaultFixedProfit: "0",
            defaultMinProfit: "0",
          },
        ],
      },
      providerService: { findMany: async () => [] },
    },
    "secret",
  );
  (service as any).adapter = () => ({ getServices: async () => records });
  const result = await service.importPreview("provider", {
    externalIds: ["101"],
    categoryId: "category",
  });
  assert.equal(result.items[0]!.prices.KHACH_LE, "120.00000000");
  assert.equal(result.items[0]!.prices.CTV, "110.00000000");
  assert.equal(result.items[0]!.prices.DAI_LY, "105.00000000");
});

test("multi-service import is transactional, mapped, priced and audited", async () => {
  const createdServices: any[] = [],
    mappings: any[] = [],
    audits: any[] = [];
  let serviceSequence = 0;
  const tx: any = {
    serviceCategory: { findFirst: async () => ({ id: "category" }) },
    providerService: {
      findMany: async () => [],
      upsert: async ({ create }: any) => ({
        id: `ps-${create.externalId}`,
        ...create,
      }),
    },
    serviceMapping: {
      findMany: async () => [],
      upsert: async ({ create }: any) => (mappings.push(create), create),
    },
    service: {
      create: async ({ data }: any) => {
        const row = { id: `service-${++serviceSequence}`, ...data };
        createdServices.push(row);
        return row;
      },
    },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const db: any = {
    provider: { findFirst: async () => provider },
    $transaction: async (run: any) => run(tx),
  };
  const service = new ProviderService(db, "secret");
  (service as any).adapter = () => ({ getServices: async () => records });
  const result = await service.importApply("admin", "provider", {
    externalIds: ["101", "102"],
    categoryId: "category",
    syncAll: true,
  });
  assert.deepEqual(result, {
    received: 2,
    created: 2,
    updated: 0,
    skipped: 0,
    failed: 0,
  });
  assert.equal(createdServices[0].rate, "120.00000000");
  assert.equal(mappings.length, 2);
  assert.equal(mappings[0].syncAll, true);
  assert.equal(audits[0].action, "PROVIDER_SERVICE_IMPORT");
});

test("provider request failure never opens an import transaction", async () => {
  let transactions = 0;
  const service = new ProviderService(
    {
      provider: { findFirst: async () => provider },
      $transaction: async () => transactions++,
    },
    "secret",
  );
  (service as any).adapter = () => ({
    getServices: async () => {
      throw new Error("PROVIDER_UNAVAILABLE");
    },
  });
  await assert.rejects(
    () =>
      service.importApply("admin", "provider", {
        externalIds: ["101"],
        categoryId: "category",
      }),
    /PROVIDER_UNAVAILABLE/,
  );
  assert.equal(transactions, 0);
});

test("field sync OFF preserves local name and cost while enabled Min updates", async () => {
  const updates: any[] = [],
    service = {
      id: "service",
      name: "Tên thủ công",
      providerCost: "100.00000000",
      rate: "120.00000000",
      pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
      defaultMarkupPercent: "20",
      defaultFixedProfit: "0",
      defaultMinProfit: "0",
      autoDecrease: true,
      maxAutomaticIncreasePercent: "50",
      safetyAction: "AUTO_RAISE",
      active: true,
    },
    mapping = {
      id: "mapping",
      serviceId: "service",
      providerServiceId: "provider-service",
      active: true,
      priority: 1,
      syncAll: false,
      syncName: false,
      syncCost: false,
      syncMin: true,
      syncMax: false,
      syncType: false,
      syncRefill: false,
      syncCancel: false,
      providerCostOverride: "100.00000000",
      disabledPolicy: "REQUIRE_REVIEW",
    },
    tx: any = {
      serviceMapping: {
        findMany: async ({ where }: any) =>
          where.providerServiceId ? [mapping] : [mapping],
      },
      service: {
        findUnique: async () => service,
        update: async ({ data }: any) => (
          updates.push(data),
          { ...service, ...data }
        ),
      },
      providerService: {
        findMany: async () => [
          {
            id: "provider-service",
            name: "Tên từ NCC",
            rate: "110.00000000",
            min: 250,
            max: 9999,
            type: "New",
            refill: true,
            cancel: true,
          },
        ],
      },
      priceAlert: { create: async () => ({}) },
      servicePriceHistory: { create: async () => ({}) },
    };
  await repriceMappedServices(tx, "provider", ["provider-service"]);
  assert.equal(updates[0].name, undefined);
  assert.equal(updates[0].min, 250);
  assert.equal(
    updates.some((data) => data.providerCost !== undefined),
    false,
  );
});

test("master sync cost change runs professional repricing and history", async () => {
  const updates: any[] = [],
    history: any[] = [],
    service = {
      id: "service",
      name: "Dịch vụ",
      providerCost: "100.00000000",
      rate: "120.00000000",
      pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
      defaultMarkupPercent: "20",
      defaultFixedProfit: "0",
      defaultMinProfit: "0",
      autoDecrease: true,
      maxAutomaticIncreasePercent: "50",
      safetyAction: "AUTO_RAISE",
      active: true,
    },
    mapping = {
      id: "mapping",
      serviceId: "service",
      providerServiceId: "provider-service",
      active: true,
      priority: 1,
      syncAll: true,
      syncCost: true,
      disabledPolicy: "REQUIRE_REVIEW",
    },
    tx: any = {
      serviceMapping: { findMany: async () => [mapping] },
      service: {
        findUnique: async () => service,
        update: async ({ data }: any) => (
          updates.push(data),
          { ...service, ...data }
        ),
      },
      providerService: {
        findMany: async () => [
          {
            id: "provider-service",
            name: "Dịch vụ mới",
            rate: "110.00000000",
            min: 100,
            max: 10_000,
            type: "Default",
            refill: true,
            cancel: false,
          },
        ],
      },
      priceAlert: { create: async () => ({}) },
      servicePriceHistory: {
        create: async ({ data }: any) => history.push(data),
      },
    };
  await repriceMappedServices(tx, "provider", ["provider-service"]);
  assert.equal(updates.at(-1).providerCost, "110.00000000");
  assert.equal(updates.at(-1).rate, "132.00000000");
  assert.equal(history[0].newSaleRate, "132.00000000");
});
