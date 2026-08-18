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
