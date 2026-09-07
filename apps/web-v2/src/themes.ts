const themeDefinitions = [
  [
    "DARK_LUXURY",
    "Dark Luxury",
    "Đen nhung, vàng champagne",
    "luxury",
    "#f5c978",
    "#090a0c",
    "serif",
  ],
  [
    "MINIMAL_LIGHT",
    "Minimal Light",
    "Tối giản sáng, xanh tin cậy",
    "minimal",
    "#1677ff",
    "#f7faff",
    "sans",
  ],
  [
    "CYBER_NEON",
    "Cyber Neon",
    "Tím điện, cyan tương lai",
    "cyber",
    "#b33cff",
    "#09051d",
    "display",
  ],
  [
    "SOFT_PASTEL",
    "Soft Pastel",
    "Hồng dịu, thân thiện",
    "pastel",
    "#e9557b",
    "#fff7f8",
    "sans",
  ],
  [
    "NATURE_GREEN",
    "Nature Green",
    "Xanh lá tự nhiên, bền vững",
    "nature",
    "#16844b",
    "#f5fbf5",
    "serif",
  ],
  [
    "GLASSMORPHISM",
    "Glassmorphism",
    "Kính mờ trên dải màu hiện đại",
    "glass",
    "#5145e5",
    "#e9e8ff",
    "sans",
  ],
  [
    "BOLD_COMMERCE",
    "Bold Commerce",
    "Đỏ chuyển đổi, bố cục bán hàng",
    "commerce",
    "#ed2638",
    "#fffafa",
    "display",
  ],
  [
    "DASHBOARD_FOCUSED",
    "Dashboard Focused",
    "Dữ liệu rõ ràng, xanh vận hành",
    "dashboard",
    "#2563eb",
    "#f5f9ff",
    "sans",
  ],
  [
    "CREATIVE_AGENCY",
    "Creative Agency",
    "Cam nghệ thuật trên nền than",
    "agency",
    "#ff8b24",
    "#11100f",
    "display",
  ],
  [
    "PREMIUM_CORPORATE",
    "Premium Corporate",
    "Xanh doanh nghiệp cao cấp",
    "corporate",
    "#1767d2",
    "#f4f8fc",
    "serif",
  ],
  [
    "JAPANESE_ZEN",
    "Japanese Zen",
    "Mực tàu, đỏ son và khoảng thở",
    "zen",
    "#b64035",
    "#f5f1e8",
    "serif",
  ],
  [
    "BLACK_GOLD_ELITE",
    "Black Gold Elite",
    "Đen obsidian, vàng kim độc quyền",
    "gold",
    "#d6ad55",
    "#050505",
    "serif",
  ],
  [
    "AI_FUTURISTIC",
    "AI Futuristic",
    "Gradient AI đa sắc, không gian sâu",
    "ai",
    "#7c5cff",
    "#080b20",
    "display",
  ],
  [
    "EDITORIAL_BRUTALIST",
    "Editorial Brutalist",
    "Tạp chí tương phản, đường nét brutalist",
    "editorial",
    "#111111",
    "#f4efe4",
    "serif",
  ],
  [
    "SOCIAL_CREATOR",
    "Social Creator",
    "Creator pop, hồng tím giàu năng lượng",
    "creator",
    "#f43f8f",
    "#fff5fb",
    "display",
  ],
  [
    "OCEAN_PROFESSIONAL",
    "Ocean Professional",
    "Xanh đại dương chuyên nghiệp, tin cậy",
    "ocean",
    "#087ea4",
    "#f1f9fc",
    "sans",
  ],
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
    "EMERALD_BUSINESS",
    "Emerald Business",
    "Emerald doanh nghiệp, vững vàng và rõ ràng",
    "emerald",
    "#087f5b",
    "#f1faf6",
    "sans",
  ],
  [
    "MIDNIGHT_SAAS",
    "Midnight SaaS",
    "SaaS midnight, indigo và cyan sắc nét",
    "saas",
    "#818cf8",
    "#080d1a",
    "sans",
  ],
  [
    "SOFT_BEIGE_PREMIUM",
    "Soft Beige Premium",
    "Beige mềm mại, thanh lịch cao cấp",
    "beige",
    "#9a6b4f",
    "#f7f0e5",
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
const structure = (navigationVariant:string,heroVariant:string,authVariant:string,sidebarVariant:string,dashboardVariant:string,serviceVariant:string,orderFormVariant:string,density:string):ThemeStructure => ({navigationVariant,heroVariant,authVariant,sidebarVariant,dashboardVariant,serviceVariant,orderFormVariant,density});
/** Deliberately authored structures: variants are semantic, not index-generated. */
export const themeStructure: Record<ThemeId, ThemeStructure> = {
  DARK_LUXURY:structure("centered","editorial","card","floating","wallet-first","cards","split-summary","spacious"), MINIMAL_LIGHT:structure("split","split-art","minimal","fixed","metrics-row","table","guided","comfortable"), CYBER_NEON:structure("rail","platform-stage","immersive","compact","bento","cards","stepper","compact"), SOFT_PASTEL:structure("centered","split-art","card","floating","activity-first","cards","guided","spacious"), NATURE_GREEN:structure("split","service-grid","split","fixed","metrics-row","catalog","split-summary","spacious"), GLASSMORPHISM:structure("compact","platform-stage","immersive","floating","bento","cards","stepper","comfortable"), BOLD_COMMERCE:structure("rail","service-grid","card","compact","wallet-first","catalog","guided","compact"), DASHBOARD_FOCUSED:structure("split","dashboard-first","minimal","fixed","chart-first","table","compact","compact"), CREATIVE_AGENCY:structure("centered","editorial","immersive","topbar","activity-first","cards","stepper","spacious"), PREMIUM_CORPORATE:structure("split","split-art","split","fixed","metrics-row","table","split-summary","comfortable"), JAPANESE_ZEN:structure("centered","editorial","minimal","compact","wallet-first","catalog","guided","spacious"), BLACK_GOLD_ELITE:structure("rail","editorial","card","floating","wallet-first","cards","split-summary","spacious"), AI_FUTURISTIC:structure("compact","platform-stage","immersive","topbar","chart-first","cards","stepper","comfortable"), EDITORIAL_BRUTALIST:structure("rail","editorial","minimal","compact","activity-first","table","compact","compact"), SOCIAL_CREATOR:structure("centered","split-art","card","floating","bento","cards","guided","comfortable"), OCEAN_PROFESSIONAL:structure("split","service-grid","split","fixed","metrics-row","table","split-summary","comfortable"), AURORA_MODERN:structure("compact","platform-stage","immersive","floating","chart-first","cards","stepper","spacious"), EMERALD_BUSINESS:structure("split","dashboard-first","card","fixed","metrics-row","catalog","guided","comfortable"), MIDNIGHT_SAAS:structure("rail","dashboard-first","immersive","compact","bento","table","compact","compact"), SOFT_BEIGE_PREMIUM:structure("centered","split-art","card","floating","wallet-first","cards","split-summary","spacious")
};

export const legacyThemeAliases: Record<string, ThemeId> = {BOLD_ECOMMERCE:"BOLD_COMMERCE",ZEN_JAPAN:"JAPANESE_ZEN",BLACK_GOLD:"BLACK_GOLD_ELITE",FUTURE_AI:"AI_FUTURISTIC",EDITORIAL:"EDITORIAL_BRUTALIST",CREATOR_POP:"SOCIAL_CREATOR",OCEAN_TECH:"OCEAN_PROFESSIONAL",FINTECH:"EMERALD_BUSINESS",SAAS_DARK:"MIDNIGHT_SAAS",BEIGE:"SOFT_BEIGE_PREMIUM"};

const dark = new Set([
  "DARK_LUXURY",
  "CYBER_NEON",
  "CREATIVE_AGENCY",
  "AI_FUTURISTIC",
  "SOCIAL_CREATOR",
  "AURORA_MODERN",
]);
const secondary: Record<string, string> = {
  DARK_LUXURY: "#8f7350",
  MINIMAL_LIGHT: "#74bdf2",
  CYBER_NEON: "#05c8ff",
  SOFT_PASTEL: "#ff9cae",
  NATURE_GREEN: "#77ad65",
  GLASSMORPHISM: "#8b5cf6",
  BOLD_COMMERCE: "#ff6f61",
  DASHBOARD_FOCUSED: "#48a0ff",
  CREATIVE_AGENCY: "#bb5b21",
  PREMIUM_CORPORATE: "#65a5e8",
  JAPANESE_ZEN: "#27382f",
  BLACK_GOLD_ELITE: "#a57a56",
  AI_FUTURISTIC: "#00c6ff",
  EDITORIAL_BRUTALIST: "#2bb7da",
  SOCIAL_CREATOR: "#176f96",
  OCEAN_PROFESSIONAL: "#7c4dff",
  AURORA_MODERN: "#7c5b23",
  EMERALD_BUSINESS: "#42a5ff",
  MIDNIGHT_SAAS: "#31c5a8",
  SOFT_BEIGE_PREMIUM: "#ffad32",
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
    const text = isDark
      ? "#f8fafc"
      : id === "NATURE_GREEN"
        ? "#113522"
        : "#111827";
    const muted = isDark ? "#a9b4c6" : "#607087";
    const border = isDark ? `${primary}55` : `${primary}2d`;
    const family =
      font === "serif"
        ? 'Georgia,"Times New Roman",serif'
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
) =>
  `(()=>{const allowed=new Set(${JSON.stringify(themeIds)}),aliases=${JSON.stringify(legacyThemeAliases)},structures=${JSON.stringify(themeStructure)},scope=${JSON.stringify(scope)},fallback='DARK_LUXURY',setTheme=id=>{const normalized=aliases[id]||id,selected=allowed.has(normalized)?normalized:fallback;document.documentElement.dataset.theme=selected;const variants=structures[selected];Object.entries(variants).forEach(([key,value])=>document.documentElement.dataset[key]=value);return selected},safeUrl=value=>{if(typeof value!=='string')return null;try{const url=new URL(value,location.origin);return url.protocol==='http:'||url.protocol==='https:'?url.href:null}catch{return null}};setTheme(fallback);fetch(${JSON.stringify(api)}+'/api/v1/public/settings',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then(j=>{const s=j.data||{},key='theme'+scope[0].toUpperCase()+scope.slice(1),id=s.themeMode==='SEPARATE'?s[key]:s.themeGlobal;setTheme(id);const o=s.themeOptions||{};if(['compact','comfortable','spacious'].includes(o.density))document.documentElement.dataset.density=o.density;if(['small','medium','large'].includes(o.radius))document.documentElement.dataset.radius=o.radius;const overrides=s.themeOverrides||{},colorKeys=new Set(['primary','secondary','accent','background','surface','text','muted','border','success','warning','danger']);Object.entries(overrides.colors||{}).forEach(([key,value])=>{if(colorKeys.has(key)&&typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--theme-'+key,value)});const c={...(s.themeContent||{}),...(overrides.content||{})},apply=()=>{document.querySelectorAll('[data-theme-content]').forEach(el=>{const v=c[el.dataset.themeContent];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-list]').forEach((el,i)=>{const v=c.featureBullets?.[i];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-href]').forEach(el=>{const href=safeUrl(c[el.dataset.themeHref]);if(href)el.setAttribute('href',href);else el.removeAttribute('href')})};apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true})}).catch(()=>setTheme(fallback))})();`;

export const themeStyles = `${declarations}
:root{--theme-bg:#090a0c;--theme-surface:#111827;--theme-border:#f5c97855;--theme-text:#f8fafc;--theme-muted:#a9b4c6;--theme-primary:#f5c978;--theme-secondary:#8f7350;--theme-radius:12px;--theme-shadow:0 18px 46px #0005;--theme-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
:root[data-radius="small"]{--theme-radius:6px}:root[data-radius="large"]{--theme-radius:24px}:root[data-density="compact"]{--theme-density:.82}
html[data-theme] body{background:var(--theme-bg);color:var(--theme-text);font-family:var(--theme-font)}html[data-theme] .panel,html[data-theme] .card,html[data-theme] .auth-card,html[data-theme] .dashboard{background:color-mix(in srgb,var(--theme-surface) 94%,transparent);border-color:var(--theme-border);border-radius:var(--theme-radius);box-shadow:var(--theme-shadow)}html[data-theme] .sidebar,html[data-theme] .topbar,html[data-theme] .header{background:color-mix(in srgb,var(--theme-surface) 90%,transparent);border-color:var(--theme-border)}html[data-theme] .button,html[data-theme] .sidebar nav a.active{background:linear-gradient(135deg,var(--theme-primary),var(--theme-secondary));color:#fff;border-color:transparent}html[data-theme] input,html[data-theme] select,html[data-theme] textarea{background:var(--theme-surface);border-color:var(--theme-border);color:var(--theme-text)}html[data-theme] .meta,html[data-theme] small,html[data-theme] .lead{color:var(--theme-muted)}html[data-theme] .gradient,html[data-theme] .price{background:linear-gradient(110deg,var(--theme-primary),var(--theme-secondary));-webkit-background-clip:text;color:transparent}html[data-theme] .eyebrow{color:var(--theme-primary);border-color:var(--theme-border)}html[data-theme] .eyebrow:before{background:var(--theme-primary)}
:root[data-theme="CYBER_NEON"] body,:root[data-theme="AI_FUTURISTIC"] body{background-image:radial-gradient(circle at 18% 8%,var(--theme-primary)33,transparent 35%),radial-gradient(circle at 88% 25%,var(--theme-secondary)2c,transparent 32%)}:root[data-theme="GLASSMORPHISM"] body{background-image:linear-gradient(125deg,#7dd3fc,#c4b5fd 48%,#f9a8d4)}:root[data-theme="GLASSMORPHISM"] .card{backdrop-filter:blur(18px);background:#ffffff77}:root[data-theme="JAPANESE_ZEN"] body,:root[data-theme="BLACK_GOLD_ELITE"] body{background-image:radial-gradient(circle at 90% 5%,var(--theme-primary)16,transparent 28%)}:root[data-theme="OCEAN_PROFESSIONAL"] body{background-image:radial-gradient(circle at 5% 15%,#ff3d8d22,transparent 32%),radial-gradient(circle at 90% 20%,#7c4dff22,transparent 30%)}:root[data-theme="SOCIAL_CREATOR"] body{background-image:linear-gradient(#00a8c60b 1px,transparent 1px),linear-gradient(90deg,#00a8c60b 1px,transparent 1px);background-size:48px 48px}:root[data-theme="BOLD_COMMERCE"] .button,:root[data-theme="SOFT_BEIGE_PREMIUM"] .button{text-transform:uppercase;letter-spacing:.035em}:root[data-theme="BLACK_GOLD_ELITE"] h1,:root[data-theme="JAPANESE_ZEN"] h1{letter-spacing:-.025em}:root[data-theme="DASHBOARD_FOCUSED"] .card{box-shadow:0 5px 18px #2563eb16}
:root[data-navigation-variant="centered"] .nav{justify-content:center}:root[data-navigation-variant="split"] .nav nav{margin-left:auto}:root[data-navigation-variant="rail"] .header{border-left:5px solid var(--theme-primary)}:root[data-navigation-variant="compact"] .header{margin:12px;border-radius:var(--theme-radius)}
:root[data-hero-variant="split-art"] .hero-grid{grid-template-columns:1fr 1fr}:root[data-hero-variant="dashboard-first"] .hero-visual{order:-1}:root[data-hero-variant="editorial"] .hero h1{font-size:clamp(3rem,8vw,7rem);max-width:11ch}:root[data-hero-variant="service-grid"] .hero-grid{grid-template-columns:2fr 3fr}
:root[data-auth-variant="split"] .auth-shell{grid-template-columns:1fr 1fr}:root[data-auth-variant="card"] .auth-card{max-width:520px;margin:auto}:root[data-auth-variant="immersive"] .auth-shell{min-height:100vh;background:radial-gradient(circle,var(--theme-primary)22,transparent 55%)}:root[data-auth-variant="minimal"] .auth-aside{display:none}
:root[data-sidebar-variant="floating"] .sidebar{margin:14px;border-radius:var(--theme-radius)}:root[data-sidebar-variant="topbar"] .customer{grid-template-columns:1fr}:root[data-sidebar-variant="topbar"] .sidebar{position:relative;width:auto}:root[data-sidebar-variant="compact"] .sidebar{width:210px}
:root[data-dashboard-variant="bento"] .metric-grid{grid-template-columns:2fr 1fr 1fr}:root[data-dashboard-variant="chart-first"] .chart-panel{order:-1}:root[data-dashboard-variant="activity-first"] .activity-panel{order:-1}:root[data-dashboard-variant="wallet-first"] .wallet-card{grid-column:span 2}
:root[data-service-variant="cards"] .service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}:root[data-service-variant="platform-rail"] .platform-filter{position:sticky;top:80px}:root[data-service-variant="table"] .service-grid{grid-template-columns:1fr}:root[data-service-variant="catalog"] .service-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}:root[data-order-form-variant="split-summary"] .order-layout{grid-template-columns:3fr 2fr}:root[data-order-form-variant="compact"] .order-layout{gap:12px}:root[data-order-form-variant="stepper"] .order-layout{counter-reset:step}:root[data-order-form-variant="stepper"] .order-layout label:before{counter-increment:step;content:counter(step) ". ";color:var(--theme-primary)}
:root[data-density="spacious"]{--theme-density:1.16}:root[data-density="compact"] .panel,:root[data-density="compact"] .card{padding:14px}:root[data-density="spacious"] .panel,:root[data-density="spacious"] .card{padding:28px}@media(max-width:760px){:root[data-navigation-variant] .header nav{display:none}:root[data-auth-variant] .auth-shell,:root[data-hero-variant] .hero-grid,:root[data-order-form-variant] .order-layout{grid-template-columns:1fr}:root[data-sidebar-variant] .sidebar{position:fixed}}
`;
