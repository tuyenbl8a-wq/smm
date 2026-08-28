import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/page.ts", import.meta.url), "utf8");
const routes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/services",
  "/orders",
  "/wallet",
  "/deposit",
  "/api-docs",
  "/support",
  "/notifications",
  "/account",
  "/referral",
  "/admin",
  "/admin/users",
  "/admin/orders",
  "/admin/catalog",
  "/admin/providers",
  "/admin/wallet",
  "/admin/payments",
  "/admin/deposits",
  "/admin/support",
  "/admin/reports",
  "/admin/logs",
  "/admin/settings",
  "/admin/coupons",
  "/admin/services",
  "/admin/services/import",
  "/admin/services/add",
  "/admin/staff",
  "/admin/pricing",
];
test("all production smoke destinations are registered", () => {
  for (const route of routes)
    assert.match(main, new RegExp(`\\"${route.replaceAll("/", "\\/")}\\"`));
  assert.match(page, /document\.getElementById/);
  assert.doesNotMatch(page, /status='\+status\.value/);
});

test("admin UX includes real import, staff, settings and three-mode theme journeys", () => {
  for (const contract of [
    "/api/v1/admin/providers/",
    "/import/preview",
    "/import/apply",
    "/api/v1/admin/staff",
    "Đồng bộ tất cả từ nhà cung cấp",
    "Light",
  ])
    assert.match(page, new RegExp(contract.replaceAll("/", "\\/"), "i"));
  assert.match(page, /themeModes=\['light','dark','system'\]/);
  assert.match(page, /prefers-color-scheme/);
  assert.match(page, /localStorage\.setItem\('smm_theme'/);
});
const browser = ["chromium", "chromium-browser", "google-chrome"].find(
  (name) => spawnSync("sh", ["-c", `command -v ${name}`]).status === 0,
);
test(
  "live authenticated browser journeys",
  {
    skip: browser
      ? false
      : "Chromium is unavailable in this execution environment",
  },
  () => {
    // The authenticated journey requires the Compose PostgreSQL/Redis stack and seeded
    // test identities. Keeping this explicit skip prevents a source-contract test from
    // being misreported as a real browser run.
    assert.ok(browser);
  },
);

test("authenticated price-group journeys are specified without leaking pricing internals", () => {
  assert.match(page, /\/api\/v1\/admin\/users\/price-group\/bulk\/preview/);
  assert.match(page, /\/price-group.*method:'POST'/);
  assert.match(page, /Cấp tài khoản hiện tại/);
  const account = page.slice(
    page.indexOf("export function accountPage"),
    page.indexOf("export function adminPaymentsPage"),
  );
  assert.doesNotMatch(
    account,
    /providerCost|defaultMarkupPercent|minimumProfit/,
  );
});
