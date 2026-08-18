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
