import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";
import { PrismaAuthStore } from "../src/auth/store.js";

test("tenant registration provisions a default customer price group when none exists", async () => {
  const createdGroups: any[] = [];
  const tx: any = {
    role: { findUniqueOrThrow: async () => ({ id: "role-user" }) },
    priceGroup: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdGroups.push(data);
        return { id: "group-customer", ...data };
      },
    },
    user: {
      create: async ({ data }: any) => ({ id: "user-1", emailVerifiedAt: null, ...data }),
    },
    userRole: { create: async () => ({}) },
    wallet: { create: async () => ({}) },
    affiliate: { create: async () => ({}) },
  };
  const store = new PrismaAuthStore({
    $transaction: async (run: any) => run(tx),
  } as any);
  const user = await store.createUser({
    siteId: "00000000-0000-4000-8000-000000000099",
    email: "new@example.test",
    username: "newuser",
    passwordHash: "hash",
    referralCode: "REF-1",
  });
  assert.equal(createdGroups.length, 1);
  assert.equal(createdGroups[0].siteId, "00000000-0000-4000-8000-000000000099");
  assert.equal(createdGroups[0].code, "CUSTOMER");
  assert.equal((user as any).priceGroupId, "group-customer");
});

test("production auth sessions use host-only cookies while expiring the legacy root-domain cookie", async () => {
  const headers = new Map<string, any>();
  const response: any = {
    statusCode: 0,
    setHeader(name: string, value: any) { headers.set(name.toLowerCase(), value); },
    end() {},
  };
  const request: any = { headers: {}, socket: { remoteAddress: "127.0.0.1" } };
  const store: any = {
    createSession: async () => ({ id: "session-1" }),
    rolesAndPermissions: async () => ({ roles: ["USER"], permissions: [] }),
    panelEntitlements: async () => null,
  };
  const config: any = {
    environment: "production",
    appUrl: new URL("https://dichvu1st.com"),
    apiUrl: new URL("https://api.dichvu1st.com"),
    sessionSecret: "s".repeat(64),
  };
  const handler: any = new AuthHandler(store, config);
  await handler.issueSession(
    response,
    request,
    {
      id: "user-1",
      siteId: "00000000-0000-4000-8000-000000000099",
      email: "owner@example.test",
      username: "owner",
      passwordHash: "hash",
      status: "ACTIVE",
      emailVerifiedAt: null,
    },
    200,
  );
  const cookies = headers.get("set-cookie") as string[];
  const activeCookies = cookies.filter((value) => !value.includes("Max-Age=0"));
  assert.equal(activeCookies.length, 2);
  assert.ok(activeCookies.every((value) => !/; Domain=/i.test(value)));
  assert.ok(cookies.some((value) => value.includes("Max-Age=0") && value.includes("Domain=.dichvu1st.com")));
});
