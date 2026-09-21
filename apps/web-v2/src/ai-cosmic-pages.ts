/** Dedicated AI presentation; live forms, catalog and navigation remain intact. */
const cosmicBrand = `<a href="/" class="aiv3-brand"><svg viewBox="0 0 48 42" aria-hidden="true"><path d="M4 11 14 22 24 4 34 22 44 11 39 34H9Z" fill="#b898ff" stroke="#bdefff" stroke-width="2"/><path d="M10 39h28" stroke="#77ddff" stroke-width="4"/></svg><span data-theme-content="brandTitle">DichVu1st</span></a>`;
export function renderAiCosmicLanding() {
  return `<main class="aiv3-landing" data-renderer="ai-cosmic-landing-page">
  <header class="aiv3-nav">${cosmicBrand}<nav aria-label="Điều hướng chính"><a href="/" aria-current="page">Trang chủ</a><a href="#services">Dịch vụ</a><a href="#pricing">Bảng giá</a><a href="/help">Hỗ trợ</a></nav><a href="/login">Đăng nhập</a><a class="aiv3-primary" href="/register">Đăng ký ngay →</a></header>
  <section class="aiv3-hero"><div class="aiv3-copy"><small data-theme-content="tagline">NỀN TẢNG SMM THÔNG MINH TẠI VIỆT NAM</small><h1 data-theme-content="heroTitle">Tăng trưởng<br>thương hiệu của bạn<br>với <em>sức mạnh AI</em></h1><p data-theme-content="heroSubtitle">DichVu1st cung cấp các dịch vụ Social Media Marketing chất lượng cao, giúp tiết kiệm thời gian và phát triển thương hiệu của cá nhân, doanh nghiệp.</p><div class="aiv3-actions"><a class="aiv3-primary" data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Bắt đầu ngay</span> →</a><a href="#pricing">Xem bảng giá</a></div></div><div class="aiv3-art"><img src="/theme-assets/ai-cosmic/landing-hero.png" alt="Robot AI bên hành tinh xanh, nền tảng xã hội và thành phố tương lai" fetchpriority="high"></div></section>
  <section class="aiv3-stats" aria-label="Nền tảng dịch vụ"><article><b>Đa nền tảng</b><span>Danh mục dịch vụ</span></article><article><b>Trực tiếp</b><span>Trạng thái đơn hàng</span></article><article><b>Minh bạch</b><span data-theme-content="statsText">Giá và tiến độ xử lý</span></article><article><b>Đồng hành</b><span>Hỗ trợ khách hàng</span></article></section>
  <div class="aiv3-platforms" aria-label="Các nền tảng"><span><b>f</b>Facebook</span><span><b>◎</b>Instagram</span><span><b>♪</b>TikTok</span><span><b>▶</b>YouTube</span><span><b>➤</b>Telegram</span><span><b>𝕏</b>X (Twitter)</span></div>
  <section id="services" class="aiv3-services"><header><div><h2>Dịch vụ nổi bật của DichVu1st</h2><p>Giải pháp cho từng nền tảng, đồng hành cùng thương hiệu.</p></div><a href="#pricing">Xem tất cả dịch vụ →</a></header><div>${[
    ["♧", "Tăng tương tác", "Khám phá dịch vụ like, follow và view."],
    ["▤", "Nội dung & cộng đồng", "Kết nối nội dung với người theo dõi."],
    ["↗", "Tăng trưởng đa nền tảng", "Theo dõi chiến dịch tại một nơi."],
    ["◇", "Xây dựng thương hiệu", "Giải pháp cho cá nhân và doanh nghiệp."],
  ]
    .map(
      ([icon, title, copy]) =>
        `<article><span aria-hidden="true">${icon}</span><h3>${title}</h3><p>${copy}</p><a href="#pricing">Khám phá →</a></article>`,
    )
    .join("")}</div></section>
  <footer class="aiv3-footer"><i>Social Media. Empowered by AI.</i><span data-theme-content="footerText">DICHVU1ST · SMART TOOLS. REAL GROWTH.</span></footer></main>`;
}
export function renderAiCosmicAuth(realForm: string) {
  return `<main class="aiv3-auth" data-renderer="ai-cosmic-auth-page"><section class="aiv3-auth-left">${realForm}</section><div class="aiv3-portal"><img src="/theme-assets/ai-cosmic/auth-portal.png" alt="Cổng nhìn ra thành phố tương lai"></div><aside class="aiv3-manifesto"><strong>AI <br>FOR A <br>BRIGHTER <br>CREATOR <br>ECONOMY</strong><hr><span data-theme-content="brandTitle">DichVu1st</span><small>MORE THAN SERVICES<br>A SMARTER TOMORROW</small><q>Công nghệ mở rộng cơ hội cho mọi người.</q></aside></main>`;
}
export function renderAiCosmicDashboard(
  sidebar: string,
  topbar: string,
  content: string,
) {
  topbar = topbar.replace(
    /<div><small>Trang chủ \/<\/small><strong>[^<]*<\/strong><\/div>/,
    '<form class="aiv3-search" action="/services" method="GET"><label><span class="aiv3-sr">Tìm dịch vụ</span><input name="search" placeholder="Tìm dịch vụ…" aria-label="Tìm dịch vụ"></label><button aria-label="Tìm">⌕</button></form>',
  );
  return `<div class="aiv3-dashboard" data-renderer="ai-cosmic-customer-page"><aside class="aiv3-sidebar">${sidebar}</aside><div class="aiv3-workspace"><header class="aiv3-topbar">${topbar}</header><div class="aiv3-customer-content">${content}</div></div></div>`;
}
/** Shared with live customer rendering; no fabricated history or AI service status. */
export function renderAiCosmicOverview(
  data: {
    wallet?: { balance?: unknown };
    orders?: { total?: unknown; active?: unknown; completed?: unknown };
  } = {},
) {
  const number = (value: unknown, currency = false) =>
    value === undefined || value === null || !Number.isFinite(Number(value))
      ? "—"
      : new Intl.NumberFormat(
          "vi-VN",
          currency
            ? { style: "currency", currency: "VND", maximumFractionDigits: 0 }
            : {},
        ).format(Number(value));
  const metrics = [
    ["▤", "Tổng đơn hàng", number(data.orders?.total), "Toàn bộ đơn hàng"],
    ["◇", "Số dư", number(data.wallet?.balance, true), "Số dư tài khoản"],
    ["◷", "Đang xử lý", number(data.orders?.active), "Đơn hàng hoạt động"],
    ["✓", "Hoàn thành", number(data.orders?.completed), "Kết quả thực tế"],
  ];
  return `<section class="aiv3-heading"><div><h1>Tổng quan</h1><p>Theo dõi hiệu suất và tối ưu chiến lược của bạn.</p></div><span>Dữ liệu tài khoản</span></section><section class="aiv3-kpis">${metrics.map(([icon, label, value, copy]) => `<article><span class="aiv3-kpi-icon" aria-hidden="true">${icon}</span><div><small>${label}</small><b>${value}</b></div><p>${copy}</p></article>`).join("")}</section><section class="aiv3-content"><article class="aiv3-chart"><header><h2>Hiệu suất tăng trưởng</h2><span>Đơn hàng</span></header><div class="aiv3-chart-empty"><div><strong>Chưa có dữ liệu theo thời gian</strong><p>Biểu đồ sẽ hiển thị khi có dữ liệu thống kê phù hợp.</p><a href="/orders">Xem đơn hàng →</a></div></div><small>Dữ liệu hôm nay. Tăng trưởng ngày mai.</small></article><aside class="aiv3-assistant" id="ai-assistant"><header><h2>Trợ lý AI của bạn</h2><span>Chưa kết nối</span></header><div class="aiv3-assistant-intro"><img src="/theme-assets/ai-cosmic/landing-hero.png" alt="AI Cosmic"><p>Chào bạn!<br>Khám phá các công cụ hỗ trợ quản lý chiến dịch.</p></div><nav><a href="/orders">▤ Theo dõi đơn hàng</a><a href="/services">◇ Khám phá dịch vụ</a><a href="/support">↗ Liên hệ hỗ trợ</a><a href="/account">◎ Quản lý tài khoản</a></nav><p class="aiv3-assistant-note">Trò chuyện AI chưa khả dụng. Bạn có thể gửi yêu cầu đến đội ngũ hỗ trợ.</p><a class="aiv3-primary" href="/support">Gửi yêu cầu hỗ trợ →</a></aside></section><footer class="aiv3-footer"><i>“Dữ liệu hôm nay. Tăng trưởng ngày mai.”</i><span>DICHVU1ST · SMART TOOLS. REAL GROWTH.</span></footer>`;
}
export const aiCosmicPageTemplates = {
  landing: renderAiCosmicLanding(),
  auth: renderAiCosmicAuth("<div data-ai-real-form></div>"),
  customer: renderAiCosmicDashboard(
    "<div data-ai-sidebar></div>",
    "<div data-ai-topbar></div>",
    "<div data-ai-content></div>",
  ),
};
