import { createDecipheriv, createHash } from "node:crypto";
const decrypt = (value: string, secret: string) => {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("SECRET_INVALID");
  const d = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    Buffer.from(iv, "base64url"),
  );
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(data, "base64url")),
    d.final(),
  ]).toString("utf8");
};
export class ProviderSyncWorker {
  constructor(
    private db: any,
    private key: string,
  ) {}
  private async repriceProvider(tx: any, providerId: string) {
    const SCALE = 100_000_000n;
    const units = (value: unknown): bigint => {
      const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value));
      if (!match) throw new Error("PRICE_INVALID");
      return (
        BigInt(match[1]!) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"))
      );
    };
    const text = (value: bigint) =>
      `${value / SCALE}.${String(value % SCALE).padStart(8, "0")}`;
    const providerServices = await tx.providerService.findMany({
      where: { providerId, active: true, stale: false },
      select: { id: true },
    });
    const affectedMappings = await tx.serviceMapping.findMany({
      where: {
        providerServiceId: { in: providerServices.map((row: any) => row.id) },
        active: true,
      },
      select: { serviceId: true },
    });
    const serviceIds = [
      ...new Set<string>(
        affectedMappings.map((row: any) => String(row.serviceId)),
      ),
    ];
    if (!serviceIds.length) return 0;
    const [services, mappings] = await Promise.all([
      tx.service.findMany({ where: { id: { in: serviceIds } } }),
      tx.serviceMapping.findMany({
        where: { serviceId: { in: serviceIds }, active: true },
        orderBy: { priority: "asc" },
      }),
    ]);
    const allProviderServices = await tx.providerService.findMany({
      where: {
        id: { in: mappings.map((row: any) => row.providerServiceId) },
        active: true,
        stale: false,
      },
    });
    const providers = await tx.provider.findMany({
      where: {
        id: { in: allProviderServices.map((row: any) => row.providerId) },
        status: { in: ["ACTIVE", "DEGRADED"] },
        deletedAt: null,
      },
      select: { id: true },
    });
    const availableProviders = new Set(providers.map((row: any) => row.id));
    const availableServices = allProviderServices.filter((row: any) =>
      availableProviders.has(row.providerId),
    );
    let changed = 0;
    for (const service of services) {
      const serviceMappings = mappings.filter(
        (row: any) => row.serviceId === service.id,
      );
      const candidates = serviceMappings
        .map((mapping: any) => {
          const providerService = availableServices.find(
            (row: any) => row.id === mapping.providerServiceId,
          );
          return providerService
            ? {
                mapping,
                providerService,
                cost:
                  mapping.syncAll !== false || mapping.syncCost === true
                    ? providerService.rate
                    : (mapping.providerCostOverride ?? service.providerCost),
              }
            : null;
        })
        .filter(Boolean);
      if (!candidates.length) {
        const policy =
          serviceMappings.find(
            (row: any) => row.disabledPolicy === "DISABLE_SERVICE",
          )?.disabledPolicy ??
          serviceMappings.find(
            (row: any) => row.disabledPolicy === "REQUIRE_REVIEW",
          )?.disabledPolicy ??
          "KEEP_ACTIVE";
        if (service.active && policy !== "KEEP_ACTIVE") {
          await tx.service.update({
            where: { id: service.id },
            data:
              policy === "DISABLE_SERVICE"
                ? { active: false }
                : { priceReviewStatus: "PRICE_REVIEW" },
          });
          await tx.priceAlert.create({
            data: {
              serviceId: service.id,
              providerId,
              type: "SERVICE_UNAVAILABLE",
              severity: policy === "KEEP_ACTIVE" ? "WARNING" : "CRITICAL",
              title: "Dịch vụ không còn nhà cung cấp khả dụng",
              message:
                policy === "DISABLE_SERVICE"
                  ? `${service.name} đã bị tắt sau đồng bộ nhà cung cấp.`
                  : `${service.name} cần được kiểm tra sau đồng bộ nhà cung cấp.`,
              metadata: { disabledPolicy: policy },
            },
          });
        }
        continue;
      }
      const selected: any = candidates[0];
      const safetyCost = candidates.reduce(
        (maximum: bigint, row: any) =>
          units(row.cost) > maximum ? units(row.cost) : maximum,
        0n,
      );
      const syncAll = selected.mapping.syncAll !== false,
        providerRow = selected.providerService,
        syncedFields = {
          ...(providerRow.name !== undefined &&
          (syncAll || selected.mapping.syncName)
            ? { name: providerRow.name }
            : {}),
          ...(providerRow.min !== undefined &&
          (syncAll || selected.mapping.syncMin)
            ? { min: providerRow.min }
            : {}),
          ...(providerRow.max !== undefined &&
          (syncAll || selected.mapping.syncMax)
            ? { max: providerRow.max }
            : {}),
          ...(providerRow.type !== undefined &&
          (syncAll || selected.mapping.syncType)
            ? { type: providerRow.type }
            : {}),
          ...(providerRow.refill !== undefined &&
          (syncAll || selected.mapping.syncRefill)
            ? { refill: providerRow.refill }
            : {}),
          ...(providerRow.cancel !== undefined &&
          (syncAll || selected.mapping.syncCancel)
            ? { cancel: providerRow.cancel }
            : {}),
        };
      if (Object.keys(syncedFields).length)
        await tx.service.update({
          where: { id: service.id },
          data: syncedFields,
        });
      const oldCost = units(service.providerCost),
        oldRate = units(service.rate);
      const increasePercent =
        oldCost === 0n ? 0n : ((safetyCost - oldCost) * 100n * SCALE) / oldCost;
      if (
        safetyCost > oldCost &&
        increasePercent > units(service.maxAutomaticIncreasePercent)
      ) {
        await tx.service.update({
          where: { id: service.id },
          data: { priceReviewStatus: "PRICE_REVIEW" },
        });
        await tx.priceAlert.create({
          data: {
            serviceId: service.id,
            providerId,
            providerServiceId: selected.providerService.id,
            type: "PRICE_SPIKE_REVIEW",
            severity: "CRITICAL",
            title: "Giá nhà cung cấp tăng vượt ngưỡng",
            message: `${service.name} đang chờ kiểm tra giá.`,
            metadata: {
              oldCost: text(oldCost),
              newCost: text(safetyCost),
              changePercent: text(increasePercent),
            },
          },
        });
        continue;
      }
      let newRate = oldRate;
      if (safetyCost > oldCost || service.autoDecrease) {
        const percentage =
          (safetyCost * units(service.defaultMarkupPercent ?? "0")) /
          SCALE /
          100n;
        const calculated =
          safetyCost + percentage + units(service.defaultFixedProfit ?? "0");
        const floor = safetyCost + units(service.defaultMinProfit ?? "0");
        newRate = calculated < floor ? floor : calculated;
        if (service.pricingMode === "FIXED")
          newRate = oldRate < floor ? floor : oldRate;
      }
      const saleChanged = newRate !== oldRate;
      const costChanged = safetyCost !== oldCost;
      if (!saleChanged && !costChanged) continue;
      const data: any = {
        providerCost: text(safetyCost),
        priceReviewStatus: "OK",
      };
      if (service.pricingMode === "FIXED" && newRate > oldRate) {
        if (service.safetyAction === "DISABLE_SERVICE") data.active = false;
        else if (service.safetyAction === "REQUIRE_REVIEW")
          data.priceReviewStatus = "PRICE_REVIEW";
        else data.rate = text(newRate);
      } else data.rate = text(newRate);
      await tx.service.update({ where: { id: service.id }, data });
      const appliedRate = data.rate !== undefined ? newRate : oldRate;
      if (costChanged || appliedRate !== oldRate) {
        const changePercent =
          oldRate === 0n
            ? 0n
            : ((appliedRate - oldRate) * 100n * SCALE) / oldRate;
        await tx.servicePriceHistory.create({
          data: {
            serviceId: service.id,
            providerId,
            providerServiceId: selected.providerService.id,
            oldProviderCost: text(oldCost),
            newProviderCost: text(safetyCost),
            oldSaleRate: text(oldRate),
            newSaleRate: text(appliedRate),
            changePercent: text(changePercent),
            reason:
              appliedRate !== oldRate &&
              appliedRate ===
                safetyCost + units(service.defaultMinProfit ?? "0")
                ? "SAFETY_FLOOR"
                : "PROVIDER_SYNC",
            source: "worker-provider-sync",
            metadata: {
              pricingMode: service.pricingMode,
              safetyAction: service.safetyAction,
              autoDecrease: service.autoDecrease,
              minProfit: String(service.defaultMinProfit),
            },
          },
        });
      }
      const alertType =
        data.active === false
          ? "SERVICE_DISABLED"
          : service.pricingMode === "FIXED" && data.rate
            ? "AUTO_RAISE"
            : appliedRate !== oldRate &&
                appliedRate ===
                  safetyCost + units(service.defaultMinProfit ?? "0")
              ? "MINIMUM_PROFIT_FLOOR"
              : null;
      if (alertType)
        await tx.priceAlert.create({
          data: {
            serviceId: service.id,
            providerId,
            providerServiceId: selected.providerService.id,
            type: alertType,
            severity: data.active === false ? "CRITICAL" : "WARNING",
            title:
              data.active === false
                ? "Dịch vụ bị tắt do giá vốn"
                : alertType === "MINIMUM_PROFIT_FLOOR"
                  ? "Giá được nâng theo lợi nhuận tối thiểu"
                  : "Giá bán đã tự động tăng",
            message: `${service.name}: ${text(oldRate)} → ${text(appliedRate)}.`,
          },
        });
      changed++;
    }
    return changed;
  }
  async once() {
    const lock = await this.db.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock(73129001) AS locked`,
    );
    if (!lock[0]?.locked) return 0;
    try {
      const providers = await this.db.provider.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          autoSyncEnabled: true,
          OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }],
        },
      });
      for (const p of providers) {
        const claimed = await this.db.provider.updateMany({
          where: {
            id: p.id,
            OR: [
              { syncClaimedAt: null },
              { syncClaimedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
            ],
          },
          data: { syncClaimedAt: new Date() },
        });
        if (!claimed.count) continue;
        const syncLog = await this.db.providerSyncLog.create({
          data: { providerId: p.id, status: "RUNNING", startedAt: new Date() },
        });
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), p.timeoutMs);
        try {
          const response = await fetch(p.apiUrl, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              key: decrypt(p.apiKeyEncrypted, this.key),
              action: "services",
            }),
            signal: controller.signal,
          });
          const rows = await response.json();
          if (!response.ok || !Array.isArray(rows))
            throw new Error("SYNC_INVALID");
          await this.db.$transaction(async (tx: any) => {
            const seen: string[] = [];
            let created = 0,
              updated = 0,
              unchanged = 0;
            for (const x of rows) {
              const externalId = String(x.service),
                rate = String(x.rate);
              if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(rate)) continue;
              const existing = await tx.providerService.findUnique({
                where: {
                  providerId_externalId: { providerId: p.id, externalId },
                },
              });
              const saved = await tx.providerService.upsert({
                where: {
                  providerId_externalId: { providerId: p.id, externalId },
                },
                create: {
                  providerId: p.id,
                  externalId,
                  name: String(x.name),
                  category: String(x.category),
                  type: String(x.type ?? "Default"),
                  rate,
                  min: Number(x.min),
                  max: Number(x.max),
                  refill: Boolean(x.refill),
                  cancel: Boolean(x.cancel),
                  raw: x,
                  lastSyncedAt: new Date(),
                },
                update: {
                  name: String(x.name),
                  category: String(x.category),
                  type: String(x.type ?? "Default"),
                  rate,
                  min: Number(x.min),
                  max: Number(x.max),
                  refill: Boolean(x.refill),
                  cancel: Boolean(x.cancel),
                  raw: x,
                  lastSyncedAt: new Date(),
                  active: true,
                  stale: false,
                },
              });
              if (!existing) created++;
              else if (
                String(existing.rate) !== rate ||
                existing.name !== String(x.name) ||
                existing.min !== Number(x.min) ||
                existing.max !== Number(x.max) ||
                existing.active !== true
              )
                updated++;
              else unchanged++;
              seen.push(saved.id);
            }
            const staleServices = await tx.providerService.findMany({
              where: { providerId: p.id, id: { notIn: seen }, active: true },
              select: { id: true, name: true },
            });
            await tx.providerService.updateMany({
              where: { providerId: p.id, id: { notIn: seen } },
              data: { active: false, stale: true },
            });
            for (const stale of staleServices)
              await tx.priceAlert.create({
                data: {
                  providerId: p.id,
                  providerServiceId: stale.id,
                  type: "PROVIDER_SERVICE_STALE",
                  severity: "WARNING",
                  title: "Dịch vụ nhà cung cấp không còn xuất hiện",
                  message: `${stale.name} đã được đánh dấu stale sau đồng bộ.`,
                },
              });
            const priceChanged = await this.repriceProvider(tx, p.id);
            await tx.provider.update({
              where: { id: p.id },
              data: {
                lastSyncAt: new Date(),
                lastSuccessAt: new Date(),
                syncClaimedAt: null,
                nextSyncAt: new Date(
                  Date.now() + Math.max(5, p.syncIntervalMinutes) * 60_000,
                ),
              },
            });
            await tx.providerSyncLog.update({
              where: { id: syncLog.id },
              data: {
                status: "COMPLETED",
                finishedAt: new Date(),
                received: rows.length,
                created,
                updated,
                unchanged,
                stale: staleServices.length,
                metadata: { priceChanged },
              },
            });
          });
        } catch (error: any) {
          await this.db.provider.update({
            where: { id: p.id },
            data: {
              lastFailureAt: new Date(),
              syncClaimedAt: null,
              nextSyncAt: new Date(Date.now() + 5 * 60_000),
            },
          });
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
        } finally {
          clearTimeout(timer);
        }
      }
      return providers.length;
    } finally {
      await this.db.$executeRawUnsafe(`SELECT pg_advisory_unlock(73129001)`);
    }
  }
}
