import { repriceMappedServices } from "../catalog/repricing.js";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto.js";
import { StandardSmmAdapter } from "./adapter.js";
import { decimalInput, resolveCustomerRate } from "../catalog/pricing.js";
export class ProviderConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function importPriceOverride(
  input: any,
  externalId: string,
  groupCode: string,
): string | null {
  const rows = input?.priceOverrides;
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) return null;

  const row = rows[externalId];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;

  const value = row[groupCode];
  if (value == null || value === "") return null;

  try {
    return decimalInput(value);
  } catch {
    throw new ProviderConfigError(
      "PRICE_OVERRIDE_INVALID",
      `Giá nhập tay không hợp lệ: ${externalId}/${groupCode}`,
    );
  }
}

function resolveImportFixedRate(
  input: any,
  externalId: string,
  group: any,
  service: any,
  providerCost: unknown,
): { fixedRate: string; minProfit: string } | null {
  const fixedRate = importPriceOverride(input, externalId, String(group.code));
  if (!fixedRate) return null;

  const minProfit = decimalInput(
    group?.defaultMinProfit ?? service?.defaultMinProfit ?? "0",
    true,
  );
  const safeRate = resolveCustomerRate({
    service,
    group,
    override: { fixedRate, minProfit },
    providerCost,
  });

  if (safeRate !== fixedRate)
    throw new ProviderConfigError(
      "PRICE_OVERRIDE_BELOW_FLOOR",
      `Giá ${group.code} của dịch vụ ${externalId} thấp hơn giá vốn + lợi nhuận tối thiểu (${safeRate})`,
    );

  return { fixedRate, minProfit };
}

export class ProviderService {
  constructor(
    private readonly db: any,
    private readonly encryptionKey: string,
  ) {}
  adapter(provider: any) {
    return new StandardSmmAdapter(
      provider.apiUrl,
      decryptSecret(provider.apiKeyEncrypted, this.encryptionKey),
      provider.timeoutMs,
    );
  }
  private async provider(id: string) {
    const provider = await this.db.provider.findFirst({
      where: { id, deletedAt: null },
    });
    if (!provider)
      throw new ProviderConfigError("PROVIDER_NOT_FOUND", "Provider not found");
    return provider;
  }

