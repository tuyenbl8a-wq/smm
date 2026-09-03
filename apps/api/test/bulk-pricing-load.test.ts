import assert from "node:assert/strict";
import test from "node:test";
import { BulkPricingService } from "../src/catalog/bulk-pricing.js";

for (const size of [100, 1_000, 5_000]) {
  test(`bulk pricing preview/apply remains batch-oriented for ${size} services`, async () => {
    const services = Array.from({ length: size }, (_, index) => ({
      id: `service-${index}`,
      categoryId: "category",
      name: `Service ${index}`,
      rate: "120.00000000",
      providerCost: "100.00000000",
      pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
      defaultMarkupPercent: "20",
      defaultFixedProfit: "0",
      defaultMinProfit: "5",
      priceReviewStatus: "OK",
    }));
    let reads = 0,
      writes = 0,
      histories = 0,
      audits = 0;
    const tx: any = {
      service: {
        findMany: async () => (reads++, services),
        update: async () => (writes++, {}),
      },
      providerService: { findMany: async () => (reads++, []) },
      serviceMapping: { findMany: async () => (reads++, []) },
      priceGroup: { findFirst: async () => (reads++, null) },
      priceRule: {
        findMany: async () => (reads++, []),
        upsert: async () => ({}),
      },
      servicePriceHistory: { create: async () => (histories++, {}) },
      auditLog: { create: async () => (audits++, {}) },
    };
    const db = { ...tx, $transaction: async (run: any) => run(tx) };
    const service = new BulkPricingService(db);
    const started = Date.now();
    const preview = await service.preview({ percentDelta: "5" });
    assert.equal(preview.count, size);
    const result = await service.apply("admin", { percentDelta: "5" });
    assert.equal(result.applied, size);
    assert.equal(writes, size);
    assert.equal(histories, size);
    assert.equal(audits, 1);
    assert.equal(reads <= 4, true);
    assert.equal(Date.now() - started < 15_000, true);
  });
}
