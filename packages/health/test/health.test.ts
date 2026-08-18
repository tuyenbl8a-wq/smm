import assert from "node:assert/strict";
import test from "node:test";
import { endpointFromUrl, probeTcp } from "../src/index.js";
test("derives default infrastructure ports", () => {
  assert.deepEqual(endpointFromUrl(new URL("postgresql://db/smm")), {
    host: "db",
    port: 5432,
  });
  assert.deepEqual(endpointFromUrl(new URL("redis://cache")), {
    host: "cache",
    port: 6379,
  });
});
test("a closed endpoint is reported down", async () => {
  assert.equal(await probeTcp({ host: "127.0.0.1", port: 1 }, 100), false);
});
