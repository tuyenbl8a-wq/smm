export const themeIds = [
  "MIDNIGHT_CYAN",
  "AURORA_PURPLE",
  "CLEAN_LIGHT",
  "EMERALD_PRO",
  "ROYAL_BLUE",
] as const;

export const themePresets = [
  {
    id: "MIDNIGHT_CYAN",
    name: "Midnight Cyan",
    copy: "Kỹ thuật, kính mờ và lưới cyan",
    layout: "technical",
  },
  {
    id: "AURORA_PURPLE",
    name: "Aurora Purple",
    copy: "Aurora mềm, thẻ tròn và bố cục trung tâm",
    layout: "centered",
  },
  {
    id: "CLEAN_LIGHT",
    name: "Clean Light",
    copy: "Fintech sáng, tối giản và dễ đọc",
    layout: "split",
  },
  {
    id: "EMERALD_PRO",
    name: "Emerald Pro",
    copy: "Bảng dữ liệu gọn theo phong cách tài chính",
    layout: "compact",
  },
  {
    id: "ROYAL_BLUE",
    name: "Royal Blue",
    copy: "SaaS doanh nghiệp với vùng thương hiệu lớn",
    layout: "brand",
  },
] as const;

/** Applies allowlisted tokens; settings never become arbitrary CSS or markup. */
export const runtimeThemeScript = (
  api: string,
  scope: "public" | "auth" | "customer",
) =>
  `(()=>{const allowed=new Set(${JSON.stringify(themeIds)}),scope=${JSON.stringify(scope)},fallback='MIDNIGHT_CYAN';fetch(${JSON.stringify(api)}+'/api/v1/public/settings',{credentials:'include'}).then(r=>r.ok?r.json():Promise.reject()).then(j=>{const s=j.data||{},key='theme'+scope[0].toUpperCase()+scope.slice(1),id=s.themeMode==='SEPARATE'?s[key]:s.themeGlobal;document.documentElement.dataset.theme=allowed.has(id)?id:fallback;const o=s.themeOptions||{};if(['compact','comfortable'].includes(o.density))document.documentElement.dataset.density=o.density;if(['small','medium','large'].includes(o.radius))document.documentElement.dataset.radius=o.radius}).catch(()=>{document.documentElement.dataset.theme=fallback})})();`;

export const themeStyles = `
:root{--theme-bg:#050b18;--theme-surface:#0d1729;--theme-border:#20304a;--theme-text:#edf7ff;--theme-muted:#91a4bd;--theme-primary:#18c8ff;--theme-secondary:#2869ff;--theme-radius:14px;--theme-shadow:0 18px 45px #0006}
:root[data-theme="AURORA_PURPLE"]{--theme-bg:#100b2c;--theme-surface:#21164a;--theme-border:#6247a8;--theme-text:#faf7ff;--theme-muted:#c5b7e8;--theme-primary:#a86cff;--theme-secondary:#ec65c8;--theme-radius:24px;--theme-shadow:0 24px 65px #551aa866}
:root[data-theme="CLEAN_LIGHT"]{--theme-bg:#f5f7fb;--theme-surface:#fff;--theme-border:#dce3ee;--theme-text:#152033;--theme-muted:#65738a;--theme-primary:#1769e0;--theme-secondary:#4c86ed;--theme-radius:10px;--theme-shadow:0 8px 24px #25385814}
:root[data-theme="EMERALD_PRO"]{--theme-bg:#08110f;--theme-surface:#101c19;--theme-border:#28483f;--theme-text:#edfff9;--theme-muted:#91b5a9;--theme-primary:#20c997;--theme-secondary:#0e9f81;--theme-radius:6px;--theme-shadow:0 10px 28px #0007}
:root[data-theme="ROYAL_BLUE"]{--theme-bg:#07183b;--theme-surface:#10295a;--theme-border:#31558e;--theme-text:#f5f8ff;--theme-muted:#afc2e4;--theme-primary:#4e8cff;--theme-secondary:#78b7ff;--theme-radius:18px;--theme-shadow:0 20px 50px #00102f88}
:root[data-radius="small"]{--theme-radius:6px}:root[data-radius="large"]{--theme-radius:24px}:root[data-density="compact"]{--theme-density:.82}
html[data-theme] body{background:var(--theme-bg);color:var(--theme-text)}html[data-theme] .panel,html[data-theme] .card,html[data-theme] .auth-card{background:var(--theme-surface);border-color:var(--theme-border);border-radius:var(--theme-radius);box-shadow:var(--theme-shadow)}html[data-theme] .sidebar,html[data-theme] .topbar{background:color-mix(in srgb,var(--theme-surface) 92%,transparent);border-color:var(--theme-border)}html[data-theme] .button{background:linear-gradient(135deg,var(--theme-primary),var(--theme-secondary));color:#fff}html[data-theme] input,html[data-theme] select,html[data-theme] textarea{background:var(--theme-surface);border-color:var(--theme-border);color:var(--theme-text)}html[data-theme] .meta,html[data-theme] small{color:var(--theme-muted)}html[data-theme="AURORA_PURPLE"] body{background-image:radial-gradient(circle at 15% 10%,#a855f744,transparent 35%),radial-gradient(circle at 85% 25%,#ec489933,transparent 30%)}html[data-theme="CLEAN_LIGHT"] .auth{grid-template-columns:1.15fr .85fr}html[data-theme="EMERALD_PRO"] table{font-size:13px}html[data-theme="ROYAL_BLUE"] .hero{background-image:linear-gradient(120deg,#174b9b55,transparent)}
`;
