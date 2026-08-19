import { decryptSecret, encryptSecret, maskSecret } from "./crypto.js";
import { StandardSmmAdapter } from "./adapter.js";
export class ProviderConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
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
    const records = await this.adapter(provider).getServices(),
      now = new Date();
    const result = await this.db.$transaction(async (tx: any) => {
      let created = 0,
        updated = 0;
      for (const record of records) {
        const existing = await tx.providerService.findUnique({
          where: {
            providerId_externalId: {
              providerId: id,
              externalId: record.externalId,
            },
          },
        });
        await tx.providerService.upsert({
          where: {
            providerId_externalId: {
              providerId: id,
              externalId: record.externalId,
            },
          },
          create: { providerId: id, ...record, lastSyncedAt: now },
          update: { ...record, lastSyncedAt: now, active: true },
        });
        existing ? updated++ : created++;
      }
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
          after: { received: records.length, created, updated },
        },
      });
      return { received: records.length, created, updated };
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