  async fetchServices(id: string, query: any = {}) {
    const provider = await this.provider(id),
      rows = await this.adapter(provider).getServices(),
      search = String(query.search ?? "")
        .trim()
        .toLowerCase(),
      category = String(query.category ?? "").trim(),
      page = Math.max(1, Number(query.page) || 1),
      limit = Math.min(200, Math.max(1, Number(query.limit) || 50)),
      filtered = rows.filter(
        (row) =>
          (!search ||
            row.name.toLowerCase().includes(search) ||
            row.externalId.toLowerCase().includes(search)) &&
          (!category || row.category === category),
      );
    return {
      provider: { id: provider.id, name: provider.name },
      categories: [...new Set(rows.map((row) => row.category))].sort(),
      page,
      limit,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit),
      items: filtered
        .slice((page - 1) * limit, page * limit)
        .map(({ raw, ...row }) => row),
    };
  }

  private async selectedRecords(provider: any, input: any) {
    const externalIds = Array.isArray(input.externalIds)
      ? [...new Set(input.externalIds.map(String))].slice(0, 5000)
      : [];
    if (!externalIds.length)
      throw new ProviderConfigError(
        "SERVICES_REQUIRED",
        "Select at least one service",
      );
    const rows = await this.adapter(provider).getServices(),
      selected = rows.filter((row) => externalIds.includes(row.externalId)),
      overrides =
        input.overrides && typeof input.overrides === "object"
          ? input.overrides
          : {};
    if (selected.length !== externalIds.length)
      throw new ProviderConfigError(
        "PROVIDER_SERVICE_MISSING",
        "A selected provider service is unavailable",
      );
    return selected.map((row) => {
      const override = overrides[row.externalId];
      if (!override || typeof override !== "object") return row;
      const min = override.min === undefined ? row.min : Number(override.min),
        max = override.max === undefined ? row.max : Number(override.max),
        name =
          override.name === undefined
            ? row.name
            : String(override.name).trim().slice(0, 500);
      if (!name || !Number.isSafeInteger(min) || !Number.isSafeInteger(max))
        throw new ProviderConfigError(
          "IMPORT_OVERRIDE_INVALID",
          "Invalid service override",
        );
      if (min < 1 || max < min)
        throw new ProviderConfigError(
          "IMPORT_RANGE_INVALID",
          "Invalid imported service range",
        );
      return { ...row, name, min, max };
    });
  }

  async importPreview(id: string, input: any) {
    const provider = await this.provider(id),
      records = await this.selectedRecords(provider, input),
      category = await this.db.serviceCategory.findFirst({
        where: {
          id: String(input.categoryId ?? ""),
          active: true,
          deletedAt: null,
        },
      });
    if (!category)
      throw new ProviderConfigError(
        "CATEGORY_NOT_FOUND",
        "Local category not found",
      );
    const [platform, groups, existingProviderServices] = await Promise.all([
      category.platformId
        ? this.db.platform.findUnique({ where: { id: category.platformId } })
        : null,
      this.db.priceGroup.findMany({
        where: {
          active: true,
          code: { in: ["CUSTOMER", "AGENT", "DISTRIBUTOR"] },
        },
        orderBy: { tierOrder: "asc" },
      }),
      this.db.providerService.findMany({
        where: {
          providerId: id,
          externalId: { in: records.map((row) => row.externalId) },
        },
      }),
    ]);
    const existingMap = new Map(
      existingProviderServices.map((row: any) => [row.externalId, row]),
    );
    const existingMappings = existingProviderServices.length
      ? await this.db.serviceMapping.findMany({
          where: {
            providerServiceId: {
              in: existingProviderServices.map((row: any) => row.id),
            },
          },
        })
      : [];
    const mapped = new Set(
      existingMappings.map((row: any) => row.providerServiceId),
    );
    return {
      count: records.length,
      items: records.map((record) => {
        const service = {
          rate: record.rate,
          pricingMode: input.pricingMode ?? "COST_PLUS_PERCENT_AND_FIXED",
          defaultMarkupPercent: input.defaultMarkupPercent ?? "20",
          defaultFixedProfit: input.defaultFixedProfit ?? "0",
          defaultMinProfit: input.defaultMinProfit ?? "0",
        };
        const existing: any = existingMap.get(record.externalId);
        return {
          provider: provider.name,
          externalServiceId: record.externalId,
          providerName: record.name,
          providerCategory: record.category,
          providerCost: record.rate,
          suggestedPlatform: platform?.name ?? null,
          suggestedCategory: category.name,
          localName: record.name,
          prices: Object.fromEntries(
            groups.map((group: any) => {
              const manual = resolveImportFixedRate(
                input,
                record.externalId,
                group,
                service,
                record.rate,
              );
              return [
                group.code,
                manual?.fixedRate ??
                  resolveCustomerRate({
                    service,
                    group,
                    providerCost: record.rate,
                  }),
              ];
            }),
          ),
          automaticPrices: Object.fromEntries(
            groups.map((group: any) => [
              group.code,
              resolveCustomerRate({
                service,
                group,
                providerCost: record.rate,
              }),
            ]),
          ),
          min: record.min,
          max: record.max,
          type: record.type,
          refill: record.refill,
          cancel: record.cancel,
          state: existing
            ? mapped.has(existing.id)
              ? "EXISTS"
              : "UNMAPPED"
            : "NEW",
          warning: existing ? "Dịch vụ nhà cung cấp đã tồn tại" : null,
        };
      }),
    };
  }

  async importApply(actorId: string, id: string, input: any) {
    const provider = await this.provider(id),
      records = await this.selectedRecords(provider, input),
      categoryId = String(input.categoryId ?? ""),
      action = ["UPDATE", "REMAP", "SKIP"].includes(
        String(input.existingAction),
      )
        ? String(input.existingAction)
        : "SKIP";
    return this.db.$transaction(async (tx: any) => {
      const category = await tx.serviceCategory.findFirst({
        where: { id: categoryId, active: true, deletedAt: null },
      });
      if (!category)
        throw new ProviderConfigError(
          "CATEGORY_NOT_FOUND",
          "Local category not found",
        );

      const requestedGroupCodes = [
        ...new Set(
          records.flatMap((record) => {
            const row = input?.priceOverrides?.[record.externalId];
            if (!row || typeof row !== "object" || Array.isArray(row))
              return [];
            return Object.entries(row)
              .filter(([, value]) => value != null && value !== "")
              .map(([code]) => code);
          }),
        ),
      ];
      const priceGroups = requestedGroupCodes.length
        ? await tx.priceGroup.findMany({
            where: {
              active: true,
              code: { in: requestedGroupCodes },
            },
          })
        : [];
      if (priceGroups.length !== requestedGroupCodes.length)
        throw new ProviderConfigError(
          "PRICE_GROUP_NOT_FOUND",
          "Một hoặc nhiều nhóm giá không tồn tại hoặc đã bị tắt",
        );

      const existing = await tx.providerService.findMany({
        where: {
          providerId: id,
          externalId: { in: records.map((row) => row.externalId) },
        },
      });
      const existingMap = new Map(
        existing.map((row: any) => [row.externalId, row]),
      );
      const mappings = existing.length
        ? await tx.serviceMapping.findMany({
            where: {
              providerServiceId: { in: existing.map((row: any) => row.id) },
            },
          })
        : [];
      const mappingMap = new Map(
        mappings.map((row: any) => [row.providerServiceId, row]),
      );
      let created = 0,
        updated = 0,
        skipped = 0;
      const changedProviderServiceIds: string[] = [];
      for (const record of records) {
        const previous: any = existingMap.get(record.externalId),
          priorMapping: any = previous ? mappingMap.get(previous.id) : null;
        if (priorMapping && action === "SKIP") {
          skipped++;
          continue;
        }
        const providerService = await tx.providerService.upsert({
          where: {
            providerId_externalId: {
              providerId: id,
              externalId: record.externalId,
            },
          },
          create: { providerId: id, ...record, lastSyncedAt: new Date() },
          update: {
            ...record,
            active: true,
            stale: false,
            lastSyncedAt: new Date(),
          },
        });
        changedProviderServiceIds.push(providerService.id);
        if (priorMapping && action === "UPDATE") {
          const mapping = priorMapping;
          const all = input.syncAll !== false,
            currentSync = {
              syncAll: all,
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
            };
          await tx.service.update({
            where: { id: mapping.serviceId },
            data: {
              ...(all || currentSync.syncName ? { name: record.name } : {}),
              ...(all || currentSync.syncCost
                ? { providerCost: record.rate }
                : {}),
              ...(all || currentSync.syncMin ? { min: record.min } : {}),
              ...(all || currentSync.syncMax ? { max: record.max } : {}),
              ...(all || currentSync.syncType ? { type: record.type } : {}),
              ...(all || currentSync.syncRefill
                ? { refill: record.refill }
                : {}),
              ...(all || currentSync.syncCancel
                ? { cancel: record.cancel }
                : {}),
              ...(all || currentSync.syncStatus ? { active: true } : {}),
              ...(typeof record.raw?.description === "string" &&
              (all || currentSync.syncDescription)
                ? {
                    description: record.raw.description.slice(0, 5000),
                  }
                : {}),
              ...(typeof record.raw?.averageTime === "string" &&
              (all || currentSync.syncAverageTime)
                ? {
                    averageTime: record.raw.averageTime.slice(0, 100),
                  }
                : {}),
            },
          });
          await tx.serviceMapping.update({
            where: { id: mapping.id },
            data: {
              ...currentSync,
              providerCostOverride:
                input.syncAll === false && input.syncCost === false
                  ? record.rate
                  : null,
              disabledPolicy: input.disabledPolicy ?? "REQUIRE_REVIEW",
            },
          });
          updated++;
          continue;
        }
        const pricingTemplate = {
            rate: record.rate,
            pricingMode: input.pricingMode ?? "COST_PLUS_PERCENT_AND_FIXED",
            defaultMarkupPercent: input.defaultMarkupPercent ?? "20",
            defaultFixedProfit: input.defaultFixedProfit ?? "0",
            defaultMinProfit: input.defaultMinProfit ?? "0",
          },
          initialSaleRate = resolveCustomerRate({
            service: pricingTemplate,
            providerCost: record.rate,
          });
        const local = await tx.service.create({
          data: {
            categoryId,
            name: record.name,
            description:
              typeof record.raw?.description === "string"
                ? record.raw.description.slice(0, 5000)
                : null,
            type: record.type,
            rate: initialSaleRate,
            providerCost: record.rate,
            pricingMode: input.pricingMode ?? "COST_PLUS_PERCENT_AND_FIXED",
            defaultMarkupPercent: input.defaultMarkupPercent ?? "20",
            defaultFixedProfit: input.defaultFixedProfit ?? "0",
            defaultMinProfit: input.defaultMinProfit ?? "0",
            min: record.min,
            max: record.max,
            refill: record.refill,
            cancel: record.cancel,
            active: input.active !== false,
          },
        });
        await tx.serviceMapping.upsert({
          where: {
            serviceId_providerServiceId: {
              serviceId: local.id,
              providerServiceId: providerService.id,
            },
          },
          create: {
            serviceId: local.id,
            providerServiceId: providerService.id,
            priority: Number(input.priority ?? 100),
            syncAll: input.syncAll !== false,
            syncName: input.syncName !== false,
            syncCost: input.syncCost !== false,
            providerCostOverride:
              input.syncAll === false && input.syncCost === false
                ? record.rate
                : null,
            syncMin: input.syncMin !== false,
            syncMax: input.syncMax !== false,
            syncType: input.syncType !== false,
            syncRefill: input.syncRefill !== false,
            syncCancel: input.syncCancel !== false,
            syncStatus: input.syncStatus !== false,
            syncDescription: input.syncDescription === true,
            syncAverageTime: input.syncAverageTime === true,
            disabledPolicy: input.disabledPolicy ?? "REQUIRE_REVIEW",
          },
          update: {
            active: true,
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
                ? record.rate
                : null,
            disabledPolicy: input.disabledPolicy ?? "REQUIRE_REVIEW",
          },
        });

        for (const group of priceGroups) {
          const manual = resolveImportFixedRate(
            input,
            record.externalId,
            group,
            pricingTemplate,
            record.rate,
          );
          if (!manual) continue;

          await tx.priceRule.upsert({
            where: {
              priceGroupId_serviceId: {
                priceGroupId: group.id,
                serviceId: local.id,
              },
            },
            create: {
              priceGroupId: group.id,
              serviceId: local.id,
              fixedRate: manual.fixedRate,
              markupPercent: null,
              fixedProfit: null,
              minProfit: manual.minProfit,
            },
            update: {
              fixedRate: manual.fixedRate,
              markupPercent: null,
              fixedProfit: null,
              minProfit: manual.minProfit,
            },
          });
        }
        created++;
      }
      if (changedProviderServiceIds.length)
        await repriceMappedServices(
          tx,
          id,
          changedProviderServiceIds,
          "provider-service-import",
        );
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PROVIDER_SERVICE_IMPORT",
          resource: "provider",
          resourceId: id,
          after: {
            categoryId,
            externalIds: records.map((row) => row.externalId),
            created,
            updated,
            skipped,
          },
        },
      });
      return { received: records.length, created, updated, skipped, failed: 0 };
    });
  }

  async syncLogs(id: string, page = 1) {
    await this.provider(id);
    const limit = 50;
    return this.db.providerSyncLog.findMany({
      where: { providerId: id },
      orderBy: { startedAt: "desc" },
      skip: (Math.max(1, page) - 1) * limit,
      take: limit,
    });
  }
  async list() {
    const rows = await this.db.provider.findMany({
      where: { deletedAt: null },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    });
    return rows.map(({ apiKeyEncrypted, ...x }: any) => ({
      ...x,
      balance: x.balance == null ? null : String(x.balance),
      apiKeyMasked: maskSecret(
        decryptSecret(apiKeyEncrypted, this.encryptionKey),
      ),
    }));
  }
  async create(actorId: string, input: any) {
    const apiUrl = String(input.apiUrl ?? "");
    try {
      const u = new URL(apiUrl);
      if (
        ![
          "https:",
          ...(process.env.NODE_ENV === "development" ? ["http:"] : []),
        ].includes(u.protocol)
      )
        throw 0;
    } catch {
      throw new ProviderConfigError(
        "PROVIDER_URL_INVALID",
        "Provider URL must be HTTPS",
      );
    }
    const apiKey = String(input.apiKey ?? "").trim();
    if (apiKey.length < 8)
      throw new ProviderConfigError(
        "PROVIDER_KEY_INVALID",
        "Provider key is too short",
      );
    const data = {
      name: String(input.name ?? "")
        .trim()
        .slice(0, 120),
      apiUrl,
      apiKeyEncrypted: encryptSecret(apiKey, this.encryptionKey),
      encryptionKeyVersion: 1,
      currency: String(input.currency ?? "USD")
        .toUpperCase()
        .slice(0, 10),
      status: input.status ?? "INACTIVE",
      priority: Number(input.priority ?? 100),
      timeoutMs: Number(input.timeoutMs ?? 15000),
      maxRetries: Number(input.maxRetries ?? 3),
      autoSyncEnabled: Boolean(input.autoSyncEnabled ?? false),
      syncIntervalMinutes: Number(input.syncIntervalMinutes ?? 15),
    };
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.provider.create({ data });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PROVIDER_CREATE",
          resource: "provider",
          resourceId: item.id,
          after: { ...data, apiKeyEncrypted: "[REDACTED]" },
        },
      });
      return { id: item.id, name: item.name };
    });
  }
  async detail(id: string) {
    const provider = await this.db.provider.findFirst({
      where: { id, deletedAt: null },
    });
    if (!provider)
      throw new ProviderConfigError("PROVIDER_NOT_FOUND", "Provider not found");
    const [services, logs] = await Promise.all([
      this.db.providerService.findMany({
        where: { providerId: id },
        orderBy: { name: "asc" },
        take: 500,
      }),
      this.db.orderProviderLog.findMany({
        where: { providerId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const { apiKeyEncrypted, ...safe } = provider;
    return {
      ...safe,
      balance: provider.balance == null ? null : String(provider.balance),
      apiKeyMasked: maskSecret(
        decryptSecret(apiKeyEncrypted, this.encryptionKey),
      ),
      services: services.map((service: any) => ({
        ...service,
        rate: String(service.rate),
      })),
      logs,
    };
  }
  async update(actorId: string, id: string, input: any) {
    const before = await this.db.provider.findUnique({ where: { id } });
    if (!before)
      throw new ProviderConfigError("PROVIDER_NOT_FOUND", "Provider not found");
    const data: any = {
      ...(input.name != null
        ? { name: String(input.name).trim().slice(0, 120) }
        : {}),
      ...(input.currency != null
        ? { currency: String(input.currency).trim().toUpperCase().slice(0, 10) }
        : {}),
      ...(input.status != null ? { status: String(input.status) } : {}),
      ...(input.priority != null ? { priority: Number(input.priority) } : {}),
      ...(input.timeoutMs != null
        ? { timeoutMs: Number(input.timeoutMs) }
        : {}),
      ...(input.maxRetries != null
        ? { maxRetries: Number(input.maxRetries) }
        : {}),
      ...(input.autoSyncEnabled != null
        ? { autoSyncEnabled: Boolean(input.autoSyncEnabled) }
        : {}),
      ...(input.syncIntervalMinutes != null
        ? { syncIntervalMinutes: Number(input.syncIntervalMinutes) }
        : {}),
    };
    if (input.apiUrl != null) {
      const url = new URL(String(input.apiUrl));
      if (
        url.protocol !== "https:" &&
        !(process.env.NODE_ENV === "development" && url.protocol === "http:")
      )
        throw new ProviderConfigError(
          "PROVIDER_URL_INVALID",
          "Provider URL must be HTTPS",
        );
      data.apiUrl = url.toString();
    }
    if (String(input.apiKey ?? "").trim())
      data.apiKeyEncrypted = encryptSecret(
        String(input.apiKey).trim(),
        this.encryptionKey,
      );
    return this.db.$transaction(async (tx: any) => {
      const item = await tx.provider.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PROVIDER_UPDATE",
          resource: "provider",
          resourceId: id,
          before: { ...before, apiKeyEncrypted: "[REDACTED]" },
          after: {
            ...data,
            ...(data.apiKeyEncrypted ? { apiKeyEncrypted: "[REDACTED]" } : {}),
          },
        },
      });
      return { id: item.id, status: item.status };
    });
  }
  async sync(actorId: string, id: string) {
    const provider = await this.db.provider.findUnique({ where: { id } });
    if (!provider)
      throw new ProviderConfigError("PROVIDER_NOT_FOUND", "Provider not found");
    const syncLog = this.db.providerSyncLog?.create
      ? await this.db.providerSyncLog.create({
          data: { providerId: id, status: "RUNNING", startedAt: new Date() },
        })
      : null;
    let records;
    try {
      records = await this.adapter(provider).getServices();
    } catch (error: any) {
      if (syncLog)
        await this.db.providerSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            errors: 1,
            errorMessage: String(
              error?.message ?? "Provider sync failed",
            ).slice(0, 500),
          },
        });
      throw error;
    }
    const now = new Date();
    const result = await this.db.$transaction(async (tx: any) => {
      let created = 0,
        updated = 0;
      const changed: string[] = [],
        seen: string[] = [];
      for (const record of records) {
        const existing = await tx.providerService.findUnique({
          where: {
            providerId_externalId: {
              providerId: id,
              externalId: record.externalId,
            },
          },
        });
        const saved = await tx.providerService.upsert({
          where: {
            providerId_externalId: {
              providerId: id,
              externalId: record.externalId,
            },
          },
          create: { providerId: id, ...record, lastSyncedAt: now },
          update: { ...record, lastSyncedAt: now, active: true, stale: false },
        });
        seen.push(saved.id);
        if (
          !existing ||
          String(existing.rate) !== String(record.rate) ||
          existing.min !== record.min ||
          existing.max !== record.max
        )
          changed.push(saved.id);
        existing ? updated++ : created++;
      }
      const staleServices = tx.providerService.findMany
        ? await tx.providerService.findMany({
            where: { providerId: id, id: { notIn: seen }, active: true },
            select: { id: true, name: true },
          })
        : [];
      if (tx.providerService.updateMany)
        await tx.providerService.updateMany({
          where: { providerId: id, id: { notIn: seen } },
          data: { stale: true, active: false },
        });
      if (tx.priceAlert)
        for (const stale of staleServices)
          await tx.priceAlert.create({
            data: {
              providerId: id,
              providerServiceId: stale.id,
              type: "PROVIDER_SERVICE_STALE",
              severity: "WARNING",
              title: "Dịch vụ nhà cung cấp không còn xuất hiện",
              message: `${stale.name} đã được đánh dấu stale sau đồng bộ.`,
            },
          });
      const pricingAvailable = Boolean(tx.serviceMapping);
      const pricing = pricingAvailable
        ? await repriceMappedServices(tx, id, changed)
        : {
            priceChanged: 0,
            priceIncreased: 0,
            priceDecreased: 0,
            requiresReview: 0,
            unavailable: 0,
          };
      await tx.provider.update({
        where: { id },
        data: { lastSyncAt: now, lastSuccessAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PROVIDER_SERVICES_SYNC",
          resource: "provider",
          resourceId: id,
          after: {
            received: records.length,
            created,
            updated,
            ...(pricingAvailable ? pricing : {}),
          },
        },
      });
      if (syncLog && tx.providerSyncLog)
        await tx.providerSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "COMPLETED",
            finishedAt: new Date(),
            received: records.length,
            created,
            updated,
            unchanged: Math.max(0, records.length - created - changed.length),
            stale: staleServices.length,
            priceIncreased: pricing.priceIncreased,
            priceDecreased: pricing.priceDecreased,
            requiresReview: pricing.requiresReview,
          },
        });
      return {
        received: records.length,
        created,
        updated,
        ...(pricingAvailable ? pricing : {}),
      };
    });
    return result;
  }

  async test(id: string) {
    const provider = await this.db.provider.findUnique({ where: { id } });
    if (!provider)
      throw new ProviderConfigError("PROVIDER_NOT_FOUND", "Provider not found");
    return this.adapter(provider).getBalance();
  }
}
