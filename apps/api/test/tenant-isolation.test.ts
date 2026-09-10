import assert from "node:assert/strict";
import test from "node:test";
import { AdminOperationsService } from "../src/admin/operations.js";
import { AuthHandler } from "../src/auth/handler.js";
import { PrismaAuthStore } from "../src/auth/store.js";
import { DepositService } from "../src/payment/service.js";
import { SupportService } from "../src/support/service.js";
import { ROOT_SITE_ID } from "../src/tenant/context.js";

const CHILD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("a root SUPER_ADMIN session cannot authenticate on a child hostname", async () => {
  const store: any = {
    findSession: async () => ({
      id: "session",
      userId: "root-admin",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    // Deliberately return the root identity to prove authenticate rejects it
    // even if a legacy/custom store forgets to apply its own site predicate.
    findUserById: async () => ({
      id: "root-admin",
      siteId: ROOT_SITE_ID,
      status: "ACTIVE",
    }),
  };
  const handler = new AuthHandler(store, {
    apiUrl: new URL("http://localhost:3001"),
  } as any);
  let body = "";
  const response: any = {
    setHeader: () => undefined,
    end: (value: string) => (body = value),
  };
  await handler.handle(
    {
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: "smm_session=root-token" },
    } as any,
    response,
    "/api/v1/me",
    {
      id: CHILD_A,
      siteNumber: 100001n,
      parentSiteId: ROOT_SITE_ID,
      status: "ACTIVE",
      depth: 1,
    },
  );
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(body).error.code, "AUTHENTICATION_REQUIRED");
});

for (const siteId of [CHILD_A, CHILD_B]) {
  test(`admin list, search, detail and finance queries stay inside ${siteId}`, async () => {
    const seen: Array<{ model: string; where: any }> = [];
    const emptyModel = (model: string) => ({
      count: async ({ where }: any = {}) => (seen.push({ model, where }), 0),
      findMany: async ({ where }: any = {}) => (
        seen.push({ model, where }),
        []
      ),
      aggregate: async ({ where }: any = {}) => (
        seen.push({ model, where }),
        { _sum: {}, _count: 0 }
      ),
      groupBy: async ({ where }: any = {}) => (seen.push({ model, where }), []),
    });
    const db: any = {
      user: {
        ...emptyModel("user"),
        findFirst: async ({ where }: any) => (
          seen.push({ model: "user-detail", where }),
          null
        ),
      },
      order: {
        ...emptyModel("order"),
        findFirst: async ({ where }: any) => (
          seen.push({ model: "order-detail", where }),
          null
        ),
      },
      walletTransaction: emptyModel("transaction"),
      priceGroup: emptyModel("priceGroup"),
      userRole: emptyModel("userRole"),
      role: emptyModel("role"),
      wallet: emptyModel("wallet"),
      deposit: emptyModel("deposit"),
      loginHistory: emptyModel("loginHistory"),
      setting: emptyModel("setting"),
    };
    const admin = new AdminOperationsService(db);
    await admin.users({}, siteId);
    await admin.orders({}, siteId);
    await admin.transactions({}, siteId);
    await admin.customerSearch("customer", siteId);
    await admin.settings(siteId);
    await assert.rejects(
      () => admin.user("root-or-other-user", siteId),
      (error: any) => error.code === "USER_NOT_FOUND",
    );
    await assert.rejects(
      () => admin.order("100123", siteId),
      (error: any) => error.code === "ORDER_NOT_FOUND",
    );
    for (const entry of seen.filter(({ model }) =>
      [
        "user",
        "order",
        "transaction",
        "priceGroup",
        "wallet",
        "deposit",
        "loginHistory",
        "setting",
        "user-detail",
        "order-detail",
      ].includes(model),
    ))
      assert.equal(entry.where?.siteId, siteId);

    const depositCalls: any[] = [];
    await new DepositService({
      deposit: {
        findMany: async ({ where }: any) => (depositCalls.push(where), []),
      },
    } as any).adminHistory({}, siteId);
    assert.equal(depositCalls[0].siteId, siteId);

    const ticketCalls: any[] = [];
    await new SupportService({
      ticket: {
        count: async ({ where }: any) => (ticketCalls.push(where), 0),
        findMany: async ({ where }: any) => (ticketCalls.push(where), []),
      },
    } as any).adminInbox({}, siteId);
    assert.equal(ticketCalls[0].siteId, siteId);
    assert.equal(ticketCalls[1].siteId, siteId);
  });
}

test("customer and admin dashboards apply tenant predicates to every owned aggregate", async () => {
  const siteId = CHILD_A;
  const seen: Array<{ model: string; where: any }> = [];
  const model = (name: string) => ({
    count: async ({ where }: any = {}) => (
      seen.push({ model: name, where }),
      0
    ),
    findMany: async ({ where }: any = {}) => (
      seen.push({ model: name, where }),
      []
    ),
    aggregate: async ({ where }: any = {}) => (
      seen.push({ model: name, where }),
      { _sum: {} }
    ),
  });
  const store = new PrismaAuthStore({
    wallet: {
      findUnique: async ({ where }: any) => (
        seen.push({ model: "wallet", where }),
        null
      ),
    },
    user: model("user"),
    order: model("order"),
    deposit: model("deposit"),
    ticket: model("ticket"),
    notification: model("notification"),
    service: model("service"),
    provider: model("provider"),
    priceAlert: model("priceAlert"),
  });
  await store.customerDashboard("child-user", siteId);
  await store.adminDashboard(siteId);
  for (const entry of seen.filter(({ model }) =>
    [
      "wallet",
      "user",
      "order",
      "deposit",
      "ticket",
      "notification",
      "service",
    ].includes(model),
  ))
    assert.equal(entry.where?.siteId, siteId);
  assert.equal(
    seen.some(({ model }) => model === "provider"),
    false,
  );
  assert.equal(
    seen.some(({ model }) => model === "priceAlert"),
    false,
  );
});
