/** Deterministic browser QA only. Fixtures never ship in the runtime server. */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { landingPage, authPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { fullPageThemePreview } from "../dist/theme-builder.js";
import { referencePages } from "../dist/reference-runtime.js";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const out = new URL("./artifacts/", import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL(".gitignore", out), "*\n!.gitignore\n");
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/theme-assets/")) {
    try {
      res.setHeader("content-type", "image/png");
      res.end(
        await readFile(new URL("../public" + url.pathname, import.meta.url)),
      );
    } catch {
      res.statusCode = 404;
      res.end();
    }
    return;
  }
  const kinds = {
    "/login": "login",
    "/register": "register",
    "/forgot-password": "forgot",
    "/reset-password": "reset",
  };
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    url.pathname === "/__preview"
      ? fullPageThemePreview(
          "",
          url.searchParams.get("theme"),
          url.searchParams.get("scope"),
        )
      : url.pathname === "/"
        ? landingPage("")
        : kinds[url.pathname]
          ? authPage("", kinds[url.pathname])
          : customerPage("", url.pathname),
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage();
const mutations = [];
await page
  .context()
  .addCookies([{ name: "smm_csrf", value: "qa-csrf", url: origin }]);
const errors = [],
  results = [];
let theme,
  tenantName = "Tenant QA";
