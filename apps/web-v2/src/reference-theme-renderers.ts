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
      `<nav class="theme-navigation"><article><a href="#services">Bộ sưu tập</a><a href="#pricing">Bảng giá</a></article></nav><section class="theme-story"><article><strong>Tăng trưởng thanh lịch</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></article></section><aside class="theme-offer"><article><h2>Dịch vụ tuyển chọn</h2><p>TikTok · Facebook · Instagram · YouTube</p></article></aside><footer class="theme-cta"><article><a href="/register">Tư vấn thương hiệu →</a></article></footer><div class="container hero-grid">`,
    );
export const renderSoftBeigeAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="beige-hospitality" class="auth beige-hospitality',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><article>Quyền truy cập riêng</article></nav><section class="auth-visual"><article><h1>Không gian premium</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></article></section><aside class="auth-form-region"><article><h2>Đăng nhập an toàn</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></article></aside><footer class="auth-assurance"><article>Hỗ trợ tận tâm</article></footer>`,
    );
export const renderSoftBeigeCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="beige-ledger" class="customer beige-ledger',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><article>Điều hành</article></nav><section class="dashboard-wallet"><article><small>Tài chính</small><h2>Số dư khả dụng</h2></article></section><aside class="dashboard-kpis"><article><strong>Dịch vụ đang dùng</strong><span> Cập nhật theo dữ liệu tài khoản</span></article></aside><footer class="dashboard-orders"><article><strong>Đơn hàng gần đây</strong><a href="/orders"> Xem chi tiết →</a></article></footer>`,
    );

export const renderJapaneseZenLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="zen-pavilion" class="hero zen-pavilion',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><div><span><a href="#services">Lối vào tĩnh tại</a><a href="#pricing">Bảng giá</a></span></div></nav><section class="theme-story"><div><span><strong>Tăng trưởng từ giá trị thật</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></span></div></section><aside class="theme-offer"><div><span><h2>Dịch vụ hài hòa</h2><p>TikTok · Facebook · Instagram · YouTube</p></span></div></aside><footer class="theme-cta"><div><span><a href="/register">Bắt đầu hành trình →</a></span></div></footer><div class="container hero-grid">`,
    );
export const renderJapaneseZenAuth: ReferenceRenderer = (html) =>
  html
    .replace('class="auth', 'data-renderer="zen-shoji" class="auth zen-shoji')
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><div><span>Cổng shoji</span></div></nav><section class="auth-visual"><div><span><h1>Khu vườn bình tâm</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></span></div></section><aside class="auth-form-region"><div><span><h2>Xác thực tài khoản</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></span></div></aside><footer class="auth-assurance"><div><span>An tâm đồng hành</span></div></footer>`,
    );
export const renderJapaneseZenCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="zen-ledger" class="customer zen-ledger',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><div><span>Mục lục vận hành</span></div></nav><section class="dashboard-wallet"><div><span><small>Tài chính</small><h2>Tài chính cân bằng</h2></span></div></section><aside class="dashboard-kpis"><div><span><strong>Dịch vụ tinh gọn</strong><span> Cập nhật theo dữ liệu tài khoản</span></span></div></aside><footer class="dashboard-orders"><div><span><strong>Nhật ký đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></span></div></footer>`,
    );

export const renderDarkLuxuryLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="noir-monument" class="hero noir-monument',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><header><a href="#services">Bộ sưu tập độc quyền</a><a href="#pricing">Bảng giá</a></header></nav><section class="theme-story"><header><strong>Nâng tầm vị thế thương hiệu</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></header></section><aside class="theme-offer"><header><h2>Dịch vụ đặc tuyển</h2><p>TikTok · Facebook · Instagram · YouTube</p></header></aside><footer class="theme-cta"><header><a href="/register">Gia nhập đặc quyền →</a></header></footer><div class="container hero-grid">`,
    );
export const renderDarkLuxuryAuth: ReferenceRenderer = (html) =>
  html
    .replace('class="auth', 'data-renderer="noir-suite" class="auth noir-suite')
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><header>Private access</header></nav><section class="auth-visual"><header><h1>Tầm nhìn thành phố</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></header></section><aside class="auth-form-region"><header><h2>Xác thực hội viên</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></header></aside><footer class="auth-assurance"><header>Dịch vụ concierge</header></footer>`,
    );
export const renderDarkLuxuryCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="noir-console" class="customer noir-console',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><header>Executive menu</header></nav><section class="dashboard-wallet"><header><small>Tài chính</small><h2>Tài sản khả dụng</h2></header></section><aside class="dashboard-kpis"><header><strong>Danh mục cao cấp</strong><span> Cập nhật theo dữ liệu tài khoản</span></header></aside><footer class="dashboard-orders"><header><strong>Order vault</strong><a href="/orders"> Xem chi tiết →</a></header></footer>`,
    );

