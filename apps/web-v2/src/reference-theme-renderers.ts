export type ReferenceScope = "landing" | "auth" | "customer";
export type ReferenceRenderer = (html: string) => string;

export const renderSoftBeigeLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="beige-estate" class="hero beige-estate',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Bộ sưu tập</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Tăng trưởng thanh lịch</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Dịch vụ tuyển chọn</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Tư vấn thương hiệu →</a></footer><div class="container hero-grid">`,
    );
export const renderSoftBeigeAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="beige-hospitality" class="auth beige-hospitality',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Quyền truy cập riêng</nav><section class="auth-visual"><h1>Không gian premium</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Đăng nhập an toàn</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Hỗ trợ tận tâm</footer>`,
    );
export const renderSoftBeigeCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="beige-ledger" class="customer beige-ledger',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Điều hành</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Số dư khả dụng</h2></section><aside class="dashboard-kpis"><strong>Dịch vụ đang dùng</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Đơn hàng gần đây</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderJapaneseZenLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="zen-pavilion" class="hero zen-pavilion',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Lối vào tĩnh tại</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Tăng trưởng từ giá trị thật</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Dịch vụ hài hòa</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Bắt đầu hành trình →</a></footer><div class="container hero-grid">`,
    );
export const renderJapaneseZenAuth: ReferenceRenderer = (html) =>
  html
    .replace('class="auth', 'data-renderer="zen-shoji" class="auth zen-shoji')
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Cổng shoji</nav><section class="auth-visual"><h1>Khu vườn bình tâm</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Xác thực tài khoản</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">An tâm đồng hành</footer>`,
    );
export const renderJapaneseZenCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="zen-ledger" class="customer zen-ledger',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Mục lục vận hành</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Tài chính cân bằng</h2></section><aside class="dashboard-kpis"><strong>Dịch vụ tinh gọn</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Nhật ký đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderDarkLuxuryLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="noir-monument" class="hero noir-monument',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Bộ sưu tập độc quyền</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Nâng tầm vị thế thương hiệu</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Dịch vụ đặc tuyển</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Gia nhập đặc quyền →</a></footer><div class="container hero-grid">`,
    );
export const renderDarkLuxuryAuth: ReferenceRenderer = (html) =>
  html
    .replace('class="auth', 'data-renderer="noir-suite" class="auth noir-suite')
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Private access</nav><section class="auth-visual"><h1>Tầm nhìn thành phố</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Xác thực hội viên</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Dịch vụ concierge</footer>`,
    );
export const renderDarkLuxuryCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="noir-console" class="customer noir-console',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Executive menu</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Tài sản khả dụng</h2></section><aside class="dashboard-kpis"><strong>Danh mục cao cấp</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Order vault</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderPremiumCorporateLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="corporate-tower" class="hero corporate-tower',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Giải pháp doanh nghiệp</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Kiến tạo tăng trưởng bền vững</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Năng lực vận hành</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Nhận tư vấn →</a></footer><div class="container hero-grid">`,
    );
export const renderPremiumCorporateAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="corporate-portal" class="auth corporate-portal',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Trung tâm tin cậy</nav><section class="auth-visual"><h1>Không gian doanh nghiệp</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Đăng nhập tổ chức</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Tuân thủ và bảo mật</footer>`,
    );
export const renderPremiumCorporateCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="corporate-board" class="customer corporate-board',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Điều hướng vận hành</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Doanh thu và số dư</h2></section><aside class="dashboard-kpis"><strong>Hiệu suất dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Bảng đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderCyberNeonLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="neon-metropolis" class="hero neon-metropolis',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Command center</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Kích hoạt sức mạnh tăng trưởng</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Neon service modules</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Launch campaign →</a></footer><div class="container hero-grid">`,
    );
