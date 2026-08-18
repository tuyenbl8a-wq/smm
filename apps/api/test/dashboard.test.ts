import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivitySeries,
  subtractDecimal,
} from "../src/customer/dashboard.js";

test("dashboard activity always returns seven ordered UTC days", () => {
  const result = buildActivitySeries([], new Date("2026-08-18T12:00:00Z"));
  assert.equal(result.length, 7);
  assert.equal(result[0]?.date, "2026-08-12");
  assert.equal(result[6]?.date, "2026-08-18");
});

test("dashboard net spend subtracts refunds with decimal precision", () => {
  assert.equal(subtractDecimal("10.000001", "2.100000"), "7.900001");
});

test("dashboard activity aggregates orders and decimal charges without floats", () => {
  const result = buildActivitySeries(
    [
      { createdAt: new Date("2026-08-18T01:00:00Z"), charge: "1.125000" },
      { createdAt: new Date("2026-08-18T23:00:00Z"), charge: "2.000001" },
      { createdAt: new Date("2026-08-10T23:00:00Z"), charge: "99.000000" },
    ],
    new Date("2026-08-18T12:00:00Z"),
  );
  assert.deepEqual(result[6], {
    date: "2026-08-18",
    orders: 2,
    spent: "3.125001",
  });
});
