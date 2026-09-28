import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";
import { csrfValue, tokenHash } from "../src/auth/security.js";

const ROOT = "00000000-0000-4000-8000-000000000001";
const SECRET = "test-secret-with-enough-entropy";
const OLD = "legacy-host-session-token";
const CURRENT = "current-domain-session-token";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";

function fakeStore() {
  const revoked: string[] = [];
  const sessions = new Map([
    [tokenHash(OLD), { id: "legacy-session", userId: "admin", expiresAt: new Date(Date.now() + 60_000), revokedAt: null }],
    [tokenHash(CURRENT), { id: "current-session", userId: "admin", expiresAt: new Date(Date.now() + 60_000), revokedAt: null }],
  ]);
  const user = {
    id: "admin",
    email: "admin@example.com",
    username: "admin",
    passwordHash: "unused",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    siteId: ROOT,
  };
  return {
    revoked,
    store: {
      findSession: async (hash: string) => sessions.get(hash) ?? null,
      findUserById: async (id: string, siteId: string) => id === user.id && siteId === ROOT ? user : null,
      rolesAndPermissions: async () => ({ roles: ["SUPER_ADMIN"], permissions: ["settings.manage"] }),
      revokeSession: async (id: string) => { revoked.push(id); },
    } as any,
  };
}

function response() {
  const headers = new Map<string, unknown>();
  const res: any = {
    statusCode: 0,
    headers,
    setHeader: (name: string, value: unknown) => headers.set(name.toLowerCase(), value),
    end: (value: string) => { res.body = JSON.parse(value); },
  };
  return res;
}

function duplicateCookieRequest(method: string, path: string, body?: unknown) {
  const csrf = csrfValue(CURRENT, SECRET);
  const staleCsrf = csrfValue(OLD, SECRET);
  const listeners = new Map<string, (...args: any[]) => void>();
  const req: any = {
    method,
    url: path,
    headers: {
      cookie:
        "smm_session=" + OLD +
        "; smm_session=" + CURRENT +
        "; smm_csrf=" + staleCsrf +
        "; smm_csrf=" + csrf,
      "x-csrf-token": csrf,
    },
    socket: {},
    on: (event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
      return req;
    },
  };
  if (body !== undefined) {
    setTimeout(() => {
      listeners.get("data")?.(Buffer.from(JSON.stringify(body)));
      listeners.get("end")?.();
    }, 0);
  }
  return req;
}

function config() {
  return {
    apiUrl: new URL("https://api.dichvu1st.com"),
    appUrl: new URL("https://dichvu1st.com"),
    environment: "production",
    sessionSecret: SECRET,
  } as any;
}

test("duplicate legacy/domain session cookies select the session matching the CSRF header", async () => {
  const { store, revoked } = fakeStore();
  const handler = new AuthHandler(store, config());
  const res = response();
  await handler.handle(
    duplicateCookieRequest("POST", "/api/v1/auth/logout"),
    res,
    "/api/v1/auth/logout",
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(revoked, ["current-session"]);
  const cookies = res.headers.get("set-cookie") as string[];
  assert.equal(cookies.some((value) => value.includes("Max-Age=0") && !value.includes("Domain=")), true);
  assert.equal(cookies.some((value) => value.includes("Domain=.dichvu1st.com")), true);
});

test("Panel mutations accept the valid CSRF pair even when stale cookies appear first", async () => {
  const { store } = fakeStore();
  const calls: any[] = [];
  const panels: any = {
    savePlan: async (...args: any[]) => {
      calls.push(args);
      return { id: PLAN_ID };
    },
  };
  const handler = new AuthHandler(
    store,
    config(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    panels,
  );
  const path = "/api/v1/admin/panel-plans/" + PLAN_ID;
  const res = response();
  await handler.handle(
    duplicateCookieRequest("PATCH", path, { name: "Panel", permissionCodes: [] }),
    res,
    path,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], ROOT);
  assert.equal(calls[0][2], PLAN_ID);
});