export const renderCyberNeonAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="neon-portal" class="auth neon-portal',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Identity gateway</nav><section class="auth-visual"><h1>Thành phố số</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Access terminal</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">System online</footer>`,
    );
export const renderCyberNeonCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="neon-telemetry" class="customer neon-telemetry',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Circuit navigation</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Ví năng lượng</h2></section><aside class="dashboard-kpis"><strong>Telemetry dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Mission queue</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderGlassLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="glass-orbit" class="hero glass-orbit',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Điều hướng nổi</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Tăng trưởng trong suốt</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Dịch vụ lăng kính</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Khám phá cơ hội →</a></footer><div class="container hero-grid">`,
    );
export const renderGlassAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="glass-gateway" class="auth glass-gateway',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Crystal access</nav><section class="auth-visual"><h1>Chân trời tương lai</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Đăng nhập trong suốt</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Riêng tư được bảo vệ</footer>`,
    );
export const renderGlassCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="glass-workspace" class="customer glass-workspace',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Floating menu</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Ví thanh khoản</h2></section><aside class="dashboard-kpis"><strong>Chỉ số đa sắc</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Luồng đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderEmeraldLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="emerald-harbor" class="hero emerald-harbor',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Hải trình thương hiệu</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Vượt sóng vươn xa</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Đội hình dịch vụ</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Khởi hành ngay →</a></footer><div class="container hero-grid">`,
    );
export const renderEmeraldAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="emerald-secure-harbor" class="auth emerald-secure-harbor',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Cổng an toàn</nav><section class="auth-visual"><h1>Hải đăng dẫn lối</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Xác thực bảo mật</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Neo giữ niềm tin</footer>`,
    );
export const renderEmeraldCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="emerald-operations" class="customer emerald-operations',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Boong điều hành</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Nguồn lực tài chính</h2></section><aside class="dashboard-kpis"><strong>Tuyến dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Danh sách hành trình</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderCreatorLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="creator-collage" class="hero creator-collage',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Creator hub</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Tạo nội dung, kết nối, chuyển đổi</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Kênh tăng trưởng</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Bắt đầu viral →</a></footer><div class="container hero-grid">`,
    );
export const renderCreatorAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="creator-studio" class="auth creator-studio',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Studio pass</nav><section class="auth-visual"><h1>Không gian sáng tạo</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Đăng nhập creator</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Cộng đồng đồng hành</footer>`,
    );
export const renderCreatorCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="creator-performance" class="customer creator-performance',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Creator menu</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Thu nhập khả dụng</h2></section><aside class="dashboard-kpis"><strong>Hiệu suất nội dung</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Chiến dịch đang chạy</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderBrutalistLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="brutalist-poster" class="hero brutalist-poster',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">Mục lục 01</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Ý tưởng lớn xây thương hiệu</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Khối dịch vụ</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Hành động ngay →</a></footer><div class="container hero-grid">`,
    );
export const renderBrutalistAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="brutalist-sheet" class="auth brutalist-sheet',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Issue 01 / Access</nav><section class="auth-visual"><h1>Tuyên ngôn tăng trưởng</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Biểu mẫu truy cập</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Bản quyền bảo mật</footer>`,
    );
export const renderBrutalistCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="brutalist-newsroom" class="customer brutalist-newsroom',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Index / Menu</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Sổ cái tài khoản</h2></section><aside class="dashboard-kpis"><strong>Headline metrics</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Order grid</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const renderAiLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="ai-neural-orbit" class="hero ai-neural-orbit',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><a href="#services">AI command</a><a href="#pricing">Bảng giá</a></nav><section class="theme-story"><strong>Tăng trưởng bằng sức mạnh AI</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></section><aside class="theme-offer"><h2>Mô-đun thông minh</h2><p>TikTok · Facebook · Instagram · YouTube</p></aside><footer class="theme-cta"><a href="/register">Kích hoạt AI →</a></footer><div class="container hero-grid">`,
    );
