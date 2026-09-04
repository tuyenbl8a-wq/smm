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

test("admin target refund credits only incremental delta and audits atomically", async () => {
  const writes: any[] = [],
    transactions: any[] = [],
    histories: any[] = [],
    audits: any[] = [];
  const current: any = {
    id: 2n,
    publicId: "00000000-0000-0000-0000-000000000002",
    userId: "user",
    charge: "100.00000000",
    refundedAmount: "30.00000000",
    status: "COMPLETED",
  };
  const tx: any = {
    order: {
      findUnique: async () => current,
      update: async ({ data }: any) => (
        writes.push(data),
        { ...current, ...data }
      ),
    },
    $queryRawUnsafe: async () => [{ id: "wallet", before: "10", after: "30" }],
    walletTransaction: {
      create: async ({ data }: any) => transactions.push(data),
    },
    orderHistory: { create: async ({ data }: any) => histories.push(data) },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const db: any = {
    order: { findFirst: async () => current },
    $transaction: async (run: any) => run(tx),
  };
  const result = await new AdminOperationsService(db).refundOrder(
    "admin",
    "100002",
    { targetRefundAmount: "50", reason: "Đền bù dịch vụ" },
  );
  assert.equal(result.refundAdded, "20.00000000");
  assert.equal(transactions[0].amount, "20.00000000");
  assert.match(transactions[0].idempotencyKey, /to:50\.00000000$/);
  assert.equal(writes[0].refundedAmount, "50.00000000");
  assert.equal(histories[0].actorId, "admin");
  assert.equal(audits[0].action, "ORDER_REFUND");
});

test("admin refund rejects decreasing or excessive targets", async () => {
  const current: any = {
    id: 2n,
    publicId: "id",
    userId: "user",
    charge: "100",
    refundedAmount: "30",
    status: "COMPLETED",
  };
  const tx: any = { order: { findUnique: async () => current } };
  const service = new AdminOperationsService({
    order: { findFirst: async () => current },
    $transaction: async (run: any) => run(tx),
  });
  await assert.rejects(
    () =>
      service.refundOrder("admin", "100002", {
        targetRefundAmount: "20",
        reason: "valid reason",
      }),
    (e: AdminOperationError) => e.code === "REFUND_BELOW_EXISTING",
  );
  await assert.rejects(
    () =>
      service.refundOrder("admin", "100002", {
        targetRefundAmount: "101",
        reason: "valid reason",
      }),
    (e: AdminOperationError) => e.code === "REFUND_EXCEEDS_CHARGE",
  );
});

test("manual order update validates counts and records before/after with actor", async () => {
  const order: any = {
    id: 2n,
    publicId: "id",
    quantity: 100,
    providerId: null,
    providerOrderId: null,
    status: "COMPLETED",
    startCount: 0,
    remains: 0,
    manualOverride: false,
  };
  const audits: any[] = [];
  const tx: any = {
    order: { update: async ({ data }: any) => ({ ...order, ...data }) },
    orderHistory: { create: async () => ({}) },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const service = new AdminOperationsService({
    order: { findFirst: async () => order },
    $transaction: async (run: any) => run(tx),
  });
  const result = await service.updateOrder("admin", "100002", {
    manualOverride: true,
    remains: 10,
    reason: "Kiểm tra thủ công",
  });
  assert.equal(result.manualOverride, true);
  assert.equal(audits[0].actorId, "admin");
  assert.equal(audits[0].before.manualOverride, false);
  await assert.rejects(
    () =>
      service.updateOrder("admin", "100002", {
        remains: 101,
        reason: "invalid count",
      }),
    /Invalid remains/,
  );
});

test("explicit provider sync accepts short and UUID references, including manual override", async () => {
  const key = "0123456789abcdef0123456789abcdef";
  const { encryptSecret } = await import("../src/provider/crypto.js");
  const base: any = {
    id: 2n,
    publicId: "00000000-0000-0000-0000-000000000002",
    userId: "user",
    providerId: "provider",
    providerOrderId: "2520992",
    quantity: 100,
    charge: "80",
    refundedAmount: "0",
    status: "COMPLETED",
    remains: 0,
    startCount: 10,
    manualOverride: true,
  };
  const histories: any[] = [],
    audits: any[] = [],
    references: any[] = [];
  const tx: any = {
    order: {
      findUnique: async () => base,
      update: async ({ data }: any) => ({ ...base, ...data }),
    },
    $executeRawUnsafe: async () => 1,
    $queryRawUnsafe: async () => [{ id: "wallet", before: "0", after: "20" }],
    walletTransaction: { create: async () => ({}) },
    orderHistory: { create: async ({ data }: any) => histories.push(data) },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const db: any = {
    order: {
      findFirst: async ({ where }: any) => (references.push(where), base),
    },
    provider: {
      findFirst: async () => ({
        id: "provider",
        apiUrl: "https://provider.test/api",
        apiKeyEncrypted: encryptSecret("secret", key),
        timeoutMs: 1000,
      }),
    },
    $transaction: async (run: any) => run(tx),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ status: "Partial", remains: "25", start_count: "15" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  try {
    const service = new AdminOperationsService(db, key);
    const short = await service.syncOrderFromProvider("admin", "100002");
    await service.syncOrderFromProvider("admin", base.publicId);
    assert.deepEqual(references[0], { id: 2n });
    assert.deepEqual(references[1], { publicId: base.publicId });
    assert.equal(short.refundAdded, "20.00000000");
    assert.equal((short as any).apiKeyEncrypted, undefined);
    assert.equal(histories[0].actorId, "admin");
    assert.equal(audits[0].action, "ORDER_PROVIDER_SYNC");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicit provider sync rejects an invalid provider response", async () => {
  const key = "0123456789abcdef",
    { encryptSecret } = await import("../src/provider/crypto.js");
  const order: any = {
    id: 2n,
    publicId: "id",
    providerId: "p",
    providerOrderId: "x",
    quantity: 10,
    remains: 0,
  };
  const service = new AdminOperationsService(
    {
      order: { findFirst: async () => order },
      provider: {
        findFirst: async () => ({
          apiUrl: "https://provider.test",
          apiKeyEncrypted: encryptSecret("secret", key),
          timeoutMs: 1000,
        }),
      },
    },
    key,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "made-up", remains: 0 }), {
      status: 200,
    });
  try {
    await assert.rejects(
      () => service.syncOrderFromProvider("admin", "100002"),
      (e: AdminOperationError) => e.code === "PROVIDER_RESPONSE_INVALID",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
