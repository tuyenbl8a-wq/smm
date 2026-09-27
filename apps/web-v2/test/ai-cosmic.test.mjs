import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { themeIds, themeStyles, runtimeThemeScript } from "../dist/themes.js";
import { fullPageThemePreview } from "../dist/theme-builder.js";
import {
  renderAiCosmicLanding,
  renderAiCosmicDashboard,
  renderAiCosmicOverview,
  renderAiCosmicAuth,
} from "../dist/ai-cosmic-pages.js";
import { authPage, landingPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
test("Aurora remains fallback and AI remains selectable", () => {
  assert.ok(themeIds.includes("AURORA_MODERN"));
  assert.ok(themeIds.includes("AI_COSMIC_FUTURE"));
  for (const id of ["UNKNOWN", "NEON_TECH", "LUXURY_GOLD"])
    for (const scope of ["landing", "auth", "customer"])
      assert.match(
        fullPageThemePreview("", id, scope),
        /data-theme="AURORA_MODERN"/,
      );
});
test("AI auth preserves the complete real card for every auth route", () => {
  for (const kind of ["login", "register", "forgot", "reset"]) {
    const form = authPage("", kind).match(
      /<section class="auth-card">[\s\S]*?<\/section>/,
    )[0];
    assert.ok(renderAiCosmicAuth(form).includes(form));
  }
});
test("AI Cosmic retains its dedicated approved compositions and artwork", () => {
  const landing = renderAiCosmicLanding();
  assert.match(landing, /data-renderer="ai-cosmic-landing-page"/);
  assert.match(landing, /class="aiv3-nav"/);
  assert.match(landing, /class="aiv3-hero"/);
  assert.match(landing, /theme-assets\/ai-cosmic\/landing-hero\.png/);
  assert.match(landing, /class="aiv3-stats"/);
  assert.match(landing, /id="services"/);
  assert.match(landing, /class="aiv3-footer"/);
  const auth = renderAiCosmicAuth('<section class="auth-card">live form</section>');
  assert.match(auth, /data-renderer="ai-cosmic-auth-page"/);
  assert.match(auth, /class="aiv3-portal"/);
  assert.match(auth, /theme-assets\/ai-cosmic\/auth-portal\.png/);
  assert.match(auth, /class="aiv3-manifesto"/);
  const dashboard = renderAiCosmicDashboard('<aside class="sidebar">menu</aside>', '<header class="topbar">search</header>', '<main class="customer-content">live dashboard</main>');
  assert.match(dashboard, /data-renderer="ai-cosmic-customer-page"/);
  assert.match(dashboard, /class="aiv3-sidebar"/);
  assert.match(dashboard, /class="aiv3-workspace"/);
  assert.match(dashboard, /class="aiv3-customer-content"/);
  assert.match(themeStyles, /\.aiv3-landing/);
  for (const path of ["/", "/login", "/dashboard", "/orders/new"]) {
    const html = path === "/" ? landingPage("") : path === "/login" ? authPage("", "login") : customerPage("", path);
    const script = html.match(/<script>([\s\S]*?)<\/script>/g)?.join("\n") || "";
    assert.match(script, /mountAiPage/);
    assert.match(script, /AI_COSMIC_FUTURE/);
  }
  assert.match(runtimeThemeScript("", "public"), /AI_COSMIC_FUTURE/);
});
test("AI preserves pricing controls and never invents dashboard history", () => {
  const landing = fullPageThemePreview("", "AI_COSMIC_FUTURE", "landing");
  assert.match(landing, /id="pricing"/);
  assert.match(landing, /id="public-search"/);
  const empty = renderAiCosmicOverview();
  assert.match(empty, /Chưa có dữ liệu theo thời gian/);
  assert.match(empty, /Chưa kết nối/);
  assert.doesNotMatch(empty, /99.8%|12.450.000|Đang online/);
  const live = renderAiCosmicOverview({
    wallet: { balance: 120000 },
    orders: { total: 17, active: 3, completed: 14 },
  });
  assert.match(live, /120.000/);
  assert.match(live, />17</);
  assert.match(live, />3</);
  assert.match(live, />14</);
});
test("both locally served artwork files are PNG images", async () => {
  for (const asset of ["landing-hero.png", "auth-portal.png"]) {
    const bytes = await readFile(
      new URL("../public/theme-assets/ai-cosmic/" + asset, import.meta.url),
    );
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
  }
});

import vm from "node:vm";
import { tenantBranding } from "../dist/branding.js";
import { themeEditorPage } from "../dist/theme-builder.js";

test("merged tenant branding and translations produce safe executable pages", () => {
  const tenant = tenantBranding("child.test", {
    brandName: 'Panel <Sao> "A" </script>',
    logoUrl: "https://cdn.test/child-logo.png",
    faviconUrl: "https://cdn.test/child-icon.png",
  });
  const pages = [landingPage("", tenant), authPage("", "login", "", tenant), customerPage("", "/orders/new", tenant)];
  for (const html of pages) {
    assert.match(html, /Panel &lt;Sao&gt; &quot;A&quot; &lt;\/script&gt;/);
    assert.match(html, /child-logo\.png/);
    assert.match(html, /child-icon\.png/);
    assert.doesNotMatch(html, />DichVu1st</);
    assert.doesNotMatch(html, /Panel <Sao>/);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
    assert.match(scripts[0][1], /window\.__i18n/);
    assert.match(scripts[0][1], /tenantName=/);
  }
});

test("all theme previews keep tenant forms, favicon and valid preview scripts", () => {
  const tenant = tenantBranding("child.test", { brandName: "Panel Sao", faviconUrl: "https://cdn.test/favicon.png" });
  for (const theme of themeIds) {
    for (const scope of ["landing", "auth", "customer"]) {
      const html = fullPageThemePreview("", theme, scope, tenant);
      assert.ok(html.includes(`data-theme="${theme}"`));
      assert.match(html, /Panel Sao/);
      assert.match(html, /https:\/\/cdn\.test\/favicon\.png/);
      assert.doesNotMatch(html, />DichVu1st</);
      if (scope === "auth") assert.match(html, /<form novalidate>/);
      if (scope === "customer") assert.match(html, /id="app"/);
      for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new vm.Script(script));
    }
  }
});

