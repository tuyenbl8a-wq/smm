import assert from "node:assert/strict";
import test from "node:test";
import { BulkPricingService } from "../src/catalog/bulk-pricing.js";
import { CatalogService } from "../src/catalog/service.js";

const services = [
  {
    id: "service-1",
    categoryId: "category-1",
    name: "Followers",
    rate: "120.00000000",
    providerCost: "100.00000000",
    pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
    defaultMarkupPercent: "20",
    defaultFixedProfit: "0",
    defaultMinProfit: "5",
    priceReviewStatus: "OK",
  },
  {
    id: "service-2",
    categoryId: "category-2",
    name: "Likes",
    rate: "105.00000000",
    providerCost: "100.00000000",
    pricingMode: "FIXED",
    defaultMarkupPercent: "0",
    defaultFixedProfit: "0",
    defaultMinProfit: "10",
    priceReviewStatus: "OK",
  },
];
function database(overrides: any = {}) {
  const updates: any[] = [],
    history: any[] = [],
    audits: any[] = [],
    rules: any[] = [];
  const groups = [
    { id: "retail", code: "KHACH_LE", defaultMinProfit: "5" },
    { id: "agency", code: "CTV", defaultMinProfit: "5" },
    { id: "distributor", code: "DAI_LY", defaultMinProfit: "5" },
  ];
  const tx: any = {
    service: {
      findMany: async ({ where }: any) =>
        services.filter(
          (service) =>
            (!where.categoryId ||
              (typeof where.categoryId === "string"
                ? service.categoryId === where.categoryId
                : where.categoryId.in.includes(service.categoryId))) &&
            (!where.id || where.id.in.includes(service.id)),
        ),
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        if (overrides.failOn === where.id) throw new Error("WRITE_FAILED");
        return data;
      },
    },
    serviceCategory: {
      findMany: async ({ where }: any) =>
        [
          { id: "category-1", platformId: "platform-1" },
          { id: "category-2", platformId: "platform-2" },
        ].filter((row) => row.platformId === where.platformId),
    },
    providerService: {
      findMany: async ({ where }: any) =>
        where.providerId === "provider-1" ? [{ id: "provider-service-1" }] : [],
    },
    serviceMapping: {
      findMany: async ({ where }: any) =>
        where.providerServiceId.in.includes("provider-service-1")
          ? [{ serviceId: "service-1" }]
          : [],
    },
    priceGroup: {
      findFirst: async ({ where }: any) =>
        groups.find((group) => group.id === where.id) ?? null,
      findMany: async () => groups,
    },
    priceRule: {
      findMany: async () => [],
      upsert: async ({ create }: any) => (rules.push(create), create),
    },
    servicePriceHistory: {
      create: async ({ data }: any) => history.push(data),
    },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  return {
    db: {
      ...tx,
      $transaction: async (work: any) => {
        const updateStart = updates.length,
          historyStart = history.length,
          auditStart = audits.length;
        try {
          return await work(tx);
        } catch (error) {
          updates.splice(updateStart);
          history.splice(historyStart);
          audits.splice(auditStart);
          throw error;
        }
      },
    },
    updates,
    history,
    audits,
    rules,
  };
}

test("bulk preview applies signed adjustments and minimum-profit floor", async () => {
  const { db } = database();
  const result = await new BulkPricingService(db).preview({
    percentDelta: "-20",
    minProfit: "10",
  });
  assert.equal(result.count, 2);
  assert.deepEqual(
    result.items.map((row: any) => row.newRate),
    ["110.00000000", "110.00000000"],
  );
  assert.equal(result.items[0].warning, "SAFETY_FLOOR");
  assert.equal(result.items[0].newProfit, "10.00000000");
});

test("platform and provider filters scope services consistently", async () => {
  const { db } = database();
  const pricing = new BulkPricingService(db);
  const platform = await pricing.preview({ platformId: "platform-2" });
  assert.deepEqual(
    platform.items.map((item: any) => item.serviceId),
    ["service-2"],
  );
  const provider = await pricing.preview({ providerId: "provider-1" });
  assert.deepEqual(
    provider.items.map((item: any) => item.serviceId),
    ["service-1"],
  );
});

test("pricing rejects a category or selected service outside the cascading scope", async () => {
  const { db } = database();
  const pricing = new BulkPricingService(db);
  await assert.rejects(
    () =>
      pricing.preview({
        platformId: "platform-1",
        categoryId: "category-2",
      }),
    (error: any) => error.code === "CATEGORY_OUT_OF_PLATFORM",
  );
  await assert.rejects(
    () =>
      pricing.preview({
        providerId: "provider-1",
        serviceIds: ["service-2"],
      }),
    (error: any) =>
      error.code === "SERVICES_NOT_FOUND" ||
      error.code === "SERVICE_OUT_OF_SCOPE",
  );
});

test("simple three-tier pricing previews and applies in one transaction", async () => {
  const { db, rules, audits } = database(),
    pricing = new BulkPricingService(db),
    input = { tiers: { KHACH_LE: "30", CTV: "20", DAI_LY: "10" } },
    preview = await pricing.previewSimple(input);
  assert.equal(preview.count, 2);
  assert.deepEqual(preview.items[0].prices, {
    KHACH_LE: "130.00000000",
    CTV: "120.00000000",
    DAI_LY: "110.00000000",
  });
  const applied = await pricing.applySimple("admin", input);
  assert.deepEqual(applied, { applied: 2, tiers: 3 });
  assert.equal(rules.length, 6);
  assert.equal(audits.length, 3);
  assert.deepEqual(
    [...new Set(rules.map((rule) => rule.markupPercent))],
    ["30.00000000", "20.00000000", "10.00000000"],
  );
});

test("bulk apply updates every service, writes history and one audit atomically", async () => {
  const { db, updates, history, audits } = database();
  const result = await new BulkPricingService(db).apply("admin", {
    fixedDelta: "10",
  });
  assert.equal(result.applied, 2);
  assert.equal(updates.length, 2);
  assert.equal(history.length, 2);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "BULK_PRICING_APPLY");
});

test("bulk apply rolls back the complete operation when one write fails", async () => {
  const { db, updates, history, audits } = database({ failOn: "service-2" });
  await assert.rejects(
    () => new BulkPricingService(db).apply("admin", { fixedDelta: "10" }),
    /WRITE_FAILED/,
  );
  assert.equal(updates.length, 0);
  assert.equal(history.length, 0);
  assert.equal(audits.length, 0);
});

test("admin price alert dashboard counts open alerts and resolves with audit", async () => {
  const audit: any[] = [];
  const alert = { id: "alert", status: "OPEN", severity: "CRITICAL" };
  const tx: any = {
    priceAlert: {
      findUnique: async () => alert,
      update: async ({ data }: any) => ({ ...alert, ...data }),
    },
    auditLog: { create: async ({ data }: any) => audit.push(data) },
  };
  const db: any = {
    priceAlert: {
      count: async () => 3,
      findMany: async () => [alert],
    },
    $transaction: async (work: any) => work(tx),
  };
  const catalog = new CatalogService(db);
  assert.deepEqual(await catalog.pricingAlerts(), { open: 3, items: [alert] });
  const resolved = await catalog.resolvePricingAlert("admin", "alert");
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(audit[0].action, "PRICE_ALERT_RESOLVE");
});
