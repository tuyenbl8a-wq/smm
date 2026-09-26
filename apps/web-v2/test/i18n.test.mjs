import assert from "node:assert/strict";
import test from "node:test";
import {
  customerI18nScript,
  supportedLocales,
  translationDictionaries,
} from "../dist/i18n.js";
import { authPage, landingPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { readFile } from "node:fs/promises";

test("all supported customer locales have complete translation-key parity", () => {
  assert.deepEqual(supportedLocales, [
    "vi", "en", "zh-CN", "fr", "es", "pt-BR", "id", "th", "ru", "ar",
  ]);
  const keys = Object.keys(translationDictionaries.vi).sort();
  assert.ok(keys.length >= 120);
  for (const locale of supportedLocales) {
    assert.deepEqual(Object.keys(translationDictionaries[locale]).sort(), keys, locale);
    for (const key of keys)
      assert.ok(translationDictionaries[locale][key].trim(), `${locale}: ${key}`);
  }
});

test("shared browser runtime is valid and implements locale priority, persistence, and RTL", () => {
  const runtime = customerI18nScript();
  assert.doesNotThrow(() => new Function(runtime));
  assert.match(runtime, /smm_locale=/);
  assert.match(runtime, /navigator\.languages/);
  assert.match(runtime, /active==='ar'\?'rtl':'ltr'/);
  assert.match(runtime, /querySelectorAll\('\[data-i18n\]/);
  assert.match(runtime, /data-i18n-parts/);
  assert.match(runtime, /target\.nodeValue=value/);
  assert.doesNotMatch(runtime, /TreeWalker|SHOW_TEXT|exact\.get/);
  assert.match(runtime, /select\.value=active;select\.onchange/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
});
test("split hero translation preserves all existing title markup", async () => {
  const pages = await import("../dist/ai-cosmic-pages.js");
  const { referencePages } = await import("../dist/reference-runtime.js");
  const ai = pages.renderAiCosmicLanding().match(/<h1[^>]*>[\s\S]*?<\/h1>/)[0];
  assert.match(ai, /<br>thương hiệu của bạn<br>với <em>sức mạnh AI<\/em><\/h1>$/);
  assert.doesNotMatch(ai, /<span/);
  assert.match(ai, /data-i18n-parts="theme\.ai\.hero\.title\.first\|theme\.ai\.hero\.title\.second\|theme\.ai\.hero\.title\.lead\|theme\.ai\.hero\.title\.accent"/);
  for (const [id, pagesForTheme] of Object.entries(referencePages)) {
    const h1 = pagesForTheme.landing.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0];
    assert.ok(h1, `${id} has a title`);
    assert.match(h1, /<em>[^<]+<\/em>/, `${id} retains emphasis`);
    assert.match(h1, /data-i18n-parts=/, `${id} translates text segments without wrapping them`);
  }
});

test("public, auth, and customer surfaces share the locale selector runtime", () => {
  for (const html of [landingPage(""), authPage("", "login"), customerPage("", "/dashboard")]) {
    assert.match(html, /locale-picker/);
    assert.match(html, /smm_locale/);
    assert.match(html, /dir="ltr"/);
  }
});

test("customer order renderer has explicit keys and never renders a missing service identifier", () => {
  const html = customerPage("", "/orders/new");
  for (const key of [
    "customer.orders.allPlatforms",
    "customer.orders.enterCoupon",
    "customer.orders.noAverageTime",
    "customer.orders.noRefill",
    "customer.orders.noCancel",
    "customer.orders.backendFinal",
  ]) assert.match(html, new RegExp(key));
  assert.match(html, /filter\(v=>v!==null&&v!==undefined&&v!==''\)/);
  assert.doesNotMatch(html, /undefined —/);
});

test("customer-facing source dictionaries contain no common mojibake markers", () => {
  const text = JSON.stringify(translationDictionaries.vi);
  assert.doesNotMatch(text, /Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ä[‘ƒ]|Æ[°¡]|áº|á»|â€™|â€œ|â€|ï¿½|�/u);
});

test("Vietnamese source and rendered customer output are valid UTF-8 without mojibake", async () => {
  const root = new URL("../src/", import.meta.url);
  const customerFacingSources = [
    "ai-cosmic-pages.ts", "ai-cosmic-styles.ts", "components.ts", "customer.ts", "page.ts", "reference-primitives.ts", "reference-runtime.ts", "themes.ts", "i18n.ts",
    "beige-editorial-pages.ts", "beige-editorial-styles.ts", "black-gold-pages.ts", "black-gold-styles.ts",
    "blue-business-pages.ts", "blue-business-styles.ts", "creator-pop-pages.ts", "creator-pop-styles.ts",
    "cyber-neon-pages.ts", "cyber-neon-styles.ts", "ocean-premium-pages.ts", "ocean-premium-styles.ts",
    "prism-glass-pages.ts", "prism-glass-styles.ts", "urban-lime-pages.ts", "urban-lime-styles.ts", "zen-japanese-pages.ts", "zen-japanese-styles.ts",
  ];
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const VietnameseCorruption = /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ä[\u0080-\u00bf]|Æ[\u0080-\u00bf]|á»|áº|â€™|â€œ|â€|ï¿½|�)/u;
  for (const path of customerFacingSources) {
    const bytes = await readFile(new URL(path, root));
    const source = utf8.decode(bytes);
    assert.doesNotMatch(source, VietnameseCorruption, `${path} contains corrupted UTF-8 text`);
  }
  const rendered = [landingPage(""), authPage("", "login"), customerPage("", "/orders/new")].join("\n");
  assert.match(rendered, /Đăng nhập/);
  assert.match(rendered, /Trang chủ/);
  assert.match(rendered, /Dịch vụ/);
  assert.match(rendered, /Đơn hàng/);
  assert.match(rendered, /Tất cả nền tảng/);
  assert.match(rendered, /Nhập mã coupon/);
  assert.doesNotMatch(rendered, VietnameseCorruption);
});
