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
  async once() {
    const lock = await this.db.$queryRawUnsafe(
      `SELECT pg_try_advisory_lock(73129001) AS locked`,
    );
    if (!lock[0]?.locked) return 0;
    try {
      const providers = await this.db.provider.findMany({
        where: { status: "ACTIVE", deletedAt: null },
      });
      for (const p of providers) {
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
            for (const x of rows) {
              const externalId = String(x.service),
                rate = String(x.rate);
              if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(rate)) continue;
              await tx.providerService.upsert({
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
                },
              });
            }
            await tx.provider.update({
              where: { id: p.id },
              data: { lastSyncAt: new Date(), lastSuccessAt: new Date() },
            });
          });
        } catch {
          await this.db.provider.update({
            where: { id: p.id },
            data: { lastFailureAt: new Date() },
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
