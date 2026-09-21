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
export const themeIds = themeDefinitions.map((theme) => theme[0]);
export type ThemeId = (typeof themeIds)[number];

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

const dark = new Set(["AURORA_MODERN", "AI_COSMIC_FUTURE"]);
const secondary: Record<ThemeId, string> = {
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
      String(font) === "serif"
        ? 'Georgia,"Times New Roman",serif'
        : font === "display"
          ? '"Arial Narrow","Segoe UI",sans-serif'
          : 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    return `:root[data-theme="${id}"]{color-scheme:${isDark ? "dark" : "light"};--theme-bg:${background};--theme-surface:${surface};--theme-border:${border};--theme-text:${text};--theme-muted:${muted};--theme-primary:${primary};--theme-secondary:${secondary[id]};--theme-radius:${radius[style]};--theme-font:${family};--theme-shadow:0 ${String(style) === "editorial" ? "2px 0" : "18px 46px"} ${primary}1f}`;
  })
  .join("");

/** Resolves only allowlisted themes/options and applies content with textContent (never HTML). */
export const runtimeThemeScript = (
  api: string,
  scope: "public" | "auth" | "customer",
) => {
  const compositionScope = scope === "public" ? "landing" : scope;

  return `(()=>{const allowed=new Set(${JSON.stringify(themeIds)}),aliases=${JSON.stringify(legacyThemeAliases)},structures=${JSON.stringify(themeStructure)},aiPages=${JSON.stringify(aiCosmicPageTemplates)},scope=${JSON.stringify(scope)},compositionScope=${JSON.stringify(compositionScope)},fallback='AURORA_MODERN',mountAiPage=()=>{const template=document.createElement('template');template.innerHTML=aiPages[compositionScope];const page=template.content.firstElementChild;if(compositionScope==='landing'){const current=document.querySelector('main');if(!current)return;const pricing=current.querySelector('#pricing');if(pricing)page.insertBefore(pricing,page.querySelector('.aiv3-footer'));current.replaceWith(page);return}if(compositionScope==='auth'){const current=document.querySelector('.auth'),form=current?.querySelector('.auth-card'),slot=page.querySelector('[data-ai-real-form]');if(!current||!form||!slot)return;slot.replaceWith(form);current.replaceWith(page);return}const current=document.querySelector('.customer'),sidebar=current?.querySelector('.sidebar'),topbar=current?.querySelector('.topbar'),content=current?.querySelector('.customer-content'),sidebarSlot=page.querySelector('[data-ai-sidebar]'),topbarSlot=page.querySelector('[data-ai-topbar]'),contentSlot=page.querySelector('[data-ai-content]');if(!current||!sidebar||!topbar||!content||!sidebarSlot||!topbarSlot||!contentSlot)return;const search=document.createElement('form');search.className='aiv3-search';search.action='/services';search.method='GET';search.innerHTML='<label><span class=\"aiv3-sr\">Tìm dịch vụ</span><input name=\"search\" placeholder=\"Tìm dịch vụ…\" aria-label=\"Tìm dịch vụ\"></label><button aria-label=\"Tìm\">⌕</button>';topbar.children[1]?.replaceWith(search);const assistantLink=document.createElement('a');assistantLink.href='/dashboard#ai-assistant';assistantLink.innerHTML='<i>✧</i><span>AI Assistant</span>';sidebar.querySelector('nav')?.append(assistantLink);const close=document.createElement('button');close.type='button';close.className='aiv3-close';close.textContent='Đóng menu ×';close.onclick=()=>document.querySelector('#drawer-toggle')?.click();sidebar.prepend(close);sidebar.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('#drawer-toggle')?.click();document.querySelector('#drawer-toggle')?.focus()}});const profile=topbar.querySelector('#profile-menu');if(profile)profile.onclick=()=>location.href='/account';sidebarSlot.replaceWith(sidebar);topbarSlot.replaceWith(topbar);contentSlot.replaceWith(content);current.replaceWith(page)},compose=theme=>{if(theme==='AI_COSMIC_FUTURE'){mountAiPage();return}},setTheme=id=>{const normalized=aliases[id]||id,selected=allowed.has(normalized)?normalized:fallback;document.documentElement.dataset.theme=selected;const variants=structures[selected];Object.entries(variants).forEach(([key,value])=>document.documentElement.dataset[key]=value);compose(selected);document.dispatchEvent(new CustomEvent('themechange',{detail:{theme:selected}}));return selected},safeUrl=value=>{if(typeof value!=='string')return null;try{const url=new URL(value,location.origin);return url.protocol==='http:'||url.protocol==='https:'?url.href:null}catch{return null}};setTheme(fallback);fetch(${JSON.stringify(api)}+'/api/v1/public/settings',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then(j=>{const s=j.data||{},key='theme'+scope[0].toUpperCase()+scope.slice(1),id=s.themeMode==='SEPARATE'?s[key]:s.themeGlobal;setTheme(id);const o=s.themeOptions||{};if(['compact','comfortable','spacious'].includes(o.density))document.documentElement.dataset.density=o.density;if(['small','medium','large'].includes(o.radius))document.documentElement.dataset.radius=o.radius;const overrides=s.themeOverrides||{},colorKeys=new Set(['primary','secondary','accent','background','surface','text','muted','border','success','warning','danger']);Object.entries(overrides.colors||{}).forEach(([key,value])=>{if(colorKeys.has(key)&&typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--theme-'+key,value)});const c={...(s.themeContent||{}),...(overrides.content||{})},apply=()=>{document.querySelectorAll('[data-theme-content]').forEach(el=>{const v=c[el.dataset.themeContent];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-list]').forEach((el,i)=>{const v=c.featureBullets?.[i];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-href]').forEach(el=>{const href=safeUrl(c[el.dataset.themeHref]);if(href)el.setAttribute('href',href);else if(document.documentElement.dataset.theme!=='AI_COSMIC_FUTURE'||c[el.dataset.themeHref]!==undefined)el.removeAttribute('href')})};apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true})}).catch(()=>setTheme(fallback))})();`;
};

