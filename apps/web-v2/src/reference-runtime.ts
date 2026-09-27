import { beigeEditorialPages } from "./beige-editorial-pages.js";
import { beigeEditorialStyles } from "./beige-editorial-styles.js";
import { blackGoldPages } from "./black-gold-pages.js";
import { blackGoldStyles } from "./black-gold-styles.js";
import { zenJapanesePages } from "./zen-japanese-pages.js";
import { zenJapaneseStyles } from "./zen-japanese-styles.js";
import { blueBusinessPages } from "./blue-business-pages.js";
import { blueBusinessStyles } from "./blue-business-styles.js";
import { oceanPremiumPages } from "./ocean-premium-pages.js";
import { oceanPremiumStyles } from "./ocean-premium-styles.js";
import { prismGlassPages } from "./prism-glass-pages.js";
import { prismGlassStyles } from "./prism-glass-styles.js";
import { cyberNeonPages } from "./cyber-neon-pages.js";
import { cyberNeonStyles } from "./cyber-neon-styles.js";
import { urbanLimePages } from "./urban-lime-pages.js";
import { urbanLimeStyles } from "./urban-lime-styles.js";
import { creatorPopPages } from "./creator-pop-pages.js";
import { creatorPopStyles } from "./creator-pop-styles.js";
import { referenceBaseStyles } from "./reference-styles.js";
import type { ReferencePages } from "./reference-primitives.js";
export const referencePages: Record<string, ReferencePages> = {
  BEIGE_EDITORIAL: beigeEditorialPages,
  BLACK_GOLD_LUXURY: blackGoldPages,
  ZEN_JAPANESE: zenJapanesePages,
  BLUE_BUSINESS: blueBusinessPages,
  OCEAN_PREMIUM: oceanPremiumPages,
  PRISM_GLASS: prismGlassPages,
  CYBER_NEON_CITY: cyberNeonPages,
  URBAN_LIME_BRUTAL: urbanLimePages,
  CREATOR_POP: creatorPopPages,
};
export const referenceStyles =
  referenceBaseStyles +
  beigeEditorialStyles +
  blackGoldStyles +
  zenJapaneseStyles +
  blueBusinessStyles +
  oceanPremiumStyles +
  prismGlassStyles +
  cyberNeonStyles +
  urbanLimeStyles +
  creatorPopStyles;

export function referencePreview(
  theme: string,
  scope: "landing" | "auth" | "customer",
  body: string,
) {
  const page = referencePages[theme];
  if (!page) return body;
  const extract = (pattern: RegExp) => pattern.exec(body)?.[0] || "";
  const emptyList = (title: string) =>
    `<section class="list panel"><h2>${title}</h2><div class="empty">Đăng nhập để xem dữ liệu tài khoản.</div></section>`;
  let overview = page.overview;
  const fragments: Record<string, string> = {
    metrics: `<section class="metric-grid">${["Số dư", "Tổng đơn hàng", "Đang xử lý", "Hoàn thành"].map((label) => `<article class="metric-card"><small>${label}</small><b>—</b></article>`).join("")}</section>`,
    orders: emptyList("Đơn hàng gần đây"),
    transactions: emptyList("Giao dịch gần đây"),
    notifications: emptyList("Thông báo mới"),
  };
  fragments.chart = renderReferenceOrderMix();
  for (const [name, html] of Object.entries(fragments))
    overview = overview.replace(
      `<div data-reference-slot="${name}"></div>`,
      html,
    );
  const nodes: Record<string, string> = {
    pricing: extract(/<section id="pricing"[\s\S]*?(?=<section id="process")/),
    form: extract(/<section class="auth-card">[\s\S]*?<\/section>/),
    sidebar: extract(/<aside class="sidebar">[\s\S]*?<\/aside>/),
    topbar: extract(/<header class="topbar">[\s\S]*?<\/header>/),
    content: `<main id="app" class="customer-content" data-theme-section="dashboard" data-theme-slot="content">${overview}</main>`,
  };
  let result = page[scope];
  for (const [name, html] of Object.entries(nodes))
    result = result.replace(`<div data-reference-slot="${name}"></div>`, html);
  if (scope === "auth") result = result.replace(/<main class="ref-auth ([^"]+)" data-reference-page/, '<main class="ref-auth $1" data-reference-page data-theme-section="marketing" data-theme-slot="content"');
  return result.replace(/DichVu1st/giu, "Social Platform");
}

