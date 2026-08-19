import assert from "node:assert/strict";
import test from "node:test";
import { AdminOperationsService } from "../src/admin/operations.js";
import { stringifyJson } from "../src/http/json.js";
import { DepositService } from "../src/payment/service.js";
import { SupportService } from "../src/support/service.js";

test("shared JSON transport serializes nested bigint, decimal and dates", () => {
  const date = new Date("2026-08-19T00:00:00.000Z"),
    encoded = stringifyJson({
      id: 42n,
      nested: [{ amount: { toJSON: () => "1.25000000" }, date }],
    });
  assert.deepEqual(JSON.parse(encoded), {
    id: "42",
    nested: [{ amount: "1.25000000", date: date.toISOString() }],
  });
});

test("empty admin filters never reach Prisma as undefined enum strings", async () => {
  const seen: any[] = [],
    db: any = {
      user: {
        count: async ({ where }: any) => (seen.push(where), 0),
        findMany: async ({ where }: any) => (seen.push(where), []),
      },
      order: {
        count: async ({ where }: any) => (seen.push(where), 0),
        findMany: async ({ where }: any) => (seen.push(where), []),
      },
    },
    service = new AdminOperationsService(db);
  await service.users({ status: "undefined", role: "null", search: "" });
  await service.orders({ status: "undefined", provider: "null", search: "" });
  assert.deepEqual(seen, [{}, {}, {}, {}]);
  await assert.rejects(
    () => service.users({ status: "NOT_A_USER_STATUS" }),
    (error: any) => error.code === "USER_STATUS_INVALID",
  );
  await assert.rejects(
    () => service.orders({ status: "NOT_AN_ORDER_STATUS" }),
    (error: any) => error.code === "ORDER_STATUS_INVALID",
  );
});

test("deposit and support filters normalize empty values and reject invalid enums", async () => {
  const depositCalls: any[] = [],
    ticketCalls: any[] = [],
    deposits = new DepositService({
      deposit: {
        findMany: async (query: any) => (depositCalls.push(query), []),
      },
    }),
    support = new SupportService({
      ticket: {
        count: async ({ where }: any) => (ticketCalls.push(where), 0),
        findMany: async ({ where }: any) => (ticketCalls.push(where), []),
      },
    });
  await deposits.adminHistory({ status: "undefined" });
  await support.adminInbox({ status: "undefined", search: "null" });
  assert.equal(depositCalls[0].where, undefined);
  assert.deepEqual(ticketCalls, [{}, {}]);
  await assert.rejects(
    () => deposits.adminHistory({ status: "WRONG" }),
    (error: any) => error.code === "DEPOSIT_STATUS_INVALID",
  );
  await assert.rejects(
    () => support.adminInbox({ status: "WRONG" }),
    (error: any) => error.code === "STATUS_INVALID",
  );
});
