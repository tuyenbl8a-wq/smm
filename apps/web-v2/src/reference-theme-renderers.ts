export type ReferenceScope = "landing" | "auth" | "customer";
export type ReferenceRenderer = (html: string) => string;

type Architecture = {
  shell: string;
  regions: [string, string, string, string];
};

const addRegions = (html: string, root: string, architecture: Architecture) => {
  const [navigation, primary, secondary, closing] = architecture.regions;
  const opening = `class="${root}`;
  const decorated = html.replace(
    opening,
    `data-renderer="${architecture.shell}" class="${root} ${architecture.shell}`,
  );
  const anchor =
    root === "hero" ? '<div class="container hero-grid">' : `class="${root}`;
  const regionMarkup = `<nav class="theme-region ${navigation}" aria-label="Điểm nhấn giao diện"></nav><section class="theme-region ${primary}" aria-hidden="true"></section><aside class="theme-region ${secondary}" aria-hidden="true"></aside><footer class="theme-region ${closing}" aria-hidden="true"></footer>`;
  return root === "hero"
    ? decorated.replace(anchor, `${regionMarkup}${anchor}`)
    : decorated.replace(
        /(data-renderer="[^"]+" class="[^"]+">)/,
        `$1${regionMarkup}`,
      );
};

const landing =
  (shell: string, regions: Architecture["regions"]) => (html: string) =>
    addRegions(html, "hero", { shell, regions });
const auth =
  (shell: string, regions: Architecture["regions"]) => (html: string) =>
    addRegions(html, "auth", { shell, regions });
const customer =
  (shell: string, regions: Architecture["regions"]) => (html: string) =>
    addRegions(html, "customer", { shell, regions });

export const renderSoftBeigeLanding = landing("beige-estate", [
  "boutique-nav",
  "editorial-hero",
  "marble-services",
  "concierge-cta",
]);
export const renderSoftBeigeAuth = auth("beige-hospitality", [
  "monogram-bar",
  "lifestyle-visual",
  "concierge-form",
  "assurance-note",
]);
export const renderSoftBeigeCustomer = customer("beige-ledger", [
  "tailored-rail",
  "balance-ledger",
  "service-journal",
  "order-register",
]);

export const renderJapaneseZenLanding = landing("zen-pavilion", [
  "engawa-nav",
  "ink-hero",
  "tatami-services",
  "ensō-cta",
]);
export const renderJapaneseZenAuth = auth("zen-shoji", [
  "shoji-header",
  "garden-visual",
  "ritual-form",
  "haiku-note",
]);
export const renderJapaneseZenCustomer = customer("zen-ledger", [
  "quiet-rail",
  "garden-kpis",
  "wallet-scroll",
  "order-ledger",
]);

export const renderDarkLuxuryLanding = landing("noir-monument", [
  "gallery-nav",
  "crown-hero",
  "jewel-services",
  "private-cta",
]);
export const renderDarkLuxuryAuth = auth("noir-suite", [
  "gold-crest",
  "skyline-visual",
  "private-form",
  "member-note",
]);
export const renderDarkLuxuryCustomer = customer("noir-console", [
  "gold-rail",
  "executive-kpis",
  "wealth-panel",
  "order-vault",
]);

export const renderPremiumCorporateLanding = landing("corporate-tower", [
  "enterprise-nav",
  "architectural-hero",
  "solution-columns",
  "boardroom-cta",
]);
export const renderPremiumCorporateAuth = auth("corporate-portal", [
  "trust-header",
  "office-visual",
  "identity-form",
  "compliance-note",
]);
export const renderPremiumCorporateCustomer = customer("corporate-board", [
  "office-rail",
  "kpi-board",
  "revenue-chart",
  "orders-table",
]);

export const renderCyberNeonLanding = landing("neon-metropolis", [
  "command-nav",
  "hologram-hero",
  "neon-modules",
  "signal-cta",
]);
export const renderCyberNeonAuth = auth("neon-portal", [
  "circuit-header",
  "city-visual",
  "portal-form",
  "system-status",
]);
export const renderCyberNeonCustomer = customer("neon-telemetry", [
  "circuit-rail",
  "telemetry-kpis",
  "pulse-chart",
  "mission-queue",
]);

export const renderGlassLanding = landing("glass-orbit", [
  "floating-nav",
  "prism-hero",
  "glass-services",
  "orbital-cta",
]);
export const renderGlassAuth = auth("glass-gateway", [
  "crystal-header",
  "horizon-visual",
  "floating-form",
  "privacy-orb",
]);
export const renderGlassCustomer = customer("glass-workspace", [
  "floating-rail",
  "prismatic-kpis",
  "liquid-wallet",
  "glass-orders",
]);

