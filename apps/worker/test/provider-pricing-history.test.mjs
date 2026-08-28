import assert from "node:assert/strict";
import test from "node:test";
import { ProviderSyncWorker } from "../dist/provider-sync.js";

const service = {
  id: "service",
  name: "Followers",
  active: true,
  rate: "120.00000000",
  providerCost: "100.00000000",
  pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
  defaultMarkupPercent: "20",
  defaultFixedProfit: "0",
  defaultMinProfit: "0",
  maxAutomaticIncreasePercent: "50",
  autoDecrease: true,
  safetyAction: "AUTO_RAISE",
};
function transaction(providerRate = "110.00000000") {
  const updates = [],
    history = [],
    alerts = [];
  const tx = {
    providerService: {
      findMany: async (query) =>
        query.select
          ? [{ id: "provider-service" }]
          : [
              {
                id: "provider-service",
                providerId: "provider",
                rate: providerRate,
              },
            ],
    },
    serviceMapping: {
      findMany: async (query) =>
        query.select
          ? [{ serviceId: "service" }]
          : [
              {
                serviceId: "service",
                providerServiceId: "provider-service",
                priority: 1,
              },
            ],
    },
    service: {
      findMany: async () => [service],
      update: async ({ data }) => updates.push(data),
    },
    provider: { findMany: async () => [{ id: "provider" }] },
    servicePriceHistory: { create: async ({ data }) => history.push(data) },
    priceAlert: { create: async ({ data }) => alerts.push(data) },
  };
  return { tx, updates, history, alerts };
}

test("worker records provider 100 to 110 repricing as 132 with metadata", async () => {
  const state = transaction();
  const worker = new ProviderSyncWorker({}, "secret");
  const changed = await worker.repriceProvider(state.tx, "provider");
  assert.equal(changed, 1);
  assert.equal(state.updates[0].rate, "132.00000000");
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].oldSaleRate, "120.00000000");
  assert.equal(state.history[0].newSaleRate, "132.00000000");
  assert.equal(
    state.history[0].metadata.pricingMode,
    "COST_PLUS_PERCENT_AND_FIXED",
  );
});

test("worker does not create history when sale price and provider cost are unchanged", async () => {
  const state = transaction("100.00000000");
  const worker = new ProviderSyncWorker({}, "secret");
  assert.equal(await worker.repriceProvider(state.tx, "provider"), 0);
  assert.equal(state.history.length, 0);
  assert.equal(state.updates.length, 0);
});
