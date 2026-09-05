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
    /const websiteOrder=byId\('websiteOrder'\),providerOrder=byId\('providerOrder'\)/,
  );
  assert.match(page, /q\.set\('status',selectedStatus\)/);
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
    "Khách hàng",
    "Thanh toán",
    "Nhà cung cấp",
    "Hỗ trợ",
    "Cài đặt",
  ])
    assert.match(navigation, new RegExp(label.replace("/", "\\/")));
  assert.match(navigation, /Mã giảm giá/);
  assert.match(page, /data-admin-permission="pricing\.manage"/);
  assert.match(page, /data-admin-permission="users\.balance\.manage"/);
  assert.match(page, /applyAdminPermissions/);
});

test("wallet adjustment lives in user detail and uses idempotent ledger API", () => {
  assert.match(page, /Số dư hiện tại/);
  assert.match(page, /Cộng tiền/);
  assert.match(page, /Trừ tiền/);
  assert.match(page, /Lịch sử số dư/);
  assert.match(page, /admin-wallet:'\+crypto\.randomUUID/);
  assert.match(page, /idempotency-key/);
  assert.match(page, /reason/);
  assert.match(page, /wallets\/\$\{id\}\/mutations/);
});

test("short order routes keep customer actions and admin operations distinct", () => {
  assert.match(main, /adminUserRecord = \/\^\\\/admin\\\/users/);
  assert.match(main, /adminOrderRecord = \/\^\\\/admin\\\/orders/);
  assert.match(page, /customer\/orders\/'\+x\.publicId\+'\/'\+a/);
  for (const action of [
    "Cập nhật từ NCC",
    "Xem chi tiết",
    "ghi đè thủ công",
    "Hoàn tiền",
  ])
    assert.match(page, new RegExp(action));
  assert.match(page, /admin\/orders\/'\+ref\+'\/sync/);
  assert.match(page, /method:'PATCH'/);
});

test("redesigned admin orders exposes real filters, action dropdown and fixed-point refund modal", () => {
  for (const label of [
    "Thủ công",
    "Lỗi",
    "Mã đơn website",
    "Mã đơn NCC",
    "Đổi trạng thái",
    "Cập nhật từ NCC",
    "Chỉnh Start count",
    "Chỉnh Remains",
    "Hoàn tiền",
    "Xem lịch sử",
  ])
    assert.match(page, new RegExp(label));
  assert.match(page, /moneyUnits\(o\.charge\)\*BigInt/);
  assert.match(page, /data-action="status"/);
  assert.match(page, /orderModal/);
  assert.doesNotMatch(page, /\b(?:window\.)?prompt\s*\(/);
});

test("customer detail has operational profile, statistic cards and all requested tabs", () => {
  for (const label of [
    "Tổng quan",
    "Nạp tiền / Điều chỉnh số dư",
    "Giá riêng",
    "Lịch sử đăng nhập",
    "Giao dịch",
    "Đơn hàng",
    "Referral",
    "Audit log",
    "Tổng bonus",
    "Tổng hoàn tiền",
  ])
    assert.match(page, new RegExp(label.replaceAll("/", "\\/")));
  for (const tier of ["CUSTOMER", "AGENT", "DISTRIBUTOR"])
    assert.match(page, new RegExp(tier));
  assert.match(page, /userModal/);
  assert.match(page, /walletModal/);
});

test("staff RBAC UI groups effective permissions and requires reason", () => {
  assert.match(page, /permissionGroups/);
  assert.match(page, /data-all/);
  assert.match(page, /Lý do/);
  assert.match(page, /thu hồi session/i);
  assert.match(page, /Nâng tài khoản hiện có/);
  assert.match(page, /admin\/staff\/candidates/);
  assert.match(page, /value="CUSTOMER">Hạ về khách hàng/);
});

test("final admin UX includes provider assignment, live status counts and secure profile password flow", () => {
  assert.match(page, /admin\/orders\/providers/);
  assert.match(page, /name="providerId"/);
  assert.match(page, /statusCounts/);
  assert.match(page, /manualCount/);
  assert.match(page, /status-completed/);
  assert.match(page, /name="newPassword"/);
  assert.match(page, /Phương thức điều chỉnh/);
  assert.match(page, /rolePermissions/);
  assert.match(page, /directPermissions/);
});

test("admin shell uses accessible overlays without native browser dialogs", () => {
  assert.match(page, /function confirmDialog/);
  assert.match(page, /aria-modal/);
  assert.match(page, /event\.key==='Escape'/);
  assert.match(page, /nav::-webkit-scrollbar/);
  assert.doesNotMatch(page, /\b(?:window\.)?(?:prompt|alert|confirm)\s*\(/);
});

test("service operations use real modal forms and authenticated toggle API", () => {
  for (const contract of [
    'id="platformModal"',
    'id="categoryModal"',
    "data-service-toggle",
    "/api/v1/admin/catalog/platforms",
    "/api/v1/admin/catalog/categories",
    "/api/v1/admin/catalog/services/",
    "confirmDialog",
  ])
    assert.match(page, new RegExp(contract.replaceAll("/", "\\/")));
  assert.doesNotMatch(page, /window\.(?:prompt|alert|confirm)\s*\(/);
});

test("shared service form supports Manual, provider source, three tiers and clone", () => {
  for (const contract of [
    'name="source"',
    'value="MANUAL"',
    'value="API"',
    'name="providerServiceId"',
    '"CUSTOMER"',
    '"AGENT"',
    '"DISTRIBUTOR"',
    "100000000n",
    "sticky-actions",
    "data-service-clone",
    "cloneId",
    "servicePageLabel",
    "Giá CUSTOMER",
    'id="providerSearch"',
    "cloneDetail",
    "Nhân bản dịch vụ",
    "Giá AGENT",
    "Giá NPP",
    "Thời gian TB",
    "servicePrevious",
    "serviceNext",
    "result.failed",
  ])
    assert.match(page, new RegExp(contract.replaceAll("/", "\\/")));
});

test("service editor requires audited reason and uses the same three-tier fields", () => {
  const editor = page.slice(
    page.indexOf("export function adminServiceEditorPage"),
    page.indexOf("export function adminServiceImportPage"),
  );
  assert.match(editor, /name="reason"/);
  assert.match(editor, /CUSTOMER/);
  assert.match(editor, /AGENT/);
  assert.match(editor, /DISTRIBUTOR/);
  assert.match(editor, /name="providerServiceId"/);
  assert.match(editor, /name="categoryId"/);
  assert.match(editor, /sticky-actions/);
});

test("orders script is isolated and uses page-specific identifiers before loading API data", () => {
  const start = page.indexOf("orders: `");
  const orders = page.slice(start, page.indexOf("reports:", start));
  assert.match(orders, /orders: `\(\(\)=>\{/);
  assert.match(orders, /orderStatusFilters/);
  assert.match(orders, /ordersContent/);
  assert.match(orders, /\/api\/v1\/admin\/orders\?/);
  assert.match(orders, /load\(1\)\}\)\(\)`/);
  assert.doesNotMatch(orders, /\bconst statuses\b/);
  assert.doesNotMatch(orders, /\bconst content\b/);
});

test("order action modal exposes only task-specific fields and provider retry is permission scoped", () => {
  const start = page.indexOf("orders: `");
  const orders = page.slice(start, page.indexOf("reports:", start));
  assert.match(page, /\[hidden\]\{display:none!important\}/);
  assert.match(
    orders,
    /for\(const el of \[statusField,providerField,providerOrderField,startField,remainsField,targetField\]\)el\.hidden=true/,
  );
  assert.match(
    orders,
    /mode==='provider'.*providerField\.hidden=false.*providerOrderField\.hidden=false/,
  );
  assert.match(orders, /mode==='retry'/);
  assert.match(orders, /data-admin-permission="orders\.retry"/);
  assert.match(orders, /\/retry-provider/);
  assert.match(orders, /idempotency-key/);
});

test("admin orders copies only selected short IDs with page-scoped select-all state", () => {
  const start = page.indexOf("orders: `");
  const orders = page.slice(start, page.indexOf("reports:", start));
  for (const text of [
    "Chọn tất cả đơn trên trang",
    "Đã chọn ",
    "Sao chép mã đã chọn",
    "Sao chép tất cả mã trên trang",
    "Bỏ chọn",
    "Đã sao chép ",
    "Không thể sao chép mã đơn. Vui lòng thử lại.",
  ])
    assert.match(orders, new RegExp(text.replaceAll(".", "\\.")));
  assert.match(orders, /numbers\.join\('\\n'\)/);
  assert.match(orders, /selectAllOrders\.indeterminate/);
  assert.match(orders, /resetSelection\(\);ordersContent/);
  assert.match(orders, /String\(o\.orderNumber\)/);
  assert.doesNotMatch(orders, /copyOrderNumbers\([^)]*providerOrderId/);
});
