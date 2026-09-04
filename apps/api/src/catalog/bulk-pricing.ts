import {
  calculateSaleRate,
  moneyText,
  moneyUnits,
  priceChangePercent,
  resolveCustomerRate,
} from "./pricing.js";

export class BulkPricingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type BulkInput = {
  categoryId?: string;
  platformId?: string;
  providerId?: string;
  serviceIds?: string[];
  priceGroupId?: string;
  percentDelta?: unknown;
  fixedDelta?: unknown;
  pricingMode?: string;
  markupPercent?: unknown;
  fixedProfit?: unknown;
  minProfit?: unknown;
};
type SimpleTierInput = Omit<BulkInput, "priceGroupId"> & {
  tiers: Record<string, unknown>;
};

const signedUnits = (value: unknown): bigint => {
  const raw = String(value ?? "0").trim();
  const match = /^([+-]?)(\d{1,12})(?:\.(\d{1,8}))?$/.exec(raw);
  if (!match)
    throw new BulkPricingError(
      "ADJUSTMENT_INVALID",
      "Điều chỉnh giá không hợp lệ",
    );
  const amount =
    BigInt(match[2]!) * 100_000_000n + BigInt((match[3] ?? "").padEnd(8, "0"));
  return match[1] === "-" ? -amount : amount;
};
const decimal = (value: unknown, fallback = "0") =>
  moneyText(moneyUnits(value ?? fallback));

export class BulkPricingService {
  constructor(private readonly db: any) {}

  private async selectServices(db: any, input: BulkInput) {
    const requested = Array.isArray(input.serviceIds)
      ? [...new Set(input.serviceIds.map(String))].slice(0, 5000)
      : [];
    let providerServiceIds: string[] | undefined;
    if (input.providerId) {
      const providerServices = await db.providerService.findMany({
        where: {
          providerId: String(input.providerId),
          active: true,
          stale: false,
        },
        select: { id: true },
      });
      providerServiceIds = providerServices.map((row: any) => row.id);
    }
    let mappedIds: string[] | undefined;
    if (providerServiceIds) {
      const mappings = providerServiceIds.length
        ? await db.serviceMapping.findMany({
            where: {
              providerServiceId: { in: providerServiceIds },
              active: true,
            },
            select: { serviceId: true },
          })
        : [];
      mappedIds = [
        ...new Set<string>(mappings.map((row: any) => String(row.serviceId))),
      ];
    }
    const candidates = requested.length
      ? mappedIds
        ? requested.filter((id) => mappedIds!.includes(id))
        : requested
      : mappedIds;
    let platformCategoryIds: string[] | undefined;
    if (input.platformId) {
      const categories = await db.serviceCategory.findMany({
        where: {
          platformId: String(input.platformId),
          deletedAt: null,
        },
        select: { id: true },
      });
      const categoryIds = categories.map((row: any) => String(row.id));
      platformCategoryIds = categoryIds;
      if (input.categoryId && !categoryIds.includes(String(input.categoryId)))
        throw new BulkPricingError(
          "CATEGORY_OUT_OF_PLATFORM",
          "Danh mục không thuộc nền tảng đã chọn",
        );
    }
    const where: any = {
      deletedAt: null,
      ...(input.categoryId
        ? { categoryId: String(input.categoryId) }
        : platformCategoryIds
          ? { categoryId: { in: platformCategoryIds } }
          : {}),
      ...(candidates ? { id: { in: candidates } } : {}),
    };
    const services = await db.service.findMany({
      where,
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      take: 5000,
    });
    if (!services.length)
      throw new BulkPricingError(
        "SERVICES_NOT_FOUND",
        "Không có dịch vụ phù hợp bộ lọc",
      );
    if (
      requested.length &&
      requested.some(
        (id) => !services.some((service: any) => String(service.id) === id),
      )
    )
      throw new BulkPricingError(
        "SERVICE_OUT_OF_SCOPE",
        "Một hoặc nhiều dịch vụ không thuộc bộ lọc đã chọn",
      );
    return services;
  }

