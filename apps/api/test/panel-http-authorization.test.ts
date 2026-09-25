import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";
import { TenantError } from "../src/tenant/context.js";
import { csrfValue } from "../src/auth/security.js";
import { PanelService } from "../src/tenant/panel-service.js";

const ROOT = "00000000-0000-4000-8000-000000000001";
const CHILD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function request(method: string, url: string, value?: unknown) {
  const listeners = new Map<string, (...args: any[]) => void>();
  const csrf = csrfValue("token", "test-secret-with-enough-entropy");
  const req: any = {
    method,
    url,
    headers: { cookie: "smm_csrf=" + csrf, "x-csrf-token": csrf },
    socket: {},
    on: (event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
      return req;
    },
  };
  if (value !== undefined)
    setTimeout(() => {
      listeners.get("data")?.(Buffer.from(JSON.stringify(value)));
      listeners.get("end")?.();
    }, 0);
  return req;
}

async function call(handler: any, method: string, path: string, access: any, tenantId = CHILD_A, body?: unknown, panelType: "PANEL" | "CHILD_PANEL" = tenantId === ROOT ? "PANEL" : "CHILD_PANEL") {
  handler.authenticate = async () => ({
    user: { id: "tenant-admin", siteId: tenantId },
    access,
    rawToken: "token",
  });
  handler.csrf = () => undefined;
  const response: any = {
    setHeader: () => undefined,
    end: (value: string) => (response.body = JSON.parse(value)),
  };
  await handler.handle(
    request(method, path, body),
    response,
    path.split("?")[0]!,
    { id: tenantId, siteNumber: 100001n, parentSiteId: tenantId === ROOT ? null : ROOT, panelType, status: "ACTIVE", depth: tenantId === ROOT ? 0 : 1 },
  );
  return response;
}

function handlerFor() {
  const calls: any[] = [];
  const panels: any = {
    assertResellerAccess: async (siteId: string) => siteId,
    adminPlans: async (siteId: string) => (calls.push(["list", siteId]), [{ id: siteId }]),
    adminPlan: async (siteId: string, id: string) => {
      calls.push(["detail", siteId, id]);
      if (id !== siteId) throw new TenantError("PLAN_NOT_FOUND", "Not found");
      return { id };
    },
    savePlan: async (siteId: string) => (calls.push(["save", siteId]), { id: siteId }),
    adminPanels: async () => (calls.push(["global-panels"]), []),
  };
  const handler: any = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, panels,
  );
  return { handler, calls };
}

test("PANEL reseller settings.manage can manage only plans scoped to its own site", async () => {
  const { handler, calls } = handlerFor();
  const manager = { roles: ["ADMIN"], permissions: ["settings.manage"] };
  assert.equal((await call(handler, "GET", "/api/v1/admin/panel-plans", manager, CHILD_A, undefined, "PANEL")).statusCode, 200);
  assert.equal((await call(handler, "POST", "/api/v1/admin/panel-plans", manager, CHILD_A, { code: "A" }, "PANEL")).statusCode, 201);
  assert.equal((await call(handler, "GET", `/api/v1/admin/panel-plans/${CHILD_A}`, manager, CHILD_A, undefined, "PANEL")).statusCode, 200);
  assert.equal((await call(handler, "GET", `/api/v1/admin/panel-plans/${CHILD_B}`, manager, CHILD_A, undefined, "PANEL")).statusCode, 404);
  assert.deepEqual(calls.slice(0, 3), [["list", CHILD_A], ["save", CHILD_A], ["detail", CHILD_A, CHILD_A]]);
});

test("SUPER_ADMIN retains global panel access while staff without settings.manage is denied", async () => {
  const { handler, calls } = handlerFor();
  assert.equal((await call(handler, "GET", "/api/v1/admin/panels", { roles: ["SUPER_ADMIN"], permissions: [] }, ROOT)).statusCode, 200);
  assert.equal((await call(handler, "GET", "/api/v1/admin/panels", { roles: ["ADMIN"], permissions: ["settings.manage"] }, ROOT)).statusCode, 403);
  assert.equal((await call(handler, "GET", "/api/v1/admin/panel-plans", { roles: ["STAFF"], permissions: ["settings.view"] })).statusCode, 403);
  assert.equal((await call(handler, "GET", "/api/v1/admin/panels", { roles: ["ADMIN"], permissions: ["settings.manage"] })).statusCode, 403);
  assert.deepEqual(calls, [["global-panels"]]);
});

