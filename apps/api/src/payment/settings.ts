import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../provider/crypto.js";

const publicKeys = [
  "cassoEnabled",
  "bankName",
  "bankBin",
  "bankAccountNumber",
  "bankAccountName",
];
const secretKeys = [
  "cassoApiKey",
  "cassoWebhookSecureToken",
  "vietQrClientId",
  "vietQrApiKey",
];

export class PaymentSettingsService {
  constructor(
    private db: any,
    private encryptionKey: string,
  ) {}

  private async row(key: string) {
    return this.db.setting.findUnique({
      where: { group_key: { group: "payments", key } },
    });
  }

  private decimal(value: unknown, field: string, scale = 8) {
    const raw = String(value ?? "0").trim();
    if (!new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`).test(raw))
      throw new Error(`${field.toUpperCase()}_INVALID`);
    return raw;
  }

  private publicMethod(row: any) {
    let configured = false,
      accountMasked: string | null = null;
    if (row.configEncrypted) {
      const config = JSON.parse(
        decryptSecret(row.configEncrypted, this.encryptionKey),
      );
      configured = Object.keys(config).length > 0;
      accountMasked = config.accountNumber
        ? maskSecret(String(config.accountNumber))
        : null;
    }
    const { configEncrypted: _secret, ...safe } = row;
    return {
      ...safe,
      minAmount: String(row.minAmount),
      maxAmount: String(row.maxAmount),
      exchangeRate: String(row.exchangeRate),
      dailyAmountLimit: String(row.dailyAmountLimit),
      bonusPercent: String(row.bonusPercent),
      configured,
      accountMasked,
      webhookUrl: `${process.env.API_URL ?? "http://localhost:4000"}/webhooks/payments/${row.code}`,
    };
  }

  async methods(includeInactive = true) {
    const rows = await this.db.paymentMethod.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row: any) => this.publicMethod(row));
  }

  async saveMethod(actorId: string, id: string | null, input: any) {
    const providerType = String(input.providerType ?? "").toUpperCase();
    if (!["MANUAL", "VIETQR", "CASSO", "BINANCE"].includes(providerType))
      throw new Error("PAYMENT_PROVIDER_TYPE_INVALID");
    const minAmount = this.decimal(input.minAmount, "min_amount"),
      maxAmount = this.decimal(input.maxAmount, "max_amount"),
      dailyAmountLimit = this.decimal(
        input.dailyAmountLimit,
        "daily_amount_limit",
      ),
      exchangeRate = this.decimal(
        input.exchangeRate ?? "1",
        "exchange_rate",
        12,
      ),
      bonusPercent = this.decimal(input.bonusPercent, "bonus_percent", 6);
    const units = (value: string) => {
      const [whole, fraction = ""] = value.split(".");
      return (
        BigInt(whole!) * 100000000n +
        BigInt(fraction.padEnd(8, "0").slice(0, 8))
      );
    };
    if (units(maxAmount) !== 0n && units(maxAmount) < units(minAmount))
      throw new Error("PAYMENT_LIMIT_INVALID");
    const dailyTransactionLimit = Number(input.dailyTransactionLimit ?? 0),
      sortOrder = Number(input.sortOrder ?? 0);
    if (
      !Number.isSafeInteger(dailyTransactionLimit) ||
      dailyTransactionLimit < 0 ||
      !Number.isSafeInteger(sortOrder) ||
      sortOrder < 0
    )
      throw new Error("PAYMENT_LIMIT_INVALID");
    const secrets = [
        "accountNumber",
        "accountName",
        "apiKey",
        "apiSecret",
        "merchantId",
        "webhookSecret",
      ],
      secretInput = Object.fromEntries(
        secrets
          .filter((key) => typeof input[key] === "string" && input[key].trim())
          .map((key) => [key, input[key].trim()]),
      );
    return this.db.$transaction(async (tx: any) => {
      const existing = id
        ? await tx.paymentMethod.findUnique({ where: { id } })
        : null;
      if (id && !existing) throw new Error("PAYMENT_METHOD_NOT_FOUND");
      let configEncrypted = existing?.configEncrypted ?? null;
      if (Object.keys(secretInput).length) {
        const prior = configEncrypted
          ? JSON.parse(decryptSecret(configEncrypted, this.encryptionKey))
          : {};
        configEncrypted = encryptSecret(
          JSON.stringify({ ...prior, ...secretInput }),
          this.encryptionKey,
        );
      }
      const data = {
        code: String(input.code ?? existing?.code ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, "")
          .slice(0, 50),
        name: String(input.name ?? "")
          .trim()
          .slice(0, 120),
        providerType,
        currency: String(input.currency ?? "USD")
          .toUpperCase()
          .slice(0, 10),
        icon: input.icon ? String(input.icon).trim().slice(0, 2048) : null,
        minAmount,
        maxAmount,
        exchangeRate,
        dailyTransactionLimit,
        dailyAmountLimit,
        bonusPercent,
        instructions: input.instructions
          ? String(input.instructions).slice(0, 10000)
          : null,
        sortOrder,
        active: input.active === true,
        configEncrypted,
      };
      if (!data.code || !data.name) throw new Error("PAYMENT_METHOD_INVALID");
      const row = existing
        ? await tx.paymentMethod.update({ where: { id }, data })
        : await tx.paymentMethod.create({ data });
      await tx.auditLog.create({
        data: {
          actorId,
          action: existing ? "PAYMENT_METHOD_UPDATE" : "PAYMENT_METHOD_CREATE",
          resource: "PaymentMethod",
          resourceId: row.id,
          before: existing
            ? { name: existing.name, active: existing.active }
            : undefined,
          after: {
            code: row.code,
            name: row.name,
            providerType: row.providerType,
            currency: row.currency,
            active: row.active,
          },
        },
      });
      return this.publicMethod(row);
    });
  }

  async webhookToken(fallback = "") {
    const row = await this.row("cassoWebhookSecureToken");
    return row?.encrypted && typeof row.value === "string"
      ? decryptSecret(row.value, this.encryptionKey)
      : fallback;
  }

  async publicBank() {
    const rows = await this.db.setting.findMany({
      where: { group: "payments", key: { in: publicKeys } },
    });
    const values = Object.fromEntries(
      rows.map((row: any) => [row.key, row.value]),
    );
    return {
      bin: String(values.bankBin ?? process.env.BANK_BIN ?? ""),
      name: String(values.bankName ?? process.env.BANK_NAME ?? ""),
      account: String(
        values.bankAccountNumber ?? process.env.BANK_ACCOUNT_NUMBER ?? "",
      ),
      accountName: String(
        values.bankAccountName ?? process.env.BANK_ACCOUNT_NAME ?? "",
      ),
    };
  }

  async adminView() {
    const rows = await this.db.setting.findMany({
        where: { group: "payments" },
      }),
      values: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.encrypted) {
        const raw =
          typeof row.value === "string"
            ? decryptSecret(row.value, this.encryptionKey)
            : "";
        values[row.key] = {
          configured: Boolean(raw),
          masked: raw ? maskSecret(raw) : null,
        };
      } else values[row.key] = row.value;
    }
    return {
      ...values,
      webhookUrl: `${process.env.API_URL ?? "http://localhost:4000"}/webhooks/payments/casso`,
    };
  }

  async update(actorId: string, input: any) {
    const entries = [
      ...publicKeys
        .filter((key) => input[key] !== undefined)
        .map((key) => [key, input[key], false] as const),
      ...secretKeys
        .filter((key) => typeof input[key] === "string" && input[key].trim())
        .map(
          (key) =>
            [
              key,
              encryptSecret(input[key].trim(), this.encryptionKey),
              true,
            ] as const,
        ),
    ];
    if (!entries.length) throw new Error("PAYMENT_SETTINGS_EMPTY");
    return this.db.$transaction(async (tx: any) => {
      for (const [key, value, encrypted] of entries)
        await tx.setting.upsert({
          where: { group_key: { group: "payments", key } },
          update: { value, encrypted },
          create: { group: "payments", key, value, encrypted },
        });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PAYMENT_SETTINGS_UPDATE",
          resource: "Setting",
          resourceId: "payments",
          after: { keys: entries.map(([key]) => key) },
        },
      });
      return { updated: entries.map(([key]) => key) };
    });
  }
}