/** Move live nodes, never clone forms: listeners, values and pending requests survive. */
export function mountReferencePage(
  pages: Record<string, ReferencePages>,
  theme: string,
  scope: "landing" | "auth" | "customer",
) {
  const selected = pages[theme];
  if (!selected || document.querySelector("[data-reference-page]")) return;
  const current = document.querySelector(
    scope === "landing" ? "main" : scope === "auth" ? ".auth" : ".customer",
  );
  if (!current) return;
  const template = document.createElement("template");
  template.innerHTML = selected[scope];
  const page = template.content.firstElementChild as HTMLElement;
  if (scope === "auth") {
    page.dataset.themeSection = "marketing";
    page.dataset.themeSlot = "content";
  }
  const selectors: Record<string, string> =
    scope === "landing"
      ? { pricing: "#pricing" }
      : scope === "auth"
        ? { form: ".auth-card" }
        : {
            sidebar: ".sidebar",
            topbar: ".topbar",
            content: ".customer-content",
          };
  for (const [name, selector] of Object.entries(selectors)) {
    const live = current.querySelector(selector),
      target = page.querySelector(`[data-reference-slot="${name}"]`);
    if (live && target) {
      if (scope === "customer" && name === "content") {
        live.setAttribute("data-theme-section", "dashboard");
        live.setAttribute("data-theme-slot", "content");
      }
      target.replaceWith(live);
    }
  }
  if (scope === "landing") {
    document.querySelector("body > .header")?.remove();
    document.querySelector("body > footer")?.remove();
  }
  current.replaceWith(page);
  setupReferenceNavigation(page);
}

/** Rearranges only real dashboard fragments, without adding made-up business values. */
export function mountReferenceOverview(
  pages: Record<string, ReferencePages>,
  theme: string,
  app: Element,
) {
  if (location.pathname !== "/dashboard") return;
  if (!pages[theme] || app.querySelector("[data-reference-overview]")) return;
  const metrics = app.querySelector(".metric-grid");
  if (!metrics) return;
  const lists = Array.from(app.querySelectorAll(".list"));
  const fragments: Record<string, Element | undefined> = {
    metrics,
    orders: lists[0],
    transactions: lists[1],
    notifications: lists[2],
  };
  const template = document.createElement("template");
  template.innerHTML = pages[theme].overview;
  const overview = template.content.firstElementChild!;
  overview.setAttribute("data-reference-overview", "");
  const values = Array.from(metrics.querySelectorAll("b"))
    .slice(1)
    .map((node) => Number((node.textContent || "").replace(/[^0-9]/g, "")));
  const chart = overview.querySelector('[data-reference-slot="chart"]');
  if (chart) {
    const graphic = document.createElement("template");
    graphic.innerHTML = renderReferenceOrderMix(
      values[0],
      values[1],
      values[2],
    );
    chart.replaceWith(graphic.content);
  }
  for (const [name, node] of Object.entries(fragments)) {
    const target = overview.querySelector(`[data-reference-slot="${name}"]`);
    if (node && target) target.replaceWith(node);
  }
  app.replaceChildren(overview);
}

