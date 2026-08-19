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