test("CHILD_PANEL direct provider and mapping API calls are rejected before any provider method runs", async () => {
  const calls: any[] = [];
  const providers: any = new Proxy({}, {
    get: (_target, method) => async (...args: any[]) => (calls.push([method, ...args]), []),
  });
  const handler: any = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any,
    undefined, undefined, providers,
  );
  const access = { roles: ["ADMIN"], permissions: ["providers.manage", "services.import"] };
  const providerId = "11111111-1111-4111-8111-111111111111";
  const routes: Array<[string, string, unknown?]> = [
    ["GET", "/api/v1/admin/providers"],
    ["GET", `/api/v1/admin/providers/${providerId}`],
    ["GET", `/api/v1/admin/providers/${providerId}/services`],
    ["GET", `/api/v1/admin/providers/${providerId}/sync-logs`],
    ["POST", "/api/v1/admin/providers", { apiUrl: "https://provider.example", apiKey: "secret" }],
    ["PATCH", `/api/v1/admin/providers/${providerId}`, { apiUrl: "https://provider.example", apiKey: "new-secret" }],
    ["POST", `/api/v1/admin/providers/${providerId}/sync`, {}],
    ["POST", `/api/v1/admin/providers/${providerId}/import/preview`, {}],
    ["POST", `/api/v1/admin/providers/${providerId}/import/apply`, {}],
    ["POST", `/api/v1/admin/services/${providerId}/source-preview`, { providerServiceId: "external" }],
  ];

  for (const [method, path, body] of routes) {
    const response = await call(handler, method, path, access, CHILD_A, body);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error.code, "CHILD_PANEL_PROVIDER_FORBIDDEN");
  }
  assert.deepEqual(calls, []);
});

test("PANEL with provider permission retains provider functionality and tenant scope", async () => {
  const calls: any[] = [];
  const providers: any = {
    list: async (siteId: string) => (calls.push(["list", siteId]), [{ id: "owned-provider" }]),
  };
  const handler: any = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any,
    undefined, undefined, providers,
  );
  const response = await call(
    handler,
    "GET",
    "/api/v1/admin/providers",
    { roles: ["ADMIN"], permissions: ["providers.view"] },
    CHILD_A,
    undefined,
    "PANEL",
  );
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [["list", CHILD_A]]);
});

test("renew endpoint rejects a missing idempotency key before touching billing data", async () => {
  const service = new PanelService({} as any, {} as any);
  const panels: any = {
    renew: (siteId: string, userId: string, _number: string, key: string) =>
      service.renew(siteId, userId, key),
  };
  const handler: any = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, panels,
  );
  const response = await call(handler, "POST", "/api/v1/customer/panels/100001/renew", { roles: ["CUSTOMER"], permissions: [] });
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error.code, "IDEMPOTENCY_KEY_INVALID");
});


test("reseller conversion routes pass the authenticated seller scope and require resale permission", async () => {
  const calls: any[] = [];
  const panels: any = {
    assertResellerAccess: async (siteId: string) => siteId,
    panelTypeConversionPreview: async (...args: any[]) => (calls.push(["preview", ...args]), {}),
    convertPanelType: async (...args: any[]) => (calls.push(["convert", ...args]), {}),
  };
  const handler: any = new AuthHandler({} as any, { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, panels);
  const path = "/api/v1/admin/panels/100001/type";
  const access = { roles: ["ADMIN"], permissions: ["panels.resale.manage"] };
  assert.equal((await call(handler, "GET", path + "-preview?targetType=PANEL", access, CHILD_A, undefined, "PANEL")).statusCode, 200);
  assert.equal((await call(handler, "PATCH", path, access, CHILD_A, { panelType: "PANEL", reason: "Upgrade" }, "PANEL")).statusCode, 200);
  assert.deepEqual(calls, [["preview", "100001", "PANEL", CHILD_A], ["convert", "tenant-admin", "100001", "PANEL", "Upgrade", CHILD_A]]);
  assert.equal((await call(handler, "PATCH", path, { roles: ["CUSTOMER"], permissions: [] }, CHILD_A, undefined, "PANEL")).statusCode, 403);
  assert.equal((await call(handler, "GET", path + "-preview?targetType=PANEL", access)).statusCode, 403);
  assert.equal(calls.length, 2);
});

test("provider handler uses exactly one tenant argument for every provider operation", async () => {
  const calls: any[] = [];
  const providers: any = new Proxy({}, { get: (_target, method) => async (...args: any[]) => (calls.push([method, ...args]), {}) });
  const handler: any = new AuthHandler({} as any, { apiUrl: new URL("http://localhost:3001"), sessionSecret: "test-secret-with-enough-entropy" } as any, undefined, undefined, providers);
  const access = { roles: ["ADMIN"], permissions: ["providers.manage"] };
  const base = "/api/v1/admin/providers/" + CHILD_B;
  for (const [method, suffix, name, expected] of [
    ["GET", "/services", "fetchServices", [CHILD_A, CHILD_B, {}]],
    ["GET", "/sync-logs", "syncLogs", [CHILD_A, CHILD_B, 1]],
    ["POST", "/import/preview", "importPreview", [CHILD_A, CHILD_B, {}]],
    ["POST", "/import/apply", "importApply", ["tenant-admin", CHILD_A, CHILD_B, {}]],
    ["POST", "", "update", ["tenant-admin", CHILD_A, CHILD_B, {}]],
  ] as const) {
    const response = await call(handler, method, base + suffix, access, CHILD_A, method === "POST" ? {} : undefined, "PANEL");
    assert.deepEqual({ name, status: response.statusCode, error: response.body.error }, { name, status: 200, error: undefined });
    assert.deepEqual(calls.at(-1), [name, ...expected]);
  }
});
