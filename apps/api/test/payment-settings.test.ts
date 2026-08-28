import assert from "node:assert/strict";
import test from "node:test";
import { PaymentSettingsService } from "../src/payment/settings.js";

test("payment secrets are encrypted and admin reads only masked values", async () => {
  const rows: any[] = [],
    db: any = {
      setting: {
        findMany: async () => rows,
        findUnique: async ({ where }: any) =>
          rows.find((row) => row.key === where.group_key.key) ?? null,
      },
      auditLog: { create: async () => undefined },
    };
  db.$transaction = async (fn: any) =>
    fn({
      setting: {
        upsert: async ({ create, update }: any) => {
          const current = rows.find((row) => row.key === create.key);
          current ? Object.assign(current, update) : rows.push(create);
        },
      },
      auditLog: db.auditLog,
    });
  const service = new PaymentSettingsService(db, "test-encryption-key");
  await service.update("admin", {
    cassoEnabled: true,
    cassoWebhookSecureToken: "very-secret-webhook-token",
    bankName: "Test Bank",
  });
  const secret = rows.find((row) => row.key === "cassoWebhookSecureToken");
  assert.equal(secret.encrypted, true);
  assert.doesNotMatch(secret.value, /very-secret/);
  assert.equal(
    await service.webhookToken("fallback"),
    "very-secret-webhook-token",
  );
  const view: any = await service.adminView();
  assert.equal(view.cassoWebhookSecureToken.configured, true);
  assert.notEqual(
    view.cassoWebhookSecureToken.masked,
    "very-secret-webhook-token",
  );
});

test("Casso webhook token falls back to environment when DB is unset", async () => {
  const service = new PaymentSettingsService(
    { setting: { findUnique: async () => null } },
    "test-encryption-key",
  );
  assert.equal(
    await service.webhookToken("environment-token"),
    "environment-token",
  );
});

test("active Casso method webhook token is used by the real webhook handler", async () => {
  const methods: any[] = [],
    db: any = {
      paymentMethod: {
        findMany: async () => methods,
        findFirst: async () => methods[0] ?? null,
      },
      setting: { findUnique: async () => null },
    };
  const service = new PaymentSettingsService(db, "test-encryption-key");
  const tx = {
    paymentMethod: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        const row = { id: "casso-id", createdAt: new Date(), ...data };
        methods.push(row);
        return row;
      },
    },
    auditLog: { create: async () => undefined },
  };
  db.$transaction = async (fn: any) => fn(tx);
  await service.saveMethod("admin", null, {
    code: "casso",
    name: "Casso",
    providerType: "CASSO",
    currency: "VND",
    minAmount: "0",
    maxAmount: "0",
    dailyAmountLimit: "0",
    bonusPercent: "0",
    exchangeRate: "1",
    bankName: "Test Bank",
    accountNumber: "0123456789",
    accountName: "NGUYEN VAN A",
    webhookSecret: "method-webhook-token",
    active: true,
  });
  assert.equal(
    await service.webhookToken("environment-token"),
    "method-webhook-token",
  );
});