test("theme editor enforces a denied Panel entitlement from the real API envelope", async () => {
  const html = themeEditorPage("CREATOR_POP");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const controls = [{ disabled: false }, { disabled: false }];
  const requests = [];
  const preview = { contentWindow: { postMessage() {} }, dataset: {} };
  const state = { textContent: "" };
  const select = () => ({ value: "", options: [], append(option) { this.options.push(option); if (!this.value) this.value = option.value; }, replaceChildren() { this.options = []; } });
  const controlsElement = {
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const elements = new Map([
    ["#preview", preview], ["#scope", { value: "landing" }],
    ["#applyMode", { value: "GLOBAL" }], ["#controls", controlsElement],
    ["#state", state], ["#nodeEditor", { hidden: true }],
    ["#nodeText", { value: "", closest: () => ({}) }],
    ["#nodeHref", { value: "" }], ["#nodeHidden", { checked: false, closest: () => ({}) }],
    ["#nodeName", { textContent: "" }], ["#nodeHrefWrap", { hidden: false }],
    ["#nodeDuplicate", {}], ["#nodeReset", {}], ["#nodeUp", {}], ["#nodeDown", {}], ["#blockList", { replaceChildren() {} }],
    ["#addBlock", {}], ["#undo", {}], ["#reset", {}], ["#save", {}],
    ["#sectionSelect", select()], ["#sectionHidden", { checked: false }],
    ["#sectionPreset", select()], ["#blockType", { value: "paragraph" }],
    ["#blockSection", select()], ["#sectionMoveWrap", { hidden: true }],
    ["#sectionUp", {}], ["#sectionDown", {}], ["#resetSection", {}],
    ["#apply", {}], ["#newtab", {}],
  ]);
  const context = {
    preview, scope: { value: "landing" }, newtab: {}, controls: controlsElement, state,
    undo: {}, reset: {}, save: {}, apply: {},
    structuredClone, location: { origin: "https://child.test" }, addEventListener() {},
    document: {
      cookie: "",
      querySelector: selector => elements.get(selector),
      querySelectorAll: selector => selector === "[data-device]" ? [] : controls,
      createElement: () => ({ value: "", textContent: "" }),
    },
    fetch: async (url) => { requests.push(url); return { ok: true, json: async () => ({ data: { panelEntitlement: { allowThemes: false } } }) }; },
  };
  new vm.Script(script).runInNewContext(context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ["/api/v1/me"]);
  assert.ok(controls.every(control => control.disabled));
  assert.match(preview.src, /^\/admin\/theme-preview\?theme=CREATOR_POP&scope=landing&editor=1/);
  assert.equal(state.textContent, "Gói Panel hiện tại không cho phép thay đổi giao diện.");
});
