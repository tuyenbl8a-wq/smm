import assert from "node:assert/strict";
import test from "node:test";
import { AdminOperationsService } from "../src/admin/operations.js";
import { AuthHandler } from "../src/auth/handler.js";
import { csrfValue } from "../src/auth/security.js";

const SITE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secret = "theme-tenant-isolation-secret";

function makeHarness() {
  const rows = new Map<string, any>();
  const setting = {
    findMany: async ({ where }: any) => [...rows.entries()]
      .filter(([key, value]) => key.startsWith(`${where.siteId}:`) && value.encrypted === false && (!where.key || key === `${where.siteId}:${where.key}`))
      .map(([key, value]) => ({ siteId: where.siteId, group: "general", key: key.split(":").slice(1).join(":"), value: value.value })),
    upsert: async ({ where, create, update }: any) => {
      const siteId = where.siteId_group_key.siteId;
      const key = where.siteId_group_key.key;
      rows.set(`${siteId}:${key}`, { value: update.value ?? create.value, encrypted: false });
      return {};
    },
  };
  const db: any = {
    setting,
    panelSubscription: { findFirst: async () => null },
    panelRentalPlan: { findUnique: async () => null },
    site: { findUnique: async ({ where }: any) => ({ name: where.id === SITE_A ? "Tenant A" : "Tenant B" }) },
    siteDomain: { findFirst: async () => null },
    $transaction: async (fn: any) => fn({ setting, auditLog: { create: async () => ({}) } }),
  };
  const admin = new AdminOperationsService(db);
  const handlerFor = (siteId: string) => {
    const handler: any = new AuthHandler(
      {} as any,
      { apiUrl: new URL("http://localhost:3001"), sessionSecret: secret } as any,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      admin,
    );
    handler.authenticate = async () => ({
      user: { id: `admin-${siteId}`, siteId },
      access: { roles: ["ADMIN"], permissions: ["settings.view", "settings.manage"] },
      rawToken: `token-${siteId}`,
    });
    handler.csrf = () => undefined;
    return handler;
  };
  const call = async (siteId: string, method: "GET" | "POST", body?: unknown) => {
    const handler = handlerFor(siteId);
    const listeners = new Map<string, (...args: any[]) => void>();
    const csrf = csrfValue(`token-${siteId}`, secret);
    const req: any = {
      method,
      url: "/api/v1/admin/settings",
      headers: { "x-csrf-token": csrf, cookie: `smm_csrf=${csrf}` },
      socket: {},
      on: (event: string, listener: (...args: any[]) => void) => {
        listeners.set(event, listener);
        return req;
      },
    };
    if (method === "POST") setTimeout(() => {
      listeners.get("data")?.(Buffer.from(JSON.stringify(body ?? {})));
      listeners.get("end")?.();
    }, 0);
    const response: any = { setHeader() {}, end(value: string) { this.body = JSON.parse(value); } };
    const tenant = { id: siteId, siteNumber: 100001n, parentSiteId: "root", status: "ACTIVE", depth: 1 };
    await handler.handle(req, response, "/api/v1/admin/settings", tenant);
    return response;
  };
  return { rows, call, admin };
}

