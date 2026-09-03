import assert from "node:assert/strict";
import test from "node:test";
import { DailySnapshotService, zonedDayBounds } from "../dist/index.js";

test("report boundaries honor UTC and Asia Ho Chi Minh", () => {
  assert.equal(
    zonedDayBounds("2026-08-19", "UTC").start.toISOString(),
    "2026-08-19T00:00:00.000Z",
  );
  assert.equal(
    zonedDayBounds("2026-08-19", "Asia/Ho_Chi_Minh").start.toISOString(),
    "2026-08-18T17:00:00.000Z",
  );
});

test("daily snapshot creation is an idempotent upsert", async () => {
  let upsert;
  const db = {
    order: {
      aggregate: async () => ({
        _sum: {
          charge: "10",
          providerCost: "4",
          profit: "6",
          refundedAmount: "1",
        },
        _count: 2,
      }),
      count: async ({ where }) => (where.status === "FAILED" ? 1 : 0),
    },
    deposit: { aggregate: async () => ({ _sum: { netAmount: "20" } }) },
    user: { count: async () => 3 },
    dailyReportSnapshot: {
      upsert: async (input) => ((upsert = input), input.create),
    },
  };
  const result = await new DailySnapshotService(db).build("2026-08-19", "UTC");
  assert.equal(result.revenue, "10");
  assert.equal(result.grossProfit, "6");
  assert.equal(result.depositAmount, "20");
  assert.equal(upsert.where.date_timezone.timezone, "UTC");
});

test("chart trend is ordered and bounded", async () => {
  let query;
  const service = new DailySnapshotService({
    dailyReportSnapshot: {
      findMany: async (input) => ((query = input), []),
    },
  });
  assert.deepEqual(await service.trend("UTC", "2026-08-01", "2026-08-19"), []);
  assert.deepEqual(query.orderBy, { date: "asc" });
  assert.equal(query.take, 366);
});
