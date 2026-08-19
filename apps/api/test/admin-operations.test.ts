import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminOperationError,
  AdminOperationsService,
} from "../src/admin/operations.js";

test("admin user search is paginated and never selects password hashes", async () => {
  let selection: any;
  const service = new AdminOperationsService({
    user: {
      count: async () => 1,
      findMany: async (input: any) => {
        selection = input.select;
        return [{ id: "user", email: "u@example.com", username: "user" }];
      },
    },
  });
  const result = await service.users({
    search: "user",
    page: "1",
    limit: "20",
  });
  assert.equal(result.total, 1);
  assert.equal(selection.passwordHash, undefined);
  assert.equal(selection.email, true);
});

test("super admin cannot ban or demote itself", async () => {
  const service = new AdminOperationsService({});
  await assert.rejects(
    () => service.updateUser("same", "same", { status: "BANNED" }),
    (error: AdminOperationError) => error.code === "SELF_BAN_DENIED",
  );
  await assert.rejects(
    () => service.roles("same", "same", ["ADMIN"]),
    (error: AdminOperationError) => error.code === "SELF_DEMOTION_DENIED",
  );
});

test("session revocation is persisted and audited", async () => {
  const audits: any[] = [];
  const service = new AdminOperationsService({
    session: { updateMany: async () => ({ count: 3 }) },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  });
  assert.deepEqual(await service.revokeSessions("admin", "user"), {
    revoked: 3,
  });
  assert.equal(audits[0].action, "USER_SESSIONS_REVOKE");
  assert.equal(audits[0].resourceId, "user");
});

test("general settings never return encrypted values", async () => {
  let query: any;
  const service = new AdminOperationsService({
    setting: {
      findMany: async (input: any) => {
        query = input;
        return [];
      },
    },
  });
  await service.settings();
  assert.deepEqual(query.where, { encrypted: false });
  assert.equal(query.select.value, true);
});

test("report CSV neutralizes spreadsheet formulas", async () => {
  const service = new AdminOperationsService({});
  (service as any).reports = async () => ({
    orders: { total: "=1+1", failed: 0, partial: 0, refunded: 0 },
    users: 0,
    money: { revenue: "+10", providerCost: 0, profit: 0, deposits: 0 },
  });
  const csv = await service.reportsCsv();
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"'\+10"/);
});

test("maintenance settings are normalized for runtime enforcement", async () => {
  const service = new AdminOperationsService({
    setting: {
      findMany: async () => [
        { key: "maintenanceMode", value: true },
        { key: "maintenanceMessage", value: "Vui lòng quay lại sau." },
      ],
    },
  });
  assert.deepEqual(await service.maintenance(), {
    enabled: true,
    message: "Vui lòng quay lại sau.",
  });
});
