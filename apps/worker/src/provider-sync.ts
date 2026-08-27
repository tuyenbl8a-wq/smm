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
    /* PostgreSQL performs decimal arithmetic atomically; MAX protects margin if a higher-cost failover is selected. */
    await tx.$executeRawUnsafe(
      `WITH costs AS (
         SELECT sm.service_id, MAX(ps.rate) safety_cost FROM service_mappings sm
         JOIN provider_services ps ON ps.id=sm.provider_service_id JOIN providers p ON p.id=ps.provider_id
         WHERE sm.active=true AND ps.active=true AND ps.stale=false AND p.status IN ('ACTIVE','DEGRADED')
           AND sm.service_id IN (SELECT sm2.service_id FROM service_mappings sm2 JOIN provider_services ps2 ON ps2.id=sm2.provider_service_id WHERE ps2.provider_id=$1::uuid)
         GROUP BY sm.service_id)
       UPDATE services s SET price_review_status='PRICE_REVIEW',updated_at=CURRENT_TIMESTAMP FROM costs c
       WHERE s.id=c.service_id AND c.safety_cost>s.provider_cost
         AND ((c.safety_cost-s.provider_cost)*100/NULLIF(s.provider_cost,0))>s.max_automatic_increase_percent`,
      providerId,
    );
    return tx.$executeRawUnsafe(
      `WITH affected AS (
         SELECT DISTINCT sm.service_id FROM service_mappings sm
         JOIN provider_services ps ON ps.id=sm.provider_service_id
         WHERE ps.provider_id=$1::uuid AND sm.active=true
       ), costs AS (
         SELECT sm.service_id, MAX(ps.rate) AS safety_cost
         FROM service_mappings sm JOIN provider_services ps ON ps.id=sm.provider_service_id
         JOIN providers p ON p.id=ps.provider_id
         WHERE sm.active=true AND ps.active=true AND ps.stale=false
           AND p.status IN ('ACTIVE','DEGRADED') AND sm.service_id IN (SELECT service_id FROM affected)
         GROUP BY sm.service_id
       )
       UPDATE services s SET provider_cost=c.safety_cost,
         rate=CASE WHEN c.safety_cost>s.provider_cost OR s.auto_decrease THEN
           GREATEST(c.safety_cost+s.default_min_profit,
             c.safety_cost+(c.safety_cost*s.default_markup_percent/100)+s.default_fixed_profit)
           ELSE s.rate END,
         updated_at=CURRENT_TIMESTAMP
       FROM costs c WHERE s.id=c.service_id AND s.price_review_status='OK'`,
      providerId,
    );
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
            for (const x of rows) {
              const externalId = String(x.service),
                rate = String(x.rate);
              if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(rate)) continue;
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
              seen.push(saved.id);
            }
            await tx.providerService.updateMany({
              where: { providerId: p.id, id: { notIn: seen } },
              data: { active: false, stale: true },
            });
            await this.repriceProvider(tx, p.id);
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
          });
        } catch {
          await this.db.provider.update({
            where: { id: p.id },
            data: {
              lastFailureAt: new Date(),
              syncClaimedAt: null,
              nextSyncAt: new Date(Date.now() + 5 * 60_000),
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
