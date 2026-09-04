import assert from "node:assert/strict";
import test from "node:test";
import { CatalogService } from "../src/catalog/service.js";

const groups = [
  {
    id: "group-retail",
    code: "CUSTOMER",
    name: "Khách hàng",
    defaultMinProfit: "0",
  },
  { id: "group-agent", code: "AGENT", name: "Đại lý", defaultMinProfit: "0" },
  {
    id: "group-distributor",
    code: "DISTRIBUTOR",
    name: "NPP",
    defaultMinProfit: "0",
  },
];

function database(source = "MANUAL") {
  let service: any = {
      id: "service-1",
      source,
      categoryId: "category-1",
      name: "Tên local",
      description: "Mô tả local",
      type: "DEFAULT",
      providerCost: "0.80000000",
      rate: "1.04000000",
      pricingMode: "COST_PLUS_PERCENT",
      defaultMarkupPercent: "30",
      defaultFixedProfit: "0",
      defaultMinProfit: "0",
      min: 10,
      max: 1000,
      averageTime: "1 giờ",
      refill: false,
      cancel: false,
      active: true,
      restrictFromApi: false,
    },
    mappings: any[] =
      source === "API"
        ? [
            {
              id: "mapping-a",
              serviceId: service.id,
              providerServiceId: "ps-a",
              priority: 0,
              active: true,
              syncAll: true,
              disabledPolicy: "REQUIRE_REVIEW",
            },
          ]
        : [],
    rules: any[] = [],
    audits: any[] = [];
  const providerServices: any[] = [
    {
      id: "ps-a",
      providerId: "provider-a",
      externalId: "123",
      name: "Dịch vụ A",
      rate: "0.90000000",
      min: 20,
      max: 2000,
      type: "DEFAULT",
      refill: true,
      cancel: false,
      active: true,
      stale: false,
      raw: { description: "Mô tả A", averageTime: "30 phút" },
    },
    {
      id: "ps-b",
      providerId: "provider-b",
      externalId: "789",
      name: "Dịch vụ B",
      rate: "1.10000000",
      min: 30,
      max: 3000,
      type: "CUSTOM_COMMENTS",
      refill: false,
      cancel: true,
      active: true,
      stale: false,
      raw: { description: "Mô tả B", averageTime: "2 giờ" },
    },
  ];
  const tx: any = {
    service: {
      findUnique: async () => service,
      findFirst: async () => service,
      update: async ({ data }: any) => (service = { ...service, ...data }),
    },
    serviceMapping: {
      findMany: async () => mappings,
      updateMany: async ({ where, data }: any) => {
        for (const row of mappings)
          if (
            row.serviceId === where.serviceId &&
            (!where.active || row.active) &&
            (!where.providerServiceId?.not ||
              row.providerServiceId !== where.providerServiceId.not)
          )
            Object.assign(row, data);
        return { count: mappings.length };
      },
      upsert: async ({ where, create, update }: any) => {
        let row = mappings.find(
          (item) =>
            item.serviceId === where.serviceId_providerServiceId.serviceId &&
            item.providerServiceId ===
              where.serviceId_providerServiceId.providerServiceId,
        );
        if (row) Object.assign(row, update);
        else {
          row = { id: `mapping-${mappings.length + 1}`, ...create };
          mappings.push(row);
        }
        return row;
      },
    },
    providerService: {
      findFirst: async ({ where }: any) =>
        providerServices.find((row) => row.id === where.id),
      findMany: async ({ where }: any) =>
        providerServices.filter((row) => where.id.in.includes(row.id)),
    },
    provider: {
      findFirst: async ({ where }: any) => ({
        id: where.id,
        name: where.id === "provider-a" ? "NCC A" : "NCC B",
        status: "ACTIVE",
      }),
      findMany: async () => [],
    },
    priceGroup: { findMany: async () => groups },
    priceRule: {
      findMany: async () => rules,
      upsert: async ({ create, update, where }: any) => {
        let row = rules.find(
          (item) =>
            item.priceGroupId === where.priceGroupId_serviceId.priceGroupId,
        );
        if (row) Object.assign(row, update);
        else {
          row = create;
          rules.push(row);
        }
        return row;
      },
    },
    auditLog: { create: async ({ data }: any) => (audits.push(data), data) },
  };
  return {
    db: { ...tx, $transaction: async (run: any) => run(tx) },
    state: () => ({ service, mappings, rules, audits }),
  };
}

