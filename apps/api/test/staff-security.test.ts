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
      service.updateStaff("staff", ["staff.manage"], "super-user", {}, false),
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
        { permissions: ["wallets.adjust"] },
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
    { role: "STAFF", permissions: ["services.view"], status: "ACTIVE" },
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
