/** Small presentation primitives. Page architecture belongs to each renderer. */
export type ReferencePages = {
  landing: string;
  auth: string;
  customer: string;
  overview: string;
};
export const slot = (name: string) =>
  `<div data-reference-slot="${name}"></div>`;
export const identity = `<a class="ref-brand" href="/" data-theme-node="header.brand" data-theme-node-type="text"><span aria-hidden="true">♛</span><strong data-tenant-name>Social Platform</strong></a>`;
export const nav = `<header class="ref-nav">${identity}<nav aria-label="Điều hướng chính" data-i18n-aria-label="theme.shared.navLabel" data-theme-section="navigation" data-theme-slot="content"><a href="/" data-theme-node="nav.home" data-theme-node-type="link" data-i18n="nav.home">Trang chủ</a><a href="#services" data-theme-node="nav.services" data-theme-node-type="link" data-i18n="nav.services">Dịch vụ</a><a href="#pricing" data-theme-node="nav.pricing" data-theme-node-type="link" data-i18n="nav.pricing">Bảng giá</a><a href="/help" data-theme-node="nav.support" data-theme-node-type="link" data-i18n="nav.support">Hỗ trợ</a></nav><div><a href="/login" data-i18n="nav.login">Đăng nhập</a><a class="ref-cta" href="/register" data-i18n="nav.register">Đăng ký ngay</a></div></header>`;
export const actions = (theme: string) => `<div class="ref-actions"><a class="ref-cta" href="/register" data-theme-href="primaryCtaUrl" data-theme-node="hero.primaryCta" data-theme-node-type="button"><span data-theme-node-label data-i18n="theme.${theme}.hero.primary">Bắt đầu ngay</span> →</a><a class="ref-secondary" href="#pricing" data-theme-node="hero.secondaryCta" data-theme-node-type="link"><span data-theme-node-label data-i18n="theme.${theme}.hero.secondary">Xem bảng giá</span> ↗</a></div>`;
export const intro = (title: string, accent: string, tagline: string, theme: string) =>
  `<div class="ref-copy" data-theme-section="hero" data-theme-slot="content"><small data-i18n="theme.${theme}.hero.eyebrow" data-theme-node="hero.eyebrow" data-theme-node-type="text">${tagline}</small><h1 data-i18n-parts="theme.${theme}.hero.title.lead|theme.${theme}.hero.title.accent" data-theme-node="hero.title" data-theme-node-type="heading">${title} <em>${accent}</em></h1><p data-i18n="theme.${theme}.hero.description" data-theme-node="hero.description" data-theme-node-type="text">Giải pháp Social Media Marketing cho cá nhân và doanh nghiệp. Khám phá dịch vụ, theo dõi đơn hàng và phát triển thương hiệu tại một nơi.</p>${actions(theme)}</div>`;
export const art = (theme: string, alt: string) =>
  `<img class="ref-scene" data-theme-artwork="hero.artwork" src="/theme-assets/${theme}/scene.png" alt="${alt}" width="1536" height="1024">`;
export const platforms = `<nav class="ref-platforms" aria-label="Nền tảng dịch vụ">${[
  ["♪", "TikTok"],
  ["◎", "Instagram"],
  ["▶", "YouTube"],
  ["f", "Facebook"],
  ["➤", "Telegram"],
  ["𝕏", "X (Twitter)"],
]
  .map(
    ([icon, name]) =>
      `<a href="#pricing"><b aria-hidden="true">${icon}</b><span>${name}</span></a>`,
  )
  .join("")}</nav>`;
export const assurances = `<dl class="ref-assurances" data-theme-section="stats" data-theme-slot="content"><div><dt data-i18n="theme.shared.assurance.platforms">Đa nền tảng</dt><dd data-i18n="theme.shared.assurance.catalog">Danh mục dịch vụ</dd></div><div><dt data-i18n="theme.shared.assurance.transparent">Minh bạch</dt><dd data-i18n="theme.shared.assurance.pricing">Giá và tiến độ</dd></div><div><dt data-i18n="theme.shared.assurance.safe">An toàn</dt><dd data-i18n="theme.shared.assurance.account">Bảo vệ tài khoản</dd></div><div><dt data-i18n="theme.shared.assurance.partner">Đồng hành</dt><dd data-i18n="theme.shared.assurance.support">Hỗ trợ khách hàng</dd></div></dl>`;
export const benefits = `<section id="services" class="ref-benefits" data-theme-section="features" data-theme-slot="content"><h2 data-i18n="theme.shared.benefits">Giải pháp cho thương hiệu của bạn</h2><div>${[
  ["↗", "Tăng tương tác", "Khám phá dịch vụ cho từng nền tảng.", "engagement", "discovery"],
  ["◇", "An toàn & bảo mật", "Quản lý tài khoản trong một không gian riêng.", "security", "management"],
  ["ϟ", "Theo dõi tiến độ", "Kiểm tra trạng thái đơn hàng trực tiếp.", "progress", "status"],
  ["♧", "Đồng hành lâu dài", "Gửi yêu cầu khi cần hỗ trợ.", "support", "contact"],
]
  .map(
    ([icon, title, copy, titleKey, copyKey]) =>
      `<article><b aria-hidden="true">${icon}</b><h3 data-i18n="theme.shared.benefit.${titleKey}">${title}</h3><p data-i18n="theme.shared.benefit.${copyKey}">${copy}</p><a href="#pricing"><span data-i18n="theme.shared.explore">Khám phá</span> →</a></article>`,
  )
  .join("")}</div></section>`;
export const end = `<footer class="ref-footer" data-theme-section="footer" data-theme-slot="content">${identity}<span data-i18n="theme.shared.footer" data-theme-content="footerText" data-theme-node="footer.description" data-theme-node-type="text">Kết nối hôm nay · Phát triển ngày mai</span><a href="/help"><span data-i18n="nav.support">Hỗ trợ</span> ↗</a></footer>`;
export const shortcuts = `<nav class="ref-shortcuts" aria-label="Thao tác nhanh"><a href="/orders/new">＋ Tạo đơn hàng</a><a href="/deposit">↗ Nạp tiền</a><a href="/support">◉ Hỗ trợ</a></nav>`;
export const closeMenu = `<button type="button" class="ref-close" aria-label="Đóng menu">Đóng menu ×</button>`;
export const customerSide = `${closeMenu}${slot("sidebar")}`;
export const overviewHeading = `<header class="ref-overview-heading"><div><small>KHÔNG GIAN LÀM VIỆC</small><h1 data-theme-node="customer.pageTitle" data-theme-node-type="heading">Tổng quan</h1><p data-theme-node="customer.pageDescription" data-theme-node-type="text">Hoạt động tài khoản của bạn, cập nhật từ hệ thống.</p></div><a class="ref-cta" href="/orders/new">Tạo đơn hàng →</a></header>`;