  private proposed(service: any, group: any, rule: any, input: BulkInput) {
    const currentRate = moneyUnits(
      resolveCustomerRate({
        service,
        group,
        override: rule,
        providerCost: service.providerCost,
      }),
      false,
    );
    const minimumProfit = moneyUnits(
      input.minProfit ??
        rule?.minProfit ??
        group?.defaultMinProfit ??
        service.defaultMinProfit ??
        "0",
    );
    const floor = moneyUnits(service.providerCost) + minimumProfit;
    let proposed = currentRate;
    if (input.percentDelta != null && String(input.percentDelta) !== "")
      proposed +=
        (currentRate * signedUnits(input.percentDelta)) / 100_000_000n / 100n;
    if (input.fixedDelta != null && String(input.fixedDelta) !== "")
      proposed += signedUnits(input.fixedDelta);
    const hasPolicy =
      input.pricingMode ||
      input.markupPercent != null ||
      input.fixedProfit != null;
    if (hasPolicy)
      proposed = moneyUnits(
        calculateSaleRate({
          baseRate: moneyText(proposed > 0n ? proposed : 0n),
          providerCost: service.providerCost,
          mode: (input.pricingMode as any) ?? service.pricingMode,
          fixedRate:
            input.pricingMode === "FIXED"
              ? moneyText(proposed > 0n ? proposed : currentRate)
              : undefined,
          markupPercent:
            input.markupPercent ??
            rule?.markupPercent ??
            group?.defaultMarkupPercent ??
            service.defaultMarkupPercent,
          fixedProfit:
            input.fixedProfit ??
            rule?.fixedProfit ??
            group?.defaultFixedProfit ??
            service.defaultFixedProfit,
          minProfit: moneyText(minimumProfit),
        }),
      );
    const floorApplied = proposed < floor;
    if (floorApplied) proposed = floor;
    const currentProfit = currentRate - moneyUnits(service.providerCost);
    const newProfit = proposed - moneyUnits(service.providerCost);
    return {
      serviceId: service.id,
      service: service.name,
      providerCost: String(service.providerCost),
      currentRate: moneyText(currentRate),
      newRate: moneyText(proposed),
      currentProfit: moneyText(currentProfit),
      newProfit: moneyText(newProfit),
      changePercent:
        currentRate === 0n
          ? "0.00000000"
          : priceChangePercent(moneyText(currentRate), moneyText(proposed)),
      warning: floorApplied
        ? "SAFETY_FLOOR"
        : service.priceReviewStatus === "PRICE_REVIEW"
          ? "PRICE_REVIEW"
          : null,
      reviewStatus: service.priceReviewStatus,
      minProfit: moneyText(minimumProfit),
    };
  }

  private async previewWith(db: any, input: BulkInput) {
    const services = await this.selectServices(db, input);
    const group = input.priceGroupId
      ? await db.priceGroup.findFirst({
          where: { id: String(input.priceGroupId), active: true },
        })
      : null;
    if (input.priceGroupId && !group)
      throw new BulkPricingError(
        "PRICE_GROUP_NOT_FOUND",
        "Nhóm giá không tồn tại",
      );
    const rules = group
      ? await db.priceRule.findMany({
          where: {
            priceGroupId: group.id,
            serviceId: { in: services.map((x: any) => x.id) },
          },
        })
      : [];
    const ruleMap = new Map(rules.map((rule: any) => [rule.serviceId, rule]));
    const items = services.map((service: any) =>
      this.proposed(service, group, ruleMap.get(service.id), input),
    );
    return {
      count: items.length,
      priceGroup: group
        ? { id: group.id, code: group.code, name: group.name }
        : null,
      items,
    };
  }

  preview(input: BulkInput) {
    return this.previewWith(this.db, input);
  }