export const renderPremiumCorporateLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="corporate-tower" class="hero corporate-tower',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><div><small><a href="#services">Giải pháp doanh nghiệp</a><a href="#pricing">Bảng giá</a></small></div></nav><section class="theme-story"><div><small><strong>Kiến tạo tăng trưởng bền vững</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></small></div></section><aside class="theme-offer"><div><small><h2>Năng lực vận hành</h2><p>TikTok · Facebook · Instagram · YouTube</p></small></div></aside><footer class="theme-cta"><div><small><a href="/register">Nhận tư vấn →</a></small></div></footer><div class="container hero-grid">`,
    );
export const renderPremiumCorporateAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="corporate-portal" class="auth corporate-portal',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><div><small>Trung tâm tin cậy</small></div></nav><section class="auth-visual"><div><small><h1>Không gian doanh nghiệp</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></small></div></section><aside class="auth-form-region"><div><small><h2>Đăng nhập tổ chức</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></small></div></aside><footer class="auth-assurance"><div><small>Tuân thủ và bảo mật</small></div></footer>`,
    );
export const renderPremiumCorporateCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="corporate-board" class="customer corporate-board',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><div><small>Điều hướng vận hành</small></div></nav><section class="dashboard-wallet"><div><small><small>Tài chính</small><h2>Doanh thu và số dư</h2></small></div></section><aside class="dashboard-kpis"><div><small><strong>Hiệu suất dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></small></div></aside><footer class="dashboard-orders"><div><small><strong>Bảng đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></small></div></footer>`,
    );

export const renderCyberNeonLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="neon-metropolis" class="hero neon-metropolis',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><code><a href="#services">Command center</a><a href="#pricing">Bảng giá</a></code></nav><section class="theme-story"><code><strong>Kích hoạt sức mạnh tăng trưởng</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></code></section><aside class="theme-offer"><code><h2>Neon service modules</h2><p>TikTok · Facebook · Instagram · YouTube</p></code></aside><footer class="theme-cta"><code><a href="/register">Launch campaign →</a></code></footer><div class="container hero-grid">`,
    );
export const renderCyberNeonAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="neon-portal" class="auth neon-portal',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><code>Identity gateway</code></nav><section class="auth-visual"><code><h1>Thành phố số</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></code></section><aside class="auth-form-region"><code><h2>Access terminal</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></code></aside><footer class="auth-assurance"><code>System online</code></footer>`,
    );
export const renderCyberNeonCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="neon-telemetry" class="customer neon-telemetry',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><code>Circuit navigation</code></nav><section class="dashboard-wallet"><code><small>Tài chính</small><h2>Ví năng lượng</h2></code></section><aside class="dashboard-kpis"><code><strong>Telemetry dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></code></aside><footer class="dashboard-orders"><code><strong>Mission queue</strong><a href="/orders"> Xem chi tiết →</a></code></footer>`,
    );

export const renderGlassLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="glass-orbit" class="hero glass-orbit',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><figure><a href="#services">Điều hướng nổi</a><a href="#pricing">Bảng giá</a></figure></nav><section class="theme-story"><figure><strong>Tăng trưởng trong suốt</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></figure></section><aside class="theme-offer"><figure><h2>Dịch vụ lăng kính</h2><p>TikTok · Facebook · Instagram · YouTube</p></figure></aside><footer class="theme-cta"><figure><a href="/register">Khám phá cơ hội →</a></figure></footer><div class="container hero-grid">`,
    );
export const renderGlassAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="glass-gateway" class="auth glass-gateway',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><figure>Crystal access</figure></nav><section class="auth-visual"><figure><h1>Chân trời tương lai</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></figure></section><aside class="auth-form-region"><figure><h2>Đăng nhập trong suốt</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></figure></aside><footer class="auth-assurance"><figure>Riêng tư được bảo vệ</figure></footer>`,
    );
export const renderGlassCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="glass-workspace" class="customer glass-workspace',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><figure>Floating menu</figure></nav><section class="dashboard-wallet"><figure><small>Tài chính</small><h2>Ví thanh khoản</h2></figure></section><aside class="dashboard-kpis"><figure><strong>Chỉ số đa sắc</strong><span> Cập nhật theo dữ liệu tài khoản</span></figure></aside><footer class="dashboard-orders"><figure><strong>Luồng đơn hàng</strong><a href="/orders"> Xem chi tiết →</a></figure></footer>`,
    );