test("payment method secrets are encrypted, masked and audited", async () => {
  const methods: any[] = [],
    audits: any[] = [],
    db: any = {
      paymentMethod: { findMany: async () => methods },
    };
  db.$transaction = async (fn: any) =>
    fn({
      paymentMethod: {
        findUnique: async ({ where }: any) =>
          methods.find((row) => row.id === where.id) ?? null,
        create: async ({ data }: any) => {
          const row = {
            id: "method-id",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          methods.push(row);
          return row;
        },
      },
      auditLog: { create: async ({ data }: any) => audits.push(data) },
    });
  const service = new PaymentSettingsService(db, "test-encryption-key"),
    saved: any = await service.saveMethod("admin", null, {
      code: "casso-vnd",
      name: "Chuyển khoản tự động",
      providerType: "CASSO",
      currency: "VND",
      minAmount: "10000",
      maxAmount: "0",
      exchangeRate: "25000",
      dailyTransactionLimit: 0,
      dailyAmountLimit: "0",
      bonusPercent: "0",
      apiKey: "secret-api-key",
      bankName: "Test Bank",
      accountNumber: "0123456789",
      accountName: "NGUYEN VAN A",
      webhookSecret: "webhook-token",
      active: true,
    });
  assert.doesNotMatch(methods[0].configEncrypted, /secret-api-key|0123456789/);
  assert.equal(saved.accountMasked.includes("0123456789"), false);
  assert.equal(saved.configEncrypted, undefined);
  assert.equal(audits[0].action, "PAYMENT_METHOD_CREATE");
  assert.doesNotMatch(JSON.stringify(audits), /secret-api-key|0123456789/);
});

test("adapter validation rejects active methods with missing required setup", async () => {
  const db: any = {
    $transaction: async (fn: any) =>
      fn({
        paymentMethod: {
          findUnique: async () => null,
          create: async ({ data }: any) => ({
            id: "method-id",
            createdAt: new Date(),
            ...data,
          }),
        },
        auditLog: { create: async () => undefined },
      }),
  };
  const service = new PaymentSettingsService(db, "test-encryption-key");
  await assert.rejects(
    () =>
      service.saveMethod("admin", null, {
        code: "vietqr",
        name: "VietQR",
        providerType: "VIETQR",
        currency: "VND",
        minAmount: "0",
        maxAmount: "0",
        dailyAmountLimit: "0",
        bonusPercent: "0",
        exchangeRate: "1",
        bankName: "Test Bank",
        active: true,
      }),
    /PAYMENT_METHOD_MISSING_BANKBIN_ACCOUNTNUMBER_ACCOUNTNAME/,
  );
});

test("manual adapter discards unrelated API and webhook fields", async () => {
  let stored: any;
  const db: any = {
    $transaction: async (fn: any) =>
      fn({
        paymentMethod: {
          findUnique: async () => null,
          create: async ({ data }: any) => (
            (stored = data),
            {
              id: "method-id",
              createdAt: new Date(),
              ...data,
            }
          ),
        },
        auditLog: { create: async () => undefined },
      }),
  };
  const service = new PaymentSettingsService(db, "test-encryption-key");
  await service.saveMethod("admin", null, {
    code: "manual",
    name: "Chuyển khoản",
    providerType: "MANUAL",
    currency: "VND",
    minAmount: "0",
    maxAmount: "0",
    dailyAmountLimit: "0",
    bonusPercent: "0",
    exchangeRate: "1",
    bankName: "Test Bank",
    accountNumber: "0123456789",
    accountName: "NGUYEN VAN A",
    apiKey: "must-not-persist",
    webhookSecret: "must-not-persist",
    active: true,
  });
  assert.doesNotMatch(stored.configEncrypted, /must-not-persist/);
  const decoded = (service as any).publicMethod({
    id: "method-id",
    providerType: "MANUAL",
    active: true,
    code: "MANUAL",
    minAmount: "0",
    maxAmount: "0",
    exchangeRate: "1",
    dailyAmountLimit: "0",
    bonusPercent: "0",
    configEncrypted: stored.configEncrypted,
  });
  assert.equal(decoded.setupStatus, "ACTIVE");
  assert.equal(decoded.secretConfigured.apiKey, false);
});

test("payment method validation enforces safe limits", async () => {
  const service = new PaymentSettingsService(
    { $transaction: async () => undefined },
    "test-encryption-key",
  );
  await assert.rejects(
    () =>
      service.saveMethod("admin", null, {
        code: "manual",
        name: "Manual",
        providerType: "MANUAL",
        minAmount: "100",
        maxAmount: "99",
        dailyAmountLimit: "0",
        bonusPercent: "0",
        exchangeRate: "1",
      }),
    /PAYMENT_LIMIT_INVALID/,
  );
});
