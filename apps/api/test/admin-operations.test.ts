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
    priceGroup: { findMany: async () => [] },
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

test("manual price-group assignment preserves roles and writes immutable history", async () => {
  const histories: any[] = [],
    audits: any[] = [],
    updates: any[] = [];
  const tx = {
    user: {
      findUnique: async () => ({ id: "user", priceGroupId: "retail" }),
      updateMany: async (input: any) => (updates.push(input), { count: 1 }),
    },
    priceGroup: {
      findFirst: async () => ({
        id: "vip",
        code: "VIP_CUSTOM",
        name: "VIP riêng",
        active: true,
      }),
      findUnique: async () => ({
        id: "retail",
        code: "RETAIL",
        name: "Khách lẻ",
      }),
    },
    priceGroupHistory: {
      create: async ({ data }: any) => (
        histories.push(data),
        { id: "history" }
      ),
    },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const service = new AdminOperationsService({
    $transaction: async (run: any) => run(tx),
  });
  const result = await service.assignPriceGroup("admin", "user", {
    priceGroupId: "vip",
    reason: "Đạt thỏa thuận đại lý",
  });
  assert.equal(result.changed, true);
  assert.equal(updates[0].data.priceGroupId, "vip");
  assert.equal(updates[0].data.roles, undefined);
  assert.equal(histories[0].oldPriceGroupCode, "RETAIL");
  assert.equal(histories[0].newPriceGroupCode, "VIP_CUSTOM");
  assert.equal(histories[0].source, "MANUAL");
  assert.equal(histories[0].actorId, "admin");
  assert.equal(audits[0].action, "USER_PRICE_GROUP_CHANGE");
});

test("inactive price group is rejected", async () => {
  const tx = {
    user: { findUnique: async () => ({ id: "user", priceGroupId: null }) },
    priceGroup: { findFirst: async () => null },
  };
  const service = new AdminOperationsService({
    $transaction: async (run: any) => run(tx),
  });
  await assert.rejects(
    () =>
      service.assignPriceGroup("admin", "user", { priceGroupId: "disabled" }),
    (error: AdminOperationError) => error.code === "PRICE_GROUP_NOT_FOUND",
  );
});

test("generic profile mutation cannot change role or price group", async () => {
  const writes: any[] = [];
  const service = new AdminOperationsService({
    $transaction: async (run: any) =>
      run({
        user: {
          update: async ({ data }: any) => (writes.push(data), { id: "user" }),
        },
        auditLog: { create: async () => ({}) },
      }),
  });
  (service as any).user = async () => ({ id: "user", priceGroupId: "retail" });
  await service.updateUser("admin", "user", {
    username: "member",
    priceGroupId: "vip",
    role: "SUPER_ADMIN",
  });
  assert.equal(writes[0].username, "member");
  assert.equal(writes[0].priceGroupId, undefined);
  assert.equal(writes[0].role, undefined);
});

test("bulk assignment rolls back when one conditional update conflicts", async () => {
  let calls = 0;
  const tx = {
    priceGroup: {
      findFirst: async () => ({
        id: "vip",
        code: "VIP",
        name: "VIP",
        active: true,
      }),
      findMany: async () => [{ id: "retail", code: "RETAIL", name: "Retail" }],
    },
    user: {
      findMany: async () => [
        { id: "one", priceGroupId: "retail" },
        { id: "two", priceGroupId: "retail" },
      ],
      updateMany: async () => ({ count: ++calls === 1 ? 1 : 0 }),
    },
    priceGroupHistory: { create: async () => ({}) },
    auditLog: { create: async () => ({}) },
  };
  const service = new AdminOperationsService({
    $transaction: async (run: any) => run(tx),
  });
  await assert.rejects(
    () =>
      service.bulkAssignPriceGroup("admin", {
        userIds: ["one", "two"],
        priceGroupId: "vip",
      }),
    (error: AdminOperationError) => error.code === "PRICE_GROUP_CONFLICT",
  );
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