test("theme settings, drafts and custom blocks cannot cross tenant boundaries in either direction", async () => {
  const h = makeHarness();
  await h.admin.updateSettings("admin-a", {
    themeGlobal: "OCEAN_PREMIUM",
    themeDraft: {
      themeId: "OCEAN_PREMIUM", scope: "landing",
      overrides: { content: { customBlocks: [{ id: "block-site-a", section: "hero", type: "paragraph", value: "A private draft" }] } },
    },
    themeOverrides: {
      landing: { content: { nodes: { "hero.title": { text: "A title" } }, customBlocks: [{ id: "block-site-a", section: "hero", type: "paragraph", value: "A published block" }] } },
    },
  }, SITE_A);
  await h.admin.updateSettings("admin-b", {
    themeGlobal: "ZEN_JAPANESE",
    themeDraft: {
      themeId: "ZEN_JAPANESE", scope: "landing",
      overrides: { content: { customBlocks: [{ id: "block-site-b", section: "hero", type: "heading", value: "B private draft" }] } },
    },
    themeOverrides: {
      landing: { content: { nodes: { "hero.title": { text: "B title" } }, customBlocks: [{ id: "block-site-b", section: "hero", type: "heading", value: "B published block" }] } },
    },
  }, SITE_B);

  const aBefore = await h.call(SITE_A, "GET");
  const bBefore = await h.call(SITE_B, "GET");
  assert.equal(aBefore.body.data.find((x: any) => x.key === "themeGlobal").value, "OCEAN_PREMIUM");
  assert.equal(bBefore.body.data.find((x: any) => x.key === "themeGlobal").value, "ZEN_JAPANESE");
  assert.match(JSON.stringify(aBefore.body.data), /A private draft|A published block/);
  assert.doesNotMatch(JSON.stringify(aBefore.body.data), /B private draft|B published block|B title/);
  assert.match(JSON.stringify(bBefore.body.data), /B private draft|B published block/);
  assert.doesNotMatch(JSON.stringify(bBefore.body.data), /A private draft|A published block|A title/);

  const aWrite = await h.call(SITE_A, "POST", {
    siteId: SITE_B,
    themeGlobal: "BLACK_GOLD_LUXURY",
    themeDraft: {
      themeId: "BLACK_GOLD_LUXURY", scope: "landing",
      overrides: { content: { customBlocks: [{ id: "block-a-write", section: "hero", type: "paragraph", value: "A update" }] } },
    },
    themeOverrides: {
      landing: { content: { nodes: { "hero.title": { text: "A update" } }, customBlocks: [{ id: "block-a-write", section: "hero", type: "paragraph", value: "A update" }] } },
    },
  });
  const bWrite = await h.call(SITE_B, "POST", {
    siteId: SITE_A,
    themeGlobal: "PRISM_GLASS",
    themeDraft: {
      themeId: "PRISM_GLASS", scope: "landing",
      overrides: { content: { customBlocks: [{ id: "block-b-write", section: "hero", type: "paragraph", value: "B update" }] } },
    },
    themeOverrides: {
      landing: { content: { nodes: { "hero.title": { text: "B update" } }, customBlocks: [{ id: "block-b-write", section: "hero", type: "paragraph", value: "B update" }] } },
    },
  });
  assert.equal(aWrite.statusCode, 200);
  assert.equal(bWrite.statusCode, 200);
  assert.equal(h.rows.get(`${SITE_A}:themeGlobal`).value, "BLACK_GOLD_LUXURY");
  assert.equal(h.rows.get(`${SITE_B}:themeGlobal`).value, "PRISM_GLASS");
  assert.equal(h.rows.get(`${SITE_A}:themeOverrides`).value.landing.content.customBlocks[0].value, "A update");
  assert.equal(h.rows.get(`${SITE_B}:themeOverrides`).value.landing.content.customBlocks[0].value, "B update");
  assert.notEqual(h.rows.get(`${SITE_A}:themeDraft`).value.overrides.content.customBlocks[0].value, h.rows.get(`${SITE_B}:themeDraft`).value.overrides.content.customBlocks[0].value);

  await h.call(SITE_A, "POST", { themeOverrides: {} }); // reset only A
  assert.deepEqual(h.rows.get(`${SITE_A}:themeOverrides`).value, {});
  assert.equal(h.rows.get(`${SITE_B}:themeOverrides`).value.landing.content.nodes["hero.title"].text, "B update");
  await h.call(SITE_B, "POST", { themeOverrides: {} }); // reset only B
  assert.deepEqual(h.rows.get(`${SITE_B}:themeOverrides`).value, {});
});

