import assert from "node:assert/strict";
import test from "node:test";
import { vietQrUrl, VietQrWebhook } from "../src/payment/vietqr.js";
test("VietQR URL encodes transfer content", () =>
  assert.equal(
    vietQrUrl("9704", "123", "10", "NAP ABC").includes("NAP%20ABC"),
    true,
  ));
test("invalid webhook signature is rejected before DB", async () =>
  await assert.rejects(
    () => new VietQrWebhook({}, "secret").process("{}", "bad"),
    /SIGNATURE/,
  ));
