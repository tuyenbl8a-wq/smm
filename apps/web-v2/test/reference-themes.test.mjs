import test from "node:test";
import assert from "node:assert/strict";
import {
  referencePages,
  referenceStyles,
  referencePreview,
  renderReferenceOrderMix,
} from "../dist/reference-runtime.js";
import { themeIds, numberedThemeIds, runtimeThemeScript } from "../dist/themes.js";
import { authPage, landingPage } from "../dist/page.js";
import { customerPage } from "../dist/customer.js";
import { fullPageThemePreview } from "../dist/theme-builder.js";
import { readFile } from "node:fs/promises";

// Ignore ALL attributes, text, IDs, colors, classes and variant labels. Retain
// only element topology; a recolor of any existing renderer necessarily fails.
const topology = (html) =>
  (html.match(/<\/?[a-z][^>]*>/gi) || [])
    .map((t) => t.match(/^<\/?[a-z0-9-]+/i)[0].toLowerCase())
    .join(" ");
test("reference architectures remain distinct after removal of every superficial difference", () => {
  for (const scope of ["landing", "auth", "customer", "overview"]) {
    const seen = new Map();
    for (const [id, pages] of Object.entries(referencePages)) {
      const fingerprint = topology(pages[scope]);
      assert.ok(
        !seen.has(fingerprint),
        `${scope}: ${id} shares DOM with ${seen.get(fingerprint)}`,
      );
      seen.set(fingerprint, id);
    }
  }
  const base = referencePages.CREATOR_POP.landing;
  assert.equal(
    topology(base),
    topology(
      base
        .replaceAll("pop-", "recolored-")
        .replaceAll("CREATOR_POP", "OTHER")
        .replaceAll("Tăng trưởng", "Changed"),
    ),
  );
});
test("canonical theme numbers always select their matching renderer and artwork", () => {
  assert.deepEqual(numberedThemeIds, ["AI_COSMIC_FUTURE", "CREATOR_POP", "URBAN_LIME_BRUTAL", "CYBER_NEON_CITY", "PRISM_GLASS", "OCEAN_PREMIUM", "BLUE_BUSINESS", "ZEN_JAPANESE", "BLACK_GOLD_LUXURY", "BEIGE_EDITORIAL"]);
  assert.equal(themeIds[0], "AURORA_MODERN", "Aurora remains the unnumbered default");
  assert.equal(numberedThemeIds[0], "AI_COSMIC_FUTURE", "Theme 01 remains AI Cosmic");
  assert.equal(numberedThemeIds[7], "ZEN_JAPANESE", "Theme 08 remains Zen Japanese");
  for (const id of numberedThemeIds) {
    if (id === "AI_COSMIC_FUTURE") {
      assert.match(runtimeThemeScript("", "public"), /ai-cosmic-landing-page/);
      assert.match(runtimeThemeScript("", "public"), /theme-assets\/ai-cosmic\/landing-hero\.png/);
    } else {
      const page = referencePages[id].landing;
      assert.match(page, new RegExp(`class="[^"]*${id === "ZEN_JAPANESE" ? "zen-landing" : "-landing"}`));
      assert.match(page, new RegExp(`/theme-assets/${({CREATOR_POP:"creator-pop",URBAN_LIME_BRUTAL:"urban-lime",CYBER_NEON_CITY:"cyber-neon",PRISM_GLASS:"prism-glass",OCEAN_PREMIUM:"ocean-premium",BLUE_BUSINESS:"blue-business",ZEN_JAPANESE:"zen-japanese",BLACK_GOLD_LUXURY:"black-gold",BEIGE_EDITORIAL:"beige-editorial"})[id]}/scene\\.png`));
    }
  }
});
test("Vietnamese customer-facing reference copy stays NFC and serif headlines use Vietnamese-capable fallback stacks", async () => {
  for (const [id, pages] of Object.entries(referencePages)) {
    for (const scope of ["landing", "auth", "customer", "overview"]) {
      const html = pages[scope];
      assert.equal(html.normalize("NFC"), html, id + " " + scope + " source must be NFC");
      assert.doesNotMatch(html, /\uFFFD/, id + " " + scope + " has no replacement glyph");
    }
  }
  for (const id of ["PRISM_GLASS", "OCEAN_PREMIUM", "ZEN_JAPANESE", "BLACK_GOLD_LUXURY"]) {
    const pages = referencePages[id];
    for (const scope of ["landing", "auth", "customer", "overview"]) {
      const html = pages[scope];
      assert.equal(html.normalize("NFC"), html, id + " " + scope + " source must be NFC");
      assert.doesNotMatch(html, /\uFFFD/, id + " " + scope + " has no replacement glyph");
      assert.ok(/[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởợúùủũụứừửữựýỳỷỹỵ]/u.test(html), id + " retains real Vietnamese copy");
    }
    const preview = fullPageThemePreview("", id, "landing");
    assert.equal(preview.normalize("NFC"), preview, id + " iframe preview must be NFC");
    assert.doesNotMatch(preview, /\uFFFD/);
  }
  assert.match((await import("../dist/themes.js")).themeStyles, /"Times New Roman",Georgia,"DejaVu Serif",serif/);
  assert.match(referenceStyles, /data-theme="PRISM_GLASS"[^}]+letter-spacing:0!important/);
  for (const selector of [".prism-message h1", ".prism-auth-island h1", ".ocean-horizon h1", ".zen-landscape h1", ".gold-monument h1"]) {
    const start = referenceStyles.indexOf(selector + "{");
    const rule = referenceStyles.slice(start, referenceStyles.indexOf("}", start));
    assert.ok(start >= 0, selector + " exists in compiled theme styles");
    assert.ok(rule.includes('"Times New Roman",Georgia,"DejaVu Serif",serif'), selector + " uses the Vietnamese-capable local face first");
    assert.match(rule, /letter-spacing:(?:0|-.015em)/, selector + " uses restrained tracking");
  }
});
test("every reference mounts complete real auth cards, catalog controls and customer shell", () => {
  assert.deepEqual(
    Object.keys(referencePages).sort(),
    themeIds
      .filter((id) => !["AURORA_MODERN", "AI_COSMIC_FUTURE"].includes(id))
      .sort(),
  );
  for (const id of Object.keys(referencePages)) {
    assert.ok(themeIds.includes(id));
    for (const kind of ["login", "register", "forgot", "reset"]) {
      const original = authPage("", kind).match(
        /<section class="auth-card">[\s\S]*?<\/section>/,
      )[0];
      const rendered = referencePreview(id, "auth", original);
      assert.ok(
        rendered.includes(original.replace(/DichVu1st/giu, "Social Platform")),
      );
      assert.match(rendered, /<form novalidate>/);
    }
    const landing = referencePreview(id, "landing", landingPage(""));
    for (const control of [
      "pricing",
      "public-search",
      "public-platform",
      "public-category",
      "catalog",
      "catalog-pages",
    ])
      assert.ok(landing.includes(`id="${control}"`), id + " " + control);
    const customer = referencePreview(
      id,
      "customer",
      customerPage("", "/dashboard"),
    );
    for (const control of [
      "app",
      "drawer-toggle",
      "side-logout",
      "top-logout",
      "top-balance",
      "top-user",
    ])
      assert.ok(customer.includes(`id="${control}"`));
    assert.doesNotMatch(customer, /12\.450\.000|99\.8%|DichVu1st/i);
    for (const scope of ["landing", "auth", "customer"]) {
      const preview = fullPageThemePreview("", id, scope);
      assert.ok(
        preview.includes(
          referencePreview(
            id,
            scope,
            scope === "landing"
              ? landingPage("")
              : scope === "auth"
                ? authPage("", "login")
                : customerPage("", "/dashboard"),
          ),
        ),
      );
    }
  }
});
test("serialized runtime is valid JavaScript in every scope", () => {
  for (const scope of ["public", "auth", "customer"]) {
    const runtime = runtimeThemeScript("", scope);
    assert.doesNotThrow(() => new Function(runtime));
    assert.match(runtime, /scopeOverrides=overrides\[compositionScope\]/);
    assert.match(runtime, /activeOverrides\.content\?\.nodes/);
    assert.match(runtime, /smm:localechange/);
  }
});
test("runtime server allowlists every referenced artwork and no other path", async () => {
  const main = await readFile(
    new URL("../src/main.ts", import.meta.url),
    "utf8",
  );
  const literal = main.match(
    /const referenceAsset\s*=\s*(\/\^[^\n]+?\$\/)\.exec/,
  )[1];
  const allowed = new RegExp(literal.slice(1, -1));
  for (const pages of Object.values(referencePages)) {
    const paths = [
      ...pages.landing.matchAll(/src="(\/theme-assets\/[^\"]+)"/g),
    ].map((x) => x[1]);
    assert.equal(paths.length, 1);
    for (const path of paths) {
      assert.ok(allowed.test(path), path + " must be served by main.ts");
      const bytes = await readFile(
        new URL("../public" + path, import.meta.url),
      );
      assert.deepEqual(
        [...bytes.subarray(0, 8)],
        [137, 80, 78, 71, 13, 10, 26, 10],
      );
    }
  }
  for (const path of [
    "/theme-assets/../main.ts",
    "/theme-assets/creator-pop/other.png",
    "/theme-assets/unknown/scene.png",
  ])
    assert.ok(!allowed.test(path));
});
test("status charts reflect real counts and reject absent or inconsistent values", () => {
  assert.match(renderReferenceOrderMix(20, 4, 12), />60%/);
  assert.match(
    renderReferenceOrderMix(20, 4, 12),
    /12 hoàn thành, 4 đang xử lý, 4 đơn khác/,
  );
  for (const values of [[], [0, 0, 0], [4, 3, 3], [NaN, 0, 0], [-1, 0, 0]])
    assert.match(renderReferenceOrderMix(...values), /Chưa có dữ liệu/);
});
