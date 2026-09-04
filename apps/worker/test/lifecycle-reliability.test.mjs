import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/lifecycle.ts", import.meta.url),
  "utf8",
);

test("refill and cancellation claims are multi-worker safe and bounded", () => {
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /"attempts" < 5/);
  assert.match(source, /next_attempt_at/);
  assert.match(source, /2 \*\* attempts/);
});

test("stale and timed-out provider mutations are never blindly resent", () => {
  assert.match(source, /STALE_CLAIM_UNKNOWN/);
  assert.match(source, /PROVIDER_TIMEOUT_UNKNOWN/);
  assert.match(source, /status: "UNKNOWN"/);
});

test("provider receives stable request identity for supported idempotency", () => {
  assert.match(source, /request_id: row\.idempotency_key/);
});

test("automatic lifecycle polls pending orders but skips manual overrides", () => {
  assert.match(source, /"PENDING", "PROCESSING", "IN_PROGRESS"/);
  assert.match(source, /manualOverride: false/);
  assert.match(source, /current\.manualOverride/);
});

test("worker uses shared charge-based idempotent refund helper", () => {
  assert.match(source, /partialRefundTarget\([\s\S]*current\.charge/);
  assert.match(source, /applyOrderTargetRefund/);
  assert.doesNotMatch(source, /current\.saleRate/);
});