/** Tenant-specific settings come from the existing host-resolved public endpoint. */
export function applyReferenceBranding(settings: Record<string, any>) {
  if (!document.querySelector("[data-reference-page]")) return;
  const name =
    typeof settings.siteName === "string" && settings.siteName.trim()
      ? settings.siteName.trim()
      : location.hostname;
  document
    .querySelectorAll(
      '[data-tenant-name],[data-reference-page] [data-theme-content="brandTitle"]',
    )
    .forEach((node) => {
      if (node.textContent !== name) node.textContent = name;
      node.closest("a")?.setAttribute("aria-label", name + " · Trang chủ");
    });
  document
    .querySelectorAll("[data-reference-page] .brand .mark")
    .forEach((node) => node.remove());
  // Only legacy presentation copy is rewritten; service/order content is data.
  document
    .querySelectorAll<HTMLElement>(
      "[data-reference-page] .auth-card>p,[data-reference-page] .page-head .eyebrow",
    )
    .forEach((node) => {
      const original =
        node.dataset.referenceOriginalCopy ?? node.textContent ?? "";
      node.dataset.referenceOriginalCopy = original;
      const next = original.replace(/DichVu1st/giu, () => name);
      if (node.textContent !== next) node.textContent = next;
    });
  const originalTitle =
    document.documentElement.dataset.referenceTitle ?? document.title;
  document.documentElement.dataset.referenceTitle = originalTitle;
  document.title = originalTitle.replace(/DichVu1st/giu, () => name);
  if (typeof settings.logoUrl === "string" && settings.logoUrl.trim())
    try {
      const url = new URL(settings.logoUrl, location.origin);
      if (url.protocol === "https:" || url.origin === location.origin) {
        document
          .querySelectorAll<HTMLElement>(
            "[data-reference-page] .ref-brand,[data-reference-page] .brand",
          )
          .forEach((brand) => {
            let logo =
              brand.querySelector<HTMLImageElement>(".ref-tenant-logo");
            if (!logo) {
              logo = document.createElement("img");
              logo.className = "ref-tenant-logo";
              logo.alt = "";
              logo.addEventListener("error", () => {
                logo!.hidden = true;
              });
              brand.querySelector(":scope > span[aria-hidden]")?.remove();
              brand.prepend(logo);
            }
            if (logo.src !== url.href) logo.src = url.href;
          });
      }
    } catch {
      /* Keep the text identity if the supplied URL is invalid. */
    }
}

export function setupReferenceNavigation(page: Element, preview = false) {
  const sidebar = page.querySelector<HTMLElement>(".sidebar"),
    toggle = page.querySelector<HTMLButtonElement>("#drawer-toggle");
  if (!sidebar || !toggle) return;
  const rail = sidebar.parentElement!;
  rail.setAttribute("data-ref-rail", "");
  const mobile = matchMedia("(max-width:800px)");
  const sync = () => {
    const open = sidebar.classList.contains("open");
    rail.inert = mobile.matches && !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (mobile.matches && open)
      (rail.querySelector(".ref-close") as HTMLElement)?.focus();
  };
  const close = () => {
    sidebar.classList.remove("open");
    sync();
    toggle.focus();
  };
  if (preview)
    toggle.onclick = () => {
      sidebar.classList.toggle("open");
    };
  page.querySelector(".ref-close")?.addEventListener("click", close);
  new MutationObserver(sync).observe(sidebar, {
    attributes: true,
    attributeFilter: ["class"],
  });
  mobile.addEventListener("change", sync);
  sync();
  rail.addEventListener("keydown", (e) => {
    if (!mobile.matches || !sidebar.classList.contains("open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const focusables = Array.from(
        rail.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),input:not([disabled])",
        ),
      ).filter((n) => n.getClientRects().length);
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  page.querySelector("#profile-menu")?.addEventListener("click", () => {
    location.href = "/account";
  });
}

/** Current status distribution, never a fabricated revenue/time-series chart. */
export function renderReferenceOrderMix(
  total?: number,
  active?: number,
  completed?: number,
) {
  if (
    total === undefined ||
    active === undefined ||
    completed === undefined ||
    ![total, active, completed].every(Number.isFinite) ||
    total <= 0 ||
    active < 0 ||
    completed < 0 ||
    active + completed > total
  )
    return '<section class="ref-order-mix panel"><h2>Cơ cấu đơn hàng</h2><div class="empty">Chưa có dữ liệu đơn hàng để hiển thị biểu đồ.</div></section>';
  const done = (completed / total) * 100,
    pending = (active / total) * 100;
  return `<section class="ref-order-mix panel"><h2>Cơ cấu đơn hàng</h2><div class="ref-mix-body"><div class="ref-donut" role="img" aria-label="${completed} hoàn thành, ${active} đang xử lý, ${total - active - completed} đơn khác" style="--mix-done:${done}%;--mix-active:${done + pending}%"><span><b>${Math.round(done)}%</b><small>Hoàn thành</small></span></div><dl><div><dt>Hoàn thành</dt><dd>${completed}</dd></div><div><dt>Đang xử lý</dt><dd>${active}</dd></div><div><dt>Khác</dt><dd>${total - active - completed}</dd></div></dl></div><p>Phân bố theo tổng đơn hàng hiện tại.</p></section>`;
}
