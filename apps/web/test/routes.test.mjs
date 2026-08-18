import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../src/page.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
test("all customer destinations use the shared customer navigation", () => {
  for (const route of [
    "/dashboard",
    "/services",
    "/orders",
    "/wallet",
    "/deposit",
    "/api-docs",
    "/support",
    "/notifications",
    "/account",
  ])
    assert.match(
      page,
      route === "/notifications"
        ? /href="\/notifications"/
        : new RegExp(`navLink\\(active, \\"${route.replace("/", "\\/")}\\"`),
    );
  for (const fn of [
    "walletPage",
    "servicesPage",
    "ordersPage",
    "featurePage",
    "orderDetailPage",
    "depositDetailPage",
    "accountPage",
  ])
    assert.match(page, new RegExp(`function ${fn}[^]*?customerNavigation`));
});
test("customer and admin routes remain independently available", () => {
  for (const route of [
    "/account",
    "/admin/payments",
    "/admin/catalog",
    "/admin/providers",
    "/admin/support",
  ])
    assert.match(main, new RegExp(`\\"${route.replaceAll("/", "\\/")}\\"`));
  assert.match(main, /adminProviderDetailPage/);
  assert.match(main, /providerRecord/);
});
test("navigation highlights active destinations and groups admin operations", () => {
  assert.match(page, /active === path/);
  assert.match(page, /VẬN HÀNH/);
  assert.match(page, /TÀI CHÍNH/);
  assert.match(page, /HỆ THỐNG/);
  assert.match(page, /customerNavigation\("\/deposit"\)/);
});
test("catalog and provider audit controls are wired to authenticated APIs", () => {
  assert.match(page, /catalog\/price-groups\/.*\/update/);
  assert.match(page, /data-rule/);
  assert.match(page, /data-mapping/);
  assert.match(page, /admin\/providers\/\$\{id\}/);
});
