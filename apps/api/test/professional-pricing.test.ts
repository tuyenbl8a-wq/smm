import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSaleRate,
  choosePolicy,
  priceChangePercent,
  resolveCustomerRate,
} from "../src/catalog/pricing.js";
const service = {
  rate: "120",
  providerCost: "100",
  pricingMode: "COST_PLUS_PERCENT_AND_FIXED",
  defaultMarkupPercent: "20",
  defaultFixedProfit: "0",
  defaultMinProfit: "0",
};
test("provider increase reprices cost plus percent without floating point", () => {
  assert.equal(
    resolveCustomerRate({ service, providerCost: "100" }),
    "120.00000000",
  );
  assert.equal(
    resolveCustomerRate({ service, providerCost: "110" }),
    "132.00000000",
  );
});
test("decrease policy can recalculate or preserve current sale", () => {
  assert.equal(
    resolveCustomerRate({ service, providerCost: "80" }),
    "96.00000000",
  );
  assert.equal(
    calculateSaleRate({
      baseRate: "120",
      providerCost: "80",
      mode: "FIXED",
      fixedRate: "120",
    }),
    "120.00000000",
  );
});
test("minimum profit is an unconditional safety floor", () =>
  assert.equal(
    calculateSaleRate({
      baseRate: "105",
      providerCost: "100",
      mode: "FIXED",
      fixedRate: "105",
      minProfit: "10",
    }),
    "110.00000000",
  ));
test("group defaults and service override have deterministic precedence", () => {
  const group = {
    defaultMarkupPercent: "15",
    defaultFixedProfit: "0",
    defaultMinProfit: "1",
  };
  assert.equal(
    resolveCustomerRate({ service, group, providerCost: "100" }),
    "115.00000000",
  );
  assert.equal(
    resolveCustomerRate({
      service,
      group,
      override: { fixedRate: "140", minProfit: "2" },
      providerCost: "100",
    }),
    "140.00000000",
  );
  assert.equal(
    choosePolicy(service, group, { markupPercent: "10", minProfit: "3" })
      .markupPercent,
    "10",
  );
});
test("arbitrary retail, collaborator, agency and VIP groups resolve dynamically", () => {
  for (const [markup, expected] of [
    ["30", "130.00000000"],
    ["25", "125.00000000"],
    ["20", "120.00000000"],
    ["15", "115.00000000"],
  ])
    assert.equal(
      resolveCustomerRate({
        service,
        group: {
          defaultMarkupPercent: markup,
          defaultFixedProfit: "0",
          defaultMinProfit: "0",
        },
        providerCost: "100",
      }),
      expected,
    );
});
test("percentage changes retain exact eight-decimal representation", () =>
  assert.equal(priceChangePercent("100", "110"), "10.00000000"));
test("invalid, negative, NaN and excessive precision prices are rejected", () => {
  for (const value of ["-1", "NaN", "1.000000001", "", Infinity])
    assert.throws(() =>
      calculateSaleRate({ baseRate: "1", providerCost: value }),
    );
});

import { PricingResolver } from "../src/catalog/resolver.js";
test("resolver uses the account group and prices against expensive failover", async () => {
  const db: any = {
    serviceMapping: {
      findMany: async () => [
        { providerServiceId: "cheap", priority: 1, active: true },
        { providerServiceId: "safe", priority: 2, active: true },
      ],
    },
    providerService: {
      findMany: async () => [
        { id: "cheap", providerId: "p1", rate: "100" },
        { id: "safe", providerId: "p2", rate: "110" },
      ],
    },
    provider: { findMany: async () => [{ id: "p1" }, { id: "p2" }] },
    service: {
      findUnique: async () => ({
        ...service,
        id: "service",
        active: true,
        deletedAt: null,
        priceReviewStatus: "OK",
      }),
    },
    user: { findUnique: async () => ({ priceGroupId: "vip" }) },
    priceGroup: {
      findFirst: async () => ({
        id: "vip",
        code: "DAI_LY_VIP",
        active: true,
        defaultMarkupPercent: "15",
        defaultFixedProfit: "0",
        defaultMinProfit: "0",
      }),
    },
    priceRule: { findUnique: async () => null },
  };
  const result = await new PricingResolver(db).resolveCustomerPrice(
    "user",
    "service",
  );
  assert.equal(result.providerCost, "100");
  assert.equal(result.rate, "126.50000000");
  assert.equal(result.group.code, "DAI_LY_VIP");
});
