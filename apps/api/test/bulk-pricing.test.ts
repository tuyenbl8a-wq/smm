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
    categoryId: "category-1",
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
    audits: any[] = [];
  const tx: any = {
    service: {
      findMany: async () => services,
      update: async ({ where, data }: any) => {
        updates.push({ where, data });
        if (overrides.failOn === where.id) throw new Error("WRITE_FAILED");
        return data;
      },
    },
    providerService: { findMany: async () => [] },
    serviceMapping: { findMany: async () => [] },
    priceGroup: { findFirst: async () => null },
    priceRule: { findMany: async () => [], upsert: async () => ({}) },
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
  };
}

test("bulk preview applies signed adjustments and minimum-profit floor", async () => {
  const { db } = database();
  const result = await new BulkPricingService(db).preview({
    categoryId: "category-1",
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