test("the authenticated settings API applies a theme and merges only the editor override patch", async () => {
  const h = makeHarness();
  await h.admin.updateSettings("admin-a", {
    themeMode: "GLOBAL",
    themeGlobal: "AI_COSMIC_FUTURE",
    themeOverrides: {
      auth: { content: { nodes: { "auth.title": { text: "Đăng nhập riêng" } } } },
      customer: { colors: { accent: "#aa5500" } },
    },
  }, SITE_A);

  const applyBody = {
    themeMode: "GLOBAL",
    themeGlobal: "OCEAN_PREMIUM",
    themeOverrides: {
      colors: { primary: "#087ea4" },
      content: {},
      layout: {},
      typography: {},
    },
  };
  const applied = await h.call(SITE_A, "POST", applyBody);
  assert.equal(applied.statusCode, 200);
  assert.deepEqual(applied.body.data.updated, ["themeMode", "themeGlobal", "themeOverrides"]);
  assert.equal(h.rows.get(`${SITE_A}:themeMode`).value, "GLOBAL");
  assert.equal(h.rows.get(`${SITE_A}:themeGlobal`).value, "OCEAN_PREMIUM");
  assert.equal(h.rows.get(`${SITE_A}:themeOverrides`).value.colors.primary, "#087ea4");
  assert.equal(
    h.rows.get(`${SITE_A}:themeOverrides`).value.auth.content.nodes["auth.title"].text,
    "Đăng nhập riêng",
  );
  assert.equal(h.rows.get(`${SITE_A}:themeOverrides`).value.customer.colors.accent, "#aa5500");

  const reloaded = await h.call(SITE_A, "GET");
  assert.equal(reloaded.statusCode, 200);
  const persisted = new Map(reloaded.body.data.map((row: any) => [row.key, row.value]));
  assert.equal(persisted.get("themeGlobal"), "OCEAN_PREMIUM");
  assert.equal(persisted.get("themeMode"), "GLOBAL");
  assert.equal((persisted.get("themeOverrides") as any).colors.primary, "#087ea4");

  const referenceThemes = [
    "CREATOR_POP",
    "URBAN_LIME_BRUTAL",
    "CYBER_NEON_CITY",
    "PRISM_GLASS",
    "OCEAN_PREMIUM",
    "BLUE_BUSINESS",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "BEIGE_EDITORIAL",
  ];
  for (const theme of referenceThemes) {
    const result = await h.call(SITE_A, "POST", {
      themeMode: "GLOBAL",
      themeGlobal: theme,
    });
    assert.equal(result.statusCode, 200);
    const afterReload = await h.call(SITE_A, "GET");
    const settings = new Map(afterReload.body.data.map((row: any) => [row.key, row.value]));
    assert.equal(settings.get("themeMode"), "GLOBAL");
    assert.equal(settings.get("themeGlobal"), theme);
  }

  const separate = await h.call(SITE_A, "POST", {
    themeMode: "SEPARATE",
    themePublic: "OCEAN_PREMIUM",
    themeAuth: "BLACK_GOLD_LUXURY",
    themeCustomer: "ZEN_JAPANESE",
  });
  assert.equal(separate.statusCode, 200);
  const separateReload = await h.call(SITE_A, "GET");
  const separateSettings = new Map(separateReload.body.data.map((row: any) => [row.key, row.value]));
  assert.equal(separateSettings.get("themeMode"), "SEPARATE");
  assert.equal(separateSettings.get("themePublic"), "OCEAN_PREMIUM");
  assert.equal(separateSettings.get("themeAuth"), "BLACK_GOLD_LUXURY");
  assert.equal(separateSettings.get("themeCustomer"), "ZEN_JAPANESE");

  const invalid = await h.call(SITE_A, "POST", {
    themeGlobal: "CREATOR_POP",
    themeOverrides: { colors: { primary: "not-a-color" } },
  });
  assert.equal(invalid.statusCode, 422);
  assert.equal(invalid.body.error.code, "SETTING_INVALID");
  assert.match(invalid.body.error.message, /themeOverrides/);
  assert.equal(h.rows.get(`${SITE_A}:themeGlobal`).value, "BEIGE_EDITORIAL");
});
