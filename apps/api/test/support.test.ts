import assert from "node:assert/strict";
import test from "node:test";
import { SupportService } from "../src/support/service.js";
test("ticket list is scoped to customer", async () => {
  let where: any;
  const db = {
    ticket: { findMany: async (q: any) => ((where = q.where), []) },
  };
  await new SupportService(db).list("u");
  assert.deepEqual(where, { userId: "u" });
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
  assert.deepEqual(calls[0].where, { userId: "customer", readAt: null });
  assert.deepEqual(calls[1].where, { userId: "customer", readAt: null });
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
    ticket: { findUnique: async () => ({ id: 1n, userId: "owner" }) },
  });
  await assert.rejects(
    () => service.attachment("other", "a"),
    (error: any) => error.code === "ATTACHMENT_NOT_FOUND",
  );
  assert.equal((await service.attachment("admin", "a", true)).id, "a");
});
