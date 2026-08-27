import { moneyUnits, resolveCustomerRate } from "./pricing.js";
export class PricingResolver {
  constructor(private readonly db: any) {}
  async resolveEffectiveProviderCost(serviceId: string, tx = this.db) {
    const mappings = await tx.serviceMapping.findMany({
      where: { serviceId, active: true },
      orderBy: { priority: "asc" },
    });
    if (!mappings.length) throw new Error("PROVIDER_MAPPING_UNAVAILABLE");
    const rows = await tx.providerService.findMany({
      where: {
        id: { in: mappings.map((x: any) => x.providerServiceId) },
        active: true,
        stale: false,
      },
    });
    const providers = await tx.provider.findMany({
      where: {
        id: { in: rows.map((x: any) => x.providerId) },
        status: { in: ["ACTIVE", "DEGRADED"] },
        deletedAt: null,
      },
    });
    const available = new Map<string, any>(
      providers.map((x: any) => [x.id, x]),
    );
    const services = new Map<string, any>(
      rows
        .filter((x: any) => available.has(x.providerId))
        .map((x: any) => [x.id, x]),
    );
    const selectedMapping = mappings.find((x: any) =>
      services.has(x.providerServiceId),
    );
    if (!selectedMapping) throw new Error("PROVIDER_SERVICE_UNAVAILABLE");
    const selected: any = services.get(selectedMapping.providerServiceId);
    const safetyCost = [...services.values()].reduce((max: bigint, x: any) => {
      const value = moneyUnits(x.rate);
      return value > max ? value : max;
    }, 0n);
    return {
      mapping: selectedMapping,
      providerService: selected,
      provider: available.get(selected.providerId),
      providerCost: String(selected.rate),
      safetyCost: safetyCost,
    };
  }
  async resolveCustomerPrice(userId: string, serviceId: string, tx = this.db) {
    const [service, user, effective] = await Promise.all([
      tx.service.findUnique({ where: { id: serviceId } }),
      tx.user.findUnique({
        where: { id: userId },
        select: { priceGroupId: true },
      }),
      this.resolveEffectiveProviderCost(serviceId, tx),
    ]);
    if (
      !service ||
      !service.active ||
      service.deletedAt ||
      service.priceReviewStatus === "PRICE_REVIEW"
    )
      throw new Error("SERVICE_UNAVAILABLE");
    const group = user?.priceGroupId
      ? await tx.priceGroup.findFirst({
          where: { id: user.priceGroupId, active: true },
        })
      : null;
    const override = group
      ? await tx.priceRule.findUnique({
          where: {
            priceGroupId_serviceId: { priceGroupId: group.id, serviceId },
          },
        })
      : null;
    const safetyCost = `${effective.safetyCost / 100000000n}.${String(effective.safetyCost % 100000000n).padStart(8, "0")}`;
    return {
      service,
      group,
      override,
      ...effective,
      rate: resolveCustomerRate({
        service,
        group,
        override,
        providerCost: safetyCost,
      }),
    };
  }
}
