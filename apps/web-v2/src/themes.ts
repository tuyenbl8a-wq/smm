import { aiCosmicStyles } from "./ai-cosmic-styles.js";
import { mountThemeCustomBlocks } from "./theme-content-runtime.js";
import { rootBranding, type TenantBranding } from "./branding.js";
import {
  referencePages,
  referenceStyles,
  mountReferencePage,
  setupReferenceNavigation,
  mountReferenceOverview,
  renderReferenceOrderMix,
  applyReferenceBranding,
} from "./reference-runtime.js";
const themeDefinitions = [
  [
    "AURORA_MODERN",
    "Aurora Modern",
    "Cực quang hiện đại trên nền đêm sâu",
    "aurora",
    "#8b5cf6",
    "#07111f",
    "sans",
  ],
  [
    "AI_COSMIC_FUTURE",
    "AI Cosmic Future",
    "AI vũ trụ, quỹ đạo neural đa sắc",
    "ai",
    "#7c5cff",
    "#080b20",
    "display",
  ],
  [
    "CREATOR_POP",
    "Creator Pop",
    "Sáng tạo · collage hồng cam",
    "creator",
    "#cf087a",
    "#fff5fb",
    "sans",
  ],
  [
    "URBAN_LIME_BRUTAL",
    "Urban Lime Brutal",
    "Urban Lime Brutal",
    "tech",
    "#d2ff00",
    "#080d0b",
    "display",
  ],
  [
    "CYBER_NEON_CITY",
    "Cyber Neon City",
    "Cyber Neon City",
    "tech",
    "#6be9ff",
    "#03091a",
    "display",
  ],
  [
    "PRISM_GLASS",
    "Prism Glass",
    "Prism Glass",
    "glass",
    "#5953d8",
    "#eaf3ff",
    "serif",
  ],
  [
    "OCEAN_PREMIUM",
    "Ocean Premium",
    "Ocean Premium",
    "fintech",
    "#30ddeb",
    "#031f33",
    "serif",
  ],
  [
    "BLUE_BUSINESS",
    "Blue Business",
    "Blue Business",
    "corporate",
    "#0666ec",
    "#f3f7fc",
    "sans",
  ],
  [
    "ZEN_JAPANESE",
    "Zen Japanese",
    "Zen Japanese",
    "zen",
    "#345441",
    "#f4f4eb",
    "serif",
  ],
  [
    "BLACK_GOLD_LUXURY",
    "Black Gold Luxury",
    "Black Gold Luxury",
    "gold",
    "#e4bc79",
    "#090b0a",
    "serif",
  ],
  [
    "BEIGE_EDITORIAL",
    "Beige Editorial",
    "Beige Editorial",
    "editorial",
    "#806034",
    "#f4eee3",
    "serif",
  ],
] as const;

export const themePresets = themeDefinitions.map(
  ([id, name, copy, layout, primary, background, typography]) => ({
    id,
    name,
    copy,
    layout,
    primary,
    background,
    typography,
  }),
);
export const numberedThemeIds = [
  "AI_COSMIC_FUTURE",
  "CREATOR_POP",
  "URBAN_LIME_BRUTAL",
  "CYBER_NEON_CITY",
  "PRISM_GLASS",
  "OCEAN_PREMIUM",
  "BLUE_BUSINESS",
  "ZEN_JAPANESE",
  "BLACK_GOLD_LUXURY",
  "BEIGE_EDITORIAL",
] as const satisfies readonly (typeof themeDefinitions)[number][0][];
export const themeIds = themeDefinitions.map((theme) => theme[0]);
export type ThemeId = (typeof themeIds)[number];

