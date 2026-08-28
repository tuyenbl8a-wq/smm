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
    "/referral",
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
    "referralPage",
  ])
    assert.match(page, new RegExp(`function ${fn}[^]*?customerNavigation`));
});
test("customer and admin routes remain independently available", () => {
  for (const route of [
    "/account",
    "/admin/payments",
    "/admin/catalog",
    "/admin/pricing",
    "/admin/providers",
    "/admin/support",
    "/admin/coupons",
  ])
    assert.match(main, new RegExp(`\\"${route.replaceAll("/", "\\/")}\\"`));
  assert.match(main, /adminProviderDetailPage/);
  assert.match(main, /providerRecord/);
});
test("navigation highlights active destinations and groups admin operations", () => {
  assert.match(page, /active === path/);
  assert.match(page, /Đơn hàng/);
  assert.match(page, /Dịch vụ/);
  assert.match(page, /Cài đặt/);
  assert.match(page, /themeCycle/);
  assert.match(page, /customerNavigation\("\/deposit"\)/);
});
test("catalog and provider audit controls are wired to authenticated APIs", () => {
  assert.match(page, /catalog\/price-groups\/.*\/update/);
  assert.match(page, /data-rule/);
  assert.match(page, /data-mapping/);
  assert.match(page, /admin\/providers\/\$\{id\}/);
});
test("service administration follows platform-category-service and invalidates edited imports", () => {
  assert.match(page, /Nền tảng → Danh mục → Dịch vụ/);
  assert.match(page, /data-collapse/);
  assert.match(page, /serviceEditForm\.onsubmit/);
  assert.match(page, /data-override-name/);
  assert.match(page, /Dữ liệu đã đổi\. Hãy Xem trước lại/);
  assert.match(page, /overrides/);
  assert.match(page, /Người dùng & nhân sự/);
});
test("payment method form is adapter-specific and submits only visible fields", () => {
  assert.match(page, /data-adapters/);
  assert.match(page, /function applyAdapter/);
  assert.match(page, /control\.disabled=!show/);
  assert.match(page, /Cài đặt nâng cao/);
  assert.match(page, /Webhook Secure Token/);
  assert.match(page, /Bank BIN \/ acqId/);
  assert.match(page, /Chế độ tích hợp/);
  assert.match(page, /Hướng dẫn cấu hình/);
  assert.match(page, /READY_TO_TEST/);
  assert.match(page, /payment-methods\/'\+editing\+'\/test/);
});
test("professional pricing UI requires preview before transactional apply", () => {
  assert.match(page, /function adminPricingPage/);
  assert.match(page, /pricing\/bulk\/preview/);
  assert.match(page, /pricing\/bulk\/apply/);
  assert.match(page, /previewSignature/);
  assert.match(page, /Bảng giá chuyên nghiệp/);
  assert.match(page, /Cảnh báo giá/);
});
test("rendered scripts bind DOM nodes explicitly and omit empty enum filters", () => {
  assert.match(page, /document\.getElementById/);
  assert.match(page, /const search=byId\('search'\),from=byId\('from'\)/);
  assert.match(page, /if\(selectedStatus\)q\.set\('status',selectedStatus\)/);
  assert.doesNotMatch(page, /status='\+status\.value/);
  assert.match(page, /document\.getElementById\(\$\{JSON\.stringify\(id\)\}\)/);
});
