import assert from "node:assert/strict";
import test from "node:test";
import { ROOT_SITE_ID } from "../src/tenant/context.js";
import { SupportService } from "../src/support/service.js";
test("ticket list is scoped to customer", async () => {
  let where: any;
  const db = {
    ticket: { findMany: async (q: any) => ((where = q.where), []) },
  };
  await new SupportService(db).list("u");
  assert.deepEqual(where, {
    userId: "u",
    siteId: "00000000-0000-4000-8000-000000000001",
  });
});
test("attachments enforce MIME and size", () => {
  const s = new SupportService({});
  assert.throws(
    () =>
      s.validateAttachment({
        name: "x.exe",
        mime: "application/x-msdownload",
        size: 1,
      }),
    /Invalid/,
  );
  assert.equal(
    s
      .validateAttachment({ name: "x.png", mime: "image/png", size: 10 })
      .endsWith("-x.png"),
    true,
  );
});

test("notification unread operations stay scoped to the customer", async () => {
  const calls: any[] = [];
  const service = new SupportService({
    notification: {
      count: async (input: any) => {
        calls.push(input);
        return 2;
      },
      updateMany: async (input: any) => {
        calls.push(input);
        return { count: 2 };
      },
    },
  });
  assert.deepEqual(await service.unreadCount("customer"), { unread: 2 });
  assert.deepEqual(await service.markAllRead("customer"), { read: 2 });
  const expected = {
    userId: "customer",
    siteId: "00000000-0000-4000-8000-000000000001",
    readAt: null,
  };
  assert.deepEqual(calls[0].where, expected);
  assert.deepEqual(calls[1].where, expected);
});

test("private attachment access enforces ticket ownership while allowing staff", async () => {
  const service = new SupportService({
    attachment: {
      findUnique: async () => ({
        id: "a",
        ticketId: 1n,
        storageKey: "key",
        originalName: "invoice.pdf",
        mime: "application/pdf",
      }),
    },
    ticket: {
      findFirst: async ({ where }: any) => {
        assert.deepEqual(where, { id: 1n, siteId: ROOT_SITE_ID });
        return { id: 1n, userId: "owner" };
      },
    },
  });
  await assert.rejects(
    () => service.attachment("other", "a"),
    (error: any) => error.code === "ATTACHMENT_NOT_FOUND",
  );
  assert.equal((await service.attachment("admin", "a", true)).id, "a");
});