export type ThemeEditableNodeType = "heading" | "text" | "button" | "link" | "image";
export type ThemeEditableOperation = "text" | "href" | "hide" | "reset" | "move" | "artwork";
export type ThemeEditableNode = {
  id: string;
  type: ThemeEditableNodeType;
  label: string;
  defaultValue: string;
  operations: readonly ThemeEditableOperation[];
  removable: boolean;
};
export type ThemeBlockType = "eyebrow" | "heading" | "paragraph" | "button" | "link" | "image" | "label" | "feature" | "stat" | "divider";
export type ThemeEditorSection = {
  id: string;
  label: string;
  selector: string;
  allowedBlocks: readonly ThemeBlockType[];
  optional: boolean;
  reorderable: boolean;
  layoutPresets: readonly string[];
};
export type ThemeArtwork = {
  id: string;
  selector: string;
  operations: readonly ("replace" | "alt" | "hide" | "fit" | "position" | "reset")[];
  replaceable: boolean;
  lockedReason?: string;
  fitPresets: readonly ("cover" | "contain")[];
  positionPresets: readonly ("center" | "top" | "left" | "right" | "bottom")[];
};
export type ThemeEditorScopeManifest = {
  sections: readonly ThemeEditorSection[];
  nodes: readonly ThemeEditableNode[];
  artwork: readonly ThemeArtwork[];
  structuralPresets: Readonly<Record<string, readonly string[]>>;
  densityPresets: readonly ("compact" | "comfortable" | "spacious")[];
};
export type ThemeEditorManifest = Record<ThemeCompositionScope, ThemeEditorScopeManifest>;
const node = (id: string, type: ThemeEditableNodeType, label: string, defaultValue: string, operations: ThemeEditableOperation[], removable = false): ThemeEditableNode => ({ id, type, label, defaultValue, operations, removable });
const slot = (id: string) => `[data-theme-section="${id}"][data-theme-slot="content"]`;
const section = (id: string, label: string, allowedBlocks: ThemeBlockType[], optional = false, reorderable = false, layoutPresets: string[] = []) => ({ id, label, selector: slot(id), allowedBlocks, optional, reorderable, layoutPresets });
const referenceNavNodes = () => [
  node("nav.home", "link", "Trang chủ", "Trang chủ", ["text", "href", "hide", "reset", "move"]),
  node("nav.services", "link", "Dịch vụ", "Dịch vụ", ["text", "href", "hide", "reset", "move"]),
  node("nav.pricing", "link", "Bảng giá", "Bảng giá", ["text", "href", "hide", "reset", "move"]),
  node("nav.support", "link", "Hỗ trợ", "Hỗ trợ", ["text", "href", "hide", "reset", "move"]),
];
const publicNodes = (title: string, eyebrow: string, hasReferenceNav: boolean) => [
  node("header.brand", "text", "Tên thương hiệu", "Social Platform", ["text", "reset"]),
  ...(hasReferenceNav ? referenceNavNodes() : [node("nav.services", "link", "Dịch vụ", "Dịch vụ", ["text", "href", "hide", "reset", "move"]), node("nav.pricing", "link", "Bảng giá", "Bảng giá", ["text", "href", "hide", "reset", "move"]), node("nav.process", "link", "Cách hoạt động", "Cách hoạt động", ["text", "href", "hide", "reset", "move"]), node("nav.support", "link", "Hỗ trợ", "Hỗ trợ", ["text", "href", "hide", "reset", "move"])]),
  node("hero.eyebrow", "text", "Nhãn đầu trang", eyebrow, ["text", "hide", "reset"]),
  node("hero.title", "heading", "Tiêu đề chính", title, ["text", "hide", "reset"]),
  node("hero.description", "text", "Mô tả", "Giải pháp Social Media Marketing cho cá nhân và doanh nghiệp.", ["text", "hide", "reset"]),
  node("hero.primaryCta", "button", "Nút chính", "Bắt đầu ngay", ["text", "href", "hide", "reset"]),
  node("hero.secondaryCta", "link", "Liên kết phụ", "Xem bảng giá", ["text", "href", "hide", "reset"]),
  node("footer.description", "text", "Nội dung chân trang", "Kết nối hôm nay · Phát triển ngày mai", ["text", "hide", "reset"]),
];
const landingSections = (features: boolean, stats: boolean, cta: boolean, heroPresets: string[], featurePresets: string[], reorderOptional = false) => [
  section("navigation", "Điều hướng", ["link"], false, false, ["split", "centered", "compact"]),
  section("hero", "Hero", ["eyebrow", "heading", "paragraph", "button", "link", "image"], false, false, heroPresets),
  ...(features ? [section("features", "Tính năng", ["feature"], true, reorderOptional, featurePresets)] : []),
  ...(stats ? [section("stats", "Thống kê", ["stat"], true, reorderOptional)] : []),
  ...(cta ? [section("cta", "Kêu gọi hành động", ["heading", "paragraph", "button", "link"], true, false)] : []),
  section("footer", "Chân trang", ["paragraph", "link"], false, false),
];
const authNodes = (title: string) => [
  node("header.brand", "text", "Tên thương hiệu", "Social Platform", ["text", "reset"]),
  node("auth.marketingTitle", "heading", "Tiêu đề giới thiệu", title, ["text", "hide", "reset"]),
  node("auth.marketingDescription", "text", "Mô tả giới thiệu", "Quản lý dịch vụ, đơn hàng và tài khoản của bạn.", ["text", "hide", "reset"]),
  node("auth.title", "heading", "Tiêu đề biểu mẫu", "Đăng nhập", ["text", "hide", "reset"]),
  node("auth.description", "text", "Mô tả biểu mẫu", "Đăng nhập để tiếp tục.", ["text", "hide", "reset"]),
  node("auth.submit", "button", "Nút gửi biểu mẫu", "Đăng nhập", ["text", "reset"]),
];
const customerNodes = () => [
  node("header.brand", "text", "Tên thương hiệu", "Social Platform", ["text", "reset"]),
  node("customer.topbarTitle", "text", "Tiêu đề thanh trên", "Tổng quan", ["text", "hide", "reset"]),
  node("customer.pageTitle", "heading", "Tiêu đề trang", "Tổng quan", ["text", "hide", "reset"]),
  node("customer.pageDescription", "text", "Mô tả trang", "Hoạt động tài khoản của bạn, cập nhật từ hệ thống.", ["text", "hide", "reset"]),
];
const makeManifest = (config: { title: string; eyebrow: string; authTitle: string; landing: ThemeEditorSection[]; hasRefNav?: boolean; art?: boolean; artReplaceable?: boolean; heroPresets: string[]; featurePresets: string[] }): ThemeEditorManifest => {
  const artwork: ThemeArtwork[] = config.art ? [{ id: "hero.artwork", selector: '[data-theme-artwork="hero.artwork"]', operations: config.artReplaceable ? ["replace", "alt", "hide", "fit", "position", "reset"] as const : ["reset"] as const, replaceable: config.artReplaceable === true, ...(!config.artReplaceable ? { lockedReason: "Ảnh này là artwork cấu trúc của theme." } : {}), fitPresets: ["cover", "contain"], positionPresets: ["center", "top", "left", "right", "bottom"] }] : [];
  return {
    landing: { sections: config.landing, nodes: publicNodes(config.title, config.eyebrow, config.hasRefNav === true), artwork, structuralPresets: { hero: config.heroPresets, features: config.featurePresets, alignment: ["left", "center", "right"], columns: ["2", "3", "4"] }, densityPresets: ["compact", "comfortable", "spacious"] },
    auth: { sections: [section("marketing", "Giới thiệu", ["eyebrow", "heading", "paragraph", "image"], false, false)], nodes: authNodes(config.authTitle), artwork, structuralPresets: { auth: ["split", "centered", "compact"] }, densityPresets: ["compact", "comfortable", "spacious"] },
    customer: { sections: [section("dashboard", "Nội dung khu vực khách hàng", ["eyebrow", "heading", "paragraph", "link"], false, false)], nodes: customerNodes(), artwork: [], structuralPresets: { customer: ["compact", "normal", "spacious"] }, densityPresets: ["compact", "comfortable", "spacious"] },
  };
};
/** Each theme owns a separately authored manifest matching its actual page composition. */
export const themeEditorManifests: Record<ThemeId, ThemeEditorManifest> = {
  AURORA_MODERN: makeManifest({ title: "Tăng trưởng mạng xã hội nhanh hơn. Thông minh hơn.", eyebrow: "SMM PANEL UY TÍN HÀNG ĐẦU VIỆT NAM", authTitle: "Bắt đầu tăng trưởng cùng thương hiệu", landing: landingSections(true, true, true, ["split", "centered", "compact", "wide"], ["2-column", "3-column"], true), hasRefNav: false, art: false, heroPresets: ["split", "centered", "compact", "wide"], featurePresets: ["2-column", "3-column"] }),
  AI_COSMIC_FUTURE: makeManifest({ title: "Tăng trưởng thương hiệu của bạn với sức mạnh AI", eyebrow: "NỀN TẢNG SMM THÔNG MINH TẠI VIỆT NAM", authTitle: "AI for a brighter creator economy", landing: landingSections(true, true, false, ["split", "overlay", "wide"], ["2-column", "4-column"]), hasRefNav: true, art: true, artReplaceable: false, heroPresets: ["split", "overlay", "wide"], featurePresets: ["2-column", "4-column"] }),
  CREATOR_POP: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "✦ NỀN TẢNG CHO THẾ HỆ SÁNG TẠO", authTitle: "Sáng tạo · Kết nối · Phát triển", landing: landingSections(true, true, false, ["split", "centered", "wide"], ["2-column", "3-column", "4-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "centered", "wide"], featurePresets: ["2-column", "3-column", "4-column"] }),
  URBAN_LIME_BRUTAL: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "CHIẾN LƯỢC / DỊCH VỤ / CON NGƯỜI", authTitle: "Ideas. Grow. Brands.", landing: landingSections(true, true, false, ["split", "compact", "wide"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "compact", "wide"], featurePresets: ["2-column", "3-column"] }),
  CYBER_NEON_CITY: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "KẾT NỐI NHỊP SỐNG SỐ", authTitle: "Social · Faster · Together", landing: landingSections(true, true, false, ["split", "overlay", "wide"], ["3-column", "4-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "overlay", "wide"], featurePresets: ["3-column", "4-column"] }),
  PRISM_GLASS: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "MORE THAN SERVICE", authTitle: "Mỗi kết nối mở một cơ hội", landing: landingSections(true, true, false, ["split", "centered", "overlay"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "centered", "overlay"], featurePresets: ["2-column", "3-column"] }),
  OCEAN_PREMIUM: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "HÀNH TRÌNH THƯƠNG HIỆU VƯƠN XA", authTitle: "Vững vàng qua mọi hành trình", landing: landingSections(true, true, false, ["split", "wide", "centered"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "wide", "centered"], featurePresets: ["2-column", "3-column"] }),
  BLUE_BUSINESS: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "GIẢI PHÁP SOCIAL MEDIA CHO DOANH NGHIỆP", authTitle: "Một nền tảng cho mọi chiến dịch", landing: landingSections(true, true, false, ["split", "centered", "compact"], ["2-column", "3-column", "4-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "centered", "compact"], featurePresets: ["2-column", "3-column", "4-column"] }),
  ZEN_JAPANESE: makeManifest({ title: "Phát triển thương hiệu của bạn từ những điều chân thật", eyebrow: "TỪNG BƯỚC NHỎ · GIÁ TRỊ BỀN LÂU", authTitle: "Chậm rãi · Vững vàng · Đi xa", landing: landingSections(true, true, false, ["split", "centered", "compact"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "centered", "compact"], featurePresets: ["2-column", "3-column"] }),
  BLACK_GOLD_LUXURY: makeManifest({ title: "Tăng trưởng thương hiệu của bạn bắt đầu từ đây", eyebrow: "GIÁ TRỊ THẬT · TẦM NHÌN DÀI HẠN", authTitle: "Mỗi thương hiệu đều có tương lai", landing: landingSections(true, true, false, ["split", "overlay", "wide"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: false, heroPresets: ["split", "overlay", "wide"], featurePresets: ["2-column", "3-column"] }),
  BEIGE_EDITORIAL: makeManifest({ title: "Phát triển thương hiệu vững vàng trên mạng xã hội", eyebrow: "DỊCH VỤ MARKETING MẠNG XÃ HỘI", authTitle: "Thương hiệu vượt thời gian", landing: landingSections(true, true, false, ["split", "centered", "wide"], ["2-column", "3-column"]), hasRefNav: true, art: true, artReplaceable: true, heroPresets: ["split", "centered", "wide"], featurePresets: ["2-column", "3-column"] }),
};

type ThemeStructure = {
  navigationVariant: string;
  heroVariant: string;
  authVariant: string;
  sidebarVariant: string;
  dashboardVariant: string;
  serviceVariant: string;
  orderFormVariant: string;
  density: string;
};
const structure = (
  navigationVariant: string,
  heroVariant: string,
  authVariant: string,
  sidebarVariant: string,
  dashboardVariant: string,
  serviceVariant: string,
  orderFormVariant: string,
  density: string,
): ThemeStructure => ({
  navigationVariant,
  heroVariant,
  authVariant,
  sidebarVariant,
  dashboardVariant,
  serviceVariant,
  orderFormVariant,
  density,
});
/** Deliberately authored structures: variants are semantic, not index-generated. */
export const themeStructure: Record<ThemeId, ThemeStructure> = {
  BEIGE_EDITORIAL: structure(
    "beige-editorial-nav",
    "beige-editorial-hero",
    "beige-editorial-auth",
    "beige-editorial-rail",
    "beige-editorial-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  BLACK_GOLD_LUXURY: structure(
    "black-gold-nav",
    "black-gold-hero",
    "black-gold-auth",
    "black-gold-rail",
    "black-gold-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  ZEN_JAPANESE: structure(
    "zen-japanese-nav",
    "zen-japanese-hero",
    "zen-japanese-auth",
    "zen-japanese-rail",
    "zen-japanese-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  BLUE_BUSINESS: structure(
    "blue-business-nav",
    "blue-business-hero",
    "blue-business-auth",
    "blue-business-rail",
    "blue-business-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  OCEAN_PREMIUM: structure(
    "ocean-premium-nav",
    "ocean-premium-hero",
    "ocean-premium-auth",
    "ocean-premium-rail",
    "ocean-premium-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  PRISM_GLASS: structure(
    "prism-glass-nav",
    "prism-glass-hero",
    "prism-glass-auth",
    "prism-glass-rail",
    "prism-glass-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  CYBER_NEON_CITY: structure(
    "cyber-neon-nav",
    "cyber-neon-hero",
    "cyber-neon-auth",
    "cyber-neon-rail",
    "cyber-neon-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  URBAN_LIME_BRUTAL: structure(
    "urban-lime-nav",
    "urban-lime-hero",
    "urban-lime-auth",
    "urban-lime-rail",
    "urban-lime-overview",
    "cards",
    "comfortable",
    "comfortable",
  ),
  CREATOR_POP: structure(
    "creator-nav",
    "creator-collage",
    "creator-studio",
    "creator-rail",
    "creator-analytics",
    "cards",
    "comfortable",
    "comfortable",
  ),
  AURORA_MODERN: structure(
    "compact",
    "platform-stage",
    "immersive",
    "floating",
    "chart-first",
    "cards",
    "stepper",
    "spacious",
  ),
  AI_COSMIC_FUTURE: structure(
    "ai-dedicated-nav-v3",
    "ai-dedicated-hero-v3",
    "ai-dedicated-auth-v3",
    "ai-dedicated-sidebar-v3",
    "ai-dedicated-dashboard-v3",
    "ai-dedicated-services-v3",
    "ai-dedicated-order-v3",
    "compact",
  ),
};

export const legacyThemeAliases: Record<string, ThemeId> = {};

export type ThemeCompositionScope = "landing" | "auth" | "customer";
type Composition = Record<ThemeCompositionScope, string>;
/**
 * Authored page architectures shared by runtime and preview. These names describe
 * real layouts; they are applied to the existing page shell instead of wrapping
 * the complete document in inert elements.
 */
export const referenceThemeCompositions: Partial<Record<ThemeId, Composition>> =
  {
    AI_COSMIC_FUTURE: {
      landing: "ai-cosmic-landing-page",
      auth: "ai-dedicated-auth-v3",
      customer: "ai-cosmic-customer-page",
    },
  };
export function renderReferenceComposition(
  theme: ThemeId,
  scope: ThemeCompositionScope,
  inner: string,
) {
  return inner;
}

const dark = new Set([
  "BLACK_GOLD_LUXURY",
  "OCEAN_PREMIUM",
  "CYBER_NEON_CITY",
  "URBAN_LIME_BRUTAL",
  "AURORA_MODERN",
  "AI_COSMIC_FUTURE",
]);
const secondary: Record<ThemeId, string> = {
  BEIGE_EDITORIAL: "#382f24",
  BLACK_GOLD_LUXURY: "#b78947",
  ZEN_JAPANESE: "#677b54",
  BLUE_BUSINESS: "#1656c4",
  OCEAN_PREMIUM: "#157fb6",
  PRISM_GLASS: "#158bbc",
  CYBER_NEON_CITY: "#d66aff",
  URBAN_LIME_BRUTAL: "#aeca15",
  CREATOR_POP: "#ff8a25",
  AURORA_MODERN: "#7c5b23",
  AI_COSMIC_FUTURE: "#00c6ff",
};
const radius: Record<string, string> = {
  luxury: "12px",
  minimal: "8px",
  cyber: "18px",
  pastel: "24px",
  nature: "18px",
  glass: "26px",
  commerce: "8px",
  dashboard: "10px",
  agency: "4px",
  corporate: "12px",
  zen: "2px",
  editorial: "0px",
  ai: "22px",
  saas: "16px",
  tech: "6px",
  creator: "22px",
  gold: "6px",
  fintech: "14px",
  market: "14px",
  conversion: "12px",
};

const declarations = themeDefinitions
  .map(([id, , , style, primary, background, font]) => {
    const isDark = dark.has(id);
    const surface = isDark ? "#111827" : "#ffffff";
    const text = isDark ? "#f8fafc" : "#111827";
    const muted = isDark ? "#a9b4c6" : "#607087";
    const border = isDark ? `${primary}55` : `${primary}2d`;
    const family =
      font === "serif"
        ? '"Times New Roman",Georgia,"DejaVu Serif",serif'
        : font === "display"
          ? '"Arial Narrow","Segoe UI",sans-serif'
          : 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    return `:root[data-theme="${id}"]{color-scheme:${isDark ? "dark" : "light"};--theme-bg:${background};--theme-surface:${surface};--theme-border:${border};--theme-text:${text};--theme-muted:${muted};--theme-primary:${primary};--theme-secondary:${secondary[id]};--theme-radius:${radius[style]};--theme-font:${family};--theme-shadow:0 ${style === "editorial" ? "2px 0" : "18px 46px"} ${primary}1f}`;
  })
  .join("");

/** Resolves only allowlisted themes/options and applies content with textContent (never HTML). */
export const runtimeThemeScript = (
  api: string,
  scope: "public" | "auth" | "customer",
  tenant: TenantBranding = rootBranding,
) => {
  const compositionScope = scope === "public" ? "landing" : scope;

  return `(()=>{const allowed=new Set(${JSON.stringify(themeIds)}),aliases=${JSON.stringify(legacyThemeAliases)},structures=${JSON.stringify(themeStructure)},tenant=${JSON.stringify(tenant).replace(/</g, "\\u003c")},aiPages=${JSON.stringify(aiCosmicTemplates(tenant)).replace(/</g, "\\u003c")},referencePages=${JSON.stringify(referencePages)},mountReferencePage=${mountReferencePage.toString()},setupReferenceNavigation=${setupReferenceNavigation.toString()},mountReferenceOverview=${mountReferenceOverview.toString()},renderReferenceOrderMix=${renderReferenceOrderMix.toString()},applyReferenceBranding=${applyReferenceBranding.toString()},mountThemeCustomBlocks=${mountThemeCustomBlocks.toString()},editorManifests=${JSON.stringify(themeEditorManifests)},scope=${JSON.stringify(scope)},compositionScope=${JSON.stringify(compositionScope)},fallback='AURORA_MODERN',mountAiPage=()=>{const template=document.createElement('template');template.innerHTML=aiPages[compositionScope];const page=template.content.firstElementChild;if(compositionScope==='landing'){const current=document.querySelector('main');if(!current)return;const pricing=current.querySelector('#pricing');if(pricing)page.insertBefore(pricing,page.querySelector('.aiv3-footer'));current.replaceWith(page);return}if(compositionScope==='auth'){const current=document.querySelector('.auth'),form=current?.querySelector('.auth-card'),slot=page.querySelector('[data-ai-real-form]');if(!current||!form||!slot)return;slot.replaceWith(form);current.replaceWith(page);return}const current=document.querySelector('.customer'),sidebar=current?.querySelector('.sidebar'),topbar=current?.querySelector('.topbar'),content=current?.querySelector('.customer-content'),sidebarSlot=page.querySelector('[data-ai-sidebar]'),topbarSlot=page.querySelector('[data-ai-topbar]'),contentSlot=page.querySelector('[data-ai-content]');if(!current||!sidebar||!topbar||!content||!sidebarSlot||!topbarSlot||!contentSlot)return;const search=document.createElement('form');search.className='aiv3-search';search.action='/services';search.method='GET';search.innerHTML='<label><span class=\"aiv3-sr\">Tìm dịch vụ</span><input name=\"search\" placeholder=\"Tìm dịch vụ…\" aria-label=\"Tìm dịch vụ\"></label><button aria-label=\"Tìm\">⌕</button>';topbar.children[1]?.replaceWith(search);const assistantLink=document.createElement('a');assistantLink.href='/dashboard#ai-assistant';assistantLink.innerHTML='<i>✧</i><span>AI Assistant</span>';sidebar.querySelector('nav')?.append(assistantLink);const close=document.createElement('button');close.type='button';close.className='aiv3-close';close.textContent='Đóng menu ×';close.onclick=()=>document.querySelector('#drawer-toggle')?.click();sidebar.prepend(close);sidebar.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('#drawer-toggle')?.click();document.querySelector('#drawer-toggle')?.focus()}});const profile=topbar.querySelector('#profile-menu');if(profile)profile.onclick=()=>location.href='/account';sidebarSlot.replaceWith(sidebar);topbarSlot.replaceWith(topbar);contentSlot.replaceWith(content);current.replaceWith(page)},compose=theme=>{if(referencePages[theme]){mountReferencePage(referencePages,theme,compositionScope);const app=document.querySelector('#app');if(app){const rearrange=()=>mountReferenceOverview(referencePages,theme,app);rearrange();new MutationObserver(rearrange).observe(app,{childList:true})}return}if(theme==='AI_COSMIC_FUTURE'){mountAiPage();return}},setTheme=id=>{const normalized=aliases[id]||id,selected=allowed.has(normalized)?normalized:fallback;document.documentElement.dataset.theme=selected;const variants=structures[selected];Object.entries(variants).forEach(([key,value])=>document.documentElement.dataset[key]=value);compose(selected);document.dispatchEvent(new CustomEvent('themechange',{detail:{theme:selected}}));return selected},safeUrl=value=>{if(typeof value!=='string')return null;try{const url=new URL(value,location.origin);return url.protocol==='http:'||url.protocol==='https:'?url.href:null}catch{return null}};setTheme(fallback);window.__themeReady=fetch(${JSON.stringify(api)}+'/api/v1/public/settings',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then(j=>{const s=j.data||{},key='theme'+scope[0].toUpperCase()+scope.slice(1),id=s.themeMode==='SEPARATE'?s[key]:s.themeGlobal;setTheme(id);const o=s.themeOptions||{};if(['compact','comfortable','spacious'].includes(o.density))document.documentElement.dataset.density=o.density;if(['small','medium','large'].includes(o.radius))document.documentElement.dataset.radius=o.radius;const overrides=s.themeOverrides||{},scopeOverrides=overrides[compositionScope]||{},activeOverrides={...overrides,...scopeOverrides};for(const group of ['colors','content','layout','typography'])activeOverrides[group]={...(overrides[group]||{}),...(scopeOverrides[group]||{})};const colorKeys=new Set(['primary','secondary','accent','background','surface','text','muted','border','success','warning','danger']);Object.entries(activeOverrides.colors||{}).forEach(([key,value])=>{if(colorKeys.has(key)&&typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--theme-'+key,value)});const c={...(s.themeContent||{}),...(activeOverrides.content||{})};if(!tenant.isRoot||!c.brandTitle)c.brandTitle=tenant.name;if(referencePages[document.documentElement.dataset.theme])delete c.brandTitle;const editableNodeIds=new Set(["header.brand","hero.eyebrow","hero.title","hero.description","hero.primaryCta","hero.secondaryCta","footer.description","auth.marketingTitle","auth.marketingDescription","auth.title","auth.description","auth.submit","customer.topbarTitle","customer.pageTitle","customer.pageDescription"]),applyNodeOverrides=()=>Object.entries(activeOverrides.content?.nodes||{}).forEach(([id,patch])=>{if(!editableNodeIds.has(id)||!patch||typeof patch!=="object")return;document.querySelectorAll("[data-theme-node]").forEach(node=>{if(node.dataset.themeNode!==id)return;if(typeof patch.hidden==="boolean")node.hidden=patch.hidden;const label=node.querySelector("[data-theme-node-label]")||(id==="header.brand"?node.querySelector("strong"):node);if(typeof patch.text==="string"&&label&&label.textContent!==patch.text)label.textContent=patch.text.normalize("NFC");if(typeof patch.href==="string"&&node instanceof HTMLAnchorElement){const href=safeUrl(patch.href);if(href)node.href=href}})}),applyArtwork=manifest=>{for(const spec of manifest?.artwork||[]){const image=document.querySelector(spec.selector);if(!(image instanceof HTMLImageElement))continue;if(!image.dataset.themeOriginalSrc){image.dataset.themeOriginalSrc=image.getAttribute("src")||"";image.dataset.themeOriginalAlt=image.getAttribute("alt")||""}const patch=activeOverrides.content?.artwork?.[spec.id]||{};if(spec.replaceable&&typeof patch.src==="string"){const src=safeUrl(patch.src);if(src)image.src=src}else if(spec.replaceable)image.src=image.dataset.themeOriginalSrc;image.alt=typeof patch.alt==="string"?patch.alt.normalize("NFC").slice(0,240):image.dataset.themeOriginalAlt;image.hidden=patch.hidden===true;image.style.objectFit=spec.fitPresets.includes(patch.fit)?patch.fit:"";image.style.objectPosition=spec.positionPresets.includes(patch.position)?patch.position:""}},apply=()=>{applyReferenceBranding({...s,siteName:s.siteName||tenant.name,logoUrl:s.logoUrl||tenant.logoUrl});document.querySelectorAll('[data-theme-content]').forEach(el=>{if(el.hasAttribute('data-i18n')||el.querySelector('[data-i18n]'))return;const v=c[el.dataset.themeContent];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-list]').forEach((el,i)=>{const v=c.featureBullets?.[i];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-href]').forEach(el=>{const href=safeUrl(c[el.dataset.themeHref]);if(href)el.setAttribute('href',href);else if((document.documentElement.dataset.theme!=='AI_COSMIC_FUTURE'&&!referencePages[document.documentElement.dataset.theme])||c[el.dataset.themeHref]!==undefined)el.removeAttribute('href')});applyNodeOverrides();const activeManifest=editorManifests[document.documentElement.dataset.theme]?.[compositionScope];applyArtwork(activeManifest);const navParents=new Set([...document.querySelectorAll("[data-theme-node^=\\"nav.\\"]")].map(n=>n.parentElement));for(const parent of navParents){if(!parent)continue;const children=[...parent.children].filter(n=>n.dataset.themeNode?.startsWith("nav."));children.sort((a,b)=>(activeOverrides.content?.nodes?.[a.dataset.themeNode]?.order??activeManifest?.nodes?.findIndex(x=>x.id===a.dataset.themeNode))-(activeOverrides.content?.nodes?.[b.dataset.themeNode]?.order??activeManifest?.nodes?.findIndex(x=>x.id===b.dataset.themeNode)));children.forEach((n,i)=>{if(parent.children[i]!==n)parent.insertBefore(n,parent.children[i]||null)})}for(const spec of activeManifest?.sections||[]){const id=spec.id,p=activeOverrides.layout?.sections?.[id]||{},target=document.querySelector(spec.selector);if(!target)continue;if(spec.optional)target.hidden=p.hidden===true;if(p.preset&&spec.layoutPresets.includes(p.preset))target.dataset.themePreset=p.preset;else delete target.dataset.themePreset}for(const parent of new Set((activeManifest?.sections||[]).filter(x=>x.reorderable).map(x=>document.querySelector(x.selector)?.parentElement).filter(Boolean))){const slots=activeManifest.sections.filter(x=>x.reorderable&&document.querySelector(x.selector)?.parentElement===parent).map(x=>({spec:x,target:document.querySelector(x.selector)})).sort((a,b)=>a.target.compareDocumentPosition(b.target)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1),ordered=[...slots].sort((a,b)=>(activeOverrides.layout?.sections?.[a.spec.id]?.order??activeManifest.sections.indexOf(a.spec))-(activeOverrides.layout?.sections?.[b.spec.id]?.order??activeManifest.sections.indexOf(b.spec)));if(ordered.every((x,i)=>x.target===slots[i].target))continue;const anchors=slots.map(x=>{const anchor=document.createComment("theme-section-order");parent.replaceChild(anchor,x.target);return anchor});ordered.forEach((x,i)=>parent.replaceChild(x.target,anchors[i]))}mountThemeCustomBlocks(activeOverrides.content?.customBlocks,compositionScope,activeManifest)};apply();document.addEventListener('smm:localechange',applyNodeOverrides);new MutationObserver(apply).observe(document.body,{childList:true,subtree:true})}).catch(()=>setTheme(fallback))})();`;
};

export const themeStyles = `${declarations}
.theme-navigation,.theme-story,.theme-offer,.theme-cta,.auth-navigation,.auth-visual,.auth-form-region,.auth-assurance,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders{position:relative;z-index:2;border:1px solid var(--theme-border);background:color-mix(in srgb,var(--theme-surface) 88%,transparent);color:var(--theme-text)}:is(.theme-navigation,.theme-story,.theme-offer,.theme-cta,.auth-navigation,.auth-visual,.auth-form-region,.auth-assurance,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders)>*{display:block;margin:0;width:100%;background:none;color:inherit}.theme-navigation{display:flex;justify-content:space-between;gap:20px;width:min(1180px,calc(100% - 40px));margin:0 auto 18px;padding:12px 18px}.theme-navigation>*{display:flex;justify-content:space-between;gap:20px}.theme-story{width:min(1180px,calc(100% - 40px));margin:auto;padding:18px 22px;border-left:4px solid var(--theme-primary)}.theme-story strong{font-size:clamp(1.4rem,3vw,2.5rem)}.theme-story p{margin:5px 0;color:var(--theme-muted)}.theme-offer{position:absolute;right:4%;top:25%;max-width:320px;padding:18px}.theme-cta{position:absolute;right:4%;bottom:5%;padding:13px 18px}.auth-navigation,.auth-assurance{position:absolute;left:4%;z-index:3;padding:10px 16px}.auth-navigation{top:4%}.auth-assurance{bottom:4%}.auth-visual{position:absolute;left:4%;bottom:16%;width:38%;padding:22px}.auth-form-region{position:absolute;right:4%;top:8%;width:34%;padding:20px}.dashboard-navigation{position:fixed;left:18px;top:76px;padding:10px;writing-mode:vertical-rl}.dashboard-wallet,.dashboard-kpis,.dashboard-orders{position:fixed;right:24px;z-index:4;padding:12px 16px;max-width:260px}.dashboard-wallet{top:92px}.dashboard-kpis{top:190px}.dashboard-orders{bottom:24px}:root[data-theme="URBAN_LIME_BRUTAL"] :is(.theme-navigation,.theme-story,.theme-offer,.theme-cta,.auth-navigation,.auth-visual,.auth-form-region,.auth-assurance,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders){border:3px solid #111;border-radius:0;box-shadow:6px 6px 0 #111}:root[data-theme="PRISM_GLASS"] :is(.theme-navigation,.theme-story,.theme-offer,.theme-cta,.auth-navigation,.auth-visual,.auth-form-region,.auth-assurance,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders){backdrop-filter:blur(20px);background:#ffffff55}:root[data-theme="CYBER_NEON_CITY"] :is(.theme-navigation,.theme-story,.theme-offer,.theme-cta,.auth-navigation,.auth-visual,.auth-form-region,.auth-assurance,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders){box-shadow:0 0 22px color-mix(in srgb,var(--theme-primary) 45%,transparent)}@media(max-width:760px){.theme-offer,.theme-cta,.auth-form-region,.dashboard-navigation,.dashboard-wallet,.dashboard-kpis,.dashboard-orders{position:relative;inset:auto;width:auto;max-width:none;margin:10px 14px}.auth-visual{position:relative;inset:auto;width:auto;margin:80px 14px 10px}.auth-navigation,.auth-assurance{left:14px}.theme-navigation,.theme-story{width:calc(100% - 28px)}}
:root{--theme-bg:#07111f;--theme-surface:#111827;--theme-border:#8b5cf655;--theme-text:#f8fafc;--theme-muted:#a9b4c6;--theme-primary:#8b5cf6;--theme-secondary:#7c5b23;--theme-radius:12px;--theme-shadow:0 18px 46px #0005;--theme-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
:root[data-radius="small"]{--theme-radius:6px}:root[data-radius="large"]{--theme-radius:24px}:root[data-density="compact"]{--theme-density:.82}
html[data-theme] body{background:var(--theme-bg);color:var(--theme-text);font-family:var(--theme-font)}html[data-theme] .panel,html[data-theme] .card,html[data-theme] .auth-card,html[data-theme] .dashboard{background:color-mix(in srgb,var(--theme-surface) 94%,transparent);border-color:var(--theme-border);border-radius:var(--theme-radius);box-shadow:var(--theme-shadow)}html[data-theme] .sidebar,html[data-theme] .topbar,html[data-theme] .header{background:color-mix(in srgb,var(--theme-surface) 90%,transparent);border-color:var(--theme-border)}html[data-theme] .button,html[data-theme] .sidebar nav a.active{background:linear-gradient(135deg,var(--theme-primary),var(--theme-secondary));color:#fff;border-color:transparent}html[data-theme] input,html[data-theme] select,html[data-theme] textarea{background:var(--theme-surface);border-color:var(--theme-border);color:var(--theme-text)}html[data-theme] .meta,html[data-theme] small,html[data-theme] .lead{color:var(--theme-muted)}html[data-theme] .gradient,html[data-theme] .price{background:linear-gradient(110deg,var(--theme-primary),var(--theme-secondary));-webkit-background-clip:text;color:transparent}html[data-theme] .eyebrow{color:var(--theme-primary);border-color:var(--theme-border)}html[data-theme] .eyebrow:before{background:var(--theme-primary)}
:root[data-theme="CYBER_NEON_CITY"] body{background-image:radial-gradient(circle at 18% 8%,var(--theme-primary)33,transparent 35%),radial-gradient(circle at 88% 25%,var(--theme-secondary)2c,transparent 32%)}:root[data-theme="PRISM_GLASS"] body{background-image:linear-gradient(125deg,#7dd3fc,#c4b5fd 48%,#f9a8d4)}:root[data-theme="PRISM_GLASS"] .card{backdrop-filter:blur(18px);background:#ffffff77}:root[data-theme="ZEN_JAPANESE"] body,:root[data-theme="BLACK_GOLD_LUXURY"] body{background-image:radial-gradient(circle at 90% 5%,var(--theme-primary)16,transparent 28%)}:root[data-theme="OCEAN_PREMIUM"] body{background-image:radial-gradient(circle at 5% 15%,#ff3d8d22,transparent 32%),radial-gradient(circle at 90% 20%,#7c4dff22,transparent 30%)}:root[data-theme="CREATOR_POP"] body{background-image:linear-gradient(#00a8c60b 1px,transparent 1px),linear-gradient(90deg,#00a8c60b 1px,transparent 1px);background-size:48px 48px}:root[data-theme="URBAN_LIME_BRUTAL"] .button,:root[data-theme="BEIGE_EDITORIAL"] .button{text-transform:uppercase;letter-spacing:.035em}:root[data-theme="BLACK_GOLD_LUXURY"] h1,:root[data-theme="ZEN_JAPANESE"] h1{letter-spacing:-.025em}:root[data-theme="BLUE_BUSINESS"] .card{box-shadow:0 5px 18px #2563eb16}
:root[data-navigation-variant="centered"] .nav{justify-content:center}:root[data-navigation-variant="split"] .nav nav{margin-left:auto}:root[data-navigation-variant="rail"] .header{border-left:5px solid var(--theme-primary)}:root[data-navigation-variant="compact"] .header{margin:12px;border-radius:var(--theme-radius)}
:root[data-hero-variant="split-art"] .hero-grid{grid-template-columns:1fr 1fr}:root[data-hero-variant="dashboard-first"] .hero-visual{order:-1}:root[data-hero-variant="editorial"] .hero h1{font-size:clamp(3rem,8vw,7rem);max-width:11ch}:root[data-hero-variant="service-grid"] .hero-grid{grid-template-columns:2fr 3fr}
:root[data-auth-variant="split"] .auth-shell{grid-template-columns:1fr 1fr}:root[data-auth-variant="card"] .auth-card{max-width:520px;margin:auto}:root[data-auth-variant="immersive"] .auth-shell{min-height:100vh;background:radial-gradient(circle,var(--theme-primary)22,transparent 55%)}:root[data-auth-variant="minimal"] .auth-aside{display:none}
:root[data-sidebar-variant="floating"] .sidebar{margin:14px;border-radius:var(--theme-radius)}:root[data-sidebar-variant="topbar"] .customer{grid-template-columns:1fr}:root[data-sidebar-variant="topbar"] .sidebar{position:relative;width:auto}:root[data-sidebar-variant="compact"] .sidebar{width:210px}
:root[data-dashboard-variant="bento"] .metric-grid{grid-template-columns:2fr 1fr 1fr}:root[data-dashboard-variant="chart-first"] .chart-panel{order:-1}:root[data-dashboard-variant="activity-first"] .activity-panel{order:-1}:root[data-dashboard-variant="wallet-first"] .wallet-card{grid-column:span 2}
:root[data-service-variant="cards"] .service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}:root[data-service-variant="platform-rail"] .platform-filter{position:sticky;top:80px}:root[data-service-variant="table"] .service-grid{grid-template-columns:1fr}:root[data-service-variant="catalog"] .service-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}:root[data-order-form-variant="split-summary"] .order-layout{grid-template-columns:3fr 2fr}:root[data-order-form-variant="compact"] .order-layout{gap:12px}:root[data-order-form-variant="stepper"] .order-layout{counter-reset:step}:root[data-order-form-variant="stepper"] .order-layout label:before{counter-increment:step;content:counter(step) ". ";color:var(--theme-primary)}
:root[data-density="spacious"]{--theme-density:1.16}:root[data-density="compact"] .panel,:root[data-density="compact"] .card{padding:14px}:root[data-density="spacious"] .panel,:root[data-density="spacious"] .card{padding:28px}@media(max-width:760px){:root[data-navigation-variant] .header nav{display:none}:root[data-auth-variant] .auth-shell,:root[data-hero-variant] .hero-grid,:root[data-order-form-variant] .order-layout{grid-template-columns:1fr}:root[data-sidebar-variant] .sidebar{position:fixed}}
${aiCosmicStyles}${referenceStyles}`;
import { aiCosmicTemplates } from "./ai-cosmic-pages.js";
