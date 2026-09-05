import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminOperationError,
  AdminOperationsService,
} from "../src/admin/operations.js";

test("staff cannot modify Super Admin", async () => {
  const service = new AdminOperationsService({
    userRole: { findMany: async () => [{ roleId: "super" }] },
    role: { findMany: async () => [{ id: "super", code: "SUPER_ADMIN" }] },
  });
  await assert.rejects(
    () =>
      service.updateStaff(
        "staff",
        ["staff.manage"],
        "super-user",
        { reason: "test" },
        false,
      ),
    (error: AdminOperationError) => error.code === "SUPER_ADMIN_PROTECTED",
  );
});

test("admin cannot grant permissions outside their own scope", async () => {
  const service = new AdminOperationsService({
    userRole: { findMany: async () => [{ roleId: "staff" }] },
    role: { findMany: async () => [{ id: "staff", code: "STAFF" }] },
  });
  await assert.rejects(
    () =>
      service.updateStaff(
        "admin",
        ["services.view"],
        "target",
        { permissions: ["wallets.adjust"], reason: "test" },
        false,
      ),
    (error: AdminOperationError) => error.code === "PERMISSION_GRANT_DENIED",
  );
});

test("staff permission update is per-user, audited and never mutates global role grants", async () => {
  const audits: any[] = [],
    userGrants: any[] = [];
  const tx: any = {
    role: {
      findUniqueOrThrow: async () => ({ id: "staff-role", code: "STAFF" }),
    },
    permission: {
      findMany: async () => [{ id: "permission", code: "services.view" }],
    },
    userRole: {
      deleteMany: async () => ({}),
      create: async () => ({}),
    },
    userPermission: {
      findMany: async () => [],
      deleteMany: async () => ({}),
      createMany: async ({ data }: any) => userGrants.push(...data),
    },
    user: { update: async () => ({}) },
    session: { updateMany: async () => ({ count: 0 }) },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
    rolePermission: {
      deleteMany: async () => {
        throw new Error("global role permissions must not be changed");
      },
    },
  };
  const service = new AdminOperationsService({
    userRole: { findMany: async () => [{ roleId: "staff-role" }] },
    role: { findMany: async () => [{ id: "staff-role", code: "STAFF" }] },
    $transaction: async (run: any) => run(tx),
  });
  await service.updateStaff(
    "admin",
    ["services.view"],
    "target",
    {
      role: "STAFF",
      permissions: ["services.view"],
      status: "ACTIVE",
      reason: "Phân công mới",
    },
    false,
  );
  assert.equal(userGrants[0].userId, "target");
  assert.equal(userGrants[0].grantedBy, "admin");
  assert.equal(audits[0].action, "STAFF_PERMISSIONS_UPDATE");
});

test("password reset audit never contains token or password", async () => {
  const audits: any[] = [];
  const service = new AdminOperationsService({
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  });
  await service.recordSecurityAction(
    "admin",
    "target",
    "USER_PASSWORD_RESET_ISSUED",
  );
  const serialized = JSON.stringify(audits[0]);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("tokenHash"), false);
  assert.equal(audits[0].after.tokenExposed, false);
});

test("an existing customer can be promoted without recreating account or commercial data", async () => {
  const writes: string[] = [],
    audits: any[] = [];
  const tx: any = {
    role: { findUniqueOrThrow: async () => ({ id: "staff", code: "STAFF" }) },
    permission: { findMany: async () => [] },
    userRole: {
      deleteMany: async () => writes.push("roles-delete"),
      create: async () => writes.push("role-create"),
    },
    userPermission: {
      findMany: async () => [],
      deleteMany: async () => writes.push("permissions-delete"),
    },
    session: {
      updateMany: async () => (writes.push("sessions-revoke"), { count: 2 }),
    },
    auditLog: { create: async ({ data }: any) => audits.push(data) },
  };
  const service = new AdminOperationsService({
    userRole: { findMany: async () => [] },
    role: { findMany: async () => [] },
    $transaction: async (run: any) => run(tx),
  });
  const result = await service.updateStaff(
    "super-admin",
    [],
    "existing-customer",
    { role: "STAFF", permissions: [], reason: "Phân công hỗ trợ" },
    true,
  );
  assert.equal(result.role, "STAFF");
  assert.deepEqual(writes, [
    "roles-delete",
    "role-create",
    "permissions-delete",
    "sessions-revoke",
  ]);
  assert.equal(audits[0].resourceId, "existing-customer");
  assert.equal(JSON.stringify(audits).includes("priceGroup"), false);
});

