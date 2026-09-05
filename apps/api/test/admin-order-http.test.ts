import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";
import { canAccessAdmin } from "../src/admin/dashboard.js";

function requestWithJson(method: string, path: string, value: unknown) {
  const listeners = new Map<string, (...args: any[]) => void>();
  const request: any = {
    method,
    url: path,
    socket: {},
    destroy: () => undefined,
    on: (event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
      return request;
    },
  };
  queueMicrotask(() => {
    listeners.get("data")?.(Buffer.from(JSON.stringify(value)));
    listeners.get("end")?.();
  });
  return request;
}

test("PATCH order JSON body preserves every manual-operation field", async () => {
  const handler = new AuthHandler(
    {} as any,
    {
      apiUrl: new URL("http://localhost:3001"),
      sessionSecret: "test-session-secret-with-enough-entropy",
    } as any,
  );
  const payload = {
    reason: "Kiểm tra cập nhật đơn",
    status: "PENDING",
    providerId: "11111111-1111-4111-8111-111111111111",
    providerOrderId: "provider-123",
    startCount: 42,
    remains: 8,
    manualOverride: true,
  };
  const parsed = await (handler as any).body(
    requestWithJson("PATCH", "/api/v1/admin/orders/100002", payload),
  );
  assert.deepEqual(parsed, payload);
});

test("all supported mutating verbs parse JSON while GET remains bodyless", async () => {
  const handler = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001") } as any,
  );
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    assert.deepEqual(
      await (handler as any).body(
        requestWithJson(method, "/api/v1/admin/orders/100002", { method }),
      ),
      { method },
    );
  assert.deepEqual(
    await (handler as any).body({
      method: "GET",
      url: "/api/v1/admin/orders/100002",
    }),
    {},
  );
});

test("order view, manage, sync, refund and retry permissions are independent", () => {
  const permissions = [
    "orders.view",
    "orders.manage",
    "orders.sync",
    "orders.refund",
    "orders.retry",
  ];
  for (const granted of permissions)
    for (const required of permissions)
      assert.equal(
        canAccessAdmin({ roles: ["STAFF"], permissions: [granted] }, required),
        granted === required,
      );
});
