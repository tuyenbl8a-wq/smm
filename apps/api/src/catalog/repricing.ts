import {
  calculateSaleRate,
  moneyUnits,
  priceChangePercent,
} from "./pricing.js";
export type RepriceSummary = {
  priceChanged: number;
  priceIncreased: number;
  priceDecreased: number;
  requiresReview: number;
  unavailable: number;
};
export async function repriceMappedServices(
  tx: any,
  providerId: string,
  changedProviderServiceIds: string[],
  source = "provider-sync",
): Promise<RepriceSummary> {
  const summary: RepriceSummary = {
    priceChanged: 0,
    priceIncreased: 0,
    priceDecreased: 0,
    requiresReview: 0,
    unavailable: 0,
  };
  if (!changedProviderServiceIds.length) return summary;
  const mappings = await tx.serviceMapping.findMany({
    where: {
      providerServiceId: { in: changedProviderServiceIds },
      active: true,
    },
  });
  const serviceIds = [...new Set(mappings.map((x: any) => x.serviceId))];
  for (const serviceId of serviceIds) {
    const service = await tx.service.findUnique({ where: { id: serviceId } });
    const candidates = await tx.serviceMapping.findMany({
      where: { serviceId, active: true },
      orderBy: { priority: "asc" },
    });
    const providerServices = await tx.providerService.findMany({
      where: {
        id: { in: candidates.map((x: any) => x.providerServiceId) },
        active: true,
        stale: false,
      },
    });
    if (!providerServices.length) {
      await tx.service.update({
        where: { id: serviceId },
        data: { active: false },
      });
      summary.unavailable++;
      continue;
    }
    const selected = providerServices.find(
      (x: any) =>
        x.id ===
        candidates.find((m: any) =>
          providerServices.some((p: any) => p.id === m.providerServiceId),
        )?.providerServiceId,
    )!;
    const safetyUnits = providerServices.reduce(
      (maximum: bigint, row: any) =>
        moneyUnits(row.rate) > maximum ? moneyUnits(row.rate) : maximum,
      0n,
    );
    const oldCost = String(service.providerCost),
      newCost = `${safetyUnits / 100000000n}.${String(
        safetyUnits % 100000000n,
      ).padStart(8, "0")}`,
      oldRate = String(service.rate);
    const change = moneyUnits(newCost) - moneyUnits(oldCost);
    if (change === 0n) continue;
    const percent = priceChangePercent(oldCost, newCost);
    if (
      change > 0n &&
      moneyUnits(percent) > moneyUnits(service.maxAutomaticIncreasePercent)
    ) {
      await tx.service.update({
        where: { id: serviceId },
        data: { priceReviewStatus: "PRICE_REVIEW" },
      });
      summary.requiresReview++;
      await tx.servicePriceHistory.create({
        data: {
          serviceId,
          providerId,
          providerServiceId: selected.id,
          oldProviderCost: oldCost,
          newProviderCost: newCost,
          oldSaleRate: oldRate,
          newSaleRate: oldRate,
          changePercent: percent,
          reason: "PROVIDER_SYNC",
          source,
        },
      });
      continue;
    }
    let newRate = oldRate;
    if (change > 0n || service.autoDecrease)
      newRate = calculateSaleRate({
        baseRate: oldRate,
        providerCost: newCost,
        mode: service.pricingMode,
        fixedRate: service.pricingMode === "FIXED" ? oldRate : undefined,
        markupPercent: service.defaultMarkupPercent,
        fixedProfit: service.defaultFixedProfit,
        minProfit: service.defaultMinProfit,
      });
    const data: any = { providerCost: newCost, priceReviewStatus: "OK" };
    if (
      service.pricingMode === "FIXED" &&
      moneyUnits(newRate) > moneyUnits(oldRate)
    ) {
      if (service.safetyAction === "DISABLE_SERVICE") data.active = false;
      else if (service.safetyAction === "REQUIRE_REVIEW")
        data.priceReviewStatus = "PRICE_REVIEW";
      else data.rate = newRate;
    } else data.rate = newRate;
    await tx.service.update({ where: { id: serviceId }, data });
    await tx.servicePriceHistory.create({
      data: {
        serviceId,
        providerId,
        providerServiceId: selected.id,
        oldProviderCost: oldCost,
        newProviderCost: newCost,
        oldSaleRate: oldRate,
        newSaleRate: data.rate ?? oldRate,
        changePercent: percent,
        reason:
          data.priceReviewStatus === "PRICE_REVIEW"
            ? "SAFETY_FLOOR"
            : "PROVIDER_SYNC",
        source,
      },
    });
    summary.priceChanged++;
    change > 0n ? summary.priceIncreased++ : summary.priceDecreased++;
  }
  return summary;
}
