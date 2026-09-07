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
  DARK_LUXURY:structure("luxury-gallery","monument","noir-suite","gold-rail","executive-night","jewel-grid","private-desk","spacious"), MINIMAL_LIGHT:structure("split","split-art","minimal","fixed","metrics-row","table","guided","comfortable"), CYBER_NEON:structure("neon-command","hologram-stage","portal","circuit-rail","telemetry-bento","neon-modules","terminal-flow","compact"), SOFT_PASTEL:structure("centered","split-art","card","floating","activity-first","cards","guided","spacious"), NATURE_GREEN:structure("split","service-grid","split","fixed","metrics-row","catalog","split-summary","spacious"), GLASSMORPHISM:structure("glass-orbit","prism-pedestal","crystal-suite","floating-dock","luminous-console","glass-carousel","floating-wizard","spacious"), BOLD_COMMERCE:structure("rail","service-grid","card","compact","wallet-first","catalog","guided","compact"), DASHBOARD_FOCUSED:structure("split","dashboard-first","minimal","fixed","chart-first","table","compact","compact"), CREATIVE_AGENCY:structure("centered","editorial","immersive","topbar","activity-first","cards","stepper","spacious"), PREMIUM_CORPORATE:structure("corporate-bar","business-tower","trust-split","office-rail","kpi-board","solution-columns","proposal-flow","comfortable"), JAPANESE_ZEN:structure("zen-pavilion","ink-landscape","shoji","quiet-rail","garden-ledger","zen-shelf","ritual-flow","spacious"), BLACK_GOLD_ELITE:structure("rail","editorial","card","floating","wallet-first","cards","split-summary","spacious"), AI_FUTURISTIC:structure("ai-command","neural-orbit","cognitive-gateway","agent-console","intelligence-grid","model-modules","prompt-pipeline","compact"), EDITORIAL_BRUTALIST:structure("brutal-masthead","concrete-spread","poster-access","block-rail","hard-ledger","manifesto-grid","ticket-desk","compact"), SOCIAL_CREATOR:structure("creator-marquee","viral-collage","creator-studio","pop-ribbon","social-pulse","platform-stickers","boost-composer","comfortable"), OCEAN_PROFESSIONAL:structure("split","service-grid","split","fixed","metrics-row","table","split-summary","comfortable"), AURORA_MODERN:structure("compact","platform-stage","immersive","floating","chart-first","cards","stepper","spacious"), EMERALD_BUSINESS:structure("emerald-boardroom","growth-briefing","executive-access","enterprise-rail","growth-command","capability-matrix","approval-desk","comfortable"), MIDNIGHT_SAAS:structure("rail","dashboard-first","immersive","compact","bento","table","compact","compact"), SOFT_BEIGE_PREMIUM:structure("beige-boutique","beige-editorial","beige-gallery","beige-tailored","beige-ledger","beige-showcase","beige-concierge","spacious")
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
  SOFT_BEIGE_PREMIUM: "#b28758",
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
/* Four reference-led architectures; every selector remains isolated to its preset. */
:root[data-theme="JAPANESE_ZEN"]{--theme-bg:#f2f1e9;--theme-surface:#fbfaf4;--theme-text:#17251d;--theme-muted:#657168;--theme-primary:#265a40;--theme-secondary:#102e20;--theme-border:#315d4038;--theme-radius:3px;--theme-shadow:0 12px 36px #254b3020}:root[data-theme="JAPANESE_ZEN"] body{background:#f3f2eb;background-image:radial-gradient(circle at 68% 27%,#dbcba9 0 7%,transparent 7.2%),radial-gradient(ellipse at 72% 42%,#819b8730,transparent 35%),repeating-linear-gradient(4deg,#21453205 0 1px,transparent 1px 9px)}:root[data-theme="JAPANESE_ZEN"] h1,:root[data-theme="JAPANESE_ZEN"] h2,:root[data-theme="JAPANESE_ZEN"] h3,:root[data-theme="JAPANESE_ZEN"] .brand{font-family:Georgia,serif}:root[data-theme="JAPANESE_ZEN"] .header{background:#fbfaf3e8;border-bottom:1px solid #214c35;margin:0}:root[data-theme="JAPANESE_ZEN"] .mark{background:none!important;color:#24533b!important;font-size:0}:root[data-theme="JAPANESE_ZEN"] .mark:after{content:"鳥";font-size:25px}:root[data-theme="JAPANESE_ZEN"] .hero{padding:74px 0}:root[data-theme="JAPANESE_ZEN"] .hero-grid{grid-template-columns:.9fr 1.1fr;gap:72px;min-height:550px}:root[data-theme="JAPANESE_ZEN"] .hero h1{font-size:clamp(3.4rem,6vw,6.5rem);line-height:.98;max-width:10ch}:root[data-theme="JAPANESE_ZEN"] .preview{border:0;background:radial-gradient(ellipse at 66% 66%,#1d4b31 0 2%,transparent 2.5%),radial-gradient(ellipse at 62% 45%,transparent 0 19%,#334b3b 19.4% 20%,transparent 20.5%),linear-gradient(155deg,transparent 35%,#6d806d38 36% 55%,transparent 56%)}:root[data-theme="JAPANESE_ZEN"] .preview .dashboard{position:absolute;bottom:5%;left:5%;width:78%;background:#fbfaf4db!important;border:1px solid #395943!important;box-shadow:none!important}:root[data-theme="JAPANESE_ZEN"] .stats{border-block:1px solid #78907d;background:#fbfaf4}:root[data-theme="JAPANESE_ZEN"] #services{background:#e8ece3}:root[data-theme="JAPANESE_ZEN"] .cards{grid-template-columns:repeat(4,1fr)}:root[data-theme="JAPANESE_ZEN"] .card{box-shadow:none!important;border:1px solid #9baa9a!important}:root[data-theme="JAPANESE_ZEN"] .auth{max-width:1280px;grid-template-columns:1.1fr .9fr;gap:0;min-height:100vh}:root[data-theme="JAPANESE_ZEN"] .auth-copy{padding:10%;background:radial-gradient(circle at 58% 34%,#d9c99e 0 9%,transparent 9.3%),linear-gradient(145deg,#f8f7ef 42%,#adc0ad 43% 44%,#e6eadf 45%)}:root[data-theme="JAPANESE_ZEN"] .auth-card{align-self:center;border:1px solid #728775!important;box-shadow:none!important}:root[data-theme="JAPANESE_ZEN"] .customer{grid-template-columns:220px 1fr;background:#eef0e8}:root[data-theme="JAPANESE_ZEN"] .sidebar{background:#faf9f2;border-right:1px solid #526d59}:root[data-theme="JAPANESE_ZEN"] .sidebar nav a.active{background:#315f45;color:#fff}:root[data-theme="JAPANESE_ZEN"] .topbar{background:#faf9f2;border-bottom:1px solid #90a093}:root[data-theme="JAPANESE_ZEN"] .welcome{background:linear-gradient(100deg,#254f37,#55725e)!important;color:white}:root[data-theme="JAPANESE_ZEN"] .metric-grid{grid-template-columns:1.2fr repeat(3,1fr)}:root[data-theme="JAPANESE_ZEN"] .metric-card{border-radius:2px;border-top:3px solid #315f45;background:#faf9f2;box-shadow:none}
:root[data-theme="DARK_LUXURY"]{--theme-bg:#060707;--theme-surface:#0d1112;--theme-text:#fff8ec;--theme-muted:#b7aa98;--theme-primary:#efbd68;--theme-secondary:#9d6123;--theme-border:#e6ad5355;--theme-radius:9px;--theme-shadow:0 0 28px #d6943430}:root[data-theme="DARK_LUXURY"] body{background:#060707;background-image:radial-gradient(circle at 82% 20%,#d5902726,transparent 28%),linear-gradient(118deg,transparent 62%,#bd7a1b12 62% 68%,transparent 68%)}:root[data-theme="DARK_LUXURY"] h1,:root[data-theme="DARK_LUXURY"] h2,:root[data-theme="DARK_LUXURY"] h3,:root[data-theme="DARK_LUXURY"] .brand{font-family:Georgia,serif}:root[data-theme="DARK_LUXURY"] .header{margin:14px auto 0;width:min(1400px,calc(100% - 28px));border:1px solid #d8a451;border-radius:10px;background:#080a0be8}:root[data-theme="DARK_LUXURY"] .mark{background:none!important;color:#efbd68!important;font-size:0}:root[data-theme="DARK_LUXURY"] .mark:after{content:"♛";font-size:30px}:root[data-theme="DARK_LUXURY"] .hero{padding:42px 0}:root[data-theme="DARK_LUXURY"] .hero-grid{grid-template-columns:1fr 1fr;min-height:590px;border:1px solid #a97838;border-radius:10px;overflow:hidden;background:#090c0e}:root[data-theme="DARK_LUXURY"] .hero-grid>div:first-child{padding:58px}:root[data-theme="DARK_LUXURY"] .hero h1{font-size:clamp(3.5rem,6vw,6.8rem);line-height:.94;max-width:9ch}:root[data-theme="DARK_LUXURY"] .preview{position:relative;background:radial-gradient(circle at 55% 38%,#f3bf57 0 6%,transparent 6.5%),linear-gradient(140deg,#050606,#1a1209 48%,#70400c)}:root[data-theme="DARK_LUXURY"] .preview:before{content:"♛";position:absolute;inset:14% 0 auto;text-align:center;font-size:220px;color:#efb955;text-shadow:0 0 40px #f5b94c}:root[data-theme="DARK_LUXURY"] .preview .dashboard{position:absolute;right:5%;bottom:5%;width:70%;background:#0a0e10e8!important}:root[data-theme="DARK_LUXURY"] .stats{border:1px solid #8b622e;background:#090b0c}:root[data-theme="DARK_LUXURY"] .cards{grid-template-columns:repeat(4,1fr)}:root[data-theme="DARK_LUXURY"] .card{background:linear-gradient(145deg,#151515,#090a0a)!important;border:1px solid #805c2f!important}:root[data-theme="DARK_LUXURY"] .auth{max-width:1320px;min-height:calc(100vh - 32px);margin:16px auto;grid-template-columns:48% 52%;gap:0;border:1px solid #bd893d;border-radius:12px;overflow:hidden;background:#080909}:root[data-theme="DARK_LUXURY"] .auth-copy{padding:64px;background:radial-gradient(circle at 75% 36%,#df9c3133,transparent 25%)}:root[data-theme="DARK_LUXURY"] .auth-card{margin:0;max-width:none;padding:12%;border:0!important;border-left:1px solid #8b622e!important;border-radius:0!important;background:linear-gradient(135deg,#101112,#080909)!important}:root[data-theme="DARK_LUXURY"] .customer{grid-template-columns:230px 1fr;background:#07090a}:root[data-theme="DARK_LUXURY"] .sidebar{background:#090c0e;border-right:1px solid #775327}:root[data-theme="DARK_LUXURY"] .sidebar nav a.active{background:linear-gradient(90deg,#755021,#17120b);color:#ffd98f}:root[data-theme="DARK_LUXURY"] .topbar{background:#0b0e10;border-bottom:1px solid #5c4528}:root[data-theme="DARK_LUXURY"] .welcome{background:linear-gradient(110deg,#16100a,#61401c)!important}:root[data-theme="DARK_LUXURY"] .metric-grid{grid-template-columns:1.35fr repeat(3,1fr)}:root[data-theme="DARK_LUXURY"] .metric-card{background:#0e1214;border:1px solid #57462f;border-bottom:2px solid #dba955;box-shadow:0 10px 25px #000}
:root[data-theme="PREMIUM_CORPORATE"]{--theme-bg:#f3f8fd;--theme-surface:#fff;--theme-text:#0c2851;--theme-muted:#60748e;--theme-primary:#176ad8;--theme-secondary:#55b9ef;--theme-border:#2879d52e;--theme-radius:12px;--theme-shadow:0 14px 35px #176ad815}:root[data-theme="PREMIUM_CORPORATE"] body{background:#f4f8fc;background-image:linear-gradient(90deg,#287dd006 1px,transparent 1px),linear-gradient(#287dd006 1px,transparent 1px);background-size:56px 56px}:root[data-theme="PREMIUM_CORPORATE"] .header{background:#fffffff2;border-bottom:1px solid #d4e2f1}:root[data-theme="PREMIUM_CORPORATE"] .mark{background:#1472e6}:root[data-theme="PREMIUM_CORPORATE"] .hero{padding:76px 0;background:linear-gradient(115deg,#fff 0 58%,#e4f1fd 58%)}:root[data-theme="PREMIUM_CORPORATE"] .hero-grid{grid-template-columns:1fr .85fr;gap:64px;min-height:500px}:root[data-theme="PREMIUM_CORPORATE"] .hero h1{font-family:Arial,sans-serif;font-size:clamp(3.2rem,5vw,5.8rem);line-height:1;max-width:10ch;color:#0a2858}:root[data-theme="PREMIUM_CORPORATE"] .preview{border:0;border-radius:0;background:linear-gradient(145deg,transparent 0 35%,#87b7dc 35% 37%,transparent 37%),linear-gradient(115deg,#dceaf5 0 48%,#5993bd 49% 51%,#d8e9f6 52%)}:root[data-theme="PREMIUM_CORPORATE"] .preview .dashboard{margin:70px 0 0 -25px;background:#fff!important;box-shadow:0 24px 60px #174e8530!important}:root[data-theme="PREMIUM_CORPORATE"] .stats{margin-top:-20px;background:#fff;border-radius:14px;box-shadow:0 16px 30px #1b609018}:root[data-theme="PREMIUM_CORPORATE"] #services{background:white}:root[data-theme="PREMIUM_CORPORATE"] .cards{grid-template-columns:repeat(2,1fr)}:root[data-theme="PREMIUM_CORPORATE"] .cards .card{display:grid;grid-template-columns:auto 1fr;column-gap:20px;border-left:4px solid #257ce0!important}:root[data-theme="PREMIUM_CORPORATE"] .auth{max-width:none;min-height:100vh;grid-template-columns:58% 42%;gap:0;padding:0}:root[data-theme="PREMIUM_CORPORATE"] .auth-copy{padding:10%;background:linear-gradient(125deg,#0c4f9b,#2a8ce8);color:white}:root[data-theme="PREMIUM_CORPORATE"] .auth-copy .meta,:root[data-theme="PREMIUM_CORPORATE"] .auth-copy .lead{color:#dceeff}:root[data-theme="PREMIUM_CORPORATE"] .auth-card{margin:auto;width:min(520px,86%);box-shadow:0 25px 70px #1a548222!important}:root[data-theme="PREMIUM_CORPORATE"] .customer{grid-template-columns:248px 1fr;background:#f2f6fb}:root[data-theme="PREMIUM_CORPORATE"] .sidebar{background:#fff;border-right:1px solid #d8e3ee}:root[data-theme="PREMIUM_CORPORATE"] .sidebar nav a.active{background:#e5f1ff;color:#075fc4;border-right:3px solid #1678e5}:root[data-theme="PREMIUM_CORPORATE"] .topbar{background:white;box-shadow:0 3px 15px #144d8010}:root[data-theme="PREMIUM_CORPORATE"] .welcome{background:linear-gradient(100deg,#0a5db8,#3b9ce7)!important;color:white}:root[data-theme="PREMIUM_CORPORATE"] .metric-grid{grid-template-columns:repeat(4,1fr)}:root[data-theme="PREMIUM_CORPORATE"] .metric-card{background:#fff;border:0;border-left:4px solid #2982e2;box-shadow:0 9px 24px #175a8c12}
:root[data-theme="CYBER_NEON"]{--theme-bg:#05071a;--theme-surface:#0b1028;--theme-text:#f2f4ff;--theme-muted:#98a3c9;--theme-primary:#a23cff;--theme-secondary:#00d9ff;--theme-border:#7d54ff66;--theme-radius:16px;--theme-shadow:0 0 30px #833cff30}:root[data-theme="CYBER_NEON"] body{background:#05071a;background-image:radial-gradient(circle at 75% 18%,#ad20ff35,transparent 30%),radial-gradient(circle at 12% 45%,#00bfff22,transparent 28%),linear-gradient(#6c52ff0d 1px,transparent 1px),linear-gradient(90deg,#6c52ff0d 1px,transparent 1px);background-size:auto,auto,42px 42px,42px 42px}:root[data-theme="CYBER_NEON"] h1,:root[data-theme="CYBER_NEON"] h2,:root[data-theme="CYBER_NEON"] h3{font-family:"Arial Narrow",Arial,sans-serif;text-transform:uppercase}:root[data-theme="CYBER_NEON"] .header{margin:12px;border:1px solid #6b4cff;border-radius:16px;background:#080b20dd;box-shadow:0 0 24px #603cff38}:root[data-theme="CYBER_NEON"] .hero-grid{grid-template-columns:.85fr 1.15fr;min-height:570px}:root[data-theme="CYBER_NEON"] .hero h1{font-size:clamp(3.5rem,6vw,6.8rem);line-height:.9;max-width:8ch;text-shadow:0 0 24px #a33cff55}:root[data-theme="CYBER_NEON"] .preview{perspective:900px;background:radial-gradient(circle,#bf33ff55 0 10%,transparent 30%)}:root[data-theme="CYBER_NEON"] .preview .dashboard{transform:rotateY(-10deg) rotateX(4deg);border:1px solid #00d9ff!important;background:#080d22dd!important;box-shadow:0 0 50px #9a35ff55!important}:root[data-theme="CYBER_NEON"] .stats{border:1px solid #683cff;border-radius:16px;background:#080c24aa}:root[data-theme="CYBER_NEON"] .cards{grid-template-columns:1.4fr repeat(3,1fr)}:root[data-theme="CYBER_NEON"] .card{background:linear-gradient(145deg,#101638,#090d21)!important;border:1px solid #6548ce!important;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}:root[data-theme="CYBER_NEON"] .auth{max-width:none;min-height:100vh;grid-template-columns:1fr 1fr;gap:0;padding:0}:root[data-theme="CYBER_NEON"] .auth-copy{padding:9%;background:radial-gradient(circle at 65% 45%,#cf32ff44,transparent 28%),#06091e}:root[data-theme="CYBER_NEON"] .auth-card{margin:auto;width:min(520px,86%);border:1px solid #00d8ff!important;box-shadow:0 0 60px #8d33ff55!important;background:#090e28e8!important}:root[data-theme="CYBER_NEON"] input{box-shadow:inset 0 0 12px #00c8ff10}:root[data-theme="CYBER_NEON"] .customer{grid-template-columns:210px 1fr;background:#050719}:root[data-theme="CYBER_NEON"] .sidebar{margin:10px;border:1px solid #7049ed;border-radius:16px;background:#090d24}:root[data-theme="CYBER_NEON"] .sidebar nav a.active{background:linear-gradient(90deg,#a12fff,#0878df);box-shadow:0 0 18px #a12fff77}:root[data-theme="CYBER_NEON"] .topbar{margin:10px;border:1px solid #1b83c8;border-radius:14px;background:#090d24}:root[data-theme="CYBER_NEON"] .welcome{background:linear-gradient(110deg,#15104b,#541b89)!important;border-color:#df4dff!important}:root[data-theme="CYBER_NEON"] .metric-grid{grid-template-columns:1.5fr 1fr 1fr 1.2fr}:root[data-theme="CYBER_NEON"] .metric-card{background:#0a102b;border:1px solid #195da5;box-shadow:inset 0 0 22px #007dff18,0 0 18px #7c35ff22}:root[data-theme="CYBER_NEON"] .metric-card:nth-child(even){border-color:#a03bed}
@media(max-width:800px){:root[data-theme="JAPANESE_ZEN"] .hero-grid,:root[data-theme="DARK_LUXURY"] .hero-grid,:root[data-theme="PREMIUM_CORPORATE"] .hero-grid,:root[data-theme="CYBER_NEON"] .hero-grid{grid-template-columns:1fr;gap:24px}:root[data-theme="JAPANESE_ZEN"] .cards,:root[data-theme="DARK_LUXURY"] .cards,:root[data-theme="PREMIUM_CORPORATE"] .cards,:root[data-theme="CYBER_NEON"] .cards{grid-template-columns:1fr}:root[data-theme="JAPANESE_ZEN"] .auth,:root[data-theme="DARK_LUXURY"] .auth,:root[data-theme="PREMIUM_CORPORATE"] .auth,:root[data-theme="CYBER_NEON"] .auth{display:block}:root[data-theme="JAPANESE_ZEN"] .auth-copy,:root[data-theme="DARK_LUXURY"] .auth-copy,:root[data-theme="PREMIUM_CORPORATE"] .auth-copy,:root[data-theme="CYBER_NEON"] .auth-copy{display:none}:root[data-theme="JAPANESE_ZEN"] .metric-grid,:root[data-theme="DARK_LUXURY"] .metric-grid,:root[data-theme="PREMIUM_CORPORATE"] .metric-grid,:root[data-theme="CYBER_NEON"] .metric-grid{grid-template-columns:1fr 1fr}}
/* Three reference architectures: isolated selectors provide nine complete scope-specific interfaces. */
:root[data-theme="GLASSMORPHISM"]{--theme-bg:#eaf6ff;--theme-surface:#fff;--theme-text:#122352;--theme-muted:#596b91;--theme-primary:#398dff;--theme-secondary:#a85cf4;--theme-border:#ffffffc7;--theme-radius:25px;--theme-shadow:0 24px 65px #506ec52d}:root[data-theme="GLASSMORPHISM"] body{background:#eaf6ff;background-image:radial-gradient(circle at 12% 32%,#68d3ff99,transparent 27%),radial-gradient(circle at 73% 65%,#d886ff75,transparent 32%),linear-gradient(135deg,#f3fcff,#dce8ff 50%,#f9e9ff);background-attachment:fixed}:root[data-theme="GLASSMORPHISM"] .header{width:min(1420px,calc(100% - 44px));margin:22px auto 0;border:1px solid #fff;border-radius:22px;background:#ffffff69;backdrop-filter:blur(25px);box-shadow:0 15px 45px #456ab422}:root[data-theme="GLASSMORPHISM"] .hero-grid{grid-template-columns:1.02fr .98fr;min-height:590px;gap:18px;padding:28px;border:1px solid #fff;border-radius:38px;background:#ffffff42;backdrop-filter:blur(18px)}:root[data-theme="GLASSMORPHISM"] .hero h1{font-size:clamp(3.5rem,6vw,6.6rem);line-height:.96;max-width:10ch}:root[data-theme="GLASSMORPHISM"] .preview{overflow:visible;border:0;background:radial-gradient(circle,#fff 0 11%,#75caff70 12% 29%,transparent 30%)}:root[data-theme="GLASSMORPHISM"] .preview:before{content:"♛";display:grid;place-items:center;position:absolute;inset:8% 14% 23%;border-radius:44% 44% 28%;font-size:180px;color:#fff;background:linear-gradient(145deg,#7edaff99,#b47bff88);border:2px solid #fff;box-shadow:inset 0 0 55px #fff,0 30px 60px #5878d244;transform:rotate(-4deg)}:root[data-theme="GLASSMORPHISM"] .preview .dashboard{position:absolute;right:-3%;bottom:1%;width:67%;background:#ffffff98!important;border:1px solid #fff!important;backdrop-filter:blur(20px);transform:rotate(2deg)}:root[data-theme="GLASSMORPHISM"] .stats,:root[data-theme="GLASSMORPHISM"] .card{background:#ffffff75!important;border:1px solid #fff!important;backdrop-filter:blur(24px)}:root[data-theme="GLASSMORPHISM"] .cards{grid-template-columns:1.2fr repeat(3,1fr)}:root[data-theme="GLASSMORPHISM"] .cards .card:nth-child(even){margin-top:32px}
:root[data-theme="GLASSMORPHISM"] .auth{max-width:1350px;min-height:calc(100vh - 42px);margin:21px auto;grid-template-columns:55% 45%;gap:18px;padding:20px;border:1px solid #fff;border-radius:35px;background:#ffffff3d;backdrop-filter:blur(22px)}:root[data-theme="GLASSMORPHISM"] .auth-copy{border-radius:28px;padding:10%;background:linear-gradient(140deg,#7ddcff80,#cb91ff80);border:1px solid #fff}:root[data-theme="GLASSMORPHISM"] .auth-card{align-self:center;background:#ffffff8c!important;border:1px solid #fff!important;backdrop-filter:blur(28px)}:root[data-theme="GLASSMORPHISM"] .customer{grid-template-columns:220px 1fr;background:transparent;padding:14px;gap:14px}:root[data-theme="GLASSMORPHISM"] .sidebar,:root[data-theme="GLASSMORPHISM"] .topbar{margin:0;border:1px solid #fff;border-radius:25px;background:#ffffff69;backdrop-filter:blur(25px)}:root[data-theme="GLASSMORPHISM"] .welcome{background:linear-gradient(115deg,#5e9dffd1,#b16ce8c9)!important;color:white}:root[data-theme="GLASSMORPHISM"] .metric-grid{grid-template-columns:1.45fr repeat(3,1fr)}:root[data-theme="GLASSMORPHISM"] .metric-card{background:#ffffff7d;border:1px solid #fff;border-radius:22px;backdrop-filter:blur(22px)}:root[data-theme="GLASSMORPHISM"] .metric-card:nth-child(3){transform:translateY(18px)}
:root[data-theme="EMERALD_BUSINESS"]{--theme-bg:#061f1a;--theme-surface:#0c2d26;--theme-text:#effcf7;--theme-muted:#9bc1b4;--theme-primary:#18b67f;--theme-secondary:#72d5b0;--theme-border:#3b8f7450;--theme-radius:6px;--theme-shadow:0 15px 40px #001c1666;color-scheme:dark}:root[data-theme="EMERALD_BUSINESS"] body{background:#061f1a;background-image:linear-gradient(90deg,#45b58a0b 1px,transparent 1px),linear-gradient(#45b58a0b 1px,transparent 1px),radial-gradient(circle at 84% 12%,#1d9c7040,transparent 26%);background-size:64px 64px,64px 64px,auto}:root[data-theme="EMERALD_BUSINESS"] .header{border-bottom:1px solid #397b67;background:#071f1bef}:root[data-theme="EMERALD_BUSINESS"] .hero-grid{grid-template-columns:.82fr 1.18fr;gap:55px;min-height:520px}:root[data-theme="EMERALD_BUSINESS"] .hero-grid>div:first-child{border-left:4px solid #25ba83;padding:32px 0 32px 35px}:root[data-theme="EMERALD_BUSINESS"] .hero h1{font-size:clamp(3.2rem,5.4vw,6rem);line-height:.95;max-width:9ch}:root[data-theme="EMERALD_BUSINESS"] .preview{border:1px solid #3c8c72;border-radius:3px;background:linear-gradient(150deg,#102f28,#0b4436);box-shadow:18px 18px 0 #123c31}:root[data-theme="EMERALD_BUSINESS"] .preview:before{content:"GROWTH / 24";position:absolute;right:24px;top:22px;color:#76dfb7;font:700 13px monospace;letter-spacing:.18em}:root[data-theme="EMERALD_BUSINESS"] .cards{grid-template-columns:repeat(2,1fr);gap:1px;background:#2d6a56}:root[data-theme="EMERALD_BUSINESS"] .cards .card{border-radius:0!important;background:#0b2a23!important;box-shadow:none!important;display:grid;grid-template-columns:auto 1fr;column-gap:20px}
:root[data-theme="EMERALD_BUSINESS"] .auth{max-width:none;min-height:100vh;grid-template-columns:42% 58%;gap:0;padding:0}:root[data-theme="EMERALD_BUSINESS"] .auth-copy{padding:9%;background:#071d19;border-right:1px solid #34735f}:root[data-theme="EMERALD_BUSINESS"] .auth-copy:after{content:"SECURE ENTERPRISE ACCESS";display:block;margin-top:70px;border-top:1px solid #397864;padding-top:24px;color:#69cfa9;letter-spacing:.2em;font-size:11px}:root[data-theme="EMERALD_BUSINESS"] .auth-card{margin:auto;width:min(590px,82%);border-radius:3px!important;border-left:5px solid #1db27e!important;background:#0c3027!important;box-shadow:20px 20px 0 #051713!important}:root[data-theme="EMERALD_BUSINESS"] .customer{grid-template-columns:255px 1fr;background:#061e19}:root[data-theme="EMERALD_BUSINESS"] .sidebar{background:#08241e;border-right:1px solid #39745f}:root[data-theme="EMERALD_BUSINESS"] .sidebar nav a.active{background:#144a3c;color:#77dfb8;border-left:4px solid #22bd83}:root[data-theme="EMERALD_BUSINESS"] .topbar{background:#08251f;border-bottom:1px solid #2d6e59}:root[data-theme="EMERALD_BUSINESS"] .welcome{background:linear-gradient(100deg,#0d3c30,#14694f)!important;border-radius:3px!important;border-left:5px solid #65d6ad!important}:root[data-theme="EMERALD_BUSINESS"] .metric-grid{grid-template-columns:1.5fr 1fr 1fr 1fr;gap:1px;background:#2c6654}:root[data-theme="EMERALD_BUSINESS"] .metric-card{border:0;border-radius:0;background:#0a2b23;box-shadow:none}
:root[data-theme="SOCIAL_CREATOR"]{--theme-bg:#fff4fb;--theme-surface:#fff;--theme-text:#211027;--theme-muted:#765a74;--theme-primary:#f51f8a;--theme-secondary:#ff8a22;--theme-border:#ef78b048;--theme-radius:20px;--theme-shadow:0 18px 40px #dc30842b;color-scheme:light}:root[data-theme="SOCIAL_CREATOR"] body{background:#fff7fc;background-image:radial-gradient(circle at 12% 20%,#ff9e2b55,transparent 20%),radial-gradient(circle at 88% 12%,#dd4cff55,transparent 25%),linear-gradient(125deg,transparent 45%,#ff3e9140 46% 48%,transparent 49%)}:root[data-theme="SOCIAL_CREATOR"] .header{margin:14px auto;width:min(1420px,calc(100% - 28px));border:2px solid #ff6b9b;border-radius:24px;background:#fff}:root[data-theme="SOCIAL_CREATOR"] h1,:root[data-theme="SOCIAL_CREATOR"] h2{font-family:"Arial Black","Segoe UI",sans-serif}:root[data-theme="SOCIAL_CREATOR"] .hero-grid{grid-template-columns:1.05fr .95fr;min-height:560px;gap:10px}:root[data-theme="SOCIAL_CREATOR"] .hero h1{font-size:clamp(3.4rem,6vw,6.5rem);line-height:.88;max-width:9ch;transform:rotate(-1deg)}:root[data-theme="SOCIAL_CREATOR"] .preview{border:0;border-radius:42% 18% 35% 20%;background:linear-gradient(145deg,#ff982f,#ff3b91 48%,#9e43ff);transform:rotate(2deg)}:root[data-theme="SOCIAL_CREATOR"] .preview:before{content:"CREATE ♥ SHARE ✦ GROW";position:absolute;inset:12% 8% auto;color:white;font:900 42px/1 "Arial Black";transform:rotate(-8deg)}:root[data-theme="SOCIAL_CREATOR"] .stats{border:2px solid #ff7aa9;background:#fff;border-radius:40px}:root[data-theme="SOCIAL_CREATOR"] .cards{grid-template-columns:1.3fr .8fr 1fr 1.1fr}:root[data-theme="SOCIAL_CREATOR"] .cards .card{border:2px solid #ff75aa!important;transform:rotate(-1deg)}:root[data-theme="SOCIAL_CREATOR"] .cards .card:nth-child(even){transform:translateY(25px) rotate(2deg)}
:root[data-theme="SOCIAL_CREATOR"] .auth{max-width:1320px;min-height:calc(100vh - 30px);margin:15px auto;grid-template-columns:1.15fr .85fr;gap:0;padding:0;border-radius:32px;overflow:hidden;background:white}:root[data-theme="SOCIAL_CREATOR"] .auth-copy{padding:8%;background:linear-gradient(145deg,#ff9d29,#fa258c 55%,#9649f8);color:white;clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}:root[data-theme="SOCIAL_CREATOR"] .auth-copy:after{content:"#CREATORS GROW TOGETHER";display:block;margin-top:60px;font:900 28px "Arial Black";transform:rotate(-4deg)}:root[data-theme="SOCIAL_CREATOR"] .auth-card{margin:auto;width:min(480px,86%);border:2px solid #ff68a1!important;box-shadow:12px 12px 0 #ffb32d!important}:root[data-theme="SOCIAL_CREATOR"] .customer{grid-template-columns:190px 1fr;background:#fff5fb}:root[data-theme="SOCIAL_CREATOR"] .sidebar{margin:10px;border-radius:28px;background:linear-gradient(180deg,#ff2d8d,#ad42ef);color:white}:root[data-theme="SOCIAL_CREATOR"] .sidebar nav a.active{background:#fff;color:#e42582;transform:translateX(8px)}:root[data-theme="SOCIAL_CREATOR"] .topbar{background:#fff;border-bottom:2px solid #ff74a8}:root[data-theme="SOCIAL_CREATOR"] .welcome{background:linear-gradient(105deg,#ff288a,#ff922b 55%,#8c48ef)!important;color:white;transform:rotate(-.4deg)}:root[data-theme="SOCIAL_CREATOR"] .metric-grid{grid-template-columns:1.25fr .8fr 1fr}:root[data-theme="SOCIAL_CREATOR"] .metric-card{border:2px solid #f578ae;background:white;box-shadow:7px 7px 0 #ffd2e4}:root[data-theme="SOCIAL_CREATOR"] .metric-card:nth-child(2){border-radius:50px}:root[data-theme="SOCIAL_CREATOR"] .quick-grid a{background:linear-gradient(120deg,#ffecf5,#ffe7cf);color:#5a1642;border:1px solid #ff74aa}
@media(max-width:800px){:root[data-theme="GLASSMORPHISM"] .hero-grid,:root[data-theme="EMERALD_BUSINESS"] .hero-grid,:root[data-theme="SOCIAL_CREATOR"] .hero-grid{grid-template-columns:1fr;min-height:0}:root[data-theme="GLASSMORPHISM"] .cards,:root[data-theme="EMERALD_BUSINESS"] .cards,:root[data-theme="SOCIAL_CREATOR"] .cards{grid-template-columns:1fr}:root[data-theme="GLASSMORPHISM"] .cards .card:nth-child(even),:root[data-theme="SOCIAL_CREATOR"] .cards .card:nth-child(even){margin-top:0;transform:none}:root[data-theme="GLASSMORPHISM"] .auth,:root[data-theme="EMERALD_BUSINESS"] .auth,:root[data-theme="SOCIAL_CREATOR"] .auth{display:block;margin:8px;min-height:calc(100vh - 16px)}:root[data-theme="GLASSMORPHISM"] .auth-copy,:root[data-theme="EMERALD_BUSINESS"] .auth-copy,:root[data-theme="SOCIAL_CREATOR"] .auth-copy{display:none}:root[data-theme="GLASSMORPHISM"] .customer,:root[data-theme="EMERALD_BUSINESS"] .customer,:root[data-theme="SOCIAL_CREATOR"] .customer{grid-template-columns:1fr;padding:0}:root[data-theme="GLASSMORPHISM"] .metric-grid,:root[data-theme="EMERALD_BUSINESS"] .metric-grid,:root[data-theme="SOCIAL_CREATOR"] .metric-grid{grid-template-columns:1fr 1fr}:root[data-theme="GLASSMORPHISM"] .metric-card:nth-child(3){transform:none}}@media(max-width:430px){:root[data-theme="GLASSMORPHISM"] .hero h1,:root[data-theme="EMERALD_BUSINESS"] .hero h1,:root[data-theme="SOCIAL_CREATOR"] .hero h1{font-size:clamp(2.5rem,13vw,3.5rem)}:root[data-theme="GLASSMORPHISM"] .metric-grid,:root[data-theme="EMERALD_BUSINESS"] .metric-grid,:root[data-theme="SOCIAL_CREATOR"] .metric-grid{grid-template-columns:1fr}}
/* Final reference pair: hard editorial print versus luminous cognitive console. */
:root[data-theme="EDITORIAL_BRUTALIST"]{--theme-bg:#ecece8;--theme-surface:#fff;--theme-text:#090909;--theme-muted:#3d3d3d;--theme-primary:#c7ff00;--theme-secondary:#111;--theme-border:#111;--theme-radius:0;--theme-shadow:8px 8px 0 #111;color-scheme:light}:root[data-theme="EDITORIAL_BRUTALIST"] body{background:#eee;background-image:repeating-linear-gradient(12deg,#00000008 0 1px,transparent 1px 7px)}:root[data-theme="EDITORIAL_BRUTALIST"] .header{margin:14px;border:3px solid #111;background:#080808;color:#fff}:root[data-theme="EDITORIAL_BRUTALIST"] .mark,:root[data-theme="EDITORIAL_BRUTALIST"] .button,:root[data-theme="EDITORIAL_BRUTALIST"] .sidebar nav a.active{background:#c7ff00!important;color:#080808!important;border-radius:0}:root[data-theme="EDITORIAL_BRUTALIST"] h1,:root[data-theme="EDITORIAL_BRUTALIST"] h2,:root[data-theme="EDITORIAL_BRUTALIST"] h3{font-family:Impact,"Arial Black","Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:-.035em}:root[data-theme="EDITORIAL_BRUTALIST"] .hero{padding:18px}:root[data-theme="EDITORIAL_BRUTALIST"] .hero-grid{grid-template-columns:1.12fr .88fr;gap:0;min-height:600px;border:3px solid #111;background:#fff}:root[data-theme="EDITORIAL_BRUTALIST"] .hero-grid>div:first-child{padding:42px;border-right:3px solid #111}:root[data-theme="EDITORIAL_BRUTALIST"] .hero h1{font-size:clamp(4rem,8vw,9rem);line-height:.78;max-width:8ch}:root[data-theme="EDITORIAL_BRUTALIST"] .hero h1 .gradient{background:#c7ff00;color:#000;padding:0 .08em}:root[data-theme="EDITORIAL_BRUTALIST"] .preview{border:0;border-radius:0;background:linear-gradient(135deg,#aaa 0 49%,#111 50%)}:root[data-theme="EDITORIAL_BRUTALIST"] .preview:before{content:"IDEAS GROW BRANDS";position:absolute;inset:8%;color:#c7ff00;font:900 62px/.8 Impact;writing-mode:vertical-rl}:root[data-theme="EDITORIAL_BRUTALIST"] .stats{border:3px solid #111;border-radius:0;background:#c7ff00;color:#000}:root[data-theme="EDITORIAL_BRUTALIST"] .cards{grid-template-columns:1.3fr repeat(3,1fr);gap:0;border:3px solid #111}:root[data-theme="EDITORIAL_BRUTALIST"] .card{border:0!important;border-right:3px solid #111!important;border-radius:0!important;box-shadow:none!important}
:root[data-theme="EDITORIAL_BRUTALIST"] .auth{max-width:none;min-height:100vh;grid-template-columns:58% 42%;gap:0;padding:18px;background:#0a0a0a}:root[data-theme="EDITORIAL_BRUTALIST"] .auth-copy{padding:7%;background:#c7ff00;color:#000;border:3px solid #fff}:root[data-theme="EDITORIAL_BRUTALIST"] .auth-copy h1{font-size:clamp(4rem,8vw,8rem);line-height:.78}:root[data-theme="EDITORIAL_BRUTALIST"] .auth-card{margin:0;border:3px solid #fff!important;border-left:0!important;border-radius:0!important;background:#fff!important;color:#000;box-shadow:none!important}:root[data-theme="EDITORIAL_BRUTALIST"] input{border:2px solid #111;border-radius:0;background:#fff;color:#000}:root[data-theme="EDITORIAL_BRUTALIST"] .customer{grid-template-columns:230px 1fr;background:#e9e9e5}:root[data-theme="EDITORIAL_BRUTALIST"] .sidebar{background:#0b0b0b;color:#fff;border-right:4px solid #c7ff00}:root[data-theme="EDITORIAL_BRUTALIST"] .sidebar nav a{border-radius:0;border-bottom:1px solid #555}:root[data-theme="EDITORIAL_BRUTALIST"] .topbar{background:#fff;border-bottom:3px solid #111}:root[data-theme="EDITORIAL_BRUTALIST"] .welcome{background:#c7ff00!important;color:#000;border:3px solid #111!important;border-radius:0!important}:root[data-theme="EDITORIAL_BRUTALIST"] .metric-grid{grid-template-columns:2fr repeat(3,1fr);gap:0;border:3px solid #111}:root[data-theme="EDITORIAL_BRUTALIST"] .metric-card{border:0;border-right:3px solid #111;border-radius:0;background:#fff;box-shadow:none}:root[data-theme="EDITORIAL_BRUTALIST"] .panel{border:3px solid #111!important;border-radius:0!important;box-shadow:none!important}
:root[data-theme="AI_FUTURISTIC"]{--theme-bg:#040817;--theme-surface:#09142d;--theme-text:#eef5ff;--theme-muted:#91a7d0;--theme-primary:#58d9ff;--theme-secondary:#9a64ff;--theme-border:#4d8cff66;--theme-radius:14px;--theme-shadow:0 0 35px #557cff35;color-scheme:dark}:root[data-theme="AI_FUTURISTIC"] body{background:#040817;background-image:radial-gradient(circle at 70% 15%,#795cff55,transparent 28%),radial-gradient(circle at 18% 55%,#21c8ff30,transparent 30%),linear-gradient(#5d85ff12 1px,transparent 1px),linear-gradient(90deg,#5d85ff12 1px,transparent 1px);background-size:auto,auto,48px 48px,48px 48px}:root[data-theme="AI_FUTURISTIC"] .header{margin:12px;border:1px solid #5a86ff;border-radius:14px;background:#061126dd;box-shadow:0 0 25px #4786ff40}:root[data-theme="AI_FUTURISTIC"] .hero-grid{grid-template-columns:.72fr 1.28fr;min-height:610px}:root[data-theme="AI_FUTURISTIC"] .hero h1{font-family:"Arial Narrow","Segoe UI",sans-serif;font-size:clamp(3.6rem,6vw,6.8rem);line-height:.9;max-width:9ch}:root[data-theme="AI_FUTURISTIC"] .preview{border:0;background:radial-gradient(circle at 50% 45%,#63e3ff 0 3%,#7b61ff88 4% 13%,transparent 32%)}:root[data-theme="AI_FUTURISTIC"] .preview:before{content:"AI";display:grid;place-items:center;position:absolute;inset:16%;border:2px solid #64dbff;border-radius:50%;font:900 150px "Arial Narrow";color:#eafaff;box-shadow:inset 0 0 60px #5c78ff,0 0 55px #5be0ff;animation:aiPulse 4s ease-in-out infinite}:root[data-theme="AI_FUTURISTIC"] .preview .dashboard{position:absolute;bottom:4%;left:4%;width:68%;background:#07152dde!important;border:1px solid #59dfff!important}:root[data-theme="AI_FUTURISTIC"] .cards{grid-template-columns:1.35fr repeat(3,1fr)}:root[data-theme="AI_FUTURISTIC"] .card{background:linear-gradient(145deg,#0e1d41,#08132d)!important;border:1px solid #426fd5!important;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
:root[data-theme="AI_FUTURISTIC"] .auth{max-width:none;min-height:100vh;grid-template-columns:46% 54%;gap:0;padding:0;background:radial-gradient(circle at 25% 45%,#5fdfff44,transparent 25%),#040817}:root[data-theme="AI_FUTURISTIC"] .auth-copy{padding:9%;border-right:1px solid #557ddd;background:linear-gradient(140deg,#071127aa,#17104aaa)}:root[data-theme="AI_FUTURISTIC"] .auth-copy:after{content:"NEURAL ACCESS // VERIFIED";display:block;margin-top:55px;color:#62e5ff;font:700 12px monospace;letter-spacing:.18em}:root[data-theme="AI_FUTURISTIC"] .auth-card{margin:auto;width:min(530px,84%);background:#081630e8!important;border:1px solid #5de1ff!important;box-shadow:0 0 65px #675bff55!important}:root[data-theme="AI_FUTURISTIC"] .customer{grid-template-columns:205px 1fr;background:#040817}:root[data-theme="AI_FUTURISTIC"] .sidebar{margin:9px;border:1px solid #4f79df;border-radius:14px;background:#07132d}:root[data-theme="AI_FUTURISTIC"] .sidebar nav a.active{background:linear-gradient(90deg,#366cf0,#8a55ed);box-shadow:0 0 18px #5e79ff}:root[data-theme="AI_FUTURISTIC"] .topbar{margin:9px;border:1px solid #316bb6;border-radius:12px;background:#07132d}:root[data-theme="AI_FUTURISTIC"] .welcome{background:linear-gradient(105deg,#09244a,#32216d)!important;border-color:#61ddff!important}:root[data-theme="AI_FUTURISTIC"] .welcome:after{content:"AI ASSISTANT · ONLINE";color:#65edcc;font:700 12px monospace}:root[data-theme="AI_FUTURISTIC"] .metric-grid{grid-template-columns:1.55fr .85fr .85fr}:root[data-theme="AI_FUTURISTIC"] .metric-card{background:#081630;border:1px solid #386bc1;box-shadow:inset 0 0 20px #2f7fff18}:root[data-theme="AI_FUTURISTIC"] .metric-card:first-child{grid-row:span 2}:root[data-theme="AI_FUTURISTIC"] .quick-grid a{background:#0c2143;color:#dceeff;border:1px solid #3b7bc9}@keyframes aiPulse{50%{transform:scale(1.04);filter:hue-rotate(25deg)}}
@media(max-width:800px){:root[data-theme="EDITORIAL_BRUTALIST"] .hero-grid,:root[data-theme="AI_FUTURISTIC"] .hero-grid{grid-template-columns:1fr}:root[data-theme="EDITORIAL_BRUTALIST"] .cards,:root[data-theme="AI_FUTURISTIC"] .cards{grid-template-columns:1fr}:root[data-theme="EDITORIAL_BRUTALIST"] .auth,:root[data-theme="AI_FUTURISTIC"] .auth{display:block;padding:8px}:root[data-theme="EDITORIAL_BRUTALIST"] .auth-copy,:root[data-theme="AI_FUTURISTIC"] .auth-copy{display:none}:root[data-theme="EDITORIAL_BRUTALIST"] .customer,:root[data-theme="AI_FUTURISTIC"] .customer{grid-template-columns:1fr}:root[data-theme="EDITORIAL_BRUTALIST"] .metric-grid,:root[data-theme="AI_FUTURISTIC"] .metric-grid{grid-template-columns:1fr 1fr}}@media(max-width:430px){:root[data-theme="EDITORIAL_BRUTALIST"] .hero h1,:root[data-theme="AI_FUTURISTIC"] .hero h1{font-size:clamp(2.7rem,14vw,4rem)}:root[data-theme="EDITORIAL_BRUTALIST"] .metric-grid,:root[data-theme="AI_FUTURISTIC"] .metric-grid{grid-template-columns:1fr}:root[data-theme="AI_FUTURISTIC"] .preview:before{font-size:90px}}
/* Soft Beige Premium is an authored editorial system, not a palette swap. */
:root[data-theme="SOFT_BEIGE_PREMIUM"]{--theme-bg:#f3eadc;--theme-surface:#fffaf2;--theme-border:#b493693d;--theme-text:#211b16;--theme-muted:#6f6257;--theme-primary:#8b6238;--theme-secondary:#2b251f;--theme-radius:9px;--theme-shadow:0 18px 55px #6d4d2920}
:root[data-theme="SOFT_BEIGE_PREMIUM"] body{background-color:#eee1cf;background-image:radial-gradient(ellipse at 82% 9%,#fff9ef 0 13%,transparent 13.4%),linear-gradient(112deg,transparent 0 68%,#b9916530 68% 75%,transparent 75%),repeating-linear-gradient(90deg,#9c724506 0 1px,transparent 1px 110px);font-family:Arial,sans-serif}
:root[data-theme="SOFT_BEIGE_PREMIUM"] h1,:root[data-theme="SOFT_BEIGE_PREMIUM"] h2,:root[data-theme="SOFT_BEIGE_PREMIUM"] h3,:root[data-theme="SOFT_BEIGE_PREMIUM"] .brand strong,:root[data-theme="SOFT_BEIGE_PREMIUM"] .metric-card b{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.035em}
:root[data-theme="SOFT_BEIGE_PREMIUM"] .header{margin:14px auto 0;width:min(1400px,calc(100% - 28px));border:1px solid #9c774a;border-radius:10px;background:#fffaf2ed;box-shadow:none}:root[data-theme="SOFT_BEIGE_PREMIUM"] .header .container{max-width:none}:root[data-theme="SOFT_BEIGE_PREMIUM"] .brand .mark{background:none;color:#9b713d;font-family:Georgia;font-size:0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .brand .mark:after{content:"♛";font-size:30px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .brand strong{font-size:25px;color:#17120f}:root[data-theme="SOFT_BEIGE_PREMIUM"] .nav a{font-size:12px;color:#30271f}:root[data-theme="SOFT_BEIGE_PREMIUM"] .nav .button{background:#28221c;color:#fff}
:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero{padding:64px 0 30px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero-grid{min-height:570px;grid-template-columns:minmax(420px,.92fr) 1.08fr;gap:0;align-items:stretch;border-bottom:1px solid #a17a4c}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero-grid>div:first-child{padding:44px 42px;background:#fffaf2c7;border:1px solid #b6956d;border-right:0;border-radius:10px 0 0 10px;z-index:1}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero h1{font-size:clamp(3.2rem,5.5vw,5.8rem);line-height:.96;max-width:9ch;margin:22px 0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero h1 .gradient{color:#9b6d38}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero .lead{max-width:58ch;font-size:16px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .preview{position:relative;overflow:hidden;border:1px solid #b6956d;border-radius:0 10px 10px 0;background:radial-gradient(ellipse at 50% 115%,#4a3524 0 20%,transparent 20.5%),radial-gradient(ellipse at 47% 52%,#ead1b5 0 11%,transparent 11.5%),linear-gradient(135deg,#d8b98e,#f8eee0 45%,#b68c60)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .preview:before{content:"";position:absolute;inset:8% 12% 0;background:radial-gradient(ellipse at 50% 50%,#fbf5eb 0 32%,transparent 33%),conic-gradient(from 20deg at 50% 100%,#795839,#ead8c0,#b68b61,#f4eadc,#795839);clip-path:polygon(0 100%,8% 26%,25% 5%,73% 5%,94% 30%,100% 100%)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .preview .dashboard{position:absolute;right:24px;bottom:24px;width:54%;transform:rotate(-2deg);background:#fffaf2ed!important;border:1px solid #9f7a4f!important;box-shadow:0 20px 45px #39281940!important}:root[data-theme="SOFT_BEIGE_PREMIUM"] .stats{margin-top:0;padding:25px 30px;background:#28221d;color:#f4e7d5;max-width:1400px;border-radius:0 0 10px 10px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .stat+ .stat{border-left:1px solid #a98a63}
:root[data-theme="SOFT_BEIGE_PREMIUM"] .block{padding:76px 0}:root[data-theme="SOFT_BEIGE_PREMIUM"] #services{background:#fbf5eb;border-block:1px solid #c6aa8955}:root[data-theme="SOFT_BEIGE_PREMIUM"] #services .center{text-align:left;display:flex;align-items:end;justify-content:space-between}:root[data-theme="SOFT_BEIGE_PREMIUM"] .section-title{font-size:clamp(2.4rem,4vw,4.4rem)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .cards{grid-template-columns:repeat(4,1fr);gap:9px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .cards .card{box-shadow:none!important;border:1px solid #cbb495!important;border-radius:7px!important;text-align:center;min-height:270px;background:linear-gradient(#fffaf4,#f4e8d8)!important}:root[data-theme="SOFT_BEIGE_PREMIUM"] .platform-icon{margin:auto;background:#32271f;color:#ead1aa}:root[data-theme="SOFT_BEIGE_PREMIUM"] .button{background:#2d261f;border-radius:7px;font-size:11px;letter-spacing:.08em}:root[data-theme="SOFT_BEIGE_PREMIUM"] .button.secondary{background:transparent;color:#30261e;border:1px solid #a78964}
:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth{max-width:1320px;min-height:calc(100vh - 40px);margin:20px auto;grid-template-columns:44% 56%;gap:0;padding:0;border:1px solid #a17a4c;border-radius:12px;overflow:hidden;background:#fffaf3}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-copy{padding:58px 50px;background:linear-gradient(#fffaf3dd,#fffaf3dd),radial-gradient(circle at 80% 30%,#af845f 0 20%,transparent 21%)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-copy h1{font-size:4.4rem;line-height:.95}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card{margin:0;max-width:none;padding:80px 16%;border:0!important;border-radius:0!important;background:radial-gradient(circle at 25% 33%,#fff6e8 0 16%,transparent 16.5%),linear-gradient(125deg,#c6a27b,#ead8c0 48%,#907052)!important;box-shadow:none!important}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card form,:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card>h2,:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card>p,:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-links{background:#fffaf3ed;padding-inline:26px;margin:0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card>h2{padding-top:28px;font-size:2.2rem}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card>p{padding-bottom:18px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card form{padding-bottom:22px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-links{padding-bottom:28px}
:root[data-theme="SOFT_BEIGE_PREMIUM"] .customer{grid-template-columns:230px 1fr;background:#f4ecdf}:root[data-theme="SOFT_BEIGE_PREMIUM"] .sidebar{margin:12px 0 12px 12px;border:1px solid #c3aa88;border-radius:10px;background:#fffaf3;box-shadow:none}:root[data-theme="SOFT_BEIGE_PREMIUM"] .sidebar nav a{border-radius:6px;color:#594b3e}:root[data-theme="SOFT_BEIGE_PREMIUM"] .sidebar nav a.active{background:#eee0ca;color:#282119;border-left:3px solid #9b713d}:root[data-theme="SOFT_BEIGE_PREMIUM"] .topbar{margin:12px;border:1px solid #c3aa88;border-radius:10px;background:#fffaf3}:root[data-theme="SOFT_BEIGE_PREMIUM"] .customer-content{padding:18px 28px 40px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .page-head{border-bottom:1px solid #c6ad8d;padding-bottom:14px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .welcome{background:linear-gradient(105deg,#2d251e,#594534)!important;color:#fff6e8;border:0!important}:root[data-theme="SOFT_BEIGE_PREMIUM"] .metric-grid{grid-template-columns:repeat(4,1fr)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .metric-card{background:#fffaf3;border:1px solid #cdb99e;border-radius:8px;box-shadow:none}:root[data-theme="SOFT_BEIGE_PREMIUM"] .metric-card:before{content:"♢";display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#eee0c8;color:#8c6337}:root[data-theme="SOFT_BEIGE_PREMIUM"] .quick.panel{border-style:dashed!important}:root[data-theme="SOFT_BEIGE_PREMIUM"] .quick-grid a{background:#f1e5d3;color:#47392d;border:1px solid #ccb596}
@media(max-width:800px){:root[data-theme="SOFT_BEIGE_PREMIUM"] .header{margin:7px;width:calc(100% - 14px)}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero{padding-top:25px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero-grid{grid-template-columns:1fr;min-height:0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .hero-grid>div:first-child{padding:34px 22px;border-right:1px solid #b6956d;border-radius:10px 10px 0 0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .preview{min-height:380px;border-radius:0 0 10px 10px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .cards{grid-template-columns:1fr}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth{display:block;margin:8px}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-copy{display:none}:root[data-theme="SOFT_BEIGE_PREMIUM"] .auth-card{padding:70px 7%}:root[data-theme="SOFT_BEIGE_PREMIUM"] .customer{grid-template-columns:1fr}:root[data-theme="SOFT_BEIGE_PREMIUM"] .sidebar{margin:0}:root[data-theme="SOFT_BEIGE_PREMIUM"] .metric-grid{grid-template-columns:1fr 1fr}}
`;