test("manual service becomes API-backed without changing local identity", async () => {
  const { db, state } = database("MANUAL");
  const preview = await new CatalogService(db).serviceSourcePreview(
    "service-1",
    "ps-a",
  );
  assert.equal(preview.localServiceId, "service-1");
  assert.equal(preview.target.externalId, "123");
  assert.equal(preview.target.marginIfKept, "0.14000000");
  const result = await new CatalogService(db).updateServiceEditor(
    "admin-1",
    "service-1",
    {
      source: "API",
      providerServiceId: "ps-a",
      syncAll: true,
      disabledPolicy: "REQUIRE_REVIEW",
    },
  );
  assert.equal(result.service.id, "service-1");
  assert.equal(result.service.source, "API");
  assert.equal(state().mappings.length, 1);
  assert.equal(state().mappings[0].active, true);
  assert.equal(result.action, "SERVICE_SOURCE_MANUAL_TO_PROVIDER");
});

test("API service becomes manual while retaining data and disabling mapping", async () => {
  const { db, state } = database("API");
  const before = { ...state().service };
  const result = await new CatalogService(db).updateServiceEditor(
    "admin-1",
    "service-1",
    { source: "MANUAL" },
  );
  assert.equal(result.service.id, before.id);
  assert.equal(result.service.name, before.name);
  assert.equal(result.service.description, before.description);
  assert.equal(state().mappings[0].active, false);
  assert.equal(result.action, "SERVICE_SOURCE_PROVIDER_TO_MANUAL");
});

test("provider remap disables A, activates B, and applies request sync flags now", async () => {
  const { db, state } = database("API");
  const result = await new CatalogService(db).updateServiceEditor(
    "admin-1",
    "service-1",
    {
      source: "API",
      providerServiceId: "ps-b",
      syncAll: false,
      syncName: true,
      syncDescription: true,
      syncMin: true,
      syncMax: false,
      syncType: true,
      disabledPolicy: "KEEP_ACTIVE",
    },
  );
  assert.equal(result.service.id, "service-1");
  assert.equal(result.service.name, "Dịch vụ B");
  assert.equal(result.service.description, "Mô tả B");
  assert.equal(result.service.min, 30);
  assert.equal(result.service.max, 1000);
  assert.equal(
    state().mappings.find((row) => row.id === "mapping-a").active,
    false,
  );
  assert.equal(
    state().mappings.find((row) => row.providerServiceId === "ps-b").active,
    true,
  );
  assert.equal(result.action, "SERVICE_PROVIDER_REMAP");
});

test("description override disables only current description sync and survives reload", async () => {
  const { db, state } = database("API");
  await new CatalogService(db).updateServiceEditor("admin-1", "service-1", {
    source: "API",
    providerServiceId: "ps-a",
    syncAll: true,
    description: "Mô tả do admin viết",
    manualFields: ["description"],
  });
  assert.equal(state().service.description, "Mô tả do admin viết");
  assert.equal(state().mappings[0].syncAll, false);
  assert.equal(state().mappings[0].syncDescription, false);
  const reload = await new CatalogService(db).serviceEditor("service-1");
  assert.equal(reload.service.description, "Mô tả do admin viết");
  await new CatalogService(db).updateServiceEditor("admin-1", "service-1", {
    source: "API",
    providerServiceId: "ps-a",
    syncAll: false,
    syncDescription: true,
  });
  assert.equal(state().service.description, "Mô tả A");
  assert.equal(state().mappings[0].syncDescription, true);
});

test("tier percentage and fixed price save to existing PriceRule engine", async () => {
  const { db, state } = database("MANUAL");
  await new CatalogService(db).updateServiceEditor("admin-1", "service-1", {
    source: "MANUAL",
    pricing: {
      CUSTOMER: { mode: "PERCENT", value: "30" },
      AGENT: { mode: "FIXED", value: "0.98000000" },
      DISTRIBUTOR: { mode: "PERCENT", value: "20" },
    },
  });
  const byGroup = new Map(state().rules.map((row) => [row.priceGroupId, row]));
  assert.equal(byGroup.get("group-retail").markupPercent, "30.00000000");
  assert.equal(byGroup.get("group-agent").fixedRate, "0.98000000");
  assert.equal(byGroup.get("group-distributor").markupPercent, "20.00000000");
});

test("fixed tier price below safety floor is rejected atomically", async () => {
  const { db } = database("MANUAL");
  await assert.rejects(
    () =>
      new CatalogService(db).updateServiceEditor("admin-1", "service-1", {
        source: "MANUAL",
        pricing: { CUSTOMER: { mode: "FIXED", value: "0.70000000" } },
      }),
    /thấp hơn mức an toàn/,
  );
});