test("demotion removes only administrative role and grants, then revokes sessions", async () => {
  const writes: string[] = [];
  const tx: any = {
    permission: { findMany: async () => [] },
    userRole: { deleteMany: async () => writes.push("roles-delete") },
    userPermission: {
      findMany: async () => [{ permissionId: "orders" }],
      deleteMany: async () => writes.push("permissions-delete"),
    },
    session: {
      updateMany: async () => (writes.push("sessions-revoke"), { count: 1 }),
    },
    auditLog: { create: async () => writes.push("audit") },
  };
  const service = new AdminOperationsService({
    userRole: { findMany: async () => [{ roleId: "staff" }] },
    role: { findMany: async () => [{ id: "staff", code: "STAFF" }] },
    $transaction: async (run: any) => run(tx),
  });
  const result = await service.updateStaff(
    "super-admin",
    [],
    "staff-user",
    {
      role: "CUSTOMER",
      permissions: ["orders.view"],
      reason: "Kết thúc nhiệm vụ",
    },
    true,
  );
  assert.equal(result.role, "CUSTOMER");
  assert.deepEqual(result.permissions, []);
  assert.equal(writes.includes("sessions-revoke"), true);
  assert.equal(writes.includes("audit"), true);
});

test("staff candidate search uses scalar priceGroupId and returns a safe mapped tier", async () => {
  const queries: any[] = [];
  const service = new AdminOperationsService({
    user: {
      findMany: async (query: any) => {
        queries.push(query);
        assert.equal(query.select.priceGroup, undefined);
        assert.equal(query.select.priceGroupId, true);
        assert.equal(query.select.passwordHash, undefined);
        assert.equal(query.select.session, undefined);
        return [
          {
            id: "11111111-1111-4111-8111-111111111111",
            username: "member",
            email: "m@example.com",
            priceGroupId: "tier-customer",
          },
        ];
      },
    },
    priceGroup: {
      findMany: async ({ where, select }: any) => {
        assert.deepEqual(where.id.in, ["tier-customer"]);
        assert.deepEqual(select, { id: true, code: true, name: true });
        return [
          {
            id: "tier-customer",
            code: "CUSTOMER",
            name: "Khách hàng",
          },
        ];
      },
    },
    userRole: { findMany: async () => [] },
    role: { findMany: async () => [] },
  });
  for (const search of [
    "m@example.com",
    "member",
    "11111111-1111-4111-8111-111111111111",
  ]) {
    const [result] = await service.staffCandidates(search);
    assert.deepEqual(result.priceGroup, {
      code: "CUSTOMER",
      name: "Khách hàng",
    });
    assert.equal(result.priceGroupId, undefined);
    assert.equal(result.passwordHash, undefined);
    assert.equal(result.token, undefined);
  }
  assert.equal(
    queries[0].where.OR.some((condition: any) => "id" in condition),
    false,
  );
  assert.deepEqual(queries[2].where.OR.at(-1), {
    id: "11111111-1111-4111-8111-111111111111",
  });
});

test("staff candidate search supports users without a tier and missing users", async () => {
  let mode: "without-tier" | "missing" = "without-tier";
  const service = new AdminOperationsService({
    user: {
      findMany: async () =>
        mode === "missing"
          ? []
          : [
              {
                id: "user",
                username: "member",
                email: "m@example.com",
                priceGroupId: null,
              },
            ],
    },
    priceGroup: {
      findMany: async () => {
        throw new Error("Không được query price group khi không có ID");
      },
    },
    userRole: { findMany: async () => [] },
    role: { findMany: async () => [] },
  });
  const [withoutTier] = await service.staffCandidates("member");
  assert.equal(withoutTier.priceGroup, null);
  mode = "missing";
  assert.deepEqual(await service.staffCandidates("missing@example.com"), []);
});
