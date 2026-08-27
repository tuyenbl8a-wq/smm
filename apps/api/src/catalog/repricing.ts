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
  const alert = (data: {
    serviceId?: string;
    providerServiceId?: string;
    type: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    title: string;
    message: string;
    metadata?: any;
  }) =>
    tx.priceAlert.create({
      data: { ...data, providerId, status: "OPEN" },
    });
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
  const serviceIds = [
    ...new Set<string>(mappings.map((x: any) => String(x.serviceId))),
  ];
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
      if (service.active)
        await tx.service.update({
          where: { id: serviceId },
          data: { active: false },
        });
      summary.unavailable++;
      if (service.active)
        await alert({
          serviceId,
          type: "SERVICE_UNAVAILABLE",
          severity: "CRITICAL",
          title: "Dịch vụ không còn nhà cung cấp khả dụng",
          message: `${service.name} đã bị tắt để ngăn nhận đơn không thể xử lý.`,
        });
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
          metadata: {
            pricingMode: service.pricingMode,
            safetyAction: service.safetyAction,
            threshold: String(service.maxAutomaticIncreasePercent),
          },
        },
      });
      await alert({
        serviceId,
        providerServiceId: selected.id,
        type: "PRICE_SPIKE_REVIEW",
        severity: "CRITICAL",
        title: "Giá nhà cung cấp tăng vượt ngưỡng",
        message: `${service.name} tăng ${percent}% và đang chờ kiểm tra.`,
        metadata: { oldCost, newCost, percent },
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
    const floorRaised =
      moneyUnits(newRate) ===
      moneyUnits(newCost) + moneyUnits(service.defaultMinProfit ?? "0");
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
        metadata: {
          pricingMode: service.pricingMode,
          safetyAction: service.safetyAction,
          autoDecrease: service.autoDecrease,
          minProfit: String(service.defaultMinProfit),
        },
      },
    });
    const actionType =
      data.active === false
        ? "SERVICE_DISABLED"
        : data.priceReviewStatus === "PRICE_REVIEW"
          ? "SAFETY_REVIEW"
          : service.pricingMode === "FIXED" && data.rate !== undefined
            ? "AUTO_RAISE"
            : floorRaised
              ? "MINIMUM_PROFIT_FLOOR"
              : null;
    if (actionType)
      await alert({
        serviceId,
        providerServiceId: selected.id,
        type: actionType,
        severity: data.active === false ? "CRITICAL" : "WARNING",
        title:
          actionType === "SERVICE_DISABLED"
            ? "Dịch vụ bị tắt do giá vốn"
            : actionType === "AUTO_RAISE"
              ? "Giá bán đã tự động tăng"
              : actionType === "MINIMUM_PROFIT_FLOOR"
                ? "Giá được nâng theo lợi nhuận tối thiểu"
                : "Giá cần được kiểm tra",
        message: `${service.name}: ${oldRate} → ${data.rate ?? oldRate}.`,
        metadata: { oldCost, newCost, oldRate, newRate: data.rate ?? oldRate },
      });
    summary.priceChanged++;
    change > 0n ? summary.priceIncreased++ : summary.priceDecreased++;
  }
  return summary;
}
