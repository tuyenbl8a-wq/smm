import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const page = await readFile(
  new URL("../dist/page.js", import.meta.url),
  "utf8",
);
const components = await readFile(
  new URL("../dist/components.js", import.meta.url),
  "utf8",
);
const customer = await readFile(
  new URL("../dist/customer.js", import.meta.url),
  "utf8",
);
const client = await readFile(
  new URL("../dist/api-client.js", import.meta.url),
  "utf8",
);
const main = await readFile(
  new URL("../dist/main.js", import.meta.url),
  "utf8",
);
const admin = await readFile(
  new URL("../dist/admin.js", import.meta.url),
  "utf8",
);
const adminOperations = await readFile(
  new URL("../dist/admin-operations.js", import.meta.url),
  "utf8",
);
test("public experience includes real catalog, navigation and responsive UI", () => {
  assert.match(page, /api\/v1\/public\/catalog/);
  assert.match(page, /DỊCH VỤ CỦA CHÚNG TÔI/);
  assert.match(page, /3 bước/);
  assert.match(page, /CÂU HỎI THƯỜNG GẶP/);
  assert.match(components, /Public|header/i);
});
test("auth routes provide validation, password visibility and safe session fetch", () => {
  for (const route of [
    "login",
    "register",
    "forgot-password",
    "reset-password",
  ])
    assert.match(page, new RegExp(route));
  assert.match(page, /credentials:'include'/);
  assert.match(page, /checkValidity/);
  assert.match(page, /Hiện mật khẩu/);
  assert.doesNotMatch(page, /localStorage/);
});
test("operational errors are mapped to Vietnamese messages", () => {
  assert.match(page, /Email hoặc mật khẩu không đúng/);
  assert.doesNotMatch(page, /Failed to fetch/);
});
test("all customer routes and real modules are registered", () => {
  for (const route of [
    "dashboard",
    "orders/new",
    "orders",
    "services",
    "wallet",
    "deposit",
    "transactions",
    "affiliate",
    "api",
    "support",
    "notifications",
    "account",
  ])
    assert.match(main + customer, new RegExp(route.replace("/", "\\/")));
  for (const endpoint of [
    "customer/dashboard",
    "customer/catalog",
    "customer/orders",
    "customer/wallet",
    "customer/deposits",
    "customer/tickets",
    "customer/notifications",
    "auth/change-password",
    "auth/logout-others",
    "auth/logout",
  ])
    assert.match(customer, new RegExp(endpoint.replaceAll("/", "\\/")));
});
test("authenticated API client includes cookies, CSRF, timeout and normalized errors", () => {
  assert.match(client, /credentials:'include'/);
  assert.match(client, /x-csrf-token/);
  assert.match(client, /AbortController/);
  assert.match(client, /method:'PUT'/);
  assert.match(client, /method:'PATCH'/);
  assert.match(client, /method:'DELETE'/);
  assert.doesNotMatch(client + customer, /localStorage/);
  assert.doesNotMatch(client, /Failed to fetch|\[object Object\]/);
});
test("create order validates quantity and preserves one logical idempotency key", () => {
  assert.match(customer, /Number\.isSafeInteger/);
  assert.match(customer, /q<s\.min\|\|q>s\.max/);
  assert.match(customer, /if\(!orderKey\)orderKey=crypto\.randomUUID/);
  assert.match(customer, /idempotency-key/);
  assert.match(customer, /btn\.disabled=true/);
  assert.match(customer, /coupons\/preview/);
  assert.match(customer, /Backend sẽ xác nhận giá/);
});
test("orders support filters, pagination, selection and copy short IDs only", () => {
  for (const token of [
    "order-search",
    "order-status",
    "data-page",
    "select-all",
    "selectedIds",
  ])
    assert.match(customer, new RegExp(token));
  assert.match(customer, /replace\(\/\^#\//);
  assert.match(customer, /filter\(id=>\/\^\\d\{6,\}\$\//);
  assert.match(customer, /navigator\.clipboard\.writeText\(ids\.join/);
  assert.doesNotMatch(customer, /providerOrderId|providerCost/);
});
test("public pricing has search, platform/category filters, loading, retry and pagination", () => {
  for (const token of [
    "public-search",
    "public-platform",
    "public-category",
    "skeleton",
    "retry",
    "state.page",
    "URLSearchParams",
  ])
    assert.match(page, new RegExp(token.replace("-", "\\-")));
});
test("admin routes, shell and permission-aware navigation are registered", () => {
  for (const route of [
    "admin/orders",
    "admin/users",
    "admin/staff",
    "admin/services",
    "admin/platforms",
    "admin/categories",
    "admin/providers",
    "admin/price-groups",
    "admin/pricing",
    "admin/deposits",
    "admin/payment-methods",
    "admin/transactions",
    "admin/coupons",
    "admin/affiliate",
    "admin/support",
    "admin/reports",
    "admin/logs",
    "admin/settings",
  ])
    assert.match(main + admin, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(admin, /admin-shell/);
  assert.match(admin, /data-permission/);
  assert.match(admin, /SUPER_ADMIN/);
  assert.match(admin, /PERMISSION_DENIED/);
});
test("admin orders keep website IDs distinct and use protected operations", () => {
  assert.match(admin, /Website Order ID/);
  assert.match(admin, /Provider Order ID/);
  assert.match(admin, /providerOrderId/);
  assert.match(admin, /replace\(\/\^#\//);
  assert.match(admin, /filter\(id=>/);
  assert.match(admin, /\\d\{6,\}/);
  assert.match(admin, /navigator\.clipboard\.writeText\(ids\.join/);
  for (const operation of [
    "sync",
    "refund",
    "manualOverride",
    "targetRefundAmount",
    "idempotency-key",
  ])
    assert.match(admin, new RegExp(operation));
  assert.match(admin + client, /x-csrf-token/);
});
test("admin UI excludes secret fields and never stores sessions locally", () => {
  assert.match(
    admin,
    /password\|token\|secret\|credential\|encrypted\|authorization/,
  );
  assert.doesNotMatch(admin + client, /localStorage/);
  for (const secret of [
    "SESSION_SECRET",
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "DATABASE_URL",
    "POSTGRES_PASSWORD",
    "REDIS_URL",
  ])
    assert.doesNotMatch(admin, new RegExp(secret));
});
test("remaining admin modules use real mutation contracts", () => {
  for (const contract of [
    "staff/candidates",
    "admin/staff/",
    "price-group",
    "catalog/",
    "platforms",
    "categories",
    "services",
    "providers/",
    "import/preview",
    "import/apply",
    "pricing/simple/preview",
    "pricing/simple/apply",
    "admin/coupons",
    "admin/payment-methods",
    "tickets/",
    "retry-provider",
  ])
    assert.match(
      admin + adminOperations,
      new RegExp(contract.replaceAll("/", "\\/")),
    );
  for (const label of [
    "Hồ sơ",
    "Ví",
    "Đơn hàng",
    "Giao dịch",
    "Nhóm giá",
    "Affiliate",
    "Phiên đăng nhập",
  ])
    assert.match(adminOperations, new RegExp(label));
});
test("admin security recursively redacts nested secrets and allowlists settings", () => {
  assert.match(adminOperations, /function redact/);
  assert.match(adminOperations, /value\.map\(x=>redact/);
  assert.match(
    adminOperations,
    /password\|token\|secret\|credential\|authorization\|encrypted\|api\.\?key\|session/,
  );
  assert.match(adminOperations, /const allowed=\['siteName'/);
  assert.match(adminOperations, /apiKey:''/);
  assert.match(adminOperations, /type:'password'/);
});