  private async applyWith(tx: any, actorId: string, input: BulkInput) {
    const preview = await this.previewWith(tx, input);
    const directAdjustment =
      (input.percentDelta != null && String(input.percentDelta) !== "") ||
      (input.fixedDelta != null && String(input.fixedDelta) !== "");
    for (const item of preview.items) {
      if (preview.priceGroup) {
        await tx.priceRule.upsert({
          where: {
            priceGroupId_serviceId: {
              priceGroupId: preview.priceGroup.id,
              serviceId: item.serviceId,
            },
          },
          create: {
            priceGroupId: preview.priceGroup.id,
            serviceId: item.serviceId,
            fixedRate: directAdjustment ? item.newRate : null,
            markupPercent:
              input.markupPercent == null ? null : decimal(input.markupPercent),
            fixedProfit:
              input.fixedProfit == null ? null : decimal(input.fixedProfit),
            minProfit: item.minProfit,
          },
          update: {
            fixedRate: directAdjustment ? item.newRate : null,
            ...(input.markupPercent != null
              ? { markupPercent: decimal(input.markupPercent) }
              : {}),
            ...(input.fixedProfit != null
              ? { fixedProfit: decimal(input.fixedProfit) }
              : {}),
            minProfit: item.minProfit,
          },
        });
      } else {
        await tx.service.update({
          where: { id: item.serviceId },
          data: {
            rate: item.newRate,
            ...(input.pricingMode
              ? { pricingMode: String(input.pricingMode) }
              : {}),
            ...(input.markupPercent != null
              ? { defaultMarkupPercent: decimal(input.markupPercent) }
              : {}),
            ...(input.fixedProfit != null
              ? { defaultFixedProfit: decimal(input.fixedProfit) }
              : {}),
            ...(input.minProfit != null
              ? { defaultMinProfit: item.minProfit }
              : {}),
          },
        });
        if (item.currentRate !== item.newRate)
          await tx.servicePriceHistory.create({
            data: {
              serviceId: item.serviceId,
              oldProviderCost: item.providerCost,
              newProviderCost: item.providerCost,
              oldSaleRate: item.currentRate,
              newSaleRate: item.newRate,
              changePercent: item.changePercent,
              reason: "PRICE_GROUP_RULE",
              source: "admin-bulk-pricing",
              metadata: { actorId, warning: item.warning, input },
            },
          });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "BULK_PRICING_APPLY",
        resource: "service_pricing",
        after: { filters: input, count: preview.count, items: preview.items },
      },
    });
    return { applied: preview.count, items: preview.items };
  }

  async apply(actorId: string, input: BulkInput) {
    return this.db.$transaction((tx: any) =>
      this.applyWith(tx, actorId, input),
    );
  }

  private async tierInputs(db: any, input: SimpleTierInput) {
    const codes = ["CUSTOMER", "AGENT", "DISTRIBUTOR"],
      groups = await db.priceGroup.findMany({
        where: { active: true, code: { in: codes } },
      }),
      byCode = new Map(groups.map((group: any) => [group.code, group]));
    if (groups.length !== codes.length)
      throw new BulkPricingError(
        "DEFAULT_TIERS_MISSING",
        "Thiếu một trong ba cấp giá mặc định",
      );
    return codes.map((code) => ({
      ...input,
      tiers: undefined,
      priceGroupId: (byCode.get(code) as any).id,
      pricingMode: "COST_PLUS_PERCENT",
      markupPercent: input.tiers[code],
    }));
  }

  async previewSimple(input: SimpleTierInput) {
    const inputs = await this.tierInputs(this.db, input),
      previews = await Promise.all(
        inputs.map((tierInput) => this.previewWith(this.db, tierInput)),
      ),
      rows = new Map<string, any>();
    for (const preview of previews)
      for (const item of preview.items) {
        const row = rows.get(item.serviceId) ?? {
          serviceId: item.serviceId,
          service: item.service,
          providerCost: item.providerCost,
          prices: {},
          warnings: [],
        };
        row.prices[preview.priceGroup!.code] = item.newRate;
        if (item.warning) row.warnings.push(item.warning);
        rows.set(item.serviceId, row);
      }
    return { count: rows.size, items: [...rows.values()] };
  }

  async applySimple(actorId: string, input: SimpleTierInput) {
    return this.db.$transaction(async (tx: any) => {
      const inputs = await this.tierInputs(tx, input);
      const results = [];
      for (const tierInput of inputs)
        results.push(await this.applyWith(tx, actorId, tierInput));
      return { applied: results[0]?.applied ?? 0, tiers: results.length };
    });
  }
}
