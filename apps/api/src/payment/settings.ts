import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "../provider/crypto.js";

export class PaymentSettingsService {
  constructor(
    private readonly db: any,
    private readonly encryptionKey: string,
  ) {}

  async getAdminSettings() {
    const rows = await this.db.setting.findMany({
      where: {
        group: {
          in: ["payments.casso", "payments.bank", "payments.vietqr"],
        },
      },
    });

    const map = new Map<string, any>(
      rows.map(
        (row: any) => [`${row.group}:${row.key}`, row] as [string, any],
      ),
    );

    const read = (group: string, key: string) =>
      map.get(`${group}:${key}`)?.value ?? null;

    const readSecret = (group: string, key: string) => {
      const row = map.get(`${group}:${key}`);
      if (!row?.value) return null;

      const raw = String(row.value);

      if (!row.encrypted) {
        return raw;
      }

      try {
        return decryptSecret(raw, this.encryptionKey);
      } catch {
        return null;
      }
    };

    const maskedSecret = (group: string, key: string) => {
      const value = readSecret(group, key);
      return value ? maskSecret(value) : null;
    };

    return {
      casso: {
        enabled: Boolean(read("payments.casso", "enabled")),
        apiKeyConfigured: Boolean(
          readSecret("payments.casso", "apiKey"),
        ),
        apiKeyMasked: maskedSecret("payments.casso", "apiKey"),
        webhookTokenConfigured: Boolean(
          readSecret("payments.casso", "webhookSecureToken"),
        ),
        webhookTokenMasked: maskedSecret(
          "payments.casso",
          "webhookSecureToken",
        ),
      },

      bank: {
        bankName: read("payments.bank", "bankName"),
        bankBin: read("payments.bank", "bankBin"),
        accountNumber: read("payments.bank", "accountNumber"),
        accountName: read("payments.bank", "accountName"),
      },

      vietqr: {
        clientIdConfigured: Boolean(
          readSecret("payments.vietqr", "clientId"),
        ),
        clientIdMasked: maskedSecret("payments.vietqr", "clientId"),

        apiKeyConfigured: Boolean(
          readSecret("payments.vietqr", "apiKey"),
        ),
        apiKeyMasked: maskedSecret("payments.vietqr", "apiKey"),

        webhookSecretConfigured: Boolean(
          readSecret("payments.vietqr", "webhookSecret"),
        ),
        webhookSecretMasked: maskedSecret(
          "payments.vietqr",
          "webhookSecret",
        ),
      },
    };
  }

  async updateAdminSettings(input: Record<string, unknown>) {
    const writes: Array<{
      group: string;
      key: string;
      value: unknown;
      encrypted: boolean;
    }> = [];

    const push = (
      group: string,
      key: string,
      value: unknown,
      encrypted = false,
    ) => {
      if (value === undefined) return;

      writes.push({
        group,
        key,
        value,
        encrypted,
      });
    };

    const pushSecret = (
      group: string,
      key: string,
      value: unknown,
    ) => {
      if (value === undefined) return;

      const raw = String(value).trim();

      if (!raw) return;

      push(
        group,
        key,
        encryptSecret(raw, this.encryptionKey),
        true,
      );
    };

    push(
      "payments.casso",
      "enabled",
      Boolean(input.cassoEnabled),
    );

    pushSecret(
      "payments.casso",
      "apiKey",
      input.cassoApiKey,
    );

    pushSecret(
      "payments.casso",
      "webhookSecureToken",
      input.cassoWebhookSecureToken,
    );

    push(
      "payments.bank",
      "bankName",
      String(input.bankName ?? "").trim(),
    );

    push(
      "payments.bank",
      "bankBin",
      String(input.bankBin ?? "").trim(),
    );

    push(
      "payments.bank",
      "accountNumber",
      String(input.bankAccountNumber ?? "").trim(),
    );

    push(
      "payments.bank",
      "accountName",
      String(input.bankAccountName ?? "").trim(),
    );

    pushSecret(
      "payments.vietqr",
      "clientId",
      input.vietqrClientId,
    );

    pushSecret(
      "payments.vietqr",
      "apiKey",
      input.vietqrApiKey,
    );

    pushSecret(
      "payments.vietqr",
      "webhookSecret",
      input.vietqrWebhookSecret,
    );

    await this.db.$transaction(
      writes.map((item) =>
        this.db.setting.upsert({
          where: {
            group_key: {
              group: item.group,
              key: item.key,
            },
          },

          update: {
            value: item.value,
            encrypted: item.encrypted,
          },

          create: {
            group: item.group,
            key: item.key,
            value: item.value,
            encrypted: item.encrypted,
          },
        }),
      ),
    );

    return this.getAdminSettings();
  }
}