import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../src/reseller/rate-limit.js";
import { LocalStorage } from "../src/storage/local.js";
test("distributed limiter namespaces and expires Redis counter", async () => {
  let n = 0,
    ttl = 0;
  const l = new DistributedRateLimiter({
    incr: async () => ++n,
    expire: async (_k, x) => (ttl = x),
  });
  assert.equal((await l.consume("k", 1)).allowed, true);
  assert.equal((await l.consume("k", 1)).allowed, false);
  assert.equal(ttl, 61);
});
test("attachment rejects traversal and fake MIME", async () => {
  const s = new LocalStorage("/tmp/smm-test");
  await assert.rejects(
    () => s.put("../x.png", "image/png", Buffer.from("evil")),
    /INVALID/,
  );
  await assert.rejects(
    () => s.put("x.png", "image/png", Buffer.from("evil")),
    /MIME/,
  );
});