function creationDatabase() {
  const services: any[] = [],
    mappings: any[] = [],
    rules: any[] = [],
    audits: any[] = [];
  const providerService = {
    id: "ps-create",
    providerId: "provider-1",
    rate: "0.50000000",
    active: true,
    stale: false,
    type: "DEFAULT",
  };
  const tx: any = {
    serviceCategory: {
      findFirst: async ({ where }: any) =>
        where.id === "category-1" ? { id: "category-1", active: true } : null,
    },
    providerService: {
      findFirst: async ({ where }: any) =>
        where.id === providerService.id ? providerService : null,
    },
    service: {
      create: async ({ data }: any) => {
        const row = {
          id: `service-${services.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          ...data,
        };
        services.push(row);
        return row;
      },
      findFirst: async ({ where }: any) =>
        services.find((row) => row.id === where.id) ?? null,
    },
    serviceMapping: {
      create: async ({ data }: any) => {
        const row = {
          id: `mapping-${mappings.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mappings.push(row);
        return row;
      },
      findMany: async ({ where }: any) =>
        mappings.filter((row) => row.serviceId === where.serviceId),
      createMany: async ({ data }: any) => {
        mappings.push(
          ...data.map((row: any, index: number) => ({
            id: `mapping-copy-${index}`,
            ...row,
          })),
        );
        return { count: data.length };
      },
    },
    priceGroup: { findMany: async () => groups },
    priceRule: {
      create: async ({ data }: any) => {
        rules.push(data);
        return data;
      },
      findMany: async ({ where }: any) =>
        rules.filter((row) => row.serviceId === where.serviceId),
      createMany: async ({ data }: any) => {
        rules.push(...data);
        return { count: data.length };
      },
    },
    auditLog: { create: async ({ data }: any) => (audits.push(data), data) },
  };
  return {
    db: { ...tx, $transaction: async (run: any) => run(tx) },
    state: () => ({ services, mappings, rules, audits }),
  };
}

test("creates manual and provider services with exactly three tier prices", async () => {
  const { db, state } = creationDatabase();
  const catalog = new CatalogService(db);
  const manual = await catalog.createService("admin-1", {
    source: "MANUAL",
    categoryId: "category-1",
    name: "Dịch vụ thủ công",
    type: "DEFAULT",
    rate: "1.00000000",
    providerCost: "0.40000000",
    min: 10,
    max: 1000,
    reason: "Tạo mới",
    pricing: {
      CUSTOMER: { mode: "PERCENT", value: "30" },
      AGENT: { mode: "PERCENT", value: "25" },
      DISTRIBUTOR: { mode: "FIXED", value: "0.60000000" },
    },
  });
  assert.equal(manual.service.source, "MANUAL");
  assert.equal(state().rules.length, 3);
  const provider = await catalog.createService("admin-1", {
    source: "API",
    providerServiceId: "ps-create",
    categoryId: "category-1",
    name: "Dịch vụ NCC",
    type: "DEFAULT",
    rate: "0.65000000",
    min: 10,
    max: 1000,
    reason: "Liên kết NCC",
  });
  assert.equal(provider.service.providerCost, "0.50000000");
  assert.equal(provider.mapping.providerServiceId, "ps-create");
  assert.equal(state().mappings.length, 1);
});

test("clones service disabled with pricing and mapping copied safely", async () => {
  const { db, state } = creationDatabase();
  const catalog = new CatalogService(db);
  const original = await catalog.createService("admin-1", {
    source: "API",
    providerServiceId: "ps-create",
    categoryId: "category-1",
    name: "Dịch vụ gốc",
    type: "DEFAULT",
    rate: "0.65000000",
    min: 10,
    max: 1000,
    reason: "Tạo gốc",
    pricing: {
      CUSTOMER: { mode: "PERCENT", value: "30" },
      AGENT: { mode: "PERCENT", value: "25" },
      DISTRIBUTOR: { mode: "PERCENT", value: "20" },
    },
  });
  const clone = await catalog.cloneService("admin-1", original.service.id, {
    reason: "Tạo biến thể",
  });
  assert.equal(clone.active, false);
  assert.match(clone.name, /bản sao/);
  assert.equal(
    state().mappings.filter((row) => row.serviceId === clone.id).length,
    1,
  );
  assert.equal(
    state().rules.filter((row) => row.serviceId === clone.id).length,
    3,
  );
  assert.equal(state().audits.at(-1).action, "SERVICE_CLONE");
});
