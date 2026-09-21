import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { themeIds, themePresets, themeStyles } from "../dist/themes.js";
import { fullPageThemePreview } from "../dist/theme-builder.js";
import {
  renderAiCosmicOverview,
  renderAiCosmicAuth,
} from "../dist/ai-cosmic-pages.js";
import { authPage } from "../dist/page.js";
test("only Aurora and rebuilt AI are selectable; retired IDs fall back in every scope", async () => {
  const admin = await readFile(
    new URL("../src/admin-operations.ts", import.meta.url),
    "utf8",
  );
  assert.deepEqual(themeIds, ["AURORA_MODERN", "AI_COSMIC_FUTURE"]);
  assert.equal(themePresets.length, 2);
  for (const id of [
    "CREATOR_POP",
    "URBAN_LIME_BRUTAL",
    "CYBER_NEON_CITY",
    "PRISM_GLASS",
    "OCEAN_PREMIUM",
    "BLUE_BUSINESS",
    "ZEN_JAPANESE",
    "BLACK_GOLD_LUXURY",
    "BEIGE_EDITORIAL",
    "UNKNOWN",
  ]) {
    assert.ok(!admin.includes(id));
    assert.ok(!themeStyles.includes(id));
    for (const scope of ["landing", "auth", "customer"])
      assert.match(
        fullPageThemePreview("", id, scope),
        /data-theme="AURORA_MODERN"/,
      );
  }
});
test("AI auth preserves the complete real card for every auth route", () => {
  for (const kind of ["login", "register", "forgot", "reset"]) {
    const form = authPage("", kind).match(
      /<section class="auth-card">[\s\S]*?<\/section>/,
    )[0];
    assert.ok(renderAiCosmicAuth(form).includes(form));
  }
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
