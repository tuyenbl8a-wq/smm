import assert from "node:assert/strict";
import test from "node:test";
import { AdminOperationsService } from "../src/admin/operations.js";
import { AuthHandler } from "../src/auth/handler.js";
import { csrfValue } from "../src/auth/security.js";

const CHILD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function requestWithBody(path: string, body: unknown, csrf: string) {
  const listeners = new Map<string, (...args: any[]) => void>();
  const req: any = {
    method: "POST",
    url: path,
    headers: { "x-csrf-token": csrf, cookie: `smm_csrf=${csrf}` },
    socket: {},
    on: (event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
      return req;
    },
  };
  setTimeout(() => {
    listeners.get("data")?.(Buffer.from(JSON.stringify(body)));
    listeners.get("end")?.();
  }, 0);
  return req;
}

async function postTheme(allowThemes: boolean, body: unknown) {
  const writes: any[] = [];
  const secret = "test-secret-with-enough-entropy";
  const db: any = {
    panelSubscription: {
      findFirst: async () => ({ planId: "plan-a", autoRenew: false }),
      update: async () => { throw new Error("Theme save must not write autoRenew"); },
    },
    panelRentalPlan: { findUnique: async () => ({ allowThemes }) },
    $transaction: async (fn: any) =>
      fn({
        setting: {
          upsert: async ({ create, update }: any) =>
            writes.push({ ...(create ?? {}), ...(update ?? {}) }),
        },
        auditLog: { create: async ({ data }: any) => writes.push(data) },
      }),
  };
  const admin = new AdminOperationsService(db);
  const handler: any = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: secret } as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    admin,
  );
  handler.authenticate = async () => ({
    user: { id: "child-admin", siteId: CHILD },
    access: { roles: ["ADMIN"], permissions: ["settings.manage"] },
    rawToken: "token",
  });
  handler.csrf = () => undefined;
  const response: any = {
    setHeader: () => undefined,
    end: (value: string) => (response.body = JSON.parse(value)),
  };
  await handler.handle(
    requestWithBody("/api/v1/admin/settings", body, csrfValue("token", secret)),
    response,
    "/api/v1/admin/settings",
    { id: CHILD, siteNumber: 100001n, parentSiteId: "root", status: "ACTIVE", depth: 1 },
  );
  return { response, writes };
}

test("theme entitlement blocks theme fields through the authenticated settings API but preserves reads", async () => {
  const blocked = await postTheme(false, { themeGlobal: "AURORA_MODERN" });
  if (blocked.response.statusCode !== 422)
    throw new Error(JSON.stringify(blocked.response.body));
  assert.equal(blocked.response.body.error.code, "PANEL_THEME_NOT_ALLOWED");
  assert.equal(blocked.writes.length, 0);
  const draftBlocked = await postTheme(false, {
    themeDraft: { themeId: "AI_COSMIC_FUTURE", overrides: { content: {} } },
  });
  assert.equal(draftBlocked.response.body.error.code, "PANEL_THEME_NOT_ALLOWED");
  assert.equal(draftBlocked.writes.length, 0);
  const forbiddenWrites = [
    {
      themeDraft: {
        themeId: "AI_COSMIC_FUTURE", scope: "landing",
        overrides: { content: { nodes: { "hero.title": { text: "Blocked edit" } } } },
      },
    },
    {
      themeDraft: {
        themeId: "AI_COSMIC_FUTURE", scope: "landing",
        overrides: { content: { customBlocks: [{ id: "block-denied-1", section: "hero", type: "paragraph", value: "Blocked add" }] } },
      },
    },
    {
      themeOverrides: {
        landing: { content: { nodes: { "hero.title": { text: "Blocked edit" } } } },
      },
    },
    {
      themeOverrides: {
        landing: { content: { customBlocks: [{ id: "block-denied-2", section: "hero", type: "paragraph", value: "Blocked add" }] } },
      },
    },
    { themeOverrides: {} }, // reset
    { themeGlobal: "AI_COSMIC_FUTURE" }, // apply/publish
    { themeMode: "SEPARATE", themePublic: "AI_COSMIC_FUTURE" }, // scoped publish
  ];
  for (const body of forbiddenWrites) {
    const denied = await postTheme(false, body);
    assert.equal(denied.response.statusCode, 422);
    assert.equal(denied.response.body.error.code, "PANEL_THEME_NOT_ALLOWED");
    assert.equal(denied.writes.length, 0);
  }
});

test("theme entitlement allows plan holders to save themes through the same API", async () => {
  const allowed = await postTheme(true, { themeGlobal: "AI_COSMIC_FUTURE" });
  if (allowed.response.statusCode !== 200)
    throw new Error(JSON.stringify(allowed.response.body));
  assert.equal(allowed.writes[0].siteId, CHILD);
  assert.equal(allowed.writes.some((row: any) => row.action === "PANEL_AUTO_RENEW_CHANGED"), false);
});
