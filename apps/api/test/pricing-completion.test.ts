import assert from "node:assert/strict";
import test from "node:test";
import { repriceMappedServices } from "../src/catalog/repricing.js";
import { ResellerService } from "../src/reseller/service.js";

function repricingTx(serviceOverrides: any, providerRate: string) {
  const service = {
    id: "service",
    name: "Followers",
    active: true,
    rate: "105.00000000",
    providerCost: "100.00000000",
    pricingMode: "FIXED",
    defaultMarkupPercent: "20",
    defaultFixedProfit: "0",
    defaultMinProfit: "10",
    autoDecrease: true,
    safetyAction: "AUTO_RAISE",
    maxAutomaticIncreasePercent: "50",
    priceReviewStatus: "OK",
    ...serviceOverrides,
  };
  const updates: any[] = [],
    history: any[] = [],
    alerts: any[] = [];
  const tx: any = {
    serviceMapping: {
      findMany: async (query: any) =>
        query.where.providerServiceId
          ? [
              {
                serviceId: "service",
                providerServiceId: "provider-service",
                priority: 1,
              },
            ]
          : [
              {
                serviceId: "service",
                providerServiceId: "provider-service",
                priority: 1,
              },
            ],
    },
    service: {
      findUnique: async () => service,
      update: async ({ data }: any) => updates.push(data),
    },
    providerService: {
      findMany: async () => [
        { id: "provider-service", providerId: "provider", rate: providerRate },
      ],
    },
    servicePriceHistory: {
      create: async ({ data }: any) => history.push(data),
    },
    priceAlert: { create: async ({ data }: any) => alerts.push(data) },
  };
  return { tx, updates, history, alerts };
}

test("large provider spike moves service to PRICE_REVIEW and emits critical alert", async () => {
  const state = repricingTx({}, "200.00000000");
  const result = await repriceMappedServices(state.tx, "provider", [
    "provider-service",
  ]);
  assert.equal(result.requiresReview, 1);
  assert.equal(state.updates[0].priceReviewStatus, "PRICE_REVIEW");
  assert.equal(state.alerts[0].type, "PRICE_SPIKE_REVIEW");
  assert.equal(state.alerts[0].severity, "CRITICAL");
});

test("fixed price AUTO_RAISE preserves the minimum-profit floor", async () => {
  const state = repricingTx({ safetyAction: "AUTO_RAISE" }, "110.00000000");
  await repriceMappedServices(state.tx, "provider", ["provider-service"]);
  assert.equal(state.updates[0].rate, "120.00000000");
  assert.equal(state.history[0].newSaleRate, "120.00000000");
  assert.equal(state.alerts[0].type, "AUTO_RAISE");
});

test("fixed price DISABLE_SERVICE fails closed when the floor is breached", async () => {
  const state = repricingTx(
    { safetyAction: "DISABLE_SERVICE" },
    "110.00000000",
  );
  await repriceMappedServices(state.tx, "provider", ["provider-service"]);
  assert.equal(state.updates[0].active, false);
  assert.equal(state.alerts[0].type, "SERVICE_DISABLED");
});

test("API v2 services uses owner price group without exposing internal pricing", async () => {
  const db: any = {
    user: { findUnique: async () => ({ priceGroupId: "vip" }) },
    priceGroup: {
      findFirst: async () => ({
        id: "vip",
        defaultMarkupPercent: "10",
        defaultFixedProfit: "0",
        defaultMinProfit: "0",
      }),
    },
    priceRule: { findMany: async () => [] },
    service: {
      findMany: async () => [
        {
          id: "service",
          name: "Followers",
          type: "DEFAULT",
          rate: "120",
          providerCost: "100",
          pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
          defaultMarkupPercent: "20",
          defaultFixedProfit: "0",
          defaultMinProfit: "0",
          min: 10,
          max: 1000,
          refill: true,
          cancel: false,
        },
      ],
    },
  };
  const reseller = new ResellerService(db, {} as any);
  const [item] = await reseller.execute(
    "unused",
    { action: "services" },
    { userId: "user" },
  );
  assert.equal(item.rate, "110.00000000");
  for (const secret of [
    "providerCost",
    "provider",
    "providerName",
    "markupPercent",
    "priceGroupId",
  ])
    assert.equal(secret in item, false);
});