export const themeStyles = `${declarations}
:root{--theme-bg:#07111f;--theme-surface:#111827;--theme-border:#8b5cf655;--theme-text:#f8fafc;--theme-muted:#a9b4c6;--theme-primary:#8b5cf6;--theme-secondary:#7c5b23;--theme-radius:12px;--theme-shadow:0 18px 46px #0005;--theme-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
:root[data-radius="small"]{--theme-radius:6px}:root[data-radius="large"]{--theme-radius:24px}:root[data-density="compact"]{--theme-density:.82}
html[data-theme] body{background:var(--theme-bg);color:var(--theme-text);font-family:var(--theme-font)}html[data-theme] .panel,html[data-theme] .card,html[data-theme] .auth-card,html[data-theme] .dashboard{background:color-mix(in srgb,var(--theme-surface) 94%,transparent);border-color:var(--theme-border);border-radius:var(--theme-radius);box-shadow:var(--theme-shadow)}html[data-theme] .sidebar,html[data-theme] .topbar,html[data-theme] .header{background:color-mix(in srgb,var(--theme-surface) 90%,transparent);border-color:var(--theme-border)}html[data-theme] .button,html[data-theme] .sidebar nav a.active{background:linear-gradient(135deg,var(--theme-primary),var(--theme-secondary));color:#fff;border-color:transparent}html[data-theme] input,html[data-theme] select,html[data-theme] textarea{background:var(--theme-surface);border-color:var(--theme-border);color:var(--theme-text)}html[data-theme] .meta,html[data-theme] small,html[data-theme] .lead{color:var(--theme-muted)}html[data-theme] .gradient,html[data-theme] .price{background:linear-gradient(110deg,var(--theme-primary),var(--theme-secondary));-webkit-background-clip:text;color:transparent}html[data-theme] .eyebrow{color:var(--theme-primary);border-color:var(--theme-border)}html[data-theme] .eyebrow:before{background:var(--theme-primary)}
:root[data-navigation-variant="centered"] .nav{justify-content:center}:root[data-navigation-variant="split"] .nav nav{margin-left:auto}:root[data-navigation-variant="rail"] .header{border-left:5px solid var(--theme-primary)}:root[data-navigation-variant="compact"] .header{margin:12px;border-radius:var(--theme-radius)}
:root[data-hero-variant="split-art"] .hero-grid{grid-template-columns:1fr 1fr}:root[data-hero-variant="dashboard-first"] .hero-visual{order:-1}:root[data-hero-variant="editorial"] .hero h1{font-size:clamp(3rem,8vw,7rem);max-width:11ch}:root[data-hero-variant="service-grid"] .hero-grid{grid-template-columns:2fr 3fr}
:root[data-auth-variant="split"] .auth-shell{grid-template-columns:1fr 1fr}:root[data-auth-variant="card"] .auth-card{max-width:520px;margin:auto}:root[data-auth-variant="immersive"] .auth-shell{min-height:100vh;background:radial-gradient(circle,var(--theme-primary)22,transparent 55%)}:root[data-auth-variant="minimal"] .auth-aside{display:none}
:root[data-sidebar-variant="floating"] .sidebar{margin:14px;border-radius:var(--theme-radius)}:root[data-sidebar-variant="topbar"] .customer{grid-template-columns:1fr}:root[data-sidebar-variant="topbar"] .sidebar{position:relative;width:auto}:root[data-sidebar-variant="compact"] .sidebar{width:210px}
:root[data-dashboard-variant="bento"] .metric-grid{grid-template-columns:2fr 1fr 1fr}:root[data-dashboard-variant="chart-first"] .chart-panel{order:-1}:root[data-dashboard-variant="activity-first"] .activity-panel{order:-1}:root[data-dashboard-variant="wallet-first"] .wallet-card{grid-column:span 2}
:root[data-service-variant="cards"] .service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}:root[data-service-variant="platform-rail"] .platform-filter{position:sticky;top:80px}:root[data-service-variant="table"] .service-grid{grid-template-columns:1fr}:root[data-service-variant="catalog"] .service-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}:root[data-order-form-variant="split-summary"] .order-layout{grid-template-columns:3fr 2fr}:root[data-order-form-variant="compact"] .order-layout{gap:12px}:root[data-order-form-variant="stepper"] .order-layout{counter-reset:step}:root[data-order-form-variant="stepper"] .order-layout label:before{counter-increment:step;content:counter(step) ". ";color:var(--theme-primary)}
:root[data-density="spacious"]{--theme-density:1.16}:root[data-density="compact"] .panel,:root[data-density="compact"] .card{padding:14px}:root[data-density="spacious"] .panel,:root[data-density="spacious"] .card{padding:28px}@media(max-width:760px){:root[data-navigation-variant] .header nav{display:none}:root[data-auth-variant] .auth-shell,:root[data-hero-variant] .hero-grid,:root[data-order-form-variant] .order-layout{grid-template-columns:1fr}:root[data-sidebar-variant] .sidebar{position:fixed}}
${aiCosmicStyles}`;
import { aiCosmicPageTemplates } from "./ai-cosmic-pages.js";
import { aiCosmicStyles } from "./ai-cosmic-styles.js";
