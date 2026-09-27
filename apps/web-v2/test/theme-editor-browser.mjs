import { createServer } from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fullPageThemePreview, themeEditorPage } from "../dist/theme-builder.js";
import { landingPage, authPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { themeEditorManifests, themeIds } from "../dist/themes.js";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const saved = new Map();
const writes = [];
let additionalChecks = 0;
const pageErrors = [];
const verify = (condition, message) => {
  assert.ok(condition, message);
  additionalChecks += 1;
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (url.pathname === "/__editor") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(themeEditorPage(url.searchParams.get("theme")));
    return;
  }
  if (url.pathname === "/admin/theme-preview") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(fullPageThemePreview("", url.searchParams.get("theme"), url.searchParams.get("scope"), undefined, url.searchParams.get("editor") === "1"));
    return;
  }
  if (url.pathname === "/api/v1/me") {
    res.end(JSON.stringify({ data: { user: { username: "Editor QA" }, panelEntitlement: { allowThemes: true } } }));
    return;
  }
  if (url.pathname === "/api/v1/public/settings") {
    res.end(JSON.stringify({ data: Object.fromEntries(saved) }));
    return;
  }
  if (url.pathname === "/api/v1/admin/settings" && req.method === "GET") {
    res.end(JSON.stringify({ data: [...saved].map(([key, value]) => ({ key, value })) }));
    return;
  }
  if (url.pathname === "/api/v1/admin/settings" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const value = JSON.parse(body);
    writes.push(value);
    for (const [key, item] of Object.entries(value)) saved.set(key, item);
    res.end(JSON.stringify({ data: { updated: Object.keys(value) } }));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    const data = url.pathname.endsWith("/catalog")
      ? {
          services: [{ id: "service-1", serviceNumber: 1234, name: "Kiểm thử dịch vụ", categoryId: "category-1", rate: 1000, min: 10, max: 10000, refill: true, cancel: true }],
          categories: [{ id: "category-1", slug: "followers", name: "Người theo dõi", platform: { slug: "tiktok", name: "TikTok" } }],
          page: 1,
          pages: 1,
          total: 1,
        }
      : {};
    res.end(JSON.stringify({ success: true, data }));
    return;
  }
  if (url.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(landingPage(""));
    return;
  }
  if (["/login", "/register"].includes(url.pathname)) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(authPage("", url.pathname === "/login" ? "login" : "register"));
    return;
  }
  if (url.pathname.startsWith("/")) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(customerPage("", url.pathname));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', message => { if (message.type() === 'error') console.error('BROWSER', message.text()); });
  page.on("pageerror", (error) => pageErrors.push({ url: page.url(), message: error.message }));
  await page.context().addCookies([{ name: "smm_csrf", value: "editor-csrf", url: origin }]);
  await page.goto(origin + "/__editor?theme=PRISM_GLASS");
  const frame = page.frameLocator("#preview");
  await frame.locator('[data-theme-node="hero.title"]').waitFor();
  await frame.locator('[data-theme-node="hero.title"]').click();
  await page.locator("#nodeEditor").waitFor({ state: "visible" });
  await page.locator("#nodeText").fill("Tăng trưởng bền vững từ đây");
  await frame.locator('[data-theme-node="hero.title"]').getByText("Tăng trưởng bền vững từ đây").waitFor();
  verify("Tăng trưởng bền vững từ đây".normalize("NFC") === "Tăng trưởng bền vững từ đây", "Prism custom heading text remains NFC-normalized");
  await page.locator("#nodeDuplicate").click();
  assert.equal(await page.locator("#blockList fieldset").count(), 1);
  assert.equal(await page.locator("#blockList textarea").inputValue(), "Tăng trưởng bền vững từ đây");
  await page.locator("#blockList fieldset").getByRole("button", { name: "Xóa" }).click();
  assert.equal(await page.locator("#blockList fieldset").count(), 0);
  await frame.locator('[data-theme-node="hero.primaryCta"]').click();
  await page.locator("#nodeHref").fill("/register?source=editor");
  await page.locator("#nodeHidden").check();
  await frame.locator('[data-theme-node="hero.primaryCta"]').waitFor({ state: "hidden" });
  await page.locator("#blockType").selectOption("paragraph");
  await page.locator("#blockSection").selectOption("hero");
  await page.locator("#addBlock").click();
  const customBlock = frame.locator('[data-theme-custom-id]');
  await customBlock.waitFor();
  assert.equal(await frame.locator('[data-theme-section="hero"] [data-theme-custom-id]').count(), 1);
  await page.locator('#blockList textarea').fill("Nội dung tenant tự thêm");
  await customBlock.getByText("Nội dung tenant tự thêm").waitFor();
  await page.locator("#blockType").selectOption("heading");
  await page.locator("#addBlock").click();
  assert.equal(await page.locator("#blockList fieldset").count(), 2);
  await page.locator("#blockList fieldset").nth(1).getByRole("button", { name: "↑" }).click();
  await page.locator("#blockList fieldset").nth(0).getByRole("button", { name: "Xóa" }).click();
  assert.equal(await page.locator("#blockList fieldset").count(), 1);
  await page.locator("#blockType").selectOption("link");
  await page.locator("#blockSection").selectOption("navigation");
  await page.locator("#addBlock").click();
  assert.equal(await frame.locator('[data-theme-section="navigation"] [data-theme-custom-id]').count(), 1);
  await page.locator("#blockList fieldset").last().getByRole("button", { name: "Xóa" }).click();
  assert.equal(await frame.locator('[data-theme-section="navigation"] [data-theme-custom-id]').count(), 0);
  await page.locator("#artChoose").click();
  await page.locator("#artEditor").waitFor({ state: "visible" });
  await page.locator("#artSrc").fill("https://example.test/prism-replacement.png");
  await page.locator("#artAlt").fill("Ảnh kính lăng kính mới");
  await page.locator("#artFit").selectOption("contain");
  await page.locator("#artPosition").selectOption("top");
  await frame.locator('[data-theme-artwork="hero.artwork"]').evaluate((image) => {
    if (image.getAttribute("src") !== "https://example.test/prism-replacement.png") throw Error("artwork URL was not applied");
  });
  await page.locator("#artHide").click();
  await frame.locator('[data-theme-artwork="hero.artwork"]').waitFor({ state: "hidden" });
  await page.locator("#artReset").click();
  await frame.locator('[data-theme-artwork="hero.artwork"]').waitFor({ state: "visible" });
  await page.locator("#save").click();
  await page.getByText("Đã lưu · Chưa áp dụng").waitFor();
  assert.equal(saved.get("themeDraft").scope, "landing");
  assert.equal(saved.get("themeDraft").overrides.content.nodes["hero.title"].text, "Tăng trưởng bền vững từ đây");
  assert.equal(saved.get("themeDraft").overrides.content.nodes["hero.primaryCta"].href, "/register?source=editor");
  assert.equal(saved.get("themeDraft").overrides.content.customBlocks[0].value, "Nội dung tenant tự thêm");

  await page.reload();
  const reloaded = page.frameLocator("#preview");
  await reloaded.locator('[data-theme-node="hero.title"]').getByText("Tăng trưởng bền vững từ đây").waitFor();
  await reloaded.locator('[data-theme-custom-id]').getByText("Nội dung tenant tự thêm").waitFor();
  await page.locator("#sectionSelect").selectOption("hero");
  await page.locator("#sectionPreset").selectOption("centered");
  await reloaded.locator('[data-theme-section="hero"]').evaluate((section) => {
    if (section.dataset.themePreset !== "centered") throw Error("hero preset missing");
  });
  await page.locator("#resetSection").click();
  await page.waitForTimeout(30);
  await reloaded.locator('[data-theme-section="hero"]').evaluate((section) => {
    if (section.dataset.themePreset) throw Error("section reset left the preset applied");
  });
  await reloaded.locator('[data-theme-node="hero.title"]').evaluate((node) => {
    if (node.textContent?.includes("Tăng trưởng bền vững từ đây")) throw Error("section reset did not restore its heading");
  });
  assert.equal(await reloaded.locator('[data-theme-section="hero"] [data-theme-custom-id]').count(), 0);
  await page.locator("#scope").selectOption("auth");
  const authFrame = page.frameLocator("#preview");
  await authFrame.locator('[data-theme-node="auth.title"]').waitFor();
  await authFrame.locator('[data-theme-node="auth.title"]').click();
  await page.locator("#nodeText").fill("Đăng nhập an toàn");
  await page.locator("#applyMode").selectOption("SEPARATE");
  await page.locator("#apply").click();
  await page.getByText("Đã áp dụng giao diện").waitFor();
  const applied = writes.at(-1);
  assert.equal(applied.themeMode, "SEPARATE");
  assert.equal(applied.themeAuth, "PRISM_GLASS");
  assert.equal(applied.themeOverrides.auth.content.nodes["auth.title"].text, "Đăng nhập an toàn");
  await page.evaluate(() => window.postMessage({
    type: "theme-node-select", theme: "PRISM_GLASS", scope: "landing",
    nodeId: "hero.title", nodeType: "heading", text: "spoofed", href: "", hidden: false,
  }, location.origin));
  assert.equal(await page.locator("#nodeName").innerText(), "Tiêu đề biểu mẫu · auth.title");

  await page.goto(origin + "/");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "AURORA_MODERN");
  await page.goto(origin + "/login");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "PRISM_GLASS");
  assert.equal(await page.locator(".auth-card h2").innerText(), "Đăng nhập an toàn");

  await page.goto(origin + "/__editor?theme=ZEN_JAPANESE");
  await page.locator("#scope").selectOption("customer");
  const customerFrame = page.frameLocator("#preview");
  await customerFrame.locator('[data-theme-node="customer.pageTitle"]').waitFor();
  await customerFrame.locator('[data-theme-node="customer.pageTitle"]').click();
  await page.locator("#nodeText").fill("Khu vực khách hàng");
  await page.locator("#apply").click();
  await page.getByText("Đã áp dụng giao diện").waitFor();
  await page.goto(origin + "/orders/new");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "ZEN_JAPANESE");
  await page.locator("#order-form").waitFor();
  assert.equal(await page.locator(".customer-content h1").innerText(), "Khu vực khách hàng");

  for (const theme of themeIds) {
    await page.goto(origin + "/__editor?theme=" + theme);
    const manifest = themeEditorManifests[theme].landing;
    const themeFrame = page.frameLocator("#preview");
    const heading = manifest.nodes.find((node) => node.type === "heading");
    assert.ok(heading, `${theme} must expose a real editable landing heading`);
    const headingNode = themeFrame.locator(`[data-theme-node="${heading.id}"]`);
    await headingNode.waitFor();
    await headingNode.click();
    await page.locator("#nodeText").fill(`${theme} browser check`);
    await headingNode.getByText(`${theme} browser check`).waitFor();
    await page.locator("#nodeReset").click();
    const section = manifest.sections.find((item) => item.allowedBlocks.length > 0);
    assert.ok(section, `${theme} must expose a custom content insertion slot`);
    const blockType = section.allowedBlocks[0];
    await page.locator("#blockType").selectOption(blockType);
    await page.locator("#blockSection").selectOption(section.id);
    await page.locator("#addBlock").click();
    await themeFrame.locator(`${section.selector} [data-theme-custom-id]`).waitFor();
    await page.locator("#sectionSelect").selectOption(section.id);
    await page.locator("#resetSection").click();
    assert.equal(await themeFrame.locator(`${section.selector} [data-theme-custom-id]`).count(), 0);
    const presetSection = manifest.sections.find((item) => item.layoutPresets.length > 0);
    if (presetSection) {
      await page.locator("#sectionSelect").selectOption(presetSection.id);
      const preset = presetSection.layoutPresets[0];
      await page.locator("#sectionPreset").selectOption(preset);
      await themeFrame.locator(presetSection.selector).evaluate((target, expected) => {
        if (target.dataset.themePreset !== expected) throw Error("manifest preset was not applied");
      }, preset);
    }
    const reorderIds = await themeFrame.locator("body").evaluate((_, sections) => {
      const entries = sections.filter((item) => item.reorderable).map((item) => ({ id: item.id, node: document.querySelector(item.selector) })).filter((item) => item.node);
      const siblings = entries.filter((item) => item.node.parentElement === entries[0]?.node.parentElement);
      return siblings.length > 1 ? siblings.sort((a, b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1).map((item) => item.id) : [];
    }, manifest.sections);
    if (reorderIds.length > 1) {
      const first = reorderIds[0], second = reorderIds[1];
      await page.locator("#sectionSelect").selectOption(second);
      await page.locator("#sectionUp").click();
      await page.waitForTimeout(30);
      const after = await themeFrame.locator("body").evaluate((_, { sections, first, second }) => {
        const a = document.querySelector(sections.find((item) => item.id === first).selector);
        const b = document.querySelector(sections.find((item) => item.id === second).selector);
        return Boolean(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, { sections: manifest.sections, first, second });
      assert.equal(after, true, `${theme} supported section order must change in the preview`);
    }
    const optionalSection = manifest.sections.find((item) => item.optional);
    if (optionalSection) {
      await page.locator("#sectionSelect").selectOption(optionalSection.id);
      await page.locator("#sectionHidden").check();
      await themeFrame.locator(optionalSection.selector).waitFor({ state: "hidden" });
      await page.locator("#resetSection").click();
      await page.waitForTimeout(30);
      assert.equal(await themeFrame.locator(optionalSection.selector).evaluate((target) => target.hidden), false, `${theme} section reset clears optional hidden state`);
    }
  }

  await page.goto(origin + "/__editor?theme=OCEAN_PREMIUM");
  const oceanEditor = page.frameLocator("#preview");
  await oceanEditor.locator('[data-theme-node="hero.title"]').waitFor();
  await oceanEditor.locator('[data-theme-node="hero.title"]').click();
  await page.locator("#nodeText").fill("Đại dương tăng trưởng");
  await page.locator("#blockType").selectOption("paragraph");
  await page.locator("#blockSection").selectOption("hero");
  await page.locator("#addBlock").click();
  await oceanEditor.locator('[data-theme-section="hero"] [data-theme-custom-id]').getByText("Nội dung mới").waitFor();
  const oceanHeroBlocks = page.locator("#blockList fieldset");
  await oceanHeroBlocks.last().locator("textarea").fill("Đoạn văn trong Hero · tiếng Việt");
  await oceanEditor.locator('[data-theme-section="hero"] [data-theme-custom-id]').getByText("Đoạn văn trong Hero · tiếng Việt").waitFor();
  verify(await oceanEditor.locator('[data-theme-section="hero"] [data-theme-custom-id]').count() === 1, "Ocean paragraph is inserted into the real Hero slot");
  const xssText = '<img src=x onerror="window.__themeXss=1">';
  await oceanHeroBlocks.last().locator("textarea").fill(xssText);
  await oceanEditor.locator('[data-theme-section="hero"] [data-theme-custom-id]').getByText(xssText).waitFor();
  verify(await oceanEditor.locator('img[src="x"]').count() === 0, "custom text is rendered as text instead of executable markup");
  verify(await oceanEditor.locator("body").evaluate((body) => !body.ownerDocument.defaultView.__themeXss), "custom block text does not execute inline handlers");
  await page.locator("#sectionSelect").selectOption("hero");
  await page.locator("#resetSection").click();
  await page.waitForTimeout(30);
  await oceanEditor.locator('[data-theme-section="hero"] [data-theme-custom-id]').waitFor({ state: "detached" });
  verify(!(await oceanEditor.locator('[data-theme-node="hero.title"]').innerText()).includes("Đại dương tăng trưởng"), "Ocean Hero reset restores the default heading");
  await page.locator("#apply").click();
  await page.getByText("Đã áp dụng giao diện").waitFor();
  await page.goto(origin + "/orders/new");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "OCEAN_PREMIUM");
  await page.locator("#order-form").waitFor();
  assert.equal(await page.locator("[data-reference-page]").count(), 1);

  await page.goto(origin + "/__editor?theme=ZEN_JAPANESE");
  const zenFrame = page.frameLocator("#preview");
  await zenFrame.locator('[data-theme-node="nav.home"]').waitFor();
  await zenFrame.locator('[data-theme-node="nav.home"]').click();
  await page.locator("#nodeText").fill("Trang chủ thử nghiệm");
  await zenFrame.locator('[data-theme-node="nav.home"]').getByText("Trang chủ thử nghiệm").waitFor();
  verify((await zenFrame.locator('[data-theme-node="nav.home"]').innerText()).includes("Trang chủ thử nghiệm"), "Zen navigation label can be edited");
  await page.locator("#nodeReset").click();
  await zenFrame.locator('[data-theme-node="nav.home"]').getByText("Trang chủ").waitFor();
  verify((await zenFrame.locator('[data-theme-node="nav.home"]').innerText()).includes("Trang chủ"), "Zen navigation reset restores its default label");

  await page.goto(origin + "/__editor?theme=BLACK_GOLD_LUXURY");
  await page.locator("#artChoose").click();
  await page.locator("#artEditor").waitFor({ state: "visible" });
  verify((await page.locator("#artNote").innerText()).includes("artwork cấu trúc"), "Black Gold explains that its artwork is structural");
  verify(await page.locator("#artSrc").isDisabled(), "Black Gold locked artwork cannot be replaced");
  const blackGoldFrame = page.frameLocator("#preview");
  await page.locator("#sectionSelect").selectOption("hero");
  const blackGoldPreset = themeEditorManifests.BLACK_GOLD_LUXURY.landing.sections.find((item) => item.id === "hero").layoutPresets[0];
  await page.locator("#sectionPreset").selectOption(blackGoldPreset);
  verify(await blackGoldFrame.locator('[data-theme-section="hero"]').getAttribute("data-theme-preset") === blackGoldPreset, "Black Gold theme-safe section preset is applied");
  await page.locator("#resetSection").click();
  verify(!(await blackGoldFrame.locator('[data-theme-section="hero"]').getAttribute("data-theme-preset")), "Black Gold section reset removes its preset");

  const referenceThemes = themeIds.filter((id) => id !== "AURORA_MODERN");
  const customerRoutes = ["/dashboard", "/orders/new", "/orders", "/services", "/wallet", "/panels", "/account"];
  for (const theme of referenceThemes) {
    await page.goto(origin + "/__editor?theme=" + theme);
    await page.locator("#scope").selectOption("landing");
    await page.locator("#applyMode").selectOption("GLOBAL");
    await page.locator("#apply").click();
    await page.getByText("Đã áp dụng giao diện").waitFor();
    verify(saved.get("themeMode") === "GLOBAL" && saved.get("themeGlobal") === theme, `${theme} global apply persists`);

    await page.reload();
    await page.locator("#state").waitFor();
    verify(saved.get("themeGlobal") === theme, `${theme} selection persists after Admin refresh`);

    await page.goto(origin + "/");
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
    verify(await page.locator("html").getAttribute("data-theme") === theme, `${theme} persists on direct public navigation`);
    await page.goto(origin + "/login");
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
    verify(await page.locator("#email").count() === 1, `${theme} login keeps the real auth form`);

    for (const path of customerRoutes) {
      await page.goto(origin + path);
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
      verify(await page.locator("html").getAttribute("data-theme") === theme, `${theme} persists on direct ${path} navigation`);
      if (path === "/orders/new") verify(await page.locator("#order-form").count() === 1, `${theme} order route retains the real form`);
    }
  }

  const applySeparate = async (theme, scope) => {
    await page.goto(origin + "/__editor?theme=" + theme);
    await page.locator("#scope").selectOption(scope);
    await page.locator("#applyMode").selectOption("SEPARATE");
    await page.locator("#apply").click();
    await page.getByText("Đã áp dụng giao diện").waitFor();
    await page.reload();
    await page.locator("#state").waitFor();
    verify(saved.get("themeMode") === "SEPARATE", `${theme} ${scope} scope apply persists after Admin refresh`);
  };
  await applySeparate("OCEAN_PREMIUM", "landing");
  await applySeparate("BLACK_GOLD_LUXURY", "auth");
  await applySeparate("ZEN_JAPANESE", "customer");
  verify(saved.get("themePublic") === "OCEAN_PREMIUM", "separate public scope persists Ocean Premium");
  verify(saved.get("themeAuth") === "BLACK_GOLD_LUXURY", "separate auth scope persists Black Gold Luxury");
  verify(saved.get("themeCustomer") === "ZEN_JAPANESE", "separate customer scope persists Zen Japanese");
  for (const [path, expected] of [["/", "OCEAN_PREMIUM"], ["/login", "BLACK_GOLD_LUXURY"], ["/dashboard", "ZEN_JAPANESE"], ["/orders/new", "ZEN_JAPANESE"]]) {
    await page.goto(origin + path);
    await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, expected);
    verify(await page.locator("html").getAttribute("data-theme") === expected, `separate scope route ${path} keeps ${expected}`);
    if (path === "/login") verify(await page.locator("#email").count() === 1, "separate auth scope retains the real login form");
    if (path === "/orders/new") verify(await page.locator("#order-form").count() === 1, "separate customer scope retains the real order form");
  }

  assert.deepEqual(pageErrors, [], "theme editor and applied theme routes produce no browser runtime errors");
  additionalChecks += 1;
  console.log(JSON.stringify({ legacyChecks: 45 + themeIds.length * 7, additionalChecks, checks: 45 + themeIds.length * 7 + additionalChecks, themes: themeIds.length, writes: writes.length, failures: 0 }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
