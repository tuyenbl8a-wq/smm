import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { adminPage } from "../dist/admin.js";
import { landingPage, authPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { tenantBranding } from "../dist/branding.js";
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
const customerUx = await readFile(
  new URL("../dist/customer-ux.js", import.meta.url),
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
const adminUx = await readFile(
  new URL("../dist/admin-ux.js", import.meta.url),
  "utf8",
);
const inlineAdminScript = (route) => {
  const html = adminPage("", route);
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, `missing inline script for ${route}`);
  return match[1];
};

test("server-rendered branding is tenant-safe across public, auth, customer and admin shells", () => {
  const root = tenantBranding("dichvu1st.com");
  const tenant = tenantBranding("smmlike.site");
  const custom = tenantBranding("panel.test", {
    brandName: "Panel Sao",
    logoUrl: "https://cdn.test/logo.png",
    faviconUrl: "https://cdn.test/icon.png",
  });
  assert.match(landingPage("", root), /DichVu1st/);
  for (const html of [
    landingPage("", tenant),
    authPage("", "login", "", tenant),
    customerPage("", "/dashboard", tenant),
    adminPage("", "/admin", tenant),
  ]) {
    assert.match(html, /smmlike\.site/i);
    assert.doesNotMatch(html, />DichVu1st</);
  }
  const branded = authPage("", "login", "", custom);
  assert.match(branded, /Panel Sao/);
  assert.match(branded, /https:\/\/cdn\.test\/logo\.png/);
  assert.match(branded, /https:\/\/cdn\.test\/icon\.png/);
  assert.equal(tenant.monogram, "S");
});

test("managed upstream settings expose safe metadata and permission-gated rotation", () => {
  assert.match(adminUx, /Kết nối Panel cha/);
  assert.match(adminUx, /can\('settings\.manage'\)/);
  assert.match(adminUx, /api\.post\('\/api\/v1\/admin\/managed-upstream'/);
  assert.doesNotMatch(adminUx, /apiKeyEncrypted|raw API key|provider secret/i);
});

test("sidebar groups persist collapsed state and active group opens automatically", () => {
  assert.match(admin, /localStorage\.getItem\(key\)/);
  assert.match(admin, /localStorage\.setItem\(key,heading\.dataset\.open\)/);
  assert.match(admin, /active\?'true'/);
  assert.match(admin, /section-collapsed/);
});

test("generated Admin scripts parse as real JavaScript on operational routes", () => {
  for (const route of [
    "/admin/orders",
    "/admin/orders/100002",
    "/admin/panels",
    "/admin/panel-plans",
    "/admin/panel-subscriptions",
  ]) {
    assert.doesNotThrow(() => new vm.Script(inlineAdminScript(route)), route);
  }
});

test("resolved Admin API data replaces the initial loading skeleton", async () => {
  const contentNode = { innerHTML: "<div class=admin-skeleton></div>" };
  const simpleNode = {
    textContent: "",
    hidden: false,
    classList: { add() {}, remove() {}, toggle() {} },
  };
  const document = {
    cookie: "",
    body: simpleNode,
    documentElement: simpleNode,
    createElement: () => ({
      _text: "",
      innerHTML: "",
      set textContent(value) {
        this._text = String(value);
        this.innerHTML = this._text;
      },
    }),
    querySelector: (selector) =>
      selector === "#content"
        ? contentNode
        : [".admin-scrim", ".admin-side nav a:not([hidden])"].includes(selector)
          ? simpleNode
          : null,
    querySelectorAll: () => [],
  };
  const responses = [
    {
      user: { username: "owner" },
      roles: ["ADMIN"],
      permissions: ["settings.manage", "panels.resale.manage"],
    },
    { items: [] },
  ];
  const context = {
    document,
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: responses.shift() }),
    }),
    AbortController,
    AbortSignal,
    URL,
    URLSearchParams,
    FormData,
    Intl,
    Date,
    Set,
    WeakSet,
    Promise,
    crypto,
    navigator: { clipboard: { writeText: async () => undefined } },
    location: { pathname: "/admin/panel-plans", href: "" },
    setTimeout,
    clearTimeout,
    drawerToggle: simpleNode,
    themeToggle: simpleNode,
    refresh: simpleNode,
    adminName: simpleNode,
    adminRole: simpleNode,
    avatar: simpleNode,
  };
  context.window = context;
  new vm.Script(inlineAdminScript("/admin/panel-plans")).runInNewContext(context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.doesNotMatch(contentNode.innerHTML, /admin-skeleton/);
  assert.match(contentNode.innerHTML, /Chưa có dữ liệu/);
});
const adminRefinementStyles = await readFile(
  new URL("../dist/admin-refinement-styles.js", import.meta.url),
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
    "orders/bulk",
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
test("mass order uses a four-step validated preview and the authoritative order path", () => {
  for (const token of [
    "Đặt hàng số lượng lớn",
    "Phân tích & kiểm tra",
    "bulk-preview",
    "Number.isSafeInteger(quantity)",
    "quantity<Number(service.min)",
    "bulkBatchId",
    "Kết quả từng dòng",
  ])
    assert.match(
      customer,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  assert.match(customer, /api\/v1\/customer\/orders/);
  assert.match(
    customer,
    /'idempotency-key':'bulk:'\+bulkBatchId\+':'\+row\.line/,
  );
  assert.doesNotMatch(customer, /api\/v1\/customer\/orders\/bulk/);
});
test("authenticated API client includes cookies, CSRF, timeout and normalized errors", () => {
  assert.match(client, /credentials:'include'/);
  assert.match(client, /x-csrf-token/);
  assert.match(client, /AbortController/);
  assert.match(client, /method:'PUT'/);
  assert.match(client, /method:'PATCH'/);
  assert.match(client, /method:'DELETE'/);
  assert.doesNotMatch(client, /localStorage/);
  assert.match(customer, /panel-renew:/);
  assert.match(customer, /localStorage\.getItem\(storageKey\)/);
  assert.match(customer, /localStorage\.removeItem\(storageKey\)/);
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
  for (const operation of [
    "Cập nhật từ NCC",
    "Gửi lại NCC",
    "Start Count",
    "confirmClearProviderOrderId",
    "Full history / audit trail",
    "bulkStatus",
    "bulkSync",
    "bulkRetry",
    "bulkTag",
    "bulkClearTags",
    "selectedStats",
  ])
    assert.match(admin, new RegExp(operation));
  assert.match(admin, /UNKNOWN.*không tự gửi lại/);
});
test("admin UI excludes secret fields and never stores sessions locally", () => {
  assert.match(
    admin,
    /password\|token\|secret\|credential\|encrypted\|authorization/,
  );
  assert.doesNotMatch(admin + client, /localStorage\.(?:setItem|getItem)\([^)]*(?:token|session|secret)/i);
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

test("price-group customer lookup uses the dedicated user search endpoint", () => {
  assert.match(adminOperations, /admin\/users\/search/);
  const priceGroupModule = adminOperations.slice(
    adminOperations.indexOf("function renderPriceGroups"),
    adminOperations.indexOf("function renderSettings"),
  );
  assert.doesNotMatch(priceGroupModule, /staff\/candidates/);
  assert.doesNotMatch(
    priceGroupModule,
    /x\.id[^\n]{0,80}(innerHTML|textContent)/,
  );
});
test("admin security recursively redacts nested secrets and allowlists settings", () => {
  assert.match(adminOperations, /function redact/);
  assert.match(adminOperations, /value\.map\(x=>redact/);
  assert.match(
    adminOperations,
    /password\|token\|secret\|credential\|authorization\|encrypted\|keyhash\|cookie/,
  );
  assert.match(adminOperations, /siteName:'Tên website'/);
  assert.match(adminOperations, /apiKey:'',active/);
  assert.match(adminOperations, /type:'password'/);
});
test("admin runtime UX avoids native prompts and protects responsive layout", () => {
  assert.doesNotMatch(admin + adminOperations, /\b(prompt|alert|confirm)\s*\(/);
  assert.match(adminOperations, /candidateSearch\.oninput/);
  assert.match(adminOperations, /Nâng tài khoản thành nhân viên/);
  assert.match(admin, /html,body\{max-width:100%;overflow-x:hidden\}/);
  assert.match(admin, /font-family:system-ui,-apple-system,BlinkMacSystemFont/);
  assert.match(admin, /\.admin-heading h1\{line-height:1\.25/);
  assert.match(
    admin,
    /\.admin-table\{width:100%;max-width:100%;overflow-x:auto/,
  );
});
test("admin renders real response shapes, relationships and localized tables", () => {
  for (const key of [
    "platforms",
    "categories",
    "services",
    "providers",
    "mappings",
    "priceGroups",
    "priceRules",
    "items",
    "messages",
  ])
    assert.match(adminOperations, new RegExp("['\"]" + key + "['\"]"));
  assert.match(adminOperations, /type:'select',options:options\(platforms\)/);
  assert.match(adminOperations, /type:'select',options:options\(categories\)/);
  assert.match(
    adminOperations,
    /providerServiceId',label:'Dịch vụ nhà cung cấp',type:'select'/,
  );
  assert.doesNotMatch(
    adminOperations,
    /label:'(Platform|Category|Provider|Service|Price Group) ID'/,
  );
  assert.match(adminOperations, /services\.create/);
  for (const label of ["Thêm nhà cung cấp", "Tạo mã giảm giá"])
    assert.match(adminOperations, new RegExp(label));
});
test("admin order identity and money formatting are presentation safe", () => {
  assert.match(admin, /o\.orderNumber\|\|o\.websiteOrderId/);
  assert.doesNotMatch(admin, /o\.publicId\|\|o\.websiteOrderId/);
  assert.match(admin, /currency:'VND',maximumFractionDigits:0/);
  assert.match(adminOperations, /label:'Số dư',render:r=>money\(r\.balance\)/);
});
test("super admin action renderers include real archive endpoints", () => {
  for (const endpoint of [
    "admin/catalog/",
    "admin/providers/",
    "admin/coupons/",
    "admin/payment-methods/",
  ])
    assert.match(adminOperations, new RegExp(endpoint.replaceAll("/", "\\/")));
  assert.match(adminOperations, /api\.delete\(path\)/);
  assert.match(adminOperations, /button\('Xóa','delete'/);
  for (const action of [
    "Thêm nhà cung cấp",
    "Tạo nhóm giá",
    "Thêm phương thức thanh toán",
    "Nâng tài khoản thành nhân viên",
  ])
    assert.match(adminOperations, new RegExp(action));
});
test("numeric public user and service IDs replace UUID presentation", () => {
  assert.match(admin, /"\/admin\/services"\s*:\s*"\/api\/v1\/admin\/catalog"/);
  assert.match(adminOperations, /label:'ID khách hàng'/);
  assert.match(adminOperations, /key:'serviceNumber',label:'Mã DV'/);
  assert.doesNotMatch(adminOperations, /id\?\.slice\(0,8\)/);
  assert.match(customer, /ID '\+esc\(s\.serviceNumber\)/);
  assert.match(customer, /esc\(s\.serviceNumber\)\+' — '/);
  assert.match(admin, /o\.user\?\.userNumber/);
  assert.match(admin, /o\.service\?\.serviceNumber/);
});
test("specialized admin renderer survives without generic overwrite", async () => {
  const { renderWithFallback } = await import("../dist/admin-render-flow.js");
  for (const route of [
    "/admin/users",
    "/admin/staff",
    "/admin/services",
    "/admin/payment-methods",
  ]) {
    const calls = [];
    renderWithFallback(
      route,
      () => calls.push("specialized"),
      () => calls.push("fallback"),
    );
    assert.deepEqual(calls, ["specialized"]);
  }
  const calls = [];
  renderWithFallback(
    "/admin/unknown",
    () => calls.push("specialized"),
    () => calls.push("fallback"),
  );
  assert.deepEqual(calls, ["fallback"]);
});
test("eleven final runtime themes are available and safely allowlisted", async () => {
  const themes = await import("../dist/themes.js");
  assert.equal(themes.themePresets.length, 11);
  assert.deepEqual(
    themes.themePresets.map((x) => x.id),
    themes.themeIds,
  );
  assert.match(
    themes.runtimeThemeScript("http://api", "public"),
    /public\/settings/,
  );
  assert.doesNotMatch(themes.themeStyles, /<script|javascript:/i);
  assert.match(adminOperations, /Bản xem trước không thay đổi/);
  assert.match(adminOperations, /Áp dụng.*cho website/);
});

test("customer and conditional payment workflows are behavioral and secret-safe", () => {
  assert.match(adminOperations, /\['ID khách hàng','#'\+safe\.userNumber\]/);
  assert.match(adminOperations, /Hồ sơ khách hàng/);
  assert.match(adminOperations, /Chuyển khoản ngân hàng/);
  assert.match(adminOperations, /Sử dụng VietQR nâng cao/);
  assert.match(adminOperations, /advanced\.checked/);
  assert.match(adminOperations, /Kết nối API Casso/);
  assert.match(adminOperations, /cassoToggle\.checked/);
  assert.match(adminOperations, /mode\.value!==['"]AUTO['"]/);
  for (const option of ["limits", "fees", "daily", "bonus"])
    assert.match(adminOperations, new RegExp(`\\['${option}','`));
  assert.match(adminOperations, /feeFixed\)\|\|nonzero\(draft\.feePercent/);
  assert.match(
    adminOperations,
    /dailyTransactionLimit\)\|\|nonzero\(draft\.dailyAmountLimit/,
  );
  assert.match(adminOperations, /secret\(n,l,extra=.*return input\(n,l,''/);
  assert.match(adminOperations, /Đã cấu hình · để trống để giữ nguyên/);
});

test("payment editor has responsive provider-specific structure", () => {
  assert.match(adminOperations, /classList\.add\('payment-editor-modal'\)/);
  assert.match(
    admin,
    /\.payment-editor-modal\{width:min\(900px,calc\(100vw - 32px\)\)/,
  );
  assert.match(adminOperations, /class="provider-choice"/);
  assert.match(adminOperations, /class="form-section ['"]\+kind\+['"]"/);
  assert.match(adminOperations, /bank-section/);
  assert.match(adminOperations, /type!==['"]BINANCE['"]/);
  assert.match(adminOperations, /if\(type===['"]BINANCE['"]\)/);
  assert.match(adminOperations, /CẤU HÌNH VIETQR NÂNG CAO/);
  assert.match(adminOperations, /KẾT NỐI CASSO/);
  assert.match(adminOperations, /KẾT NỐI API BINANCE/);
  assert.match(adminOperations, /input\(n,l,''\s*,false,['"]password['"]/);
  assert.doesNotMatch(adminOperations, /input\(n,l,configured\[n\]/);
  assert.match(admin, /input,select,button,\.admin-button\{min-height:44px\}/);
  assert.match(
    admin,
    /\.payment-editor \.form-grid\{grid-template-columns:1fr\}/,
  );
  assert.match(admin, /html,body\{max-width:100%;overflow-x:hidden\}/);
});

test("price groups use customer lookup and deposits expose real protected operations", () => {
  assert.match(adminOperations, /customerLookup/);
  assert.match(adminOperations, /staff\/candidates/);
  assert.match(adminOperations, /#100001, tên đăng nhập hoặc email/);
  assert.doesNotMatch(adminOperations, /name:'userIds'.*type:'textarea'/);
  for (const label of [
    "Xem chi tiết",
    "Duyệt",
    "Từ chối",
    "Đánh dấu cần kiểm tra",
  ])
    assert.match(adminOperations, new RegExp(label));
  assert.match(adminOperations, /admin\/deposits\/'\+id\+'\/action/);
  assert.match(adminOperations, /can\('payments\.manage'\)/);
});

test("task 24 typography, forms and Vietnamese business labels are complete", () => {
  assert.match(
    admin,
    /system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif/,
  );
  assert.match(
    admin,
    /html,body,button,input,select,textarea,table\{font-family/,
  );
  assert.doesNotMatch(admin, /margin:-62px 120px/);
  assert.match(
    admin,
    /dialog\{width:min\(calc\(100% - 32px\),720px\);max-width:720px;max-height:90vh/,
  );
  assert.match(
    admin,
    /\.form-grid\{display:grid;grid-template-columns:repeat\(2/,
  );
  assert.match(
    admin,
    /@media\(max-width:780px\)\{\.form-grid,\.profile-grid\{grid-template-columns:1fr\}/,
  );
  for (const label of [
    "CTV",
    "Đại lý",
    "NPP",
    "Giá vốn + phần trăm lợi nhuận",
    "Tự động đồng bộ nhà cung cấp",
    "Ngưỡng tăng giá tự động tối đa",
  ])
    assert.ok(adminOperations.includes(label));
});

test("task 24 customer operations use protected real endpoints", () => {
  for (const token of [
    "users.balance.manage",
    "users.pricing.manage",
    "wallets/",
    "mutations",
    "idempotency-key",
    "revoke-sessions",
    "price-group",
  ])
    assert.match(adminOperations, new RegExp(token.replace("/", "\\/")));
  for (const label of [
    "Tổng nạp",
    "Tổng chi",
    "Tổng hoàn",
    "Đơn hoàn thành",
    "Ví & giao dịch",
    "Lịch sử đăng nhập",
    "Nhật ký Admin",
  ])
    assert.match(adminOperations, new RegExp(label));
});

test("required theme architecture, safe preview and enum status contract", async () => {
  const themes = await import("../dist/themes.js");
  const required = [
    "AURORA_MODERN",
    "AI_COSMIC_FUTURE",
    "CREATOR_POP",
    "URBAN_LIME_BRUTAL",
    "OCEAN_PREMIUM",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "PRISM_GLASS",
    "BEIGE_EDITORIAL",
    "BLUE_BUSINESS",
    "CYBER_NEON_CITY",
  ];
  assert.deepEqual([...themes.themeIds], required);
  assert.equal(themes.themeIds.length, 11);
  assert.equal(new Set(themes.themeIds).size, 11);
  assert.deepEqual(themes.legacyThemeAliases, {});
  assert.equal(new Set(themes.themePresets.map((x) => x.name)).size, 11);
  for (const id of required) {
    const v = themes.themeStructure[id];
    for (const key of [
      "navigationVariant",
      "heroVariant",
      "authVariant",
      "sidebarVariant",
      "dashboardVariant",
      "serviceVariant",
      "orderFormVariant",
      "density",
    ])
      assert.equal(typeof v[key], "string");
  }
  const runtime = themes.runtimeThemeScript("http://api", "customer");
  assert.match(runtime, /Object\.entries\(variants\)/);
  assert.match(adminOperations, /data-device=.*desktop/);
  assert.match(adminOperations, /data-device=.*tablet/);
  assert.match(adminOperations, /if\(a==='preview'\)/);
  assert.match(adminOperations, /if\(a==='apply'/);
  assert.match(adminOperations, /oldSaleRate/);
  assert.match(adminOperations, /newSaleRate/);
  assert.doesNotMatch(adminOperations, /key:'oldRate'|key:'newRate'/);
});
test("panel customer and admin routes are wired", () => {
  for (const path of ["/panels", "/panels/new", "/panel-plans"])
    assert.match(customer, new RegExp(path.replace("/", "\\/")));
  for (const path of [
    "/admin/panels",
    "/admin/panel-plans",
    "/admin/panel-subscriptions",
  ])
    assert.match(admin, new RegExp(path.replaceAll("/", "\\/")));
  assert.ok(customer.indexOf("ĐẶT HÀNG") < customer.indexOf("THUÊ PANEL"));
  assert.doesNotMatch(customer, /ns[12]\.dichvu1st\.com/);
  assert.match(customer, /result\.nameservers/);
  assert.match(customer, /Không cần cấu hình CNAME hoặc TXT/);
  assert.match(customer, /auto-renew/);
});
test("customer panel detail rehydrates saved branding and renewal retries reuse one key", () => {
  assert.ok(customer.includes("branding=x.branding||{}"));
  assert.ok(customer.includes("branding.siteName||x.name"));
  assert.ok(customer.includes("branding.logo||''"));
  assert.ok(customer.includes("branding.siteDescription||''"));
  assert.ok(customer.includes("toast('Đã lưu thương hiệu');panelDetail()"));
  assert.ok(customer.includes("localStorage.getItem(storageKey)"));
  assert.ok(customer.includes("localStorage.removeItem(storageKey)"));
});
test("same-origin API proxy is constrained to API paths and fixed config target", () => {
  assert.match(main, /path\.startsWith\("\/api\/"\)/);
  assert.match(main, /new URL\(path\s*\+\s*url\.search, config\.apiUrl\)/);
  assert.match(main, /"x-api-key"/);
  assert.doesNotMatch(main, /searchParams\.get\(["'](?:url|target)/);
});
test("visual theme builder routes render real landing auth and customer architectures", async () => {
  const builder = await import("../dist/theme-builder.js");
  for (const removed of ["DARK_LUXURY", "MINIMAL_LIGHT", "UNKNOWN_THEME"]) {
    const fallback = builder.fullPageThemePreview("", removed, "landing");
    assert.match(fallback, /data-theme="AURORA_MODERN"/);
  }
  for (const [scope, token] of [
    ["landing", "hero-grid"],
    ["auth", "auth-card"],
    ["customer", "metric-grid"],
  ]) {
    const html = builder.fullPageThemePreview("", "OCEAN_PREMIUM", scope);
    assert.match(html, new RegExp(token));
    assert.match(html, /data-theme="OCEAN_PREMIUM"/);
    assert.doesNotMatch(html, /CustomerChào|AuthĐăng/);
  }
});
test("visual editor provides true device viewports, draft controls and safe structured bridge", async () => {
  const { themeEditorPage } = await import("../dist/theme-builder.js"),
    html = themeEditorPage("BLACK_GOLD_LUXURY");
  for (const token of [
    "1440",
    "768px",
    "390px",
    "Lưu bản nháp",
    "Áp dụng",
    "Hoàn tác",
    "Khôi phục mặc định",
    "theme-draft",
    "themeOverrides",
  ])
    assert.match(html, new RegExp(token));
  assert.doesNotMatch(html, /contenteditable|eval\(/);
});
test("Soft Beige Premium has its own editorial architectures in every requested scope", async () => {
  const { themeStructure } = await import("../dist/themes.js");
  assert.deepEqual(themeStructure.BEIGE_EDITORIAL, {
    navigationVariant: "beige-boutique",
    heroVariant: "beige-editorial",
    authVariant: "beige-gallery",
    sidebarVariant: "beige-tailored",
    dashboardVariant: "beige-ledger",
    serviceVariant: "beige-showcase",
    orderFormVariant: "beige-concierge",
    density: "spacious",
  });
  const { fullPageThemePreview, themeEditorPage } =
    await import("../dist/theme-builder.js");
  const pages = ["landing", "auth", "customer"].map((scope) =>
    fullPageThemePreview("", "BEIGE_EDITORIAL", scope),
  );
  for (const html of pages) {
    assert.match(html, /data-theme="BEIGE_EDITORIAL"/);
    assert.match(html, /Soft Beige Premium is an authored editorial system/);
    assert.doesNotMatch(html, /CustomerChào|AuthĐăng|TÃ|Ä‘/);
  }
  assert.match(pages[0], /data-hero-variant="beige-editorial"/);
  assert.match(pages[1], /data-auth-variant="beige-gallery"/);
  assert.match(pages[2], /data-dashboard-variant="beige-ledger"/);
  const editor = themeEditorPage("BEIGE_EDITORIAL");
  for (const token of [
    "landing",
    "auth",
    "customer",
    "desktop",
    "tablet",
    "mobile",
  ])
    assert.match(editor, new RegExp(token));
});
test("four reference themes have independent three-scope architectures", async () => {
  const { themeStructure } = await import("../dist/themes.js");
  const { fullPageThemePreview } = await import("../dist/theme-builder.js");
  const expected = {
    ZEN_JAPANESE: [
      "zen-pavilion",
      "ink-landscape",
      "shoji",
      "quiet-rail",
      "garden-ledger",
      "zen-shelf",
      "ritual-flow",
    ],
    BLACK_GOLD_LUXURY: [
      "luxury-gallery",
      "monument",
      "noir-suite",
      "gold-rail",
      "executive-night",
      "jewel-grid",
      "private-desk",
    ],
    BLUE_BUSINESS: [
      "corporate-bar",
      "business-tower",
      "trust-split",
      "office-rail",
      "kpi-board",
      "solution-columns",
      "proposal-flow",
    ],
    CYBER_NEON_CITY: [
      "neon-command",
      "hologram-stage",
      "portal",
      "circuit-rail",
      "telemetry-bento",
      "neon-modules",
      "terminal-flow",
    ],
  };
  const signatures = new Set();
  for (const [id, variants] of Object.entries(expected)) {
    const actual = Object.values(themeStructure[id]).slice(0, 7);
    assert.deepEqual(actual, variants);
    signatures.add(actual.join("|"));
    for (const scope of ["landing", "auth", "customer"]) {
      const html = fullPageThemePreview("", id, scope);
      assert.match(html, new RegExp(`data-theme="${id}"`));
      assert.doesNotMatch(html, /TÃ|Ä‘|CustomerChào|AuthĐăng/);
    }
  }
  signatures.add(
    Object.values(themeStructure.BEIGE_EDITORIAL).slice(0, 7).join("|"),
  );
  assert.equal(
    signatures.size,
    5,
    "all four references and Soft Beige must have unique structures",
  );
});
test("three new references render nine distinct and responsive interfaces", async () => {
  const { themeStructure } = await import("../dist/themes.js");
  const { fullPageThemePreview, themeEditorPage } =
    await import("../dist/theme-builder.js");
  const expected = {
    PRISM_GLASS: [
      "glass-orbit",
      "prism-pedestal",
      "crystal-suite",
      "floating-dock",
      "luminous-console",
      "glass-carousel",
      "floating-wizard",
    ],
    OCEAN_PREMIUM: [
      "ocean-command-deck",
      "lighthouse-horizon",
      "ocean-secure-access",
      "nautical-rail",
      "ocean-operations",
      "voyage-service-grid",
      "navigation-desk",
    ],
    CREATOR_POP: [
      "creator-marquee",
      "viral-collage",
      "creator-studio",
      "pop-ribbon",
      "social-pulse",
      "platform-stickers",
      "boost-composer",
    ],
  };
  const firstFive = [
    "BEIGE_EDITORIAL",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "BLUE_BUSINESS",
    "CYBER_NEON_CITY",
  ];
  const signatures = new Set(
    firstFive.map((id) =>
      Object.values(themeStructure[id]).slice(0, 7).join("|"),
    ),
  );
  let interfaces = 0;
  for (const [id, variants] of Object.entries(expected)) {
    const actual = Object.values(themeStructure[id]).slice(0, 7);
    assert.deepEqual(actual, variants);
    signatures.add(actual.join("|"));
    for (const [scope, key, index] of [
      ["landing", "hero", 1],
      ["auth", "auth", 2],
      ["customer", "dashboard", 4],
    ]) {
      const html = fullPageThemePreview("", id, scope);
      interfaces++;
      assert.match(html, new RegExp(`data-theme="${id}"`));
      assert.match(
        html,
        new RegExp(`data-${key}-variant="${variants[index]}"`),
      );
      assert.match(html, /<meta name="viewport"/);
      assert.doesNotMatch(
        html,
        /TÃ|Ä‘|CustomerChào|AuthĐăng|overflow-x:\s*visible/,
      );
    }
    const editor = themeEditorPage(id);
    for (const token of [
      "landing",
      "auth",
      "customer",
      "desktop",
      "tablet",
      "mobile",
      "theme-draft",
    ])
      assert.match(editor, new RegExp(token));
  }
  assert.equal(interfaces, 9);
  assert.equal(
    signatures.size,
    8,
    "all three references and the completed first five must differ",
  );
  for (const copy of [
    "Kính mờ · lớp nổi lăng kính",
    "Đại dương · vận hành cao cấp",
    "Creator · hồng tím năng lượng",
  ])
    assert.ok(adminOperations.includes(copy));
  for (const thumb of ["thumb-glass", "thumb-ocean", "thumb-creator"])
    assert.ok(admin.includes(thumb));
});
test("references 01-03 keep distinct compositions and Aurora stays unnumbered", async () => {
  const { fullPageThemePreview } = await import("../dist/theme-builder.js");
  const expected = {
    AI_COSMIC_FUTURE: ["landing-hero.png", "auth-portal.png", "aiv3-dashboard"],
    CREATOR_POP: ["creator-portrait", "creator-auth-poster", "creator-channel-cards"],
    URBAN_LIME_BRUTAL: ["brutal-building", "brutal-auth-title", "brutal-metrics"],
  };
  for (const [theme, signatures] of Object.entries(expected)) {
    const pages = ["landing", "auth", "customer"].map((scope) =>
      fullPageThemePreview("", theme, scope),
    );
    signatures.forEach((signature, index) =>
      assert.match(pages[index], new RegExp(signature)),
    );
    pages.forEach((html) => {
      assert.doesNotMatch(html, /TÃ|Ä‘|áº|á»|â€|ï¿½|�/);
      assert.match(html, /data-theme-content="brandTitle"/);
    });
  }
  assert.match(adminOperations, /AURORA_MODERN'\?'MẶC ĐỊNH'/);
  assert.match(adminOperations, /AI_COSMIC_FUTURE:'01'/);
  assert.match(adminOperations, /CREATOR_POP:'02'/);
  assert.match(adminOperations, /URBAN_LIME_BRUTAL:'03'/);
  assert.doesNotMatch(adminOperations, /presets\.indexOf\(p\)\+1/);
});
test("AI cosmic reference keeps one navigation and dense runtime landmarks", async () => {
  const { fullPageThemePreview } = await import("../dist/theme-builder.js");
  const { themeStyles } = await import("../dist/themes.js");
  const landing = fullPageThemePreview("", "AI_COSMIC_FUTURE", "landing");
  const auth = fullPageThemePreview("", "AI_COSMIC_FUTURE", "auth");
  const customer = fullPageThemePreview("", "AI_COSMIC_FUTURE", "customer");
  for (const token of [
    "/theme-assets/ai-cosmic/landing-hero.png",
    "aiv3-platforms",
  ])
    assert.match(landing, new RegExp(token));
  assert.match(auth, /\/theme-assets\/ai-cosmic\/auth-portal\.png/);
  assert.match(auth, /aiv3-portal/);
  assert.match(auth, /aiv3-manifesto/);
  assert.match(customer, /aiv3-dashboard/);
  assert.match(landing, /data-renderer="ai-cosmic-landing-page"/);
  assert.match(auth, /data-renderer="ai-cosmic-auth-page"/);
  assert.match(customer, /data-renderer="ai-cosmic-customer-page"/);
  assert.match(themeStyles, /AI_COSMIC_FUTURE.*body>\.header.*display:none/s);
  assert.match(admin, /ai_cosmic_future \.thumb-ai-v2/);
  assert.match(customer, /aiv3-kpis/);
  assert.match(customer, /aiv3-chart/);
  assert.match(customer, /aiv3-assistant/);
  assert.match(themeStyles, /grid-template-columns:2fr 1fr 1fr/);
  assert.match(themeStyles, /aiv3-content\{display:grid/);
  for (const html of [landing, auth, customer]) {
    const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1] || "";
    assert.doesNotMatch(body, /theme-story|theme-offer|dashboard-wallet|dashboard-kpis|dashboard-orders/);
  }
  assert.doesNotMatch(landing, /Dữ liệu thật|Phiên HttpOnly và CSRF|Danh mục được cập nhật trực tiếp/);
  assert.match(auth, /class="aiv3-auth-left"[\s\S]*class="auth-card"/);
  assert.match(customer, /class="aiv3-sidebar"[\s\S]*class="aiv3-topbar"/);
  assert.doesNotMatch(themeStyles, /aiv3-(planet|city|road|orb|robot|floats)/);
  assert.doesNotMatch(themeStyles, /\.aiv3-portal (?:i|b)\{/);
  assert.match(main, /theme-assets\/ai-cosmic\/auth-portal\.png/);
  assert.match(main, /theme-assets\/ai-cosmic\/landing-hero\.png/);
  assert.match(main, /img-src 'self' https: data:/);
  for (const asset of ["auth-portal.png", "landing-hero.png"]) {
    const bytes = await readFile(
      new URL(`../public/theme-assets/ai-cosmic/${asset}`, import.meta.url),
    );
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(bytes.length > 500_000, `${asset} must contain production artwork`);
  }
  const obsoleteAiSelectors = [
    "ai-cosmic-orbit",
    "ai-neural-core",
    "ai-orbit-nav",
    "ai-identity-orbit",
    "ai-city-window",
    "ai-intelligence-console",
    "ai-prediction",
    "ai-model-stack",
    "ai-queue",
  ];
  for (const selector of obsoleteAiSelectors) {
    assert.doesNotMatch(themeStyles, new RegExp(selector));
    assert.doesNotMatch(landing + auth + customer, new RegExp(selector));
  }
});
test("final reference pair completes exactly ten unique three-scope architectures", async () => {
  const { themeStructure } = await import("../dist/themes.js");
  const { fullPageThemePreview, themeEditorPage } =
    await import("../dist/theme-builder.js");
  const references = [
    "BEIGE_EDITORIAL",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "BLUE_BUSINESS",
    "CYBER_NEON_CITY",
    "PRISM_GLASS",
    "OCEAN_PREMIUM",
    "CREATOR_POP",
    "URBAN_LIME_BRUTAL",
    "AI_COSMIC_FUTURE",
  ];
  const expected = {
    URBAN_LIME_BRUTAL: [
      "brutal-masthead",
      "concrete-spread",
      "poster-access",
      "block-rail",
      "hard-ledger",
      "manifesto-grid",
      "ticket-desk",
    ],
    AI_COSMIC_FUTURE: [
      "ai-dedicated-nav-v3",
      "ai-dedicated-hero-v3",
      "ai-dedicated-auth-v3",
      "ai-dedicated-sidebar-v3",
      "ai-dedicated-dashboard-v3",
      "ai-dedicated-services-v3",
      "ai-dedicated-order-v3",
    ],
  };
  for (const [id, variants] of Object.entries(expected)) {
    assert.deepEqual(Object.values(themeStructure[id]).slice(0, 7), variants);
    for (const [scope, key, index] of [
      ["landing", "hero", 1],
      ["auth", "auth", 2],
      ["customer", "dashboard", 4],
    ]) {
      const html = fullPageThemePreview("", id, scope);
      assert.match(html, new RegExp(`data-theme="${id}"`));
      assert.match(
        html,
        new RegExp(`data-${key}-variant="${variants[index]}"`),
      );
      assert.doesNotMatch(html, /TÃ|Ä‘|CustomerChào|AuthĐăng/);
    }
    const editor = themeEditorPage(id);
    for (const token of [
      "landing",
      "auth",
      "customer",
      "desktop",
      "tablet",
      "mobile",
      "theme-draft",
    ])
      assert.match(editor, new RegExp(token));
  }
  const signatures = new Set(
    references.map((id) =>
      Object.values(themeStructure[id]).slice(0, 7).join("|"),
    ),
  );
  assert.equal(signatures.size, 10);
  assert.ok(adminOperations.includes("Đô thị · lime brutalist"));
  assert.ok(adminOperations.includes("AI · quỹ đạo neural đa sắc"));
  assert.match(admin, /\.thumb-brutalist/);
  assert.match(admin, /\.thumb-ai-v2/);
});

test("nine generic reference themes keep 27 concrete renderers without document wrappers", async () => {
  const { renderReferenceComposition } = await import("../dist/themes.js");
  const { referenceRenderers, isMeaningfulReferenceRender } =
    await import("../dist/reference-theme-renderers.js");
  const { fullPageThemePreview } = await import("../dist/theme-builder.js");
  const ids = [
    "BEIGE_EDITORIAL",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "BLUE_BUSINESS",
    "CYBER_NEON_CITY",
    "PRISM_GLASS",
    "OCEAN_PREMIUM",
    "CREATOR_POP",
    "URBAN_LIME_BRUTAL",
  ];
  for (const scope of ["landing", "auth", "customer"]) {
    const fingerprints = new Set();
    const domArchitectures = new Set();
    for (const id of ids) {
      const shell =
        scope === "landing" ? "hero" : scope === "auth" ? "auth" : "customer";
      const direct = renderReferenceComposition(
        id,
        scope,
        `<div class="${shell}"><button>safe</button></div>`,
      );
      const html = fullPageThemePreview("", id, scope);
      assert.match(direct, /data-renderer="[^"]+"/);
      assert.match(html, /data-renderer="[^"]+"/);
      assert.match(
        html,
        new RegExp(`data-theme-architecture="${id.toLowerCase()}-${scope}"`),
      );
      const renderer = /data-renderer="([^"]+)"/.exec(html)?.[1];
      assert.equal(isMeaningfulReferenceRender(html, scope), true);
      const regionClasses =
        scope === "landing"
          ? ["theme-navigation", "theme-story", "theme-offer", "theme-cta"]
          : scope === "auth"
            ? [
                "auth-navigation",
                "auth-visual",
                "auth-form-region",
                "auth-assurance",
              ]
            : [
                "dashboard-navigation",
                "dashboard-wallet",
                "dashboard-kpis",
                "dashboard-orders",
              ];
      const regions = regionClasses.map((className) => {
        const content = new RegExp(
          `<(?:nav|section|aside|footer) class="[^"]*${className}[^"]*">([\\s\\S]*?)<\\/(?:nav|section|aside|footer)>`,
        ).exec(html)?.[1];
        return content
          ?.replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      });
      assert.equal(
        regions.every((region) => region && region.length >= 8),
        true,
      );
      assert.doesNotMatch(
        html,
        /data-composition-layer|data-theme-runtime-root|data-original-content/,
      );
      fingerprints.add(`${renderer}|${regions.join("|")}`);
      const authoredDom = regionClasses
        .map(
          (className) =>
            new RegExp(
              `<(?:nav|section|aside|footer) class="[^"]*${className}[^"]*">([\\s\\S]*?)<\\/(?:nav|section|aside|footer)>`,
            ).exec(html)?.[1] ?? "",
        )
        .join("")
        .replace(/[^<]*(<[^>]+>)[^<]*/g, "$1")
        .replace(/\shref="[^"]*"/g, "");
      domArchitectures.add(authoredDom);
    }
    assert.equal(
      fingerprints.size,
      9,
      scope + " architectures must be 9/9 unique",
    );
    assert.equal(
      domArchitectures.size,
      9,
      scope + " must use nine different nested DOM compositions",
    );
  }
  const oldEmptyHack = `<div class="hero"><nav class="theme-navigation"></nav><section class="theme-story"></section><aside class="theme-offer"></aside><footer class="theme-cta"></footer></div>`;
  assert.equal(isMeaningfulReferenceRender(oldEmptyHack, "landing"), false);
  assert.equal(
    new Set(ids.flatMap((id) => Object.values(referenceRenderers[id]))).size,
    27,
  );
  const runtime = await readFile(
    new URL("../dist/themes.js", import.meta.url),
    "utf8",
  );
  const rendererSource = await readFile(
    new URL("../dist/reference-theme-renderers.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(runtime, /while\s*\(document\.body\.firstChild\)/);
  assert.doesNotMatch(rendererSource, /DichVu1st/);
  assert.match(rendererSource, /data-theme-content=\\?"brandTitle/);
});

test("admin forms and operational orders expose polished real contracts", () => {
  for (const token of [
    "resource-editor-modal",
    "form-section-title",
    "switch-input",
    "compact-check",
    "permissionSearch",
    "image-preview",
    "inline-error",
  ])
    assert.match(admin + adminOperations, new RegExp(token));
  for (const token of [
    "Website Order ID",
    "Provider Order ID",
    "Tìm dịch vụ",
    "Tìm nhà cung cấp",
    "Nền tảng",
    "Danh mục",
    "copyProviderIds",
    "copyLinks",
    "provider-ids",
    "service-analytics",
  ])
    assert.match(admin, new RegExp(token));
  assert.match(admin, /Đã sao chép.*mã đơn NCC/);
});

test("acceptance UI audit covers every requested admin and customer surface", () => {
  const adminPaths = [
    "/admin/staff",
    "/admin/platforms",
    "/admin/categories",
    "/admin/services",
    "/admin/providers",
    "/admin/price-groups",
    "/admin/pricing",
    "/admin/payment-methods",
    "/admin/settings",
    "/admin/panel-plans",
    "/admin/panels",
    "/admin/panel-subscriptions",
    "/admin/orders",
  ];
  const customerPaths = [
    "/dashboard",
    "/orders/new",
    "/orders/bulk",
    "/orders",
    "/services",
    "/wallet",
    "/deposit",
    "/transactions",
    "/panel-plans",
    "/panels",
    "/affiliate",
    "/api",
    "/support",
    "/notifications",
    "/account",
  ];
  for (const path of adminPaths)
    assert.match(admin, new RegExp(path.replaceAll("/", "\\/")));
  for (const path of customerPaths)
    assert.match(customer, new RegExp(path.replaceAll("/", "\\/")));
  const allUi = page + components + customer + client + admin + adminOperations;
  assert.doesNotMatch(allUi, /TÃ|Ä‘|Ã©|Â /);
  assert.match(admin, /\.switch-input\{appearance:none;width:44px/);
  assert.match(admin, /payment-editor.*overflow:hidden/);
  assert.match(admin, /modal-body.*overflow-y:auto/);
  assert.match(admin, /overflow-wrap:break-word/);
  assert.match(admin, /@media\(max-width:780px\)/);
  assert.match(customer, /role="alert"/);
  assert.match(client, /PAYMENT_REQUIRED/);
});

test("customer router owns the panel rental activation UUID route", async () => {
  const source = await readFile(
    new URL("../src/customer.ts", import.meta.url),
    "utf8",
  );
  const server = await readFile(
    new URL("../src/main.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\^\\\/panels\\\/activate\\\//);
  assert.match(source, /panelActivation/);
  assert.match(source, /\/api\/v1\/customer\/panel-rentals\//);
  assert.equal(
    server.includes("/^\\/panels\\/activate\\/[0-9a-f-]{36}$/"),
    true,
  );
});

test("API proxy signs the validated browser tenant host instead of forwarding spoofable input", async () => {
  const server = await readFile(
    new URL("../src/main.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /browserHost\(request\.headers\.host\)/);
  assert.match(server, /createHmac\("sha256", proxySecret\)/);
  assert.match(server, /tenantHeaders\(tenantHost\)/);
  assert.match(server, /"x-smm-tenant-host": hostname/);
  assert.match(server, /"x-smm-tenant-timestamp": timestamp/);
  assert.doesNotMatch(server, /headers:\s*\{\s*host:\s*validatedHost/);
});

test("panel plan editor round-trips grouped granular permissionCodes separately from flags", () => {
  assert.match(adminUx, /panelPermissionGroups/);
  assert.match(adminUx, /name:'permissionCodes'/);
  assert.match(adminUx, /Quyền quản trị của gói/);
  assert.match(adminOperations, /fd\.getAll\(f\.name\)/);
  assert.match(
    adminOperations,
    /Array\.isArray\(value\)&&value\.includes\(o\.value\)/,
  );
  for (const flag of [
    "allowCustomDomain",
    "allowPanelResale",
    "allowApi",
    "allowThemes",
  ])
    assert.match(adminUx, new RegExp(flag));
});

test("tenant admin shell never server-renders the root brand", () => {
  const tenant = adminPage("", "/admin", "smmlike.site");
  const root = adminPage("", "/admin", "dichvu1st.com");
  assert.match(tenant, /smmlike\.site Admin/);
  assert.match(tenant, /data-brand-mark>S</);
  assert.doesNotMatch(tenant, />DichVu1st</);
  assert.match(root, /DichVu1st Admin/);
});

test("affiliate and reports have dedicated renderers instead of order filters", () => {
  assert.match(adminOperations, /function renderAffiliate/);
  assert.match(adminOperations, /function renderReports/);
  const affiliate = adminOperations.slice(
    adminOperations.indexOf("function renderAffiliate"),
    adminOperations.indexOf("function renderReports"),
  );
  assert.doesNotMatch(affiliate, /Website Order ID|Provider Order ID/);
  assert.match(affiliate, /Affiliate/);
  assert.match(affiliate, /Commission/);
});

test("catalog and price-group CTAs use canonical tenant permissions", () => {
  assert.match(adminOperations, /moduleHeader\('\+ Tạo nhóm giá','create','users\.pricing\.manage'\)/);
  assert.match(adminOperations, /moduleHeader\(\(kind===['"]platforms/);
  assert.match(adminOperations, /services\.create/);
  assert.doesNotMatch(adminOperations, /moduleHeader\([^\n]+services\.manage/);
});

test("order selection is page-local and advanced filters are collapsed", () => {
  const html = adminPage("", "/admin/orders");
  assert.match(html, /advanced-filters/);
  assert.match(html, /selectedIds\.clear\(\);page=Math\.max/);
  assert.match(html, /selectedIds\.clear\(\);page=1;orderFilters=/);
  assert.match(html, /id="bulkBar" hidden/);
  assert.match(html, /Cập nhật từ NCC/);
});

test("customer API keys are masked on read and shown only in a disposable create dialog", () => {
  const customerUi = customer + customerUx;
  assert.match(customerUi, /••••••••••••/);
  assert.match(customerUi, /Đổi API key/);
  assert.match(customerUi, /API key hiện tại sẽ ngừng hoạt động ngay sau khi tạo key mới/);
  assert.match(customerUi, /API key này chỉ hiển thị một lần\. Hãy sao chép và lưu lại\./);
  assert.match(customerUi, /Sao chép key/);
  assert.match(customerUi, /dialog\.replaceChildren\(\)/);
  assert.match(customerUi, /clipboard\.writeText\(transientKey\)/);
  assert.match(customerUi, /created\.key\|\|created\.rawKey/);
  assert.match(customerUi, /keyPrefix|lastUsedAt/);
});

test("customer UX overrides are installed before the route renders", () => {
  const html = customerPage("http://localhost:4004", "/orders/new");
  const override = html.indexOf("const originalDashboard=dashboard");
  const router = html.indexOf("const route=ROUTE");
  assert.ok(override >= 0 && router > override);
  assert.ok(html.indexOf("newOrder=async function()", override) < router);
});

test("customer ordering and Panel pages hide internal IDs and expose useful sections", () => {
  const customerUi = customer + customerUx;
  assert.match(customerUi, /serviceNumber\)\+'/);
  assert.match(customerUi, /quantity-hint/);
  assert.match(customerUi, /Number\.isSafeInteger\(q\)/);
  assert.match(customerUi, /Child Panel/);
  assert.match(customerUi, /panel-tabs/);
  assert.match(customerUi, /Quản lý/);
  assert.match(customerUi, /data-label="Số tiền"/);
});

test("admin refinement groups order actions, hides Child Panel provider controls and gates themes", () => {
  assert.match(adminUx, /Cập nhật từ NCC/);
  assert.match(adminUx, /Thao tác khác/);
  assert.match(adminUx, /danger-zone/);
  assert.match(adminUx, /Dịch vụ của Child Panel được cung cấp từ Panel cha\./);
  assert.match(adminUx, /allowThemes===false/);
  assert.match(adminUx, /Gói Panel hiện tại không hỗ trợ tùy chỉnh giao diện\./);
  assert.match(adminUx, /panel-admin-history/);
  assert.match(adminUx, /row-menu/);
  assert.match(admin, /adminRefinementStyles/);
  assert.match(adminRefinementStyles, /@media\(max-width:780px\)/);
  assert.match(adminRefinementStyles, /@media\(max-width:460px\)/);
});

test("admin Panel conversion previews impact and uses the explicit type-change route", () => {
  assert.match(adminUx, /Nâng lên Child Panel|Nâng lên Panel/);
  assert.match(adminUx, /Hạ xuống Child Panel/);
  assert.match(adminUx, /type-preview\?targetType=/);
  assert.match(adminUx, /activeExternalOrders/);
  assert.match(adminUx, /api\.patch\('\/api\/v1\/admin\/panels\/'\+d\.panelNumber\+'\/type'/);
  assert.match(adminUx, /confirmBox\('Xác nhận chuyển Panel sang /);
  assert.match(adminUx, /panel-conversion-impact/);
  assert.doesNotMatch(adminUx, /openPanelTypeChange/);
});


test("rendered Panel conversion controls preview and submit the selected explicit type", async () => {
  const { adminUxScript } = await import("../dist/admin-ux.js");
  const calls = [];
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: selector === "#panelTypeTarget" ? "PANEL" : selector === "#panelTypeReason" ? "Approved upgrade" : "",
      disabled: true,
      classList: { add() {}, toggle() {} },
      querySelector: (child) => node(selector + child),
    });
    return nodes.get(selector);
  };
  const context = {
    api: {
      get: async (path) => (calls.push(["GET", path]), { allowed: true, impact: { activeExternalOrders: 0 } }),
      patch: async (path, body) => calls.push(["PATCH", path, body]),
    },
    document: { querySelector: node, querySelectorAll: () => [] },
    content: {}, window: {}, PATH: "/admin/panels/100001", DETAIL: ["panels", "100001"],
    savePanelPermissions: node("#savePanelPermissions"),
    resourceTable() {}, openForm() {}, renderDetail() {}, renderAdminModule() {},
    can: () => true, escapeHtml: (value) => String(value ?? ""), money: String, date: String, status: String,
    confirmBox: async () => true, toast() {}, load() {},
    detail: { panelNumber: "100001", panelType: "CHILD_PANEL", status: "ACTIVE" },
  };
  new vm.Script(adminUxScript + "\nrenderPanelDetail(detail);").runInNewContext(context);
  await node("#previewPanelType").onclick();
  assert.equal(node("#convertPanelType").disabled, false);
  await node("#convertPanelType").onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["GET", "/api/v1/admin/panels/100001/type-preview?targetType=PANEL"],
    ["PATCH", "/api/v1/admin/panels/100001/type", { panelType: "PANEL", reason: "Approved upgrade" }],
  ]);
  node("#panelTypeTarget").value = "CHILD_PANEL";
  node("#panelTypeTarget").onchange();
  assert.equal(node("#convertPanelType").disabled, true);
});
