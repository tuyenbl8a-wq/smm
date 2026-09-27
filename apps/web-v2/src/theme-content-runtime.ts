/** Render safe tenant-owned blocks without accepting HTML or executable content. */
export function mountThemeCustomBlocks(
  blocks: unknown,
  scope: "landing" | "auth" | "customer",
  manifest?: { sections?: { id: string; selector: string; allowedBlocks: readonly string[] }[] },
) {
  const allowedTypes = new Set([
    "eyebrow", "heading", "paragraph", "button", "link", "image",
    "label", "feature", "stat", "divider",
  ]);
  const sections = manifest?.sections ?? [];
  const list = Array.isArray(blocks) ? blocks.slice(0, 30) : [];
  const valid = list.filter((block: any) =>
    block && typeof block === "object" &&
    typeof block.id === "string" && /^block-[a-z0-9-]{4,48}$/.test(block.id) &&
    allowedTypes.has(block.type) &&
    typeof block.value === "string" && block.value.length <= 500 &&
    (block.visible === undefined || typeof block.visible === "boolean") &&
    (block.order === undefined || Number.isInteger(block.order) && block.order >= 0 && block.order < 100)
  );
  for (const sectionDef of sections) {
    const target = document.querySelector<HTMLElement>(sectionDef.selector);
    if (!target) continue;
    let host = target.querySelector<HTMLElement>(":scope > [data-theme-custom-blocks]");
    if (!host) {
      host = document.createElement("div");
      host.dataset.themeCustomBlocks = "";
      host.dataset.themeCustomBlocksSection = sectionDef.id;
      host.className = "theme-custom-blocks theme-custom-blocks-" + sectionDef.id;
      target.append(host);
    }
    const sorted = valid.filter((block: any) => block.section === sectionDef.id && sectionDef.allowedBlocks.includes(block.type))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    const signature = JSON.stringify(sorted);
    if (host.dataset.signature === signature) continue;
    host.dataset.signature = signature;
    host.replaceChildren();
    for (const block of sorted as any[]) {
    if (sectionDef.id === "navigation" && (block.type === "link" || block.type === "button")) {
      const link = document.createElement("a");
      link.dataset.themeCustomId = block.id;
      link.dataset.themeCustomSection = sectionDef.id;
      link.className = block.type === "button" ? "ref-cta" : "";
      const href = typeof block.href === "string" && block.href.length <= 2048
        ? (() => { try { const u = new URL(block.href, location.origin); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } })()
        : "";
      if (href) link.href = href;
      link.hidden = block.visible === false;
      link.textContent = block.value.normalize("NFC");
      host.append(link);
      continue;
    }
    const section = document.createElement("div");
    section.className = "theme-custom-block theme-custom-block-" + block.type;
    section.dataset.themeCustomId = block.id;
    section.dataset.themeCustomSection = block.section;
    section.hidden = block.visible === false;
    let node: HTMLElement;
    if (block.type === "button" || block.type === "link") {
      const anchor = document.createElement("a");
      anchor.className = block.type === "button" ? "button" : "theme-custom-link";
      const href = typeof block.href === "string" && block.href.length <= 2048
        ? (() => { try { const u = new URL(block.href, location.origin); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } })()
        : "";
      if (href) anchor.href = href;
      node = anchor;
    } else if (block.type === "image") {
      const image = document.createElement("img");
      image.alt = typeof block.alt === "string" ? block.alt.slice(0, 240).normalize("NFC") : "";
      const src = typeof block.src === "string" && block.src.length <= 2048
        ? (() => { try { const u = new URL(block.src, location.origin); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } })()
        : "";
      if (src) image.src = src;
      node = image;
    } else if (block.type === "heading") node = document.createElement("h2");
    else if (block.type === "eyebrow" || block.type === "label") node = document.createElement("small");
    else if (block.type === "divider") node = document.createElement("hr");
    else node = document.createElement("p");
    if (block.type !== "image" && block.type !== "divider") node.textContent = block.value.normalize("NFC");
    section.append(node);
      host.append(section);
    }
  }
}