export const renderEmeraldLanding = landing("emerald-harbor", [
  "maritime-nav",
  "lighthouse-hero",
  "fleet-services",
  "horizon-cta",
]);
export const renderEmeraldAuth = auth("emerald-secure-harbor", [
  "harbor-header",
  "ocean-visual",
  "secure-form",
  "trust-beacon",
]);
export const renderEmeraldCustomer = customer("emerald-operations", [
  "navigation-deck",
  "voyage-kpis",
  "cashflow-chart",
  "order-manifest",
]);

export const renderCreatorLanding = landing("creator-collage", [
  "sticker-nav",
  "creator-hero",
  "social-carousel",
  "viral-cta",
]);
export const renderCreatorAuth = auth("creator-studio", [
  "creator-header",
  "portrait-visual",
  "studio-form",
  "community-note",
]);
export const renderCreatorCustomer = customer("creator-performance", [
  "creator-rail",
  "engagement-kpis",
  "growth-chart",
  "campaign-orders",
]);

export const renderBrutalistLanding = landing("brutalist-poster", [
  "utility-nav",
  "poster-hero",
  "grid-services",
  "manifesto-cta",
]);
export const renderBrutalistAuth = auth("brutalist-sheet", [
  "issue-header",
  "type-visual",
  "boxed-form",
  "edition-note",
]);
export const renderBrutalistCustomer = customer("brutalist-newsroom", [
  "index-rail",
  "headline-kpis",
  "ledger-block",
  "orders-grid",
]);

export const renderAiLanding = landing("ai-neural-orbit", [
  "ai-command",
  "neural-hero",
  "model-services",
  "future-cta",
]);
export const renderAiAuth = auth("ai-cognitive-gateway", [
  "neural-header",
  "android-visual",
  "cognitive-form",
  "agent-status",
]);
export const renderAiCustomer = customer("ai-intelligence", [
  "agent-console",
  "intelligence-kpis",
  "prediction-chart",
  "automated-orders",
]);

export const referenceRenderers: Record<
  string,
  Record<ReferenceScope, ReferenceRenderer>
> = {
  SOFT_BEIGE_PREMIUM: {
    landing: renderSoftBeigeLanding,
    auth: renderSoftBeigeAuth,
    customer: renderSoftBeigeCustomer,
  },
  JAPANESE_ZEN: {
    landing: renderJapaneseZenLanding,
    auth: renderJapaneseZenAuth,
    customer: renderJapaneseZenCustomer,
  },
  DARK_LUXURY: {
    landing: renderDarkLuxuryLanding,
    auth: renderDarkLuxuryAuth,
    customer: renderDarkLuxuryCustomer,
  },
  PREMIUM_CORPORATE: {
    landing: renderPremiumCorporateLanding,
    auth: renderPremiumCorporateAuth,
    customer: renderPremiumCorporateCustomer,
  },
  CYBER_NEON: {
    landing: renderCyberNeonLanding,
    auth: renderCyberNeonAuth,
    customer: renderCyberNeonCustomer,
  },
  GLASSMORPHISM: {
    landing: renderGlassLanding,
    auth: renderGlassAuth,
    customer: renderGlassCustomer,
  },
  EMERALD_BUSINESS: {
    landing: renderEmeraldLanding,
    auth: renderEmeraldAuth,
    customer: renderEmeraldCustomer,
  },
  SOCIAL_CREATOR: {
    landing: renderCreatorLanding,
    auth: renderCreatorAuth,
    customer: renderCreatorCustomer,
  },
  EDITORIAL_BRUTALIST: {
    landing: renderBrutalistLanding,
    auth: renderBrutalistAuth,
    customer: renderBrutalistCustomer,
  },
  AI_FUTURISTIC: {
    landing: renderAiLanding,
    auth: renderAiAuth,
    customer: renderAiCustomer,
  },
};

/** Serializes concrete renderer output for the browser-side theme switcher. */
export function runtimeReferenceShells(scope: ReferenceScope) {
  const root =
    scope === "landing" ? "hero" : scope === "auth" ? "auth" : "customer";
  return Object.fromEntries(
    Object.entries(referenceRenderers).map(([theme, renderers]) => [
      theme,
      renderers[scope](`<div class="${root}"></div>`),
    ]),
  );
}