export const renderOceanLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="ocean-lighthouse" class="hero ocean-lighthouse',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><blockquote><a href="#services">Hải trình thương hiệu</a><a href="#pricing">Bảng giá</a></blockquote></nav><section class="theme-story"><blockquote><strong>Vượt sóng vươn xa</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></blockquote></section><aside class="theme-offer"><blockquote><h2>Đội hình dịch vụ</h2><p>TikTok · Facebook · Instagram · YouTube</p></blockquote></aside><footer class="theme-cta"><blockquote><a href="/register">Khởi hành ngay →</a></blockquote></footer><div class="container hero-grid">`,
    );
export const renderOceanAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="ocean-secure-harbor" class="auth ocean-secure-harbor',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><blockquote>Cổng an toàn</blockquote></nav><section class="auth-visual"><blockquote><h1>Hải đăng dẫn lối</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></blockquote></section><aside class="auth-form-region"><blockquote><h2>Xác thực bảo mật</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></blockquote></aside><footer class="auth-assurance"><blockquote>Neo giữ niềm tin</blockquote></footer>`,
    );
export const renderOceanCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="ocean-operations" class="customer ocean-operations',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><blockquote>Boong điều hành</blockquote></nav><section class="dashboard-wallet"><blockquote><small>Tài chính</small><h2>Nguồn lực tài chính</h2></blockquote></section><aside class="dashboard-kpis"><blockquote><strong>Tuyến dịch vụ</strong><span> Cập nhật theo dữ liệu tài khoản</span></blockquote></aside><footer class="dashboard-orders"><blockquote><strong>Danh sách hành trình</strong><a href="/orders"> Xem chi tiết →</a></blockquote></footer>`,
    );

export const renderCreatorLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="creator-collage" class="hero creator-collage',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><mark><a href="#services">Creator hub</a><a href="#pricing">Bảng giá</a></mark></nav><section class="theme-story"><mark><strong>Tạo nội dung, kết nối, chuyển đổi</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></mark></section><aside class="theme-offer"><mark><h2>Kênh tăng trưởng</h2><p>TikTok · Facebook · Instagram · YouTube</p></mark></aside><footer class="theme-cta"><mark><a href="/register">Bắt đầu viral →</a></mark></footer><div class="container hero-grid">`,
    );
export const renderCreatorAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="creator-studio" class="auth creator-studio',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><mark>Studio pass</mark></nav><section class="auth-visual"><mark><h1>Không gian sáng tạo</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></mark></section><aside class="auth-form-region"><mark><h2>Đăng nhập creator</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></mark></aside><footer class="auth-assurance"><mark>Cộng đồng đồng hành</mark></footer>`,
    );
export const renderCreatorCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="creator-performance" class="customer creator-performance',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><mark>Creator menu</mark></nav><section class="dashboard-wallet"><mark><small>Tài chính</small><h2>Thu nhập khả dụng</h2></mark></section><aside class="dashboard-kpis"><mark><strong>Hiệu suất nội dung</strong><span> Cập nhật theo dữ liệu tài khoản</span></mark></aside><footer class="dashboard-orders"><mark><strong>Chiến dịch đang chạy</strong><a href="/orders"> Xem chi tiết →</a></mark></footer>`,
    );

export const renderBrutalistLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="brutalist-poster" class="hero brutalist-poster',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><hgroup><a href="#services">Mục lục 01</a><a href="#pricing">Bảng giá</a></hgroup></nav><section class="theme-story"><hgroup><strong>Ý tưởng lớn xây thương hiệu</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></hgroup></section><aside class="theme-offer"><hgroup><h2>Khối dịch vụ</h2><p>TikTok · Facebook · Instagram · YouTube</p></hgroup></aside><footer class="theme-cta"><hgroup><a href="/register">Hành động ngay →</a></hgroup></footer><div class="container hero-grid">`,
    );
export const renderBrutalistAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="brutalist-sheet" class="auth brutalist-sheet',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><hgroup>Issue 01 / Access</hgroup></nav><section class="auth-visual"><hgroup><h1>Tuyên ngôn tăng trưởng</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></hgroup></section><aside class="auth-form-region"><hgroup><h2>Biểu mẫu truy cập</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></hgroup></aside><footer class="auth-assurance"><hgroup>Bản quyền bảo mật</hgroup></footer>`,
    );