page.on("pageerror", (e) => errors.push(e.message));
const service = {
  id: "service-1",
  serviceNumber: 1234,
  name: "Dịch vụ kiểm thử trình duyệt",
  categoryId: "category-1",
  rate: 1000,
  min: 10,
  max: 10000,
  type: "DEFAULT",
  refill: true,
  cancel: true,
};
const category = {
  id: "category-1",
  slug: "followers",
  name: "Người theo dõi",
  platform: { slug: "tiktok", name: "TikTok" },
};
await page.route("**/api/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() !== "GET") {
    mutations.push({
      path,
      body: route.request().postDataJSON(),
      headers: route.request().headers(),
    });
    await route.fulfill({
      status: 400,
      json: {
        error: {
          code: path.endsWith("/customer/orders")
            ? "INSUFFICIENT_BALANCE"
            : "INVALID_CREDENTIALS",
        },
      },
    });
    return;
  }
  let data = { items: [], page: 1, pages: 1, total: 0 };
  if (path.endsWith("/public/settings"))
    data = { siteName: tenantName, themeGlobal: theme };
  else if (path.endsWith("/me"))
    data = {
      user: {
        username: "Browser QA",
        email: "qa@example.test",
        status: "ACTIVE",
      },
    };
  else if (path.endsWith("/dashboard"))
    data = {
      balance: 123000,
      totalOrders: 17,
      activeOrders: 3,
      completedOrders: 14,
      notifications: [],
    };
  else if (path.endsWith("/wallet")) data = { balance: 123000 };
  else if (path.endsWith("/unread-count")) data = { unread: 0 };
  else if (path.endsWith("/catalog"))
    data = {
      services: [service],
      categories: [category],
      page: 1,
      pages: 2,
      total: 13,
    };
  else if (
    ["/payment-methods", "/api-keys", "/tickets", "/notifications"].some((s) =>
      path.endsWith(s),
    )
  )
    data = [];
  else if (path.endsWith("/auth/sessions")) data = { sessions: [] };
  else if (path.endsWith("/referral"))
    data = {
      code: "QA-REFERRAL",
      referredUsers: 2,
      commission: 12000,
      link: origin + "/register?ref=QA",
    };
  else if (path.endsWith("/price-group")) data = { name: "Khách hàng" };
  else if (path.includes("/deposits/"))
    data = {
      grossAmount: 150000,
      status: "PENDING",
      code: "QA-DEPOSIT",
      paymentMethod: { name: "Ngân hàng kiểm thử" },
    };
  else if (path.includes("/tickets/"))
    data = { subject: "Yêu cầu kiểm thử", status: "OPEN", messages: [] };
  else if (path.endsWith("/panel-plans"))
    data = {
      items: [
        {
          id: "plan-1",
          name: "Gói kiểm thử",
          price: 100000,
          billingDays: 30,
          maxDirectChildren: 2,
          maxDepth: 1,
          allowCustomDomain: true,
        },
      ],
    };
  else if (path.includes("/panel-rentals/"))
    data = {
      rental: { domain: "qa.example.test", status: "PENDING" },
      nameservers: ["ns1.example.test", "ns2.example.test"],
    };
  else if (/\/panels\/\d+$/.test(path))
    data = {
      name: "Panel QA",
      siteNumber: 100001,
      status: "ACTIVE",
      subscriptions: [{ status: "ACTIVE", autoRenew: false }],
      domains: [],
    };
  await route.fulfill({ json: { success: true, data } });
});
async function check(label) {
  await page.locator("[data-reference-page]").waitFor();
  if (await page.locator("#app").count()) {
    await page.locator("#app .skeleton").waitFor({ state: "detached" });
    assert.equal(
      await page.locator("#app .error-state").count(),
      0,
      label + " unexpected error state",
    );
  }
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((i) => i.decode().catch(() => {})),
    ),
  );
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    root: Object.fromEntries([document.documentElement, document.body].map((el) => [el.tagName, { rect: (() => { const r=el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; })(), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, margin:getComputedStyle(el).margin, padding:getComputedStyle(el).padding } ])),
    unclipped: (() => { const main=document.querySelector('.zen-landing'); if(!main)return null; const old={overflowX:main.style.overflowX,maxWidth:main.style.maxWidth}; main.style.overflowX='visible';main.style.maxWidth='none';const scroll=document.documentElement.scrollWidth, nodes=[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),p=e.parentElement,pr=p?.getBoundingClientRect();return {tag:e.tagName,class:typeof e.className==='string'?e.className:'',text:(e.textContent||'').trim().slice(0,70),rect:{left:r.left,right:r.right,width:r.width},scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,computedWidth:s.width,minWidth:s.minWidth,margin:s.margin,padding:s.padding,transform:s.transform,position:s.position,parent:p?.tagName+'.'+(typeof p?.className==='string'?p.className:''),parentRect:pr&&{left:pr.left,right:pr.right,width:pr.width},before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content}}).filter(x=>x.rect.right>innerWidth+.5||x.rect.left<-.5||x.rect.width>innerWidth+.5);main.style.overflowX=old.overflowX;main.style.maxWidth=old.maxWidth;return {scroll,nodes:nodes.slice(0,20)}})(),
    offenders: [...document.querySelectorAll("[data-reference-page] *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.right > innerWidth + 0.5 || r.left < -0.5 || r.width > innerWidth + 0.5 || e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "visible"
        ) && r.width > 0 && (
          !e.closest("[data-ref-rail]") &&
          !e.closest(".table-wrap")
        );
      })
      .slice(0, 15)
      .map((e) => { const r=e.getBoundingClientRect(),s=getComputedStyle(e),p=e.parentElement,pr=p?.getBoundingClientRect(); return {tag:e.tagName,class:e.className,text:(e.textContent||"").trim().slice(0,80),rect:{left:r.left,right:r.right,width:r.width},scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,minWidth:s.minWidth,width:s.width,margin:s.margin,padding:s.padding,transform:s.transform,position:s.position,overflowX:s.overflowX,parent:p?.tagName+"."+p?.className,parentRect:pr&&{left:pr.left,right:pr.right,width:pr.width},parentWidth:p&&getComputedStyle(p).width}; }),
  }));
  assert.ok(
    overflow.scroll <= overflow.width + 2,
    label + " overflow " + JSON.stringify(overflow),
  );
  if (label === "ZEN_JAPANESE landing 1280") console.log("ZEN_UNCLIPPED_LAYOUT", JSON.stringify(overflow.unclipped));
  assert.deepEqual(errors, [], label + " JS errors");
  results.push(label);
}
try {
  for (theme of process.env.QA_THEMES?.split(",") ||
    Object.keys(referencePages)) {
    await page.context().addCookies([
      { name: "smm_locale", value: "vi", url: origin },
    ]);
    await page.goto(origin + "/");
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-landing-page"]').waitFor();
    else await page.locator("[data-reference-page]").waitFor();
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme, "requested theme must be active before assertions");
    const expectedRenderer = theme === "AI_COSMIC_FUTURE" ? "ai-cosmic-landing-page" : null;
    if (expectedRenderer) assert.equal(await page.locator("[data-renderer]").getAttribute("data-renderer"), expectedRenderer);
    else assert.ok(await page.locator("[data-reference-page]").count(), `${theme} must use its reference renderer`);
    const titleShape = await page.locator(".ref-copy h1").evaluate(el => [...el.childNodes].map(n => n.nodeType === Node.ELEMENT_NODE ? n.tagName : "#text").join(","));
    assert.equal(titleShape, "#text,EM", `${theme} Vietnamese title keeps original text/emphasis nodes`);
    const vietnamese = await page.evaluate(() => ({ eyebrow: document.querySelector(".ref-copy small")?.textContent, title: document.querySelector(".ref-copy h1")?.textContent, description: document.querySelector(".ref-copy p")?.textContent, cta: document.querySelector(".ref-copy .ref-cta span")?.textContent, nav: document.querySelector(".ref-nav nav a")?.textContent, benefit: document.querySelector(".ref-benefits h2")?.textContent, feature: document.querySelector(".ref-benefits h3")?.textContent }));
    await page.context().addCookies([
      { name: "smm_locale", value: "en", url: origin },
    ]);
    await page.reload();
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-landing-page"]').waitFor();
    else await page.locator("[data-reference-page]").waitFor();
    const english = await page.evaluate(() => ({ eyebrow: document.querySelector(".ref-copy small")?.textContent, title: document.querySelector(".ref-copy h1")?.textContent, description: document.querySelector(".ref-copy p")?.textContent, cta: document.querySelector(".ref-copy .ref-cta span")?.textContent, nav: document.querySelector(".ref-nav nav a")?.textContent, benefit: document.querySelector(".ref-benefits h2")?.textContent, feature: document.querySelector(".ref-benefits h3")?.textContent }));
    for (const field of ["eyebrow", "title", "description", "cta", "nav"]) assert.notEqual(english[field], vietnamese[field], `${theme} must localize ${field}`);
    for (const field of ["benefit", "feature"]) if (vietnamese[field] !== undefined) assert.notEqual(english[field], vietnamese[field], `${theme} must localize ${field}`);
    assert.equal(await page.locator('[data-i18n]').evaluateAll((els) => els.some((el) => el.textContent?.trim() === el.getAttribute('data-i18n')),), false, `${theme} exposes no unresolved translation keys`);
    assert.equal(english.nav, "Home");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator(".ref-copy h1").evaluate(el => [...el.childNodes].map(n => n.nodeType === Node.ELEMENT_NODE ? n.tagName : "#text").join(",")), titleShape, `${theme} locale switching preserves title DOM topology`);
    assert.equal(await page.locator("#locale-select").inputValue(), "en");
    const urlBeforeLanguageSwitch = page.url();
    await page.locator("#locale-select").selectOption("vi");
    await page.waitForFunction(() => document.documentElement.lang === "vi");
    assert.equal(page.url(), urlBeforeLanguageSwitch, "language selector switches in place without navigation");
    assert.equal(await page.locator(".ref-nav nav a").first().innerText(), "Trang chủ");
    await page.locator("#locale-select").selectOption("en");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    assert.equal(await page.locator(".ref-nav nav a").first().innerText(), "Home");
    if (["ZEN_JAPANESE", "CREATOR_POP", "CYBER_NEON_CITY", "BLACK_GOLD_LUXURY"].includes(theme))
      await page.screenshot({
        path: new URL(`${theme}-landing-en.png`, out).pathname.replace(/^\/([A-Z]:)/, "$1"),
        fullPage: true,
      });
    await page.context().addCookies([
      { name: "smm_locale", value: "vi", url: origin },
    ]);
    for (const width of [1440, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [scope, path] of [
        ["landing", "/"],
        ["auth", "/login"],
        ["customer", "/dashboard"],
      ]) {
        await page.goto(origin + path);
        await check(`${theme} ${scope} ${width}`);
        if (scope === "customer") {
          await page.locator("[data-reference-overview]").waitFor();
          assert.match(await page.locator(".metric-grid").innerText(), /17/);
        }
        assert.doesNotMatch(
          await page.locator("[data-reference-page]").innerText(),
          /DichVu1st/i,
        );
        if (width === 1440 || width === 390)
          await page.screenshot({
            path: new URL(
              `${theme}-${scope}-${width}.png`,
              out,
            ).pathname.replace(/^\/([A-Z]:)/, "$1"),
            fullPage: true,
          });
        if (scope === "customer" && width <= 768) {
          await page.locator("#drawer-toggle").click();
          await page.locator(".ref-close").click();
          assert.equal(
            await page.locator("#drawer-toggle").getAttribute("aria-expanded"),
            "false",
          );
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/register",
      "/forgot-password",
      "/reset-password",
      "/orders/new",
      "/orders/bulk",
    ]) {
      await page.goto(origin + path);
      await check(`${theme} ${path} mobile`);
      if (path === "/orders/new") await page.locator("#order-form").waitFor();
      if (path === "/orders/bulk") {
        const text = page.locator("#bulk-input");
        await text.fill("bad");
        await page
          .getByRole("button", { name: "Phân tích & kiểm tra" })
          .click();
        assert.ok((await text.boundingBox()).height >= 150);
      }
    }
    await page.goto(origin + "/login");
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-landing-page"]').waitFor();
    else await page.locator("[data-reference-page]").waitFor();
    await page.locator("#email").fill("qa@example.test");
    await page.locator("#password").fill("WrongPassword1");
    await page.locator(".toggle").click();
    assert.equal(await page.locator("#password").getAttribute("type"), "text");
    await page.locator("button[type=submit]").click();
    await page
      .locator("#message")
      .filter({ hasText: "Email hoặc mật khẩu không đúng" })
      .waitFor();
    await page.goto(origin + "/orders/new");
    await page.locator("#service").selectOption("service-1");
    await page.locator("#link").fill("https://example.test/post");
    await page.locator("#quantity").fill("100");
    const before = mutations.length;
    await page.locator(".submit").click();
    await page
      .locator("#order-error")
      .filter({ hasText: "Số dư không đủ" })
      .waitFor();
    await page.locator(".submit").click();
    await page
      .locator("#order-error")
      .filter({ hasText: "Số dư không đủ" })
      .waitFor();
    const sent = mutations.slice(before);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0].body, {
      serviceId: "service-1",
      link: "https://example.test/post",
      quantity: 100,
    });
    assert.equal(sent[0].headers["x-csrf-token"], "qa-csrf");
    assert.ok(sent[0].headers["idempotency-key"]);
    assert.equal(
      sent[0].headers["idempotency-key"],
      sent[1].headers["idempotency-key"],
    );
    for (const width of [1440, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/orders",
        "/orders/new",
        "/orders/bulk",
        "/services",
        "/wallet",
        "/deposit",
        "/deposit/00000000-0000-4000-8000-000000000001",
        "/transactions",
        "/affiliate",
        "/api",
        "/support",
        "/support/1",
        "/notifications",
        "/account",
        "/panels",
        "/panels/new",
        "/panels/activate/00000000-0000-4000-8000-000000000001",
        "/panel-plans",
        "/panels/100001",
      ]) {
        await page.goto(origin + path);
        if (path === "/orders/new") {
          await page.locator("#service").selectOption("service-1");
          await page.locator("#quantity").fill("100");
        }
        await check(`${theme} ${path} ${width}`);
        assert.equal(
          await page.locator("[data-reference-overview]").count(),
          0,
          "Dashboard must not replace " + path,
        );
        if (path === "/panels/100001")
          await page.locator("#panel-branding").waitFor();
        if (path === "/affiliate")
          assert.match(await page.locator("#app").innerText(), /QA-REFERRAL/);
        if (
          (width === 1440 || width === 390) &&
          ["/orders/new", "/orders/bulk"].includes(path)
        )
          await page.screenshot({
            path: new URL(
              `${theme}-${path.slice(1).replaceAll("/", "-")}-${width}.png`,
              out,
            ).pathname.replace(/^\/([A-Z]:)/, "$1"),
            fullPage: true,
          });
      }
    }
    for (tenantName of ["My DichVu1st", "Panel <safe> & Co."]) {
      await page.goto(origin + "/login");
      await check(`${theme} branding ${tenantName}`);
      assert.equal(
        await page
          .locator('[data-theme-content="brandTitle"]')
          .first()
          .textContent(),
        tenantName,
      );
    }
    tenantName = "Tenant QA";
    for (const scope of ["landing", "auth", "customer"]) {
      await page.goto(origin + `/__preview?theme=${theme}&scope=${scope}`);
      await check(`${theme} preview ${scope}`);
      assert.equal(await page.locator(".locale-picker").count(), 0);
    }
  }
  theme = "ZEN_JAPANESE";
  for (const locale of ["vi", "en", "zh-CN", "fr", "es", "pt-BR", "id", "th", "ru", "ar"]) {
    await page.context().addCookies([
      { name: "smm_locale", value: locale, url: origin },
    ]);
    for (const path of ["/", "/login", "/dashboard"]) {
      await page.goto(origin + path);
      await page.locator("#locale-select").waitFor();
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "ar" ? "rtl" : "ltr");
      assert.equal(await page.locator("#locale-select").inputValue(), locale);
    }
  }
  for (const locale of ["vi", "en", "ar"]) {
    await page.context().addCookies([{ name: "smm_locale", value: locale, url: origin }]);
    await page.goto(origin + "/orders/new");
    await page.locator("#order-form").waitFor();
    await page.waitForFunction((expected) => document.documentElement.lang === expected, locale);
    assert.equal(await page.locator("html").getAttribute("dir"), locale === "ar" ? "rtl" : "ltr");
    assert.equal(await page.locator("#locale-select").inputValue(), locale);
    if (locale !== "ar") {
      assert.equal(await page.locator('label span[data-i18n="customer.orders.platformLabel"]').innerText(), locale === "vi" ? "Nền tảng" : "Platform");
      assert.equal(await page.locator('label span[data-i18n="customer.orders.couponLabel"]').innerText(), locale === "vi" ? "Mã giảm giá" : "Coupon code");
      assert.equal(await page.locator('option[data-i18n="customer.orders.allPlatforms"]').innerText(), locale === "vi" ? "Tất cả nền tảng" : "All platforms");
    }
  }
  for (theme of (process.env.QA_THEMES?.split(",") || ["AURORA_MODERN", "AI_COSMIC_FUTURE"])) {
    await page.context().addCookies([{ name: "smm_locale", value: "vi", url: origin }]);
    await page.goto(origin + "/");
    await page.locator("#locale-select").waitFor();
    const viHero = await page.locator("h1").first().innerText();
    await page.context().addCookies([{ name: "smm_locale", value: "en", url: origin }]);
    await page.reload();
    await page.locator("#locale-select").waitFor();
    if (theme === "AI_COSMIC_FUTURE") assert.notEqual(await page.locator("h1").first().innerText(), viHero, theme + " must localize hero copy");
  }
  theme = "AI_COSMIC_FUTURE";
  await page.context().addCookies([{ name: "smm_locale", value: "vi", url: origin }]);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, marker] of [
      ["/", '[data-renderer="ai-cosmic-landing-page"]'],
      ["/login", '[data-renderer="ai-cosmic-auth-page"]'],
      ["/dashboard", '[data-renderer="ai-cosmic-customer-page"]'],
      ["/orders/new", '[data-renderer="ai-cosmic-customer-page"]'],
    ]) {
      await page.goto(origin + path);
      await page.locator(marker).waitFor();
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      if (path === "/") {
        await page.locator(".aiv3-hero h1").waitFor();
        assert.match((await page.locator(".aiv3-hero h1").innerText()).replace(/\s+/g, " "), /Tăng trưởng thương hiệu của bạn với sức mạnh AI/);
        assert.equal(await page.locator(".aiv3-hero h1 em").innerText(), "sức mạnh AI");
        assert.equal(await page.locator(".aiv3-hero h1").evaluate(el => [...el.childNodes].map(n => n.nodeType === Node.ELEMENT_NODE ? n.tagName : "#text").join(",")), "#text,BR,#text,BR,#text,EM");
        assert.equal(await page.locator('img[src*="landing-hero.png"]').count(), 1);
        assert.equal(await page.locator(".aiv3-nav > .locale-picker").count(), 1, "AI Cosmic language picker must live in its navigation, not cover the CTA");
      }
      if (path === "/login") {
        assert.equal(await page.locator(".aiv3-portal img").count(), 1);
        assert.equal(await page.locator(".aiv3-manifesto").count(), 1);
        assert.equal(await page.locator(".auth-card").count(), 1);
      }
      if (path === "/orders/new") await page.locator("#order-form").waitFor();
      const state = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText }));
      assert.ok(state.scroll <= state.width, `AI Cosmic ${path} ${width} overflow: ${state.scroll}`);
      assert.doesNotMatch(state.text, /undefined|null|\[object Object\]/i, `AI Cosmic ${path} exposes invalid text`);
      if (width === 1440 || width === 390)
        await page.screenshot({ path: new URL(`AI_COSMIC_FUTURE-${path.slice(1).replaceAll("/", "-") || "landing"}-${width}.png`, out).pathname.replace(/^\/([A-Z]:)/, "$1"), fullPage: true });
    }
  }
  await writeFile(
    new URL("results.json", out),
    JSON.stringify({ checks: results.length, results, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks: results.length, errors }));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
