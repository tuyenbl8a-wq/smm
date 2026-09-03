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
  assert.match(page, /admin\/services\/'\+s\.id\+'\/edit/);
  assert.match(page, /data-override-name/);
  assert.match(page, /Dữ liệu đã đổi\. Hãy Xem trước lại/);
  assert.match(page, /overrides/);
  assert.match(page, /Người dùng & nhân sự/);
});
test("full service editor wires source, sync, pricing and remap controls", () => {
  assert.match(page, /function adminServiceEditorPage/);
  assert.match(page, /Nguồn dịch vụ/);
  assert.match(page, /API nhà cung cấp/);
  assert.match(page, /source-preview/);
  assert.match(page, /manualFields/);
  assert.match(page, /syncDescription/);
  assert.match(page, /PRICE_BELOW_SAFETY_FLOOR|minimum profit/);
  assert.match(page, /SERVICE_PROVIDER_REMAP|result\.action/);
  assert.match(page, /Cài đặt nâng cao/);
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
test("simple pricing UI hides technical engine controls and keeps preview/apply", () => {
  const pricingPage = page.slice(
    page.indexOf("export function adminPricingPage"),
  );
  assert.match(pricingPage, /function adminPricingPage/);
  assert.match(pricingPage, /pricing\/simple\/preview/);
  assert.match(pricingPage, /pricing\/simple\/apply/);
  assert.match(pricingPage, /previewSignature/);
  assert.match(pricingPage, /Khách hàng/);
  assert.match(pricingPage, /Đại lý/);
  assert.match(pricingPage, /NPP/);
  assert.match(pricingPage, /Cài đặt nâng cao/);
  assert.match(pricingPage, /name="platformId"/);
  assert.match(pricingPage, /function cascade/);
  assert.match(pricingPage, /mappedServiceIds/);
  assert.match(pricingPage, /Không có dịch vụ phù hợp với bộ lọc đã chọn/);
  assert.match(pricingPage, /compactMoney/);
  assert.doesNotMatch(pricingPage, /<b>Khách hàng<\/b><span>Lợi nhuận/);
  assert.doesNotMatch(pricingPage, /id="groupForm"/);
  assert.doesNotMatch(pricingPage, /name="pricingMode"/);
});
test("rendered scripts bind DOM nodes explicitly and omit empty enum filters", () => {
  assert.match(page, /document\.getElementById/);
  assert.match(
    page,
    /const search=byId\('search'\),orderUser=byId\('orderUser'\)/,
  );
  assert.match(page, /if\(selectedStatus\)q\.set\('status',selectedStatus\)/);
  assert.doesNotMatch(page, /status='\+status\.value/);
  assert.match(page, /document\.getElementById\(\$\{JSON\.stringify\(id\)\}\)/);
});

test("simplified admin UX keeps advanced capabilities permission-aware", () => {
  const navigation = page.slice(
    page.indexOf("const adminNavLink"),
    page.indexOf("export function adminModulePage"),
  );
  for (const label of [
    "Tổng quan",
    "Đơn hàng",
    "Dịch vụ",
    "Bảng giá",
    "Người dùng",
    "Nạp tiền / Thanh toán",
    "Nhà cung cấp",
    "Hỗ trợ",
    "Cài đặt",
  ])
    assert.match(navigation, new RegExp(label.replace("/", "\\/")));
  assert.doesNotMatch(navigation, /Mã giảm giá/);
  assert.match(page, /data-admin-permission="pricing\.manage"/);
  assert.match(page, /data-admin-permission="wallet\.manage"/);
  assert.match(page, /applyAdminPermissions/);
});

test("wallet adjustment lives in user detail and uses idempotent ledger API", () => {
  assert.match(page, /Số dư hiện tại/);
  assert.match(page, /Cộng tiền/);
  assert.match(page, /Trừ tiền/);
  assert.match(page, /Lịch sử số dư/);
  assert.match(page, /admin-wallet:'\+crypto\.randomUUID/);
  assert.match(page, /reason:data\.reason/);
  assert.match(page, /internalNote:data\.internalNote/);
  assert.match(page, /wallets\/\$\{id\}\/mutations/);
});