export const renderBrutalistCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="brutalist-newsroom" class="customer brutalist-newsroom',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><hgroup>Index / Menu</hgroup></nav><section class="dashboard-wallet"><hgroup><small>Tài chính</small><h2>Sổ cái tài khoản</h2></hgroup></section><aside class="dashboard-kpis"><hgroup><strong>Headline metrics</strong><span> Cập nhật theo dữ liệu tài khoản</span></hgroup></aside><footer class="dashboard-orders"><hgroup><strong>Order grid</strong><a href="/orders"> Xem chi tiết →</a></hgroup></footer>`,
    );

export const renderAiLanding: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="hero',
      'data-renderer="ai-neural-orbit" class="hero ai-neural-orbit',
    )
    .replace(
      '<div class="container hero-grid">',
      `<nav class="theme-navigation"><output><a href="#services">AI command</a><a href="#pricing">Bảng giá</a></output></nav><section class="theme-story"><output><strong>Tăng trưởng bằng sức mạnh AI</strong><p>Giải pháp được thiết kế riêng cho ngôn ngữ hình ảnh của giao diện này.</p></output></section><aside class="theme-offer"><output><h2>Mô-đun thông minh</h2><p>TikTok · Facebook · Instagram · YouTube</p></output></aside><footer class="theme-cta"><output><a href="/register">Kích hoạt AI →</a></output></footer><div class="container hero-grid">`,
    );
export const renderAiAuth: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="auth',
      'data-renderer="ai-cognitive-gateway" class="auth ai-cognitive-gateway',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="auth-navigation"><output>Neural access</output></nav><section class="auth-visual"><output><h1>Trợ lý AI trực tuyến</h1><p>Tiếp tục hành trình phát triển thương hiệu cùng DichVu1st.</p></output></section><aside class="auth-form-region"><output><h2>Xác thực thông minh</h2><p>Email và mật khẩu được truyền qua phiên bảo mật.</p></output></aside><footer class="auth-assurance"><output>Agent bảo vệ 24/7</output></footer>`,
    );
export const renderAiCustomer: ReferenceRenderer = (html) =>
  html
    .replace(
      'class="customer',
      'data-renderer="ai-intelligence" class="customer ai-intelligence',
    )
    .replace(
      /(data-renderer="[^"]+" class="[^"]+">)/,
      `$1<nav class="dashboard-navigation"><output>Agent console</output></nav><section class="dashboard-wallet"><output><small>Tài chính</small><h2>Ví được phân tích</h2></output></section><aside class="dashboard-kpis"><output><strong>Dự báo tăng trưởng</strong><span> Cập nhật theo dữ liệu tài khoản</span></output></aside><footer class="dashboard-orders"><output><strong>Đơn hàng tự động</strong><a href="/orders"> Xem chi tiết →</a></output></footer>`,
    );

export const referenceRenderers: Record<
  string,
  Record<ReferenceScope, ReferenceRenderer>
> = {
  BEIGE_EDITORIAL: {
    landing: renderSoftBeigeLanding,
    auth: renderSoftBeigeAuth,
    customer: renderSoftBeigeCustomer,
  },
  ZEN_JAPANESE: {
    landing: renderJapaneseZenLanding,
    auth: renderJapaneseZenAuth,
    customer: renderJapaneseZenCustomer,
  },
  BLACK_GOLD_LUXURY: {
    landing: renderDarkLuxuryLanding,
    auth: renderDarkLuxuryAuth,
    customer: renderDarkLuxuryCustomer,
  },
  BLUE_BUSINESS: {
    landing: renderPremiumCorporateLanding,
    auth: renderPremiumCorporateAuth,
    customer: renderPremiumCorporateCustomer,
  },
  CYBER_NEON_CITY: {
    landing: renderCyberNeonLanding,
    auth: renderCyberNeonAuth,
    customer: renderCyberNeonCustomer,
  },
  PRISM_GLASS: {
    landing: renderGlassLanding,
    auth: renderGlassAuth,
    customer: renderGlassCustomer,
  },
  OCEAN_PREMIUM: {
    landing: renderOceanLanding,
    auth: renderOceanAuth,
    customer: renderOceanCustomer,
  },
  CREATOR_POP: {
    landing: renderCreatorLanding,
    auth: renderCreatorAuth,
    customer: renderCreatorCustomer,
  },
  URBAN_LIME_BRUTAL: {
    landing: renderBrutalistLanding,
    auth: renderBrutalistAuth,
    customer: renderBrutalistCustomer,
  },
  AI_COSMIC_FUTURE: {
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
