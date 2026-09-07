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
  assert.match(adminOperations, /moduleHeader\('Thêm '\+title/);
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
    "Thêm nhóm giá",
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
test("twenty persistent runtime themes are available and safely allowlisted", async () => {
  const themes = await import("../dist/themes.js");
  assert.equal(themes.themePresets.length, 20);
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
  assert.match(admin, /\.payment-editor-modal\{width:min\(900px,calc\(100vw - 32px\)\)/);
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
  assert.match(admin, /\.payment-editor \.form-grid\{grid-template-columns:1fr\}/);
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
  const required = ["DARK_LUXURY","MINIMAL_LIGHT","CYBER_NEON","SOFT_PASTEL","NATURE_GREEN","GLASSMORPHISM","BOLD_COMMERCE","DASHBOARD_FOCUSED","CREATIVE_AGENCY","PREMIUM_CORPORATE","JAPANESE_ZEN","BLACK_GOLD_ELITE","AI_FUTURISTIC","EDITORIAL_BRUTALIST","SOCIAL_CREATOR","OCEAN_PROFESSIONAL","AURORA_MODERN","EMERALD_BUSINESS","MIDNIGHT_SAAS","SOFT_BEIGE_PREMIUM"];
  assert.deepEqual([...themes.themeIds], required);
  assert.equal(new Set(themes.themePresets.map(x => x.name)).size, 20);
  for (const id of required) {
    const v = themes.themeStructure[id];
    for (const key of ["navigationVariant","heroVariant","authVariant","sidebarVariant","dashboardVariant","serviceVariant","orderFormVariant","density"])
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
test('panel customer and admin routes are wired',()=>{for(const path of ['/panels','/panels/new','/panel-plans'])assert.match(customer,new RegExp(path.replace('/','\\/')));for(const path of ['/admin/panels','/admin/panel-plans','/admin/panel-subscriptions'])assert.match(admin,new RegExp(path.replaceAll('/','\\/'))) });
test('same-origin API proxy is constrained to API paths and fixed config target',()=>{assert.match(main,/path\.startsWith\("\/api\/"\)/);assert.match(main,/new URL\(path\s*\+\s*url\.search, config\.apiUrl\)/);assert.doesNotMatch(main,/searchParams\.get\(["'](?:url|target)/)});
test('visual theme builder routes render real landing auth and customer architectures',async()=>{const builder=await import('../dist/theme-builder.js');for(const [scope,token] of [['landing','hero-grid'],['auth','auth-card'],['customer','metric-grid']]){const html=builder.fullPageThemePreview('', 'OCEAN_PROFESSIONAL', scope);assert.match(html,new RegExp(token));assert.match(html,/data-theme="OCEAN_PROFESSIONAL"/);assert.doesNotMatch(html,/CustomerChào|AuthĐăng/)}});
test('visual editor provides true device viewports, draft controls and safe structured bridge',async()=>{const {themeEditorPage}=await import('../dist/theme-builder.js'),html=themeEditorPage('BLACK_GOLD_ELITE');for(const token of ['1440','768px','390px','Lưu bản nháp','Áp dụng','Hoàn tác','Khôi phục mặc định','theme-draft','themeOverrides'])assert.match(html,new RegExp(token));assert.doesNotMatch(html,/contenteditable|eval\(/)});
test('Soft Beige Premium has its own editorial architectures in every requested scope', async()=>{
  const {themeStructure}=await import('../dist/themes.js');
  assert.deepEqual(themeStructure.SOFT_BEIGE_PREMIUM,{
    navigationVariant:'beige-boutique',heroVariant:'beige-editorial',authVariant:'beige-gallery',sidebarVariant:'beige-tailored',dashboardVariant:'beige-ledger',serviceVariant:'beige-showcase',orderFormVariant:'beige-concierge',density:'spacious'
  });
  const {fullPageThemePreview,themeEditorPage}=await import('../dist/theme-builder.js');
  const pages=['landing','auth','customer'].map(scope=>fullPageThemePreview('', 'SOFT_BEIGE_PREMIUM', scope));
  for(const html of pages){
    assert.match(html,/data-theme="SOFT_BEIGE_PREMIUM"/);
    assert.match(html,/Soft Beige Premium is an authored editorial system/);
    assert.doesNotMatch(html,/CustomerChào|AuthĐăng|TÃ|Ä‘/);
  }
  assert.match(pages[0],/data-hero-variant="beige-editorial"/);
  assert.match(pages[1],/data-auth-variant="beige-gallery"/);
  assert.match(pages[2],/data-dashboard-variant="beige-ledger"/);
  const editor=themeEditorPage('SOFT_BEIGE_PREMIUM');
  for(const token of ['landing','auth','customer','desktop','tablet','mobile']) assert.match(editor,new RegExp(token));
});
test('four reference themes have independent three-scope architectures',async()=>{
  const {themeStructure}=await import('../dist/themes.js');
  const {fullPageThemePreview}=await import('../dist/theme-builder.js');
  const expected={
    JAPANESE_ZEN:['zen-pavilion','ink-landscape','shoji','quiet-rail','garden-ledger','zen-shelf','ritual-flow'],
    DARK_LUXURY:['luxury-gallery','monument','noir-suite','gold-rail','executive-night','jewel-grid','private-desk'],
    PREMIUM_CORPORATE:['corporate-bar','business-tower','trust-split','office-rail','kpi-board','solution-columns','proposal-flow'],
    CYBER_NEON:['neon-command','hologram-stage','portal','circuit-rail','telemetry-bento','neon-modules','terminal-flow']
  };
  const signatures=new Set();
  for(const [id,variants] of Object.entries(expected)){
    const actual=Object.values(themeStructure[id]).slice(0,7);
    assert.deepEqual(actual,variants); signatures.add(actual.join('|'));
    for(const scope of ['landing','auth','customer']){
      const html=fullPageThemePreview('',id,scope);
      assert.match(html,new RegExp(`data-theme="${id}"`));
      assert.doesNotMatch(html,/TÃ|Ä‘|CustomerChào|AuthĐăng/);
    }
  }
  signatures.add(Object.values(themeStructure.SOFT_BEIGE_PREMIUM).slice(0,7).join('|'));
  assert.equal(signatures.size,5,'all four references and Soft Beige must have unique structures');
});
test('three new references render nine distinct and responsive interfaces',async()=>{
  const {themeStructure}=await import('../dist/themes.js');
  const {fullPageThemePreview,themeEditorPage}=await import('../dist/theme-builder.js');
  const expected={
    GLASSMORPHISM:['glass-orbit','prism-pedestal','crystal-suite','floating-dock','luminous-console','glass-carousel','floating-wizard'],
    EMERALD_BUSINESS:['emerald-boardroom','growth-briefing','executive-access','enterprise-rail','growth-command','capability-matrix','approval-desk'],
    SOCIAL_CREATOR:['creator-marquee','viral-collage','creator-studio','pop-ribbon','social-pulse','platform-stickers','boost-composer']
  };
  const firstFive=['SOFT_BEIGE_PREMIUM','JAPANESE_ZEN','DARK_LUXURY','PREMIUM_CORPORATE','CYBER_NEON'];
  const signatures=new Set(firstFive.map(id=>Object.values(themeStructure[id]).slice(0,7).join('|')));
  let interfaces=0;
  for(const [id,variants] of Object.entries(expected)){
    const actual=Object.values(themeStructure[id]).slice(0,7); assert.deepEqual(actual,variants); signatures.add(actual.join('|'));
    for(const [scope,key,index] of [['landing','hero',1],['auth','auth',2],['customer','dashboard',4]]){
      const html=fullPageThemePreview('',id,scope); interfaces++;
      assert.match(html,new RegExp(`data-theme="${id}"`)); assert.match(html,new RegExp(`data-${key}-variant="${variants[index]}"`));
      assert.match(html,/<meta name="viewport"/); assert.doesNotMatch(html,/TÃ|Ä‘|CustomerChào|AuthĐăng|overflow-x:\s*visible/);
    }
    const editor=themeEditorPage(id); for(const token of ['landing','auth','customer','desktop','tablet','mobile','theme-draft'])assert.match(editor,new RegExp(token));
  }
  assert.equal(interfaces,9); assert.equal(signatures.size,8,'all three references and the completed first five must differ');
  for(const copy of ['Kính pha lê · lớp nổi phát sáng','Emerald đậm · tăng trưởng doanh nghiệp','Creator pop · hồng cam tím năng lượng'])assert.ok(adminOperations.includes(copy));
  for(const thumb of ['thumb-glass','thumb-business','thumb-creator'])assert.ok(admin.includes(thumb));
});