export const renderAiAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="ai-cognitive-gateway" class="auth ai-cognitive-gateway',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation">Neural access</nav><section class="auth-visual"><h1>Trợ lý AI trực tuyến</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></section><aside class="auth-form-region"><h2>Xác thực thông minh</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></aside><footer class="auth-assurance">Agent bảo vệ 24/7</footer>`,
    );
export const renderAiCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="ai-intelligence" class="customer ai-intelligence',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation">Agent console</nav><section class="dashboard-wallet"><small>Tài chính</small><h2>Ví được phân tích</h2></section><aside class="dashboard-kpis"><strong>Dự báo tăng trưởng</strong><span> Cập nhật theo dữ liệu tài khoản</span></aside><footer class="dashboard-orders"><strong>Đơn hàng tự động</strong><a href="/orders"> Xem chi tiết →</a></footer>`,
    );

export const referenceRenderers: Record<
  string,
  Record<ReferenceScope, ReferenceRenderer>
> = {
  SOFT_BEIGE_PREMIUM: {
    landing: renderSoftBeigeLanding,
    auth: renderSoftBeigeAuth,
    customer: renderSoftBeigeCustomer,
  },
  JAPANESE_ZEN: {
    landing: renderJapaneseZenLanding,
    auth: renderJapaneseZenAuth,
    customer: renderJapaneseZenCustomer,
  },
  DARK_LUXURY: {
    landing: renderDarkLuxuryLanding,
    auth: renderDarkLuxuryAuth,
    customer: renderDarkLuxuryCustomer,
  },
  PREMIUM_CORPORATE: {
    landing: renderPremiumCorporateLanding,
    auth: renderPremiumCorporateAuth,
    customer: renderPremiumCorporateCustomer,
  },
  CYBER_NEON: {
    landing: renderCyberNeonLanding,
    auth: renderCyberNeonAuth,
    customer: renderCyberNeonCustomer,
  },
  GLASSMORPHISM: {
    landing: renderGlassLanding,
    auth: renderGlassAuth,
    customer: renderGlassCustomer,
  },
  EMERALD_BUSINESS: {
    landing: renderEmeraldLanding,
    auth: renderEmeraldAuth,
    customer: renderEmeraldCustomer,
  },
  SOCIAL_CREATOR: {
    landing: renderCreatorLanding,
    auth: renderCreatorAuth,
    customer: renderCreatorCustomer,
  },
  EDITORIAL_BRUTALIST: {
    landing: renderBrutalistLanding,
    auth: renderBrutalistAuth,
    customer: renderBrutalistCustomer,
  },
  AI_FUTURISTIC: {
    landing: renderAiLanding,
    auth: renderAiAuth,
    customer: renderAiCustomer,
  },
};

export function runtimeReferenceShells(scope: ReferenceScope) {
  const root =
    scope === "landing" ? "hero" : scope === "auth" ? "auth" : "customer";
  return Object.fromEntries(
    Object.entries(referenceRenderers).map(([theme, renderers]) => [
      theme,
      renderers[scope](`<div class="${root}"></div>`),
    ]),
  );
}

const scopeRegions: Record<ReferenceScope, string[]> = {
  landing: ["theme-navigation", "theme-story", "theme-offer", "theme-cta"],
  auth: [
    "auth-navigation",
    "auth-visual",
    "auth-form-region",
    "auth-assurance",
  ],
  customer: [
    "dashboard-navigation",
    "dashboard-wallet",
    "dashboard-kpis",
    "dashboard-orders",
  ],
};

/** Rejects the former empty-region implementation rather than trusting class names. */
export function isMeaningfulReferenceRender(
  html: string,
  scope: ReferenceScope,
) {
  return scopeRegions[scope].every((className) => {
    const content = new RegExp(
      `<(?:nav|section|aside|footer) class="${className}">([\\s\\S]*?)<\\/(?:nav|section|aside|footer)>`,
    ).exec(html)?.[1];
    const text = content
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return Boolean(text && text.length >= 8);
  });
}
