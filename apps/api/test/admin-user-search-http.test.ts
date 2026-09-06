import assert from "node:assert/strict";
import test from "node:test";
import { AuthHandler } from "../src/auth/handler.js";

const user = {
  id: "actor-id",
  username: "operator",
  email: "operator@example.com",
  status: "ACTIVE",
};

async function searchWith(permissions: string[]) {
  let called = 0;
  const admin = {
    customerSearch: async (search: unknown) => {
      called++;
      assert.equal(search, "#100001");
      return [
        {
          id: "customer-id",
          userNumber: "100001",
          username: "customer",
          email: "customer@example.com",
          status: "ACTIVE",
        },
      ];
    },
  };
  const handler = new AuthHandler(
    {} as any,
    { apiUrl: new URL("http://localhost:3001") } as any,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    admin as any,
  );
  (handler as any).authenticate = async () => ({
    user,
    access: { roles: ["STAFF"], permissions },
  });
  let payload = "";
  const response: any = {
    statusCode: 0,
    setHeader: () => undefined,
    end: (body: string) => {
      payload = body;
    },
  };
  await handler.handle(
    {
      method: "GET",
      url: "/api/v1/admin/users/search?search=%23100001",
    } as any,
    response,
    "/api/v1/admin/users/search",
  );
  return { status: response.statusCode, body: JSON.parse(payload), called };
}

test("customer lookup allows either user viewing or price-group management", async () => {
  for (const permission of ["users.view", "users.pricing.manage"]) {
    const result = await searchWith([permission]);
    assert.equal(result.status, 200);
    assert.equal(result.called, 1);
    assert.equal(result.body.data[0].userNumber, "100001");
  }
});

test("customer lookup rejects an actor without either permission", async () => {
  const result = await searchWith(["staff.manage"]);
  assert.equal(result.status, 403);
  assert.equal(result.called, 0);
  assert.equal(result.body.error.code, "PERMISSION_DENIED");
});
