export type TenantBranding = {
  name: string;
  hostname: string;
  isRoot: boolean;
  monogram: string;
  logoUrl: string | undefined;
  faviconUrl: string | undefined;
  supportEmail: string | undefined;
  supportSummary: string | undefined;
};

export const ROOT_HOSTS = new Set(["dichvu1st.com", "www.dichvu1st.com", "localhost"]);

const safeUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export function tenantBranding(hostname: string, settings: Record<string, unknown> = {}): TenantBranding {
  const host = hostname.toLowerCase().replace(/:\d+$/, "");
  const isRoot = ROOT_HOSTS.has(host);
  const configured = String(settings.brandName || settings.siteName || "").trim();
  const name = configured || (isRoot ? "DichVu1st" : host || "Website");
  return {
    name,
    hostname: host,
    isRoot,
    monogram: (name.match(/[\p{L}\p{N}]/u)?.[0] || "W").toUpperCase(),
    logoUrl: safeUrl(settings.logoUrl),
    faviconUrl: safeUrl(settings.faviconUrl),
    supportEmail: typeof settings.supportEmail === "string" ? settings.supportEmail : undefined,
    supportSummary: typeof settings.supportSummary === "string" ? settings.supportSummary : undefined,
  };
}

export const rootBranding = tenantBranding("dichvu1st.com");

export const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function faviconMarkup(brand: TenantBranding) {
  if (brand.faviconUrl) return `<link rel="icon" href="${escapeHtml(brand.faviconUrl)}">`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111827"/><text x="32" y="43" text-anchor="middle" font-size="36" font-family="sans-serif" fill="white">${escapeHtml(brand.monogram)}</text></svg>`;
  return `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

/** Apply tenant identity to asynchronously composed reference-theme shells
 * without changing any theme preset, artwork, identifier, or asset. */
export function brandingRuntime(brand: TenantBranding) {
  if (brand.isRoot) return "";
  const value = JSON.stringify(brand.name).replaceAll("<", "\\u003c");
  return `(()=>{const brand=${value},paint=root=>{const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode())if(node.nodeValue?.includes('DichVu1st'))node.nodeValue=node.nodeValue.replaceAll('DichVu1st',brand);root.querySelectorAll?.('[aria-label],[title]').forEach(x=>['aria-label','title'].forEach(a=>{const v=x.getAttribute(a);if(v?.includes('DichVu1st'))x.setAttribute(a,v.replaceAll('DichVu1st',brand))}))};paint(document.body);new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)paint(n)}))).observe(document.body,{childList:true,subtree:true})})();`;
}
