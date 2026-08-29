import { decimalInput, moneyUnits, resolveCustomerRate } from "./pricing.js";
import { BulkPricingService } from "./bulk-pricing.js";
import { repriceMappedServices } from "./repricing.js";

export class CatalogError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const slug = (value: unknown): string => {
  const result = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result.length > 180)
    throw new CatalogError("SLUG_INVALID", "Invalid slug");
  return result;
};
const name = (value: unknown): string => {
  const result = String(value ?? "").trim();
  if (result.length < 2 || result.length > 255)
    throw new CatalogError("NAME_INVALID", "Name must be 2–255 characters");
  return result;
};
const integer = (value: unknown, field: string, min = 0): number => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min)
    throw new CatalogError("INTEGER_INVALID", `${field} is invalid`);
  return result;
};
const nullableMoney = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === ""
    ? null
    : decimalInput(value, true);
const moneyText = (value: bigint) => {
  const sign = value < 0n ? "-" : "",
    absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100000000n}.${String(
    absolute % 100000000n,
  ).padStart(8, "0")}`;
};
const upgradeMode = (value: unknown) => {
  const result = String(value ?? "ALL");
  if (result !== "ALL" && result !== "ANY")
    throw new CatalogError(
      "UPGRADE_MODE_INVALID",
      "Invalid upgrade match mode",
    );
  return result;
};

export class CatalogService {
  private readonly bulk: BulkPricingService;
  constructor(private readonly db: any) {
    this.bulk = new BulkPricingService(db);
  }

  bulkPreview(input: any) {
    return this.bulk.preview(input);
  }

  bulkApply(actorId: string, input: any) {
    return this.bulk.apply(actorId, input);
  }

  simplePricingPreview(input: any) {
    return this.bulk.previewSimple(input);
  }

  simplePricingApply(actorId: string, input: any) {
    return this.bulk.applySimple(actorId, input);
  }

  async pricingAlerts() {
    const [open, items] = await Promise.all([
      this.db.priceAlert.count({ where: { status: "OPEN" } }),
      this.db.priceAlert.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return { open, items };
  }

  async resolvePricingAlert(actorId: string, id: string) {
    return this.db.$transaction(async (tx: any) => {
      const alert = await tx.priceAlert.findUnique({ where: { id } });
      if (!alert)
        throw new CatalogError(
          "PRICE_ALERT_NOT_FOUND",
          "Cảnh báo không tồn tại",
        );
      if (alert.status === "RESOLVED") return alert;
      const resolved = await tx.priceAlert.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedBy: actorId,
          resolvedAt: new Date(),
        },
      });
      await this.audit(
        tx,
        actorId,
        "PRICE_ALERT_RESOLVE",
        "price_alert",
        id,
        alert,
        resolved,
      );
      return resolved;
    });
  }

  async customerCatalog(
    userId: string,
    query: { page: number; limit: number; category?: string; search?: string },
  ) {
    const page = integer(query.page, "page", 1);
    const limit = integer(query.limit, "limit", 1);
    if (limit > 100)
      throw new CatalogError("PAGINATION_INVALID", "Limit cannot exceed 100");
    const categories = await this.db.serviceCategory.findMany({
      where: {
        active: true,
        deletedAt: null,
        ...(query.category ? { slug: slug(query.category) } : {}),
      },
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const where = {
      active: true,
      deletedAt: null,
      categoryId: { in: categories.map((category: any) => category.id) },
      ...(query.search
        ? {
            name: { contains: query.search.slice(0, 100), mode: "insensitive" },
          }
        : {}),
    };
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { priceGroupId: true },
    });
    const [total, services, rules, group] = await Promise.all([
      this.db.service.count({ where }),
      this.db.service.findMany({
        where,
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          type: true,
          rate: true,
          min: true,
          max: true,
          averageTime: true,
          refill: true,
          cancel: true,
          customFields: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      user?.priceGroupId
        ? this.db.priceRule.findMany({
            where: { priceGroupId: user.priceGroupId },
            select: {
              serviceId: true,
              fixedRate: true,
              markupPercent: true,
              fixedProfit: true,
              minProfit: true,
            },
          })
        : [],
      user?.priceGroupId
        ? this.db.priceGroup.findFirst({
            where: { id: user.priceGroupId, active: true },
          })
        : null,
    ]);
    /* Provider cost is fetched separately only for pricing and is never selected into the public row. */
    const costs = await this.db.service.findMany({
      where: { id: { in: services.map((service: any) => service.id) } },
      select: {
        id: true,
        providerCost: true,
        rate: true,
        pricingMode: true,
        defaultMarkupPercent: true,
        defaultFixedProfit: true,
        defaultMinProfit: true,
      },
    });
    const costMap = new Map(costs.map((item: any) => [item.id, item]));
    const ruleMap = new Map(rules.map((rule: any) => [rule.serviceId, rule]));
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      categories,
      services: services.map((service: any) => {
        const source: any = costMap.get(service.id);
        const rule: any = ruleMap.get(service.id);
        return {
          ...service,
          rate: resolveCustomerRate({
            service: source,
            group,
            override: rule,
            providerCost: source.providerCost,
          }),
        };
      }),
    };
  }

  async adminOverview(includePricing = true) {
    const [
      platforms,
      categories,
      services,
      priceGroups,
      priceRules,
      providerServices,
      providers,
      mappings,
      priceHistory,
    ] = await Promise.all([
      this.db.platform.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.db.serviceCategory.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.db.service.findMany({
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 5000,
      }),
      this.db.priceGroup.findMany({ orderBy: { name: "asc" } }),
      this.db.priceRule.findMany({ take: 500 }),
      this.db.providerService.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        take: 5000,
      }),
      this.db.provider.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      }),
      this.db.serviceMapping.findMany({ take: 500 }),
      this.db.servicePriceHistory.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      platforms,
      categories,
      services: services.map((x: any) => ({
        ...(includePricing
          ? { ...x, rate: String(x.rate), providerCost: String(x.providerCost) }
          : {
              id: x.id,
              categoryId: x.categoryId,
              name: x.name,
              description: x.description,
              type: x.type,
              min: x.min,
              max: x.max,
              averageTime: x.averageTime,
              refill: x.refill,
              cancel: x.cancel,
              sortOrder: x.sortOrder,
              active: x.active,
              priceReviewStatus: x.priceReviewStatus,
            }),
      })),
      priceGroups: includePricing ? priceGroups : [],
      priceRules: includePricing
        ? priceRules.map((x: any) => ({
            ...x,
            fixedRate: x.fixedRate == null ? null : String(x.fixedRate),
            markupPercent:
              x.markupPercent == null ? null : String(x.markupPercent),
            fixedProfit: x.fixedProfit == null ? null : String(x.fixedProfit),
            minProfit: String(x.minProfit),
          }))
        : [],
      providerServices: providerServices.map((x: any) => ({
        ...(includePricing
          ? { ...x, rate: String(x.rate) }
          : {
              id: x.id,
              providerId: x.providerId,
              externalId: x.externalId,
              name: x.name,
              category: x.category,
              type: x.type,
              min: x.min,
              max: x.max,
              refill: x.refill,
              cancel: x.cancel,
              active: x.active,
              stale: x.stale,
            }),
      })),
      providers,
      mappings,
      priceHistory: includePricing
        ? priceHistory.map((x: any) => ({
            ...x,
            oldProviderCost: String(x.oldProviderCost),
            newProviderCost: String(x.newProviderCost),
            oldSaleRate: String(x.oldSaleRate),
            newSaleRate: String(x.newSaleRate),
            changePercent: String(x.changePercent),
          }))
        : [],
    };
  }

  async serviceEditor(id: string, includePricing = true) {
    const service = await this.db.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service)
      throw new CatalogError("SERVICE_NOT_FOUND", "Service not found");
    const [mappings, groups, rules] = await Promise.all([
      this.db.serviceMapping.findMany({
        where: { serviceId: id },
        orderBy: [{ active: "desc" }, { priority: "asc" }],
      }),
      includePricing
        ? this.db.priceGroup.findMany({
            where: { code: { in: ["KHACH_LE", "CTV", "DAI_LY"] } },
          })
        : [],
      includePricing
        ? this.db.priceRule.findMany({ where: { serviceId: id } })
        : [],
    ]);
    const providerServices = mappings.length
      ? await this.db.providerService.findMany({
          where: {
            id: {
              in: mappings.map((mapping: any) => mapping.providerServiceId),
            },
          },
        })
      : [];
    const providers = providerServices.length
      ? await this.db.provider.findMany({
          where: {
            id: { in: providerServices.map((row: any) => row.providerId) },
            deletedAt: null,
          },
          select: { id: true, name: true, status: true },
        })
      : [];
    const groupById = new Map(groups.map((group: any) => [group.id, group]));
    const { providerCost, rate, ...serviceWithoutPricing } = service;
    return {
      service: includePricing
        ? { ...service, providerCost: String(providerCost), rate: String(rate) }
        : serviceWithoutPricing,
      mappings,
      providerServices: providerServices.map((row: any) => ({
        ...(includePricing
          ? { ...row, rate: String(row.rate) }
          : {
              id: row.id,
              providerId: row.providerId,
              externalId: row.externalId,
              name: row.name,
              min: row.min,
              max: row.max,
              type: row.type,
              refill: row.refill,
              cancel: row.cancel,
              active: row.active,
              stale: row.stale,
              lastSyncedAt: row.lastSyncedAt,
            }),
        raw: undefined,
        description:
          typeof row.raw?.description === "string" ? row.raw.description : null,
        averageTime:
          typeof row.raw?.averageTime === "string" ? row.raw.averageTime : null,
      })),
      providers,
      pricing: rules
        .map((rule: any) => {
          const group: any = groupById.get(rule.priceGroupId);
          return group
            ? {
                code: group.code,
                mode: rule.fixedRate != null ? "FIXED" : "PERCENT",
                value: String(rule.fixedRate ?? rule.markupPercent ?? 0),
                minProfit: String(
                  rule.minProfit ?? group.defaultMinProfit ?? 0,
                ),
              }
            : null;
        })
        .filter(Boolean),
    };
  }

  async serviceSourcePreview(id: string, providerServiceId: string) {
    const [current, target] = await Promise.all([
      this.serviceEditor(id, true),
      this.db.providerService.findFirst({
        where: { id: providerServiceId, active: true, stale: false },
      }),
    ]);
    if (!target)
      throw new CatalogError(
        "PROVIDER_SERVICE_NOT_FOUND",
        "Provider service not found",
      );
    const provider = await this.db.provider.findFirst({
      where: { id: target.providerId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!provider)
      throw new CatalogError("PROVIDER_NOT_FOUND", "Provider not found");
    const activeMapping = current.mappings.find((row: any) => row.active),
      activeProviderService = current.providerServices.find(
        (row: any) => row.id === activeMapping?.providerServiceId,
      ),
      saleRate = String(current.service.rate),
      currentCost = String(current.service.providerCost),
      targetCost = String(target.rate);
    return {
      localServiceId: id,
      current: {
        source: current.service.source,
        providerServiceId: activeProviderService?.id ?? null,
        externalId: activeProviderService?.externalId ?? null,
        providerCost: currentCost,
        saleRate,
        margin: moneyText(moneyUnits(saleRate) - moneyUnits(currentCost)),
        min: current.service.min,
        max: current.service.max,
        type: current.service.type,
      },
      target: {
        provider,
        providerServiceId: target.id,
        externalId: target.externalId,
        name: target.name,
        providerCost: String(target.rate),
        saleRate,
        marginIfKept: moneyText(moneyUnits(saleRate) - moneyUnits(targetCost)),
        min: target.min,
        max: target.max,
        type: target.type,
        refill: target.refill,
        cancel: target.cancel,
        status: target.active ? "ACTIVE" : "INACTIVE",
        description:
          typeof target.raw?.description === "string"
            ? target.raw.description
            : null,
        averageTime:
          typeof target.raw?.averageTime === "string"
            ? target.raw.averageTime
            : null,
      },
    };
  }

  async updateServiceEditor(actorId: string, id: string, input: any) {
    const requestedSource = String(input.source ?? "API");
    if (!["MANUAL", "API"].includes(requestedSource))
      throw new CatalogError(
        "SERVICE_SOURCE_INVALID",
        "Invalid service source",
      );
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.service.findUnique({ where: { id } });
      if (!before)
        throw new CatalogError("SERVICE_NOT_FOUND", "Service not found");
      const oldMappings = await tx.serviceMapping.findMany({
        where: { serviceId: id },
        orderBy: { priority: "asc" },
      });
      const oldActiveProviderServiceId = oldMappings.find(
        (row: any) => row.active,
      )?.providerServiceId;
      let target: any = null,
        mapping: any = null;
      const manualFields = new Set<string>(
        Array.isArray(input.manualFields) ? input.manualFields.map(String) : [],
      );
      const syncNames = [
        "Name",
        "Description",
        "Cost",
        "Min",
        "Max",
        "Type",
        "Refill",
        "Cancel",
        "Status",
        "AverageTime",
      ];
      const sync: any = { syncAll: input.syncAll === true };
      for (const suffix of syncNames)
        sync[`sync${suffix}`] = sync.syncAll || input[`sync${suffix}`] === true;
      for (const field of manualFields) {
        const suffix =
          field === "providerCost"
            ? "Cost"
            : field === "averageTime"
              ? "AverageTime"
              : field.charAt(0).toUpperCase() + field.slice(1);
        if (syncNames.includes(suffix)) {
          sync.syncAll = false;
          sync[`sync${suffix}`] = false;
        }
      }
      const data: any = {
        source: requestedSource,
        ...(input.categoryId !== undefined
          ? { categoryId: String(input.categoryId) }
          : {}),
        ...(input.name !== undefined ? { name: name(input.name) } : {}),
        ...(input.description !== undefined
          ? {
              description:
                String(input.description).trim().slice(0, 5000) || null,
            }
          : {}),
        ...(input.type !== undefined
          ? { type: name(input.type).slice(0, 80) }
          : {}),
        ...(input.min !== undefined
          ? { min: integer(input.min, "min", 1) }
          : {}),
        ...(input.max !== undefined
          ? { max: integer(input.max, "max", 1) }
          : {}),
        ...(input.averageTime !== undefined
          ? {
              averageTime:
                String(input.averageTime).trim().slice(0, 100) || null,
            }
          : {}),
        ...(input.refill !== undefined
          ? { refill: input.refill === true }
          : {}),
        ...(input.cancel !== undefined
          ? { cancel: input.cancel === true }
          : {}),
        ...(input.active !== undefined
          ? { active: input.active === true }
          : {}),
        ...(input.restrictFromApi !== undefined
          ? { restrictFromApi: input.restrictFromApi === true }
          : {}),
      };
      if (requestedSource === "MANUAL") {
        await tx.serviceMapping.updateMany({
          where: { serviceId: id, active: true },
          data: { active: false, syncAll: false },
        });
      } else {
        const providerServiceId = String(input.providerServiceId ?? "");
        target = await tx.providerService.findFirst({
          where: { id: providerServiceId, active: true, stale: false },
        });
        if (!target)
          throw new CatalogError(
            "PROVIDER_SERVICE_NOT_FOUND",
            "Provider service not found",
          );
        const provider = await tx.provider.findFirst({
          where: {
            id: target.providerId,
            status: { in: ["ACTIVE", "DEGRADED"] },
            deletedAt: null,
          },
        });
        if (!provider)
          throw new CatalogError(
            "PROVIDER_UNAVAILABLE",
            "Provider unavailable",
          );
        const providerValues: any = {
          name: target.name,
          description:
            typeof target.raw?.description === "string"
              ? target.raw.description.slice(0, 5000)
              : undefined,
          providerCost: String(target.rate),
          min: target.min,
          max: target.max,
          type: target.type,
          refill: target.refill,
          cancel: target.cancel,
          active: target.active,
          averageTime:
            typeof target.raw?.averageTime === "string"
              ? target.raw.averageTime.slice(0, 100)
              : undefined,
        };
        const fieldSync: Record<string, string> = {
          name: "syncName",
          description: "syncDescription",
          providerCost: "syncCost",
          min: "syncMin",
          max: "syncMax",
          type: "syncType",
          refill: "syncRefill",
          cancel: "syncCancel",
          active: "syncStatus",
          averageTime: "syncAverageTime",
        };
        for (const [field, flag] of Object.entries(fieldSync))
          if (
            providerValues[field] !== undefined &&
            !manualFields.has(field) &&
            sync[flag]
          )
            data[field] = providerValues[field];
        if ((data.min ?? before.min) > (data.max ?? before.max))
          throw new CatalogError(
            "RANGE_INVALID",
            "Maximum must be at least minimum",
          );
        await tx.serviceMapping.updateMany({
          where: {
            serviceId: id,
            active: true,
            providerServiceId: { not: target.id },
          },
          data: { active: false },
        });
        mapping = await tx.serviceMapping.upsert({
          where: {
            serviceId_providerServiceId: {
              serviceId: id,
              providerServiceId: target.id,
            },
          },
          create: {
            serviceId: id,
            providerServiceId: target.id,
            priority: 0,
            active: true,
            ...sync,
            providerCostOverride: sync.syncCost ? null : before.providerCost,
            disabledPolicy: input.disabledPolicy ?? "REQUIRE_REVIEW",
          },
          update: {
            priority: 0,
            active: true,
            ...sync,
            providerCostOverride: sync.syncCost ? null : before.providerCost,
            disabledPolicy: input.disabledPolicy ?? "REQUIRE_REVIEW",
          },
        });
      }
      if ((data.min ?? before.min) > (data.max ?? before.max))
        throw new CatalogError(
          "RANGE_INVALID",
          "Maximum must be at least minimum",
        );
      const shouldReprice =
        requestedSource === "API" &&
        input.remapPricing === "REPRICE" &&
        target &&
        sync.syncCost;
      if (shouldReprice) delete data.providerCost;
      let service = await tx.service.update({ where: { id }, data });
      const groups = await tx.priceGroup.findMany({
        where: { active: true, code: { in: ["KHACH_LE", "CTV", "DAI_LY"] } },
      });
      if (input.pricing && groups.length !== 3)
        throw new CatalogError(
          "DEFAULT_TIERS_MISSING",
          "Default tiers missing",
        );
      for (const group of groups) {
        const tier = input.pricing?.[group.code];
        if (!tier) continue;
        const mode = String(tier.mode);
        if (!["PERCENT", "FIXED"].includes(mode))
          throw new CatalogError(
            "PRICING_MODE_INVALID",
            "Invalid pricing mode",
          );
        const value = decimalInput(tier.value, true),
          rule = {
            fixedRate: mode === "FIXED" ? value : null,
            markupPercent: mode === "PERCENT" ? value : null,
            fixedProfit: null,
            minProfit: group.defaultMinProfit,
          },
          resolved = resolveCustomerRate({
            service,
            group,
            override: rule,
            providerCost: service.providerCost,
          });
        if (mode === "FIXED" && moneyUnits(resolved) > moneyUnits(value))
          throw new CatalogError(
            "PRICE_BELOW_SAFETY_FLOOR",
            `Giá ${group.name} thấp hơn mức an toàn`,
          );
        await tx.priceRule.upsert({
          where: {
            priceGroupId_serviceId: { priceGroupId: group.id, serviceId: id },
          },
          create: { priceGroupId: group.id, serviceId: id, ...rule },
          update: rule,
        });
      }
      if (shouldReprice) {
        await repriceMappedServices(
          tx,
          target.providerId,
          [target.id],
          "service-provider-remap",
        );
        service = await tx.service.findUnique({ where: { id } });
      }
      const action =
        before.source === "MANUAL" && requestedSource === "API"
          ? "SERVICE_SOURCE_MANUAL_TO_PROVIDER"
          : before.source === "API" && requestedSource === "MANUAL"
            ? "SERVICE_SOURCE_PROVIDER_TO_MANUAL"
            : requestedSource === "API" &&
                oldActiveProviderServiceId !== target?.id
              ? "SERVICE_PROVIDER_REMAP"
              : "SERVICE_EDITOR_UPDATE";
      await this.audit(tx, actorId, action, "service", id, before, {
        ...service,
        mappingId: mapping?.id ?? null,
        sync,
      });
      return { service, mapping, action };
    });
  }
  async upsertMapping(actorId: string, input: any) {
    const data = {
      serviceId: String(input.serviceId),
      providerServiceId: String(input.providerServiceId),
      priority: integer(input.priority ?? 100, "priority", 0),
      active: input.active !== false,
      markupPercent: input.markupPercent
        ? decimalInput(input.markupPercent, true)
        : null,
      fixedProfit: input.fixedProfit
        ? decimalInput(input.fixedProfit, true)
        : null,
      minProfit: decimalInput(input.minProfit ?? "0", true),
      syncAll: input.syncAll !== false,
      syncName: input.syncName !== false,
      syncCost: input.syncCost !== false,
      syncMin: input.syncMin !== false,
      syncMax: input.syncMax !== false,
      syncType: input.syncType !== false,
      syncRefill: input.syncRefill !== false,
      syncCancel: input.syncCancel !== false,
      syncStatus: input.syncStatus !== false,
      syncDescription: input.syncDescription === true,
      syncAverageTime: input.syncAverageTime === true,
      providerCostOverride:
        input.syncAll === false && input.syncCost === false
          ? decimalInput(input.providerCostOverride ?? "0", true)
          : null,
      disabledPolicy: [
        "KEEP_ACTIVE",
        "DISABLE_SERVICE",
        "REQUIRE_REVIEW",
      ].includes(String(input.disabledPolicy))
        ? String(input.disabledPolicy)
        : "REQUIRE_REVIEW",
    };
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.serviceMapping.upsert({
        where: {
          serviceId_providerServiceId: {
            serviceId: data.serviceId,
            providerServiceId: data.providerServiceId,
          },
        },
        create: data,
        update: data,
      });
      await this.audit(
        tx,
        actorId,
        "SERVICE_MAPPING_UPSERT",
        "service_mapping",
        item.id,
        null,
        item,
      );
      return item;
    });
  }

  async createPlatform(actorId: string, input: any) {
    const data = {
      name: name(input.name).slice(0, 120),
      slug: slug(input.slug).slice(0, 140),
      icon: input.icon ? String(input.icon).trim().slice(0, 255) : null,
      sortOrder: integer(input.sortOrder ?? 0, "sortOrder"),
      active: input.active !== false,
    };
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.platform.create({ data });
      await this.audit(
        tx,
        actorId,
        "PLATFORM_CREATE",
        "platform",
        item.id,
        null,
        item,
      );
      return item;
    });
  }

  async updatePlatform(actorId: string, id: string, input: any) {
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.platform.findUnique({ where: { id } });
      if (!before)
        throw new CatalogError("PLATFORM_NOT_FOUND", "Platform not found");
      const item = await tx.platform.update({
        where: { id },
        data: {
          ...(input.name !== undefined
            ? { name: name(input.name).slice(0, 120) }
            : {}),
          ...(input.slug !== undefined
            ? { slug: slug(input.slug).slice(0, 140) }
            : {}),
          ...(input.icon !== undefined
            ? { icon: String(input.icon).trim().slice(0, 255) || null }
            : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: integer(input.sortOrder, "sortOrder") }
            : {}),
          ...(input.active !== undefined
            ? { active: input.active === true }
            : {}),
        },
      });
      await this.audit(
        tx,
        actorId,
        "PLATFORM_UPDATE",
        "platform",
        id,
        before,
        item,
      );
      return item;
    });
  }

  async createCategory(actorId: string, input: any) {
    const data = {
      platformId: input.platformId ? String(input.platformId) : null,
      name: name(input.name),
      slug: slug(input.slug),
      description: input.description
        ? String(input.description).slice(0, 5000)
        : null,
      sortOrder: integer(input.sortOrder ?? 0, "sortOrder"),
      active: input.active !== false,
    };
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.serviceCategory.create({ data });
      await this.audit(
        tx,
        actorId,
        "CATEGORY_CREATE",
        "service_category",
        item.id,
        null,
        item,
      );
      return item;
    });
  }
  async updateCategory(actorId: string, id: string, input: any) {
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.serviceCategory.findUnique({ where: { id } });
      if (!before)
        throw new CatalogError("CATEGORY_NOT_FOUND", "Category not found");
      const data = {
        ...(input.platformId !== undefined
          ? { platformId: input.platformId ? String(input.platformId) : null }
          : {}),
        ...(input.name !== undefined ? { name: name(input.name) } : {}),
        ...(input.slug !== undefined ? { slug: slug(input.slug) } : {}),
        ...(input.active !== undefined
          ? { active: Boolean(input.active) }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: integer(input.sortOrder, "sortOrder") }
          : {}),
      };
      const item = await tx.serviceCategory.update({ where: { id }, data });
      await this.audit(
        tx,
        actorId,
        "CATEGORY_UPDATE",
        "service_category",
        id,
        before,
        item,
      );
      return item;
    });
  }
  async createService(actorId: string, input: any) {
    const min = integer(input.min, "min", 1),
      max = integer(input.max, "max", 1);
    if (max < min)
      throw new CatalogError(
        "RANGE_INVALID",
        "Maximum must be at least minimum",
      );
    const data = {
      categoryId: String(input.categoryId),
      name: name(input.name),
      source: "MANUAL",
      description: input.description
        ? String(input.description).slice(0, 10000)
        : null,
      type: name(input.type ?? "DEFAULT").slice(0, 80),
      pricingModel: "PER_THOUSAND",
      rate: decimalInput(input.rate),
      providerCost: decimalInput(input.providerCost, true),
      min,
      max,
      averageTime: input.averageTime
        ? String(input.averageTime).slice(0, 100)
        : null,
      refill: Boolean(input.refill),
      cancel: Boolean(input.cancel),
      active: input.active !== false,
      sortOrder: integer(input.sortOrder ?? 0, "sortOrder"),
    };
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.service.create({ data });
      await this.audit(
        tx,
        actorId,
        "SERVICE_CREATE",
        "service",
        item.id,
        null,
        item,
      );
      return item;
    });
  }
  async updateService(actorId: string, id: string, input: any) {
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.service.findUnique({ where: { id } });
      if (!before)
        throw new CatalogError("SERVICE_NOT_FOUND", "Service not found");
      const data: any = {
        ...(input.categoryId !== undefined
          ? { categoryId: String(input.categoryId) }
          : {}),
        ...(input.name !== undefined ? { name: name(input.name) } : {}),
        ...(input.description !== undefined
          ? {
              description:
                String(input.description).trim().slice(0, 5000) || null,
            }
          : {}),
        ...(input.type !== undefined
          ? { type: name(input.type).slice(0, 80) }
          : {}),
        ...(input.averageTime !== undefined
          ? {
              averageTime:
                String(input.averageTime).trim().slice(0, 100) || null,
            }
          : {}),
        ...(input.refill !== undefined
          ? { refill: input.refill === true }
          : {}),
        ...(input.cancel !== undefined
          ? { cancel: input.cancel === true }
          : {}),
        ...(input.rate !== undefined ? { rate: decimalInput(input.rate) } : {}),
        ...(input.providerCost !== undefined
          ? { providerCost: decimalInput(input.providerCost, true) }
          : {}),
        ...(input.active !== undefined
          ? { active: Boolean(input.active) }
          : {}),
        ...(input.min !== undefined
          ? { min: integer(input.min, "min", 1) }
          : {}),
        ...(input.max !== undefined
          ? { max: integer(input.max, "max", 1) }
          : {}),
      };
      if ((data.min ?? before.min) > (data.max ?? before.max))
        throw new CatalogError(
          "RANGE_INVALID",
          "Maximum must be at least minimum",
        );
      const item = await tx.service.update({ where: { id }, data });
      const manualSyncOverride: any = {};
      if (input.name !== undefined && input.name !== before.name)
        manualSyncOverride.syncName = false;
      if (input.min !== undefined && Number(input.min) !== before.min)
        manualSyncOverride.syncMin = false;
      if (input.max !== undefined && Number(input.max) !== before.max)
        manualSyncOverride.syncMax = false;
      if (input.type !== undefined && input.type !== before.type)
        manualSyncOverride.syncType = false;
      if (input.refill !== undefined && input.refill !== before.refill)
        manualSyncOverride.syncRefill = false;
      if (input.cancel !== undefined && input.cancel !== before.cancel)
        manualSyncOverride.syncCancel = false;
      if (
        input.description !== undefined &&
        (String(input.description).trim() || null) !== before.description
      )
        manualSyncOverride.syncDescription = false;
      if (
        input.averageTime !== undefined &&
        (String(input.averageTime).trim() || null) !== before.averageTime
      )
        manualSyncOverride.syncAverageTime = false;
      if (input.active !== undefined && Boolean(input.active) !== before.active)
        manualSyncOverride.syncStatus = false;
      if (Object.keys(manualSyncOverride).length)
        await tx.serviceMapping.updateMany({
          where: { serviceId: id, active: true },
          data: { syncAll: false, ...manualSyncOverride },
        });
      await this.audit(
        tx,
        actorId,
        "SERVICE_UPDATE",
        "service",
        id,
        before,
        item,
      );
      return item;
    });
  }
  async createPriceGroup(actorId: string, input: any) {
    const code = String(input.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9_]{2,50}$/.test(code))
      throw new CatalogError("CODE_INVALID", "Invalid price group code");
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.priceGroup.create({
        data: {
          name: name(input.name).slice(0, 100),
          code,
          active: input.active !== false,
          defaultMarkupPercent: decimalInput(
            input.defaultMarkupPercent ?? "0",
            true,
          ),
          defaultFixedProfit: decimalInput(
            input.defaultFixedProfit ?? "0",
            true,
          ),
          defaultMinProfit: decimalInput(input.defaultMinProfit ?? "0", true),
          tierOrder: integer(input.tierOrder ?? 0, "tierOrder"),
          publicDescription:
            String(input.publicDescription ?? "").trim() || null,
          upgradeEnabled: input.upgradeEnabled === true,
          upgradeMatchMode: upgradeMode(input.upgradeMatchMode),
          minSuccessfulDeposits: nullableMoney(input.minSuccessfulDeposits),
          minTotalSpent: nullableMoney(input.minTotalSpent),
          minCompletedOrders:
            input.minCompletedOrders == null || input.minCompletedOrders === ""
              ? null
              : integer(input.minCompletedOrders, "minCompletedOrders"),
        },
      });
      await this.audit(
        tx,
        actorId,
        "PRICE_GROUP_CREATE",
        "price_group",
        item.id,
        null,
        item,
      );
      return item;
    });
  }
  async updatePriceGroup(actorId: string, id: string, input: any) {
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.priceGroup.findUnique({ where: { id } });
      if (!before)
        throw new CatalogError(
          "PRICE_GROUP_NOT_FOUND",
          "Price group not found",
        );
      const item = await tx.priceGroup.update({
        where: { id },
        data: {
          ...(input.name !== undefined
            ? { name: name(input.name).slice(0, 100) }
            : {}),
          ...(input.active !== undefined
            ? { active: Boolean(input.active) }
            : {}),
          ...(input.defaultMarkupPercent !== undefined
            ? {
                defaultMarkupPercent: decimalInput(
                  input.defaultMarkupPercent,
                  true,
                ),
              }
            : {}),
          ...(input.defaultFixedProfit !== undefined
            ? {
                defaultFixedProfit: decimalInput(
                  input.defaultFixedProfit,
                  true,
                ),
              }
            : {}),
          ...(input.defaultMinProfit !== undefined
            ? { defaultMinProfit: decimalInput(input.defaultMinProfit, true) }
            : {}),
          ...(input.tierOrder !== undefined
            ? { tierOrder: integer(input.tierOrder, "tierOrder") }
            : {}),
          ...(input.publicDescription !== undefined
            ? {
                publicDescription:
                  String(input.publicDescription).trim() || null,
              }
            : {}),
          ...(input.upgradeEnabled !== undefined
            ? { upgradeEnabled: input.upgradeEnabled === true }
            : {}),
          ...(input.upgradeMatchMode !== undefined
            ? { upgradeMatchMode: upgradeMode(input.upgradeMatchMode) }
            : {}),
          ...(input.minSuccessfulDeposits !== undefined
            ? {
                minSuccessfulDeposits: nullableMoney(
                  input.minSuccessfulDeposits,
                ),
              }
            : {}),
          ...(input.minTotalSpent !== undefined
            ? { minTotalSpent: nullableMoney(input.minTotalSpent) }
            : {}),
          ...(input.minCompletedOrders !== undefined
            ? {
                minCompletedOrders:
                  input.minCompletedOrders === "" ||
                  input.minCompletedOrders === null
                    ? null
                    : integer(input.minCompletedOrders, "minCompletedOrders"),
              }
            : {}),
        },
      });
      await this.audit(
        tx,
        actorId,
        "PRICE_GROUP_UPDATE",
        "price_group",
        id,
        before,
        item,
      );
      return item;
    });
  }
  async upsertPriceRule(actorId: string, input: any) {
    const data = {
      priceGroupId: String(input.priceGroupId),
      serviceId: String(input.serviceId),
      fixedRate:
        input.fixedRate == null || input.fixedRate === ""
          ? null
          : decimalInput(input.fixedRate),
      markupPercent:
        input.markupPercent == null || input.markupPercent === ""
          ? null
          : decimalInput(input.markupPercent, true),
      fixedProfit:
        input.fixedProfit == null || input.fixedProfit === ""
          ? null
          : decimalInput(input.fixedProfit, true),
      minProfit: decimalInput(input.minProfit ?? "0", true),
    };
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.priceRule.findUnique({
        where: {
          priceGroupId_serviceId: {
            priceGroupId: data.priceGroupId,
            serviceId: data.serviceId,
          },
        },
      });
      const item = await tx.priceRule.upsert({
        where: {
          priceGroupId_serviceId: {
            priceGroupId: data.priceGroupId,
            serviceId: data.serviceId,
          },
        },
        create: data,
        update: data,
      });
      await this.audit(
        tx,
        actorId,
        before ? "PRICE_RULE_UPDATE" : "PRICE_RULE_CREATE",
        "price_rule",
        item.id,
        before,
        item,
      );
      return item;
    });
  }
  private audit(
    tx: any,
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    before: any,
    after: any,
  ) {
    return tx.auditLog.create({
      data: {
        actorId,
        action,
        resource,
        resourceId,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  }
}
