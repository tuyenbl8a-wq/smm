import assert from "node:assert/strict";
import test from "node:test";
import { LocalStorage } from "../src/storage/local.js";

test("private storage fails closed in production", () => {
  assert.throws(
    () => new LocalStorage("/tmp/unused", true),
    /DURABLE_STORAGE_REQUIRED/,
  );
});

test("private storage rejects fake MIME and traversal before writing", async () => {
  const storage = new LocalStorage("/tmp/smm-storage-test");
  await assert.rejects(
    () => storage.put("../payload.png", "image/png", Buffer.from("not png")),
    /ATTACHMENT_INVALID/,
  );
  await assert.rejects(
    () => storage.put("payload.png", "image/png", Buffer.from("not png")),
    /MIME_MISMATCH/,
  );
});
