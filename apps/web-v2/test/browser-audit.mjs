/** Deterministic browser QA only. Fixtures never ship in the runtime server. */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { landingPage, authPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { fullPageThemePreview } from "../dist/theme-builder.js";
import { referencePages } from "../dist/reference-runtime.js";
import { themeIds } from "../dist/themes.js";
import { tenantBranding } from "../dist/branding.js";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const out = new URL("./artifacts/", import.meta.url);
const auditBatches = {
  A: ["AURORA_MODERN", "AI_COSMIC_FUTURE"],
  B: ["CREATOR_POP", "URBAN_LIME_BRUTAL", "CYBER_NEON_CITY"],
  C: ["PRISM_GLASS", "OCEAN_PREMIUM", "BLUE_BUSINESS"],
  D: ["ZEN_JAPANESE", "BLACK_GOLD_LUXURY", "BEIGE_EDITORIAL"],
};
const requestedThemes = process.env.QA_THEMES?.split(",").map((value) => value.trim()).filter(Boolean);
const batchKey = (process.env.QA_THEME_BATCH || process.env.QA_BATCH || "").toUpperCase();
if (requestedThemes && batchKey) throw new Error("Use either QA_THEMES or QA_THEME_BATCH, not both.");
if (batchKey && !auditBatches[batchKey]) throw new Error(`Unknown QA_THEME_BATCH ${batchKey}; use A, B, C, or D.`);
const selectedThemes = requestedThemes || auditBatches[batchKey] || themeIds;
if (new Set(selectedThemes).size !== selectedThemes.length || selectedThemes.some((id) => !themeIds.includes(id)))
  throw new Error(`QA theme filter contains an unknown or repeated theme: ${selectedThemes.join(",")}`);
const batchName = batchKey || (requestedThemes ? `custom-${selectedThemes.join("-")}` : "all");
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
const testBranding = () => tenantBranding("qa.example.test", { siteName: tenantName });
res.setHeader("content-type", "text/html; charset=utf-8");
res.end(
  url.pathname === "/__preview"
      ? fullPageThemePreview(
          "",
          url.searchParams.get("theme"),
          url.searchParams.get("scope"),
          testBranding(),
        )
      : url.pathname === "/"
        ? landingPage("", testBranding())
        : kinds[url.pathname]
          ? authPage("", kinds[url.pathname], "", testBranding())
          : customerPage("", url.pathname, testBranding()),
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext();
const errors = [],
  results = [];
let theme,
  tenantName = "Tenant QA";
let page = await context.newPage();
const configurePage = (target) => {
  target.setDefaultTimeout(15000);
  target.setDefaultNavigationTimeout(15000);
  target.on("pageerror", (e) => errors.push(e.message));
  return target;
};
configurePage(page);
const navigate = async (url) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      const retryable = /ERR_NETWORK_IO_SUSPENDED|ERR_NETWORK_CHANGED|ERR_ABORTED/.test(String(error));
      if (!retryable || attempt >= 2) throw error;
      console.log(JSON.stringify({ event: "navigation-retry", url, attempt: attempt + 1 }));
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
};
const mutations = [];
await context.addCookies([{ name: "smm_csrf", value: "qa-csrf", url: origin }]);
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
await context.route("**/api/**", async (route) => {
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
async function performCheck(label) {
  const debugCheck = label.includes("/support/1");
  const debug = (stage) => {
    if (debugCheck) console.log(JSON.stringify({ event: "check-step", batch: batchName, theme, label, stage }));
  };
  if (results.length < 3)
    console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "check-start", label }));
  if (theme === "AI_COSMIC_FUTURE")
    await page.locator('[data-renderer^="ai-cosmic-"]').waitFor();
  else if (Object.hasOwn(referencePages, theme))
    await page.locator("[data-reference-page]").waitFor();
  else await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
  debug("theme-ready");
  if (["PRISM_GLASS", "OCEAN_PREMIUM", "ZEN_JAPANESE", "BLACK_GOLD_LUXURY"].includes(theme)) {
    const headline = page.locator("[data-reference-page] h1, .customer-content h1").first();
    if (await headline.count()) {
      const heading = await headline.evaluate((el) => ({ text: el.textContent || "", font: getComputedStyle(el).fontFamily, spacing: getComputedStyle(el).letterSpacing }));
      assert.equal(heading.text.normalize("NFC"), heading.text, label + " Vietnamese headline must be NFC");
      assert.doesNotMatch(heading.text, /\uFFFD|TÃ|Ä‘|áº|á»|â€/);
      if (/Times New Roman|Georgia|DejaVu Serif|,\s*serif(?:,|$)/i.test(heading.font)) {
        assert.match(heading.font, /Times New Roman/i, label + " includes a Vietnamese-capable Times fallback");
        assert.match(heading.font, /Georgia/i, label + " includes a Vietnamese-capable Georgia fallback");
        assert.match(heading.font, /DejaVu Serif/i, label + " includes a Vietnamese-capable DejaVu fallback");
        assert.match(heading.spacing, /^(?:normal|0px)$/, label + " does not track Vietnamese marks apart");
      }
    }
  }
  if (await page.locator("#app").count()) {
    if (!label.includes(" preview "))
      await page.locator("#app .skeleton").waitFor({ state: "detached" });
    debug("skeleton-detached");
    const errorState = page.locator("#app .error-state");
    const errorCount = await errorState.count();
    assert.equal(
      errorCount,
      0,
      label + " unexpected error state" + (errorCount ? ": " + (await errorState.first().textContent()) : ""),
    );
  }
  debug("app-stable");
  const isVisualPage = / (?:landing|auth|customer) (?:1440|1280|768|390)$/.test(label)
    || /\/orders\/(?:new|bulk) (?:1440|390)$/.test(label);
  if (isVisualPage) {
    let imageAuditTimer;
    const imageAudit = page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.race([
        Promise.all(images.map((image) => image.decode().catch(() => {}))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      return images
        .filter((image) => !image.complete)
        .map((image) => image.currentSrc || image.src);
    });
    const pendingImages = await Promise.race([
      imageAudit,
      new Promise((_, reject) => {
        imageAuditTimer = setTimeout(
          () => reject(new Error(label + " image audit renderer did not respond within 15 seconds")),
          15000,
        );
      }),
    ]).finally(() => clearTimeout(imageAuditTimer));
    assert.deepEqual(
      pendingImages,
      [],
      label + " images did not finish loading before the visual audit timeout",
    );
  }
  debug("images-done");
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
  debug("overflow-read");
  assert.ok(
    overflow.scroll <= overflow.width + 2,
    label + " overflow " + JSON.stringify(overflow),
  );
  assert.deepEqual(errors, [], label + " JS errors");
  results.push(label);
  if (results.length % 25 === 0) console.log(JSON.stringify({ event: "progress", batch: batchName, checks: results.length, last: label }));
}
async function check(label) {
  let timer;
  try {
    return await Promise.race([
      performCheck(label),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(label + " browser audit check did not complete within 45 seconds")),
          45000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const landingSelectors = (theme) => theme === "AI_COSMIC_FUTURE"
  ? { eyebrow: ".aiv3-hero small", title: ".aiv3-hero h1", description: ".aiv3-hero p", cta: ".aiv3-actions .aiv3-primary span", nav: ".aiv3-nav nav a", benefit: "", feature: "", topology: "#text,BR,#text,BR,#text,EM", localized: true }
  : theme === "AURORA_MODERN"
    ? { eyebrow: ".hero .eyebrow", title: ".hero h1", description: ".hero .lead", cta: ".hero-actions .button span", nav: ".header nav a", benefit: "#services h2", feature: "#services h3", localized: false }
    : { eyebrow: ".ref-copy small", title: ".ref-copy h1", description: ".ref-copy p", cta: ".ref-cta span", nav: ".ref-nav nav a", benefit: ".ref-benefits h2", feature: ".ref-benefits h3", topology: "#text,EM", localized: true };
const landingCopy = async (selectors) => page.evaluate((s) => {
  const text = (selector) => selector ? document.querySelector(selector)?.textContent?.trim() ?? "" : "";
  const title = document.querySelector(s.title);
  return {
    eyebrow: text(s.eyebrow), title: text(s.title), description: text(s.description),
    cta: text(s.cta), nav: text(s.nav), benefit: text(s.benefit), feature: text(s.feature),
    topology: title ? [...title.childNodes].map((node) => node.nodeType === Node.ELEMENT_NODE ? node.tagName : "#text").join(",") : "",
  };
}, selectors);
try {
  for (theme of selectedThemes) {
    const themeStartCount = results.length;
    console.log(JSON.stringify({ event: "theme-start", batch: batchName, theme }));
    await page.context().addCookies([
      { name: "smm_locale", value: "vi", url: origin },
    ]);
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "initial-cookie-set" }));
    await navigate(origin + "/");
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "initial-landing-loaded" }));
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-landing-page"]').waitFor();
    else if (Object.hasOwn(referencePages, theme)) await page.locator("[data-reference-page]").waitFor();
    else await page.locator(".hero h1").waitFor();
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "initial-theme-ready" }));
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme, "requested theme must be active before assertions");
    const selectors = landingSelectors(theme);
    if (theme === "AI_COSMIC_FUTURE") assert.equal(await page.locator("[data-renderer]").getAttribute("data-renderer"), "ai-cosmic-landing-page");
    else if (Object.hasOwn(referencePages, theme)) assert.ok(await page.locator("[data-reference-page]").count(), `${theme} must use its reference renderer`);
    else assert.ok(await page.locator(".hero h1").count(), `${theme} must use the Aurora landing structure`);
    const vietnamese = await landingCopy(selectors);
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "initial-copy-read" }));
    if (selectors.topology) assert.equal(vietnamese.topology, selectors.topology, `${theme} title retains its authored DOM structure`);
    assert.ok(vietnamese.title, `${theme} has a visible landing headline`);
    assert.doesNotMatch(vietnamese.title, /\uFFFD|TÃ|Ä‘|áº|á»|â€/);
    await page.context().addCookies([
      { name: "smm_locale", value: "en", url: origin },
    ]);
    await page.reload();
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "english-reload-done" }));
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-landing-page"]').waitFor();
    else if (Object.hasOwn(referencePages, theme)) await page.locator("[data-reference-page]").waitFor();
    else await page.locator(".hero h1").waitFor();
    const english = await landingCopy(selectors);
    if (selectors.localized) {
      for (const field of ["eyebrow", "title", "description", "cta", "nav"]) assert.notEqual(english[field], vietnamese[field], `${theme} must localize ${field}`);
      for (const field of ["benefit", "feature"]) if (vietnamese[field]) assert.notEqual(english[field], vietnamese[field], `${theme} must localize ${field}`);
      assert.equal(await page.locator('[data-i18n]').evaluateAll((els) => els.some((el) => el.textContent?.trim() === el.getAttribute('data-i18n')),), false, `${theme} exposes no unresolved translation keys`);
      assert.equal(english.nav, "Home");
    } else {
      assert.equal(english.title, vietnamese.title, `${theme} fallback copy remains intact through locale switching`);
    }
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    if (selectors.topology) assert.equal(english.topology, vietnamese.topology, `${theme} locale switching preserves title DOM topology`);
    assert.equal(await page.locator("#locale-select").inputValue(), "en");
    const urlBeforeLanguageSwitch = page.url();
    await page.locator("#locale-select").selectOption("vi");
    await page.waitForFunction(() => document.documentElement.lang === "vi");
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "locale-switch-vi-done" }));
    assert.equal(page.url(), urlBeforeLanguageSwitch, "language selector switches in place without navigation");
    if (selectors.localized) assert.equal(await page.locator(selectors.nav).first().innerText(), "Trang chủ");
  await page.locator("#locale-select").selectOption("en");
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "locale-select-en-done" }));
    await page.waitForFunction(() => document.documentElement.lang === "en");
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "locale-wait-en-done" }));
    if (selectors.localized) assert.equal(await page.locator(selectors.nav).first().innerText(), "Home");
    if (["ZEN_JAPANESE", "CREATOR_POP", "CYBER_NEON_CITY", "BLACK_GOLD_LUXURY"].includes(theme))
      await page.screenshot({
        path: new URL(`${theme}-landing-en.png`, out).pathname.replace(/^\/([A-Z]:)/, "$1"),
        fullPage: true,
      });
    await page.context().addCookies([
      { name: "smm_locale", value: "vi", url: origin },
    ]);
    if (themeStartCount === 0)
      console.log(JSON.stringify({ event: "stage", batch: batchName, theme, stage: "responsive-loop-start" }));
    for (const width of [1440, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [scope, path] of [
        ["landing", "/"],
        ["auth", "/login"],
        ["customer", "/dashboard"],
      ]) {
        await navigate(origin + path);
        await check(`${theme} ${scope} ${width}`);
        if (scope === "customer") {
          if (Object.hasOwn(referencePages, theme)) {
            await page.locator("[data-reference-overview]").waitFor();
            assert.match(await page.locator(".metric-grid").innerText(), /17/);
          } else if (theme === "AI_COSMIC_FUTURE") {
            await page.locator(".aiv3-kpis").waitFor();
            assert.match(await page.locator(".aiv3-kpis").innerText(), /17/);
          } else {
            await page.locator("#app .metric-grid").waitFor();
            assert.match(await page.locator("#app .metric-grid").innerText(), /17/);
          }
        }
        const tenantBrand = page.locator('[data-theme-content="brandTitle"], [data-tenant-name]').first();
        assert.ok(await tenantBrand.count(), `${theme} ${scope} retains a tenant-brand marker`);
        const brandedText = await tenantBrand.textContent() || "";
        if (tenantName.includes("DichVu1st"))
          assert.match(brandedText, /My DichVu1st/, "configured tenant text may contain the former root brand name");
        else assert.doesNotMatch(brandedText, /DichVu1st/i);
        if ((width === 1440 || width === 390) && Object.hasOwn(referencePages, theme))
          await page.screenshot({
            path: new URL(
              `${theme}-${scope}-${width}.png`,
              out,
            ).pathname.replace(/^\/([A-Z]:)/, "$1"),
            fullPage: true,
          });
        if (Object.hasOwn(referencePages, theme) && scope === "customer" && width <= 768 && await page.locator("#drawer-toggle").isVisible()) {
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
      await navigate(origin + path);
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
    await navigate(origin + "/login");
    if (theme === "AI_COSMIC_FUTURE") await page.locator('[data-renderer="ai-cosmic-auth-page"]').waitFor();
    else if (Object.hasOwn(referencePages, theme)) await page.locator("[data-reference-page]").waitFor();
    else await page.locator(".auth-card").waitFor();
    await page.locator("#email").fill("qa@example.test");
    await page.locator("#password").fill("WrongPassword1");
    await page.locator(".toggle").click();
    assert.equal(await page.locator("#password").getAttribute("type"), "text");
    await page.locator("button[type=submit]").click();
    await page
      .locator("#message")
      .filter({ hasText: "Email hoặc mật khẩu không đúng" })
      .waitFor();
    await navigate(origin + "/orders/new");
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
        await navigate(origin + path);
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
      if (width !== 390) {
        await page.close();
        page = configurePage(await context.newPage());
      }
    }
    for (tenantName of ["My DichVu1st", "Panel <safe> & Co."]) {
      await navigate(origin + "/login");
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
      await navigate(origin + `/__preview?theme=${theme}&scope=${scope}`);
      await check(`${theme} preview ${scope}`);
      assert.equal(await page.locator(".locale-picker").count(), 0);
    }
    console.log(JSON.stringify({ event: "theme-done", batch: batchName, theme, checks: results.length - themeStartCount }));
  }
  for (theme of ["AURORA_MODERN", "AI_COSMIC_FUTURE"].filter((id) => selectedThemes.includes(id))) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const path of [
        "/", "/login", "/register", "/forgot-password", "/reset-password",
        "/dashboard", "/orders/new", "/orders/bulk", "/orders",
        "/services", "/wallet", "/deposit", "/transactions", "/panels",
        "/panels/new", "/panel-plans", "/affiliate", "/api", "/support",
        "/notifications", "/account",
      ]) {
        await navigate(origin + path);
        await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
        await check(`${theme} ${path} ${width}`);
        if (path === "/orders/new") await page.locator("#order-form").waitFor();
        if (path === "/login") await page.locator("#email").waitFor();
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      }
    }
  }
  theme = "ZEN_JAPANESE";
  for (const locale of selectedThemes.includes("ZEN_JAPANESE") ? ["vi", "en", "zh-CN", "fr", "es", "pt-BR", "id", "th", "ru", "ar"] : []) {
    await page.context().addCookies([
      { name: "smm_locale", value: locale, url: origin },
    ]);
    for (const path of ["/", "/login", "/dashboard"]) {
      await navigate(origin + path);
      await page.locator("#locale-select").waitFor();
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("dir"), locale === "ar" ? "rtl" : "ltr");
      assert.equal(await page.locator("#locale-select").inputValue(), locale);
    }
  }
  for (const locale of ["vi", "en", "ar"]) {
    if (!selectedThemes.includes("AURORA_MODERN") && !selectedThemes.includes("AI_COSMIC_FUTURE")) break;
    await page.context().addCookies([{ name: "smm_locale", value: locale, url: origin }]);
    await navigate(origin + "/orders/new");
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
  for (theme of selectedThemes) {
    await page.context().addCookies([{ name: "smm_locale", value: "vi", url: origin }]);
    await navigate(origin + "/");
    await page.locator("#locale-select").waitFor();
    const viHero = await page.locator("h1").first().innerText();
    await page.context().addCookies([{ name: "smm_locale", value: "en", url: origin }]);
    await page.reload();
    await page.locator("#locale-select").waitFor();
    if (theme === "AI_COSMIC_FUTURE") assert.notEqual(await page.locator("h1").first().innerText(), viHero, theme + " must localize hero copy");
  }
  theme = "AI_COSMIC_FUTURE";
  if (selectedThemes.includes(theme)) {
  await page.context().addCookies([{ name: "smm_locale", value: "vi", url: origin }]);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, marker] of [
      ["/", '[data-renderer="ai-cosmic-landing-page"]'],
      ["/login", '[data-renderer="ai-cosmic-auth-page"]'],
      ["/dashboard", '[data-renderer="ai-cosmic-customer-page"]'],
      ["/orders/new", '[data-renderer="ai-cosmic-customer-page"]'],
    ]) {
      await navigate(origin + path);
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
  }
  const report = { batch: batchName, themes: selectedThemes, checks: results.length, errors };
  await writeFile(new URL(`results-${batchName}.json`, out), JSON.stringify({ ...report, results }, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
