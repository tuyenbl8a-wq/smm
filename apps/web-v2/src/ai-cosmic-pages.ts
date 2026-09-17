/** Dedicated AI Cosmic page templates. These are page structures, not injected regions. */
export function renderAiCosmicLanding() {
  return `<main class="aiv3-landing" data-renderer="ai-cosmic-landing-page">
    <header class="aiv3-nav"><span data-theme-content="brandTitle">Thương hiệu của bạn</span><nav><a href="/">Trang chủ</a><a href="#services">Dịch vụ</a><a href="#pricing">Bảng giá</a><a href="#services">AI Tools</a><a href="#services">Blog</a><a href="#services">Liên hệ</a></nav><a href="/login">Đăng nhập</a><a class="aiv3-primary" href="/register">Đăng ký ngay →</a></header>
    <section class="aiv3-hero"><div class="aiv3-copy"><small data-theme-content="tagline">NỀN TẢNG SMM THÔNG MINH TẠI VIỆT NAM</small><h1 data-theme-content="heroTitle">Tăng trưởng thương hiệu của bạn với sức mạnh AI</h1><p data-theme-content="heroSubtitle">Cung cấp dịch vụ Social Media Marketing chất lượng cao, kết hợp trí tuệ nhân tạo để tối ưu chiến lược và tiết kiệm thời gian.</p><div><a class="aiv3-primary" data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Bắt đầu ngay</span> →</a><a href="#pricing">Xem bảng giá</a></div></div><div class="aiv3-art" aria-label="Robot AI giữa thành phố vũ trụ"><i class="aiv3-planet"></i><i class="aiv3-city"></i><i class="aiv3-road"></i><i class="aiv3-orb">AI</i><i class="aiv3-robot"><b></b><em></em><span>♛</span></i><div class="aiv3-floats"><span>♪ TẠO NỘI DUNG<small>AI CONTENT</small></span><span>◉ LÊN CHIẾN LƯỢC<small>AI STRATEGY</small></span><span>f　◎　✈　𝕏</span><span>▣ PHÂN TÍCH DỮ LIỆU<small>AI ANALYTICS</small></span></div></div></section>
    <section class="aiv3-stats"><article><b>50K+</b><span>Khách hàng tin tưởng</span></article><article><b>1M+</b><span>Đơn hàng hoàn thành</span></article><article><b>99.9%</b><span>Tỷ lệ thành công</span></article><article><b>24/7</b><span>Hỗ trợ AI & con người</span></article></section>
    <section class="aiv3-platforms"><span>● Facebook</span><span>▣ Instagram</span><span>♪ TikTok</span><span>▶ YouTube</span><span>✈ Telegram</span><span>𝕏 X (Twitter)</span></section>
    <section id="services" class="aiv3-services"><header><div><h2>Dịch vụ nổi bật</h2><p>Giải pháp toàn diện cho mọi nền tảng, được tối ưu bởi AI.</p></div><a href="#pricing">Xem tất cả dịch vụ →</a></header><div><article><b>♟</b><h3>Tăng tương tác</h3><p>Like, follow, view thật an toàn, bền vững.</p></article><article><b>▣</b><h3>Sản xuất nội dung AI</h3><p>Tạo ý tưởng, viết nội dung, lên lịch tự động.</p></article><article><b>↗</b><h3>Quảng cáo đa nền tảng</h3><p>Tối ưu chiến dịch với AI, tiết kiệm chi phí.</p></article><article><b>♢</b><h3>Xây dựng thương hiệu</h3><p>Giải pháp dài hạn cho cá nhân và doanh nghiệp.</p></article></div></section>
  </main>`;
}

export function renderAiCosmicAuth(realForm: string) {
  return `<main class="aiv3-auth" data-renderer="ai-cosmic-auth-page"><section class="aiv3-auth-left">${realForm}</section><section class="aiv3-portal" aria-label="Cổng thành phố tương lai"><i></i><b></b></section><aside class="aiv3-manifesto"><strong>AI<br>FOR A<br>BRIGHTER<br>CREATOR<br>ECONOMY</strong><span data-theme-content="brandTitle">Thương hiệu của bạn</span><small>MORE THAN SERVICES<br>A SMARTER TOMORROW</small><q>Công nghệ mở rộng cơ hội cho mọi người.</q></aside></main>`;
}

export function renderAiCosmicDashboard(
  sidebar: string,
  topbar: string,
  content: string,
) {
  return `<div class="aiv3-dashboard" data-renderer="ai-cosmic-customer-page"><aside class="aiv3-sidebar">${sidebar}</aside><main><header class="aiv3-topbar">${topbar}</header><div class="aiv3-customer-content">${content}</div></main></div>`;
}

export const aiCosmicPageTemplates = {
  landing: renderAiCosmicLanding(),
  auth: renderAiCosmicAuth('<div data-ai-real-form></div>'),
  customer: renderAiCosmicDashboard(
    '<div data-ai-sidebar></div>',
    '<div data-ai-topbar></div>',
    '<div data-ai-content></div>',
  ),
};
