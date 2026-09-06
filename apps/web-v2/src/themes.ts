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
    "BOLD_ECOMMERCE",
    "Bold E-commerce",
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
    "ZEN_JAPAN",
    "Zen Japan",
    "Mực tàu, đỏ son và khoảng thở",
    "zen",
    "#b64035",
    "#f5f1e8",
    "serif",
  ],
  [
    "EDITORIAL_IVORY",
    "Editorial Ivory",
    "Tạp chí thanh lịch, màu ngà",
    "editorial",
    "#503f35",
    "#fbf7ef",
    "serif",
  ],
  [
    "FUTURE_AI",
    "Future AI",
    "Gradient AI đa sắc, không gian sâu",
    "ai",
    "#7c5cff",
    "#080b20",
    "display",
  ],
  [
    "SAAS_ULTRA",
    "SaaS Ultra",
    "SaaS sạch, indigo sắc nét",
    "saas",
    "#635bff",
    "#f8f9ff",
    "sans",
  ],
  [
    "TECH_ENTERPRISE",
    "Tech Enterprise",
    "Navy kỹ thuật, cyan chính xác",
    "tech",
    "#00a8c6",
    "#071a25",
    "sans",
  ],
  [
    "CREATOR_POP",
    "Creator Pop",
    "Trẻ trung, màu pop năng lượng",
    "creator",
    "#ff3d8d",
    "#fff5fb",
    "display",
  ],
  [
    "BLACK_GOLD",
    "Black Gold",
    "Đen obsidian, vàng kim premium",
    "gold",
    "#d6a84b",
    "#050505",
    "serif",
  ],
  [
    "TRUST_FINTECH",
    "Trust Fintech",
    "Xanh tài chính, rõ ràng và an tâm",
    "fintech",
    "#0874e8",
    "#f2f8ff",
    "sans",
  ],
  [
    "CLEAN_MARKET",
    "Clean Marketplace",
    "Marketplace sạch, teal linh hoạt",
    "market",
    "#059b8a",
    "#f5fbfa",
    "sans",
  ],
  [
    "CONVERSION_ORANGE",
    "Conversion Orange",
    "Cam nổi bật, CTA hiệu suất cao",
    "conversion",
    "#f06424",
    "#fff8f3",
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

const dark = new Set([
  "DARK_LUXURY",
  "CYBER_NEON",
  "CREATIVE_AGENCY",
  "FUTURE_AI",
  "TECH_ENTERPRISE",
  "BLACK_GOLD",
]);
const secondary: Record<string, string> = {
  DARK_LUXURY: "#8f7350",
  MINIMAL_LIGHT: "#74bdf2",
  CYBER_NEON: "#05c8ff",
  SOFT_PASTEL: "#ff9cae",
  NATURE_GREEN: "#77ad65",
  GLASSMORPHISM: "#8b5cf6",
  BOLD_ECOMMERCE: "#ff6f61",
  DASHBOARD_FOCUSED: "#48a0ff",
  CREATIVE_AGENCY: "#bb5b21",
  PREMIUM_CORPORATE: "#65a5e8",
  ZEN_JAPAN: "#27382f",
  EDITORIAL_IVORY: "#a57a56",
  FUTURE_AI: "#00c6ff",
  SAAS_ULTRA: "#2bb7da",
  TECH_ENTERPRISE: "#176f96",
  CREATOR_POP: "#7c4dff",
  BLACK_GOLD: "#7c5b23",
  TRUST_FINTECH: "#42a5ff",
  CLEAN_MARKET: "#31c5a8",
  CONVERSION_ORANGE: "#ffad32",
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
  `(()=>{const allowed=new Set(${JSON.stringify(themeIds)}),scope=${JSON.stringify(scope)},fallback='DARK_LUXURY';fetch(${JSON.stringify(api)}+'/api/v1/public/settings',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then(j=>{const s=j.data||{},key='theme'+scope[0].toUpperCase()+scope.slice(1),id=s.themeMode==='SEPARATE'?s[key]:s.themeGlobal;document.documentElement.dataset.theme=allowed.has(id)?id:fallback;const o=s.themeOptions||{};if(['compact','comfortable'].includes(o.density))document.documentElement.dataset.density=o.density;if(['small','medium','large'].includes(o.radius))document.documentElement.dataset.radius=o.radius;const c=s.themeContent||{},apply=()=>{document.querySelectorAll('[data-theme-content]').forEach(el=>{const v=c[el.dataset.themeContent];if(typeof v==='string'&&el.textContent!==v)el.textContent=v});document.querySelectorAll('[data-theme-list]').forEach((el,i)=>{const v=c.featureBullets?.[i];if(typeof v==='string'&&el.textContent!==v)el.textContent=v})};apply();new MutationObserver(apply).observe(document.body,{childList:true,subtree:true})}).catch(()=>{document.documentElement.dataset.theme=fallback})})();`;

export const themeStyles = `${declarations}
:root{--theme-bg:#090a0c;--theme-surface:#111827;--theme-border:#f5c97855;--theme-text:#f8fafc;--theme-muted:#a9b4c6;--theme-primary:#f5c978;--theme-secondary:#8f7350;--theme-radius:12px;--theme-shadow:0 18px 46px #0005;--theme-font:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
:root[data-radius="small"]{--theme-radius:6px}:root[data-radius="large"]{--theme-radius:24px}:root[data-density="compact"]{--theme-density:.82}
html[data-theme] body{background:var(--theme-bg);color:var(--theme-text);font-family:var(--theme-font)}html[data-theme] .panel,html[data-theme] .card,html[data-theme] .auth-card,html[data-theme] .dashboard{background:color-mix(in srgb,var(--theme-surface) 94%,transparent);border-color:var(--theme-border);border-radius:var(--theme-radius);box-shadow:var(--theme-shadow)}html[data-theme] .sidebar,html[data-theme] .topbar,html[data-theme] .header{background:color-mix(in srgb,var(--theme-surface) 90%,transparent);border-color:var(--theme-border)}html[data-theme] .button,html[data-theme] .sidebar nav a.active{background:linear-gradient(135deg,var(--theme-primary),var(--theme-secondary));color:#fff;border-color:transparent}html[data-theme] input,html[data-theme] select,html[data-theme] textarea{background:var(--theme-surface);border-color:var(--theme-border);color:var(--theme-text)}html[data-theme] .meta,html[data-theme] small,html[data-theme] .lead{color:var(--theme-muted)}html[data-theme] .gradient,html[data-theme] .price{background:linear-gradient(110deg,var(--theme-primary),var(--theme-secondary));-webkit-background-clip:text;color:transparent}html[data-theme] .eyebrow{color:var(--theme-primary);border-color:var(--theme-border)}html[data-theme] .eyebrow:before{background:var(--theme-primary)}
:root[data-theme="CYBER_NEON"] body,:root[data-theme="FUTURE_AI"] body{background-image:radial-gradient(circle at 18% 8%,var(--theme-primary)33,transparent 35%),radial-gradient(circle at 88% 25%,var(--theme-secondary)2c,transparent 32%)}:root[data-theme="GLASSMORPHISM"] body{background-image:linear-gradient(125deg,#7dd3fc,#c4b5fd 48%,#f9a8d4)}:root[data-theme="GLASSMORPHISM"] .card{backdrop-filter:blur(18px);background:#ffffff77}:root[data-theme="ZEN_JAPAN"] body,:root[data-theme="EDITORIAL_IVORY"] body{background-image:radial-gradient(circle at 90% 5%,var(--theme-primary)16,transparent 28%)}:root[data-theme="CREATOR_POP"] body{background-image:radial-gradient(circle at 5% 15%,#ff3d8d22,transparent 32%),radial-gradient(circle at 90% 20%,#7c4dff22,transparent 30%)}:root[data-theme="TECH_ENTERPRISE"] body{background-image:linear-gradient(#00a8c60b 1px,transparent 1px),linear-gradient(90deg,#00a8c60b 1px,transparent 1px);background-size:48px 48px}:root[data-theme="BOLD_ECOMMERCE"] .button,:root[data-theme="CONVERSION_ORANGE"] .button{text-transform:uppercase;letter-spacing:.035em}:root[data-theme="EDITORIAL_IVORY"] h1,:root[data-theme="ZEN_JAPAN"] h1{letter-spacing:-.025em}:root[data-theme="DASHBOARD_FOCUSED"] .card{box-shadow:0 5px 18px #2563eb16}`;
