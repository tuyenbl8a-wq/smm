export type ReferenceScope = "landing" | "auth" | "customer";
export type ReferenceRenderer = (html: string) => string;

type ThemeScreens = Record<
  ReferenceScope,
  { renderer: string; regions: string }
>;

const brand = `<span data-theme-content="brandTitle">Thương hiệu của bạn</span>`;
const tagline = `<span data-theme-content="tagline">Nền tảng tăng trưởng mạng xã hội</span>`;
const themedScreens: Record<string, ThemeScreens> = {
  AI_COSMIC_FUTURE: {
    landing: {
      renderer: "ai-cosmic-orbit",
      regions: `<nav class="theme-navigation ai-orbit-nav"><output>${brand}<span>01 / AI NETWORK</span><a href="#services">Mô-đun</a></output></nav><section class="theme-story ai-neural-core"><output><small>INTELLIGENCE ONLINE</small><strong data-theme-content="heroTitle">Tăng trưởng bằng sức mạnh AI</strong><p data-theme-content="heroSubtitle">Phân tích tín hiệu, tối ưu chiến dịch và mở rộng cộng đồng.</p><i class="neural-orbit" aria-hidden="true"></i></output></section><aside class="theme-offer ai-signal-panel"><output><small>LIVE SIGNAL</small><b>98.7%</b><span>Độ chính xác dự báo</span></output></aside><footer class="theme-cta ai-command-strip"><output>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Kích hoạt AI</span> →</a></output></footer>`,
    },
    auth: {
      renderer: "ai-cognitive-gateway",
      regions: `<nav class="auth-navigation ai-auth-status"><output>${brand}<span>NEURAL ACCESS / 01</span></output></nav><section class="auth-visual ai-identity-orbit"><output><small>IDENTITY LAYER</small><h1>Truy cập hệ thống AI</h1><i class="neural-orbit" aria-hidden="true"></i></output></section><aside class="auth-form-region ai-auth-guide"><output><b>Xác thực thông minh</b><span>Phiên truy cập được bảo vệ liên tục.</span></output></aside><footer class="auth-assurance ai-auth-foot"><output>AI GUARD · ONLINE · 24/7</output></footer>`,
    },
    customer: {
      renderer: "ai-intelligence-console",
      regions: `<nav class="dashboard-navigation ai-console-nav"><output><span>AI</span><b>Agent console</b><small>ONLINE</small></output></nav><section class="dashboard-wallet ai-prediction"><output><small>DỰ BÁO</small><h2>Đà tăng trưởng</h2><b>+24.8%</b></output></section><aside class="dashboard-kpis ai-model-stack"><output><span>01 Reach model</span><span>02 Order signal</span><span>03 Risk monitor</span></output></aside><footer class="dashboard-orders ai-queue"><output><b>AI operation queue</b><a href="/orders">Mở hàng đợi →</a></output></footer>`,
    },
  },
  CREATOR_POP: {
    landing: {
      renderer: "creator-pop-collage",
      regions: `<nav class="theme-navigation creator-ticker"><mark>${brand}</mark><span>#CREATE&nbsp;&nbsp;#SHARE&nbsp;&nbsp;#GROW</span></nav><section class="theme-story creator-cutout"><mark><small>TRENDING NOW ✦</small><strong data-theme-content="heroTitle">Biến ý tưởng thành xu hướng</strong><p data-theme-content="heroSubtitle">Công cụ tăng trưởng dành cho thế hệ sáng tạo.</p></mark><i class="creator-sticker">LIKE!</i><i class="creator-sticker">WOW</i></section><aside class="theme-offer creator-social-card"><mark><b>@yourbrand</b><span>12.8M views</span><span>↗ 48% tuần này</span></mark></aside><footer class="theme-cta creator-swipe"><mark>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Bắt đầu sáng tạo</span> ↗</a></mark></footer>`,
    },
    auth: {
      renderer: "creator-studio-pass",
      regions: `<nav class="auth-navigation creator-auth-nav"><mark>${brand} ✦ STUDIO PASS</mark></nav><section class="auth-visual creator-auth-poster"><mark><small>HELLO CREATOR!</small><h1>Trở lại studio</h1><i>★</i><i>♥</i></mark></section><aside class="auth-form-region creator-auth-note"><mark><b>Đăng nhập & bắt đầu</b><span>Nội dung tuyệt vời đang chờ bạn.</span></mark></aside><footer class="auth-assurance creator-auth-foot"><mark>#CREATORS_GROW_TOGETHER</mark></footer>`,
    },
    customer: {
      renderer: "creator-performance-studio",
      regions: `<nav class="dashboard-navigation creator-ribbon"><mark>CREATOR<br>HUB</mark></nav><section class="dashboard-wallet creator-score"><mark><small>CREATOR SCORE</small><h2>Đang lên xu hướng</h2><b>9.4</b></mark></section><aside class="dashboard-kpis creator-channel-cards"><mark><span>TikTok ↗</span><span>Instagram ↗</span><span>YouTube ↗</span></mark></aside><footer class="dashboard-orders creator-campaigns"><mark><b>Chiến dịch của bạn</b><a href="/orders">Xem tất cả →</a></mark></footer>`,
    },
  },
  URBAN_LIME_BRUTAL: {
    landing: {
      renderer: "urban-lime-poster",
      regions: `<nav class="theme-navigation brutal-index"><hgroup><b>INDEX / 001</b>${brand}<a href="#services">SERVICES ↓</a></hgroup></nav><section class="theme-story brutal-manifesto"><hgroup><small>NO BORING GROWTH</small><strong data-theme-content="heroTitle">Ý TƯỞNG LỚN.<br>THƯƠNG HIỆU LỚN.</strong><p data-theme-content="heroSubtitle">TỐC ĐỘ. MINH BẠCH. HIỆU QUẢ.</p></hgroup></section><aside class="theme-offer brutal-stamp"><hgroup><b>24/7</b><span>GROWTH<br>DEPARTMENT</span></hgroup></aside><footer class="theme-cta brutal-marquee"><hgroup>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">HÀNH ĐỘNG NGAY</span> →</a></hgroup></footer>`,
    },
    auth: {
      renderer: "urban-access-sheet",
      regions: `<nav class="auth-navigation brutal-auth-index"><hgroup>FORM / 001 — ${brand}</hgroup></nav><section class="auth-visual brutal-auth-title"><hgroup><small>AUTHORIZED USERS ONLY</small><h1>ĐĂNG<br>NHẬP.</h1></hgroup></section><aside class="auth-form-region brutal-auth-rule"><hgroup><b>NHẬP THÔNG TIN →</b><span>KHÔNG RƯỜM RÀ. KHÔNG CHỜ ĐỢI.</span></hgroup></aside><footer class="auth-assurance brutal-auth-foot"><hgroup>SECURE SESSION © 2026</hgroup></footer>`,
    },
    customer: {
      renderer: "urban-data-newsroom",
      regions: `<nav class="dashboard-navigation brutal-dashboard-index"><hgroup>01<br>DATA<br>DESK</hgroup></nav><section class="dashboard-wallet brutal-ledger"><hgroup><small>BALANCE / LIVE</small><h2>SỔ CÁI</h2><b>READY</b></hgroup></section><aside class="dashboard-kpis brutal-metrics"><hgroup><span>ORDERS / 01</span><span>REACH / 02</span><span>SPEED / 03</span></hgroup></aside><footer class="dashboard-orders brutal-orders"><hgroup><b>ORDER GRID</b><a href="/orders">OPEN →</a></hgroup></footer>`,
    },
  },
  CYBER_NEON_CITY: {
    landing: {
      renderer: "cyber-neon-metropolis",
      regions: `<nav class="theme-navigation cyber-city-nav"><code>${brand}<span>DISTRICT 07</span><a href="#services">ENTER GRID</a></code></nav><section class="theme-story cyber-skyline"><code><small>NEON NETWORK // ONLINE</small><strong data-theme-content="heroTitle">Thành phố không ngủ.<br>Thương hiệu không dừng.</strong><p data-theme-content="heroSubtitle">Kết nối chiến dịch với nhịp đập của thế giới số.</p><i class="city-grid" aria-hidden="true"></i></code></section><aside class="theme-offer cyber-billboard"><code><small>LIVE / 23:59</small><b>+128K</b><span>SOCIAL PULSE</span></code></aside><footer class="theme-cta cyber-transit"><code>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Vào thành phố</span> ↗</a></code></footer>`,
    },
    auth: {
      renderer: "cyber-identity-portal",
      regions: `<nav class="auth-navigation cyber-auth-nav"><code>${brand} // ID GATE</code></nav><section class="auth-visual cyber-auth-city"><code><small>SECTOR 09</small><h1>Identity<br>portal</h1><i class="city-grid"></i></code></section><aside class="auth-form-region cyber-auth-status"><code><b>ACCESS REQUEST</b><span>Encrypted city network</span></code></aside><footer class="auth-assurance cyber-auth-foot"><code>CYAN LINE ━━━ MAGENTA LINE</code></footer>`,
    },
    customer: {
      renderer: "cyber-city-telemetry",
      regions: `<nav class="dashboard-navigation cyber-rail"><code>NEON<br>OPS<br>07</code></nav><section class="dashboard-wallet cyber-telemetry"><code><small>LIVE TELEMETRY</small><h2>Network pulse</h2><b>99.98%</b></code></section><aside class="dashboard-kpis cyber-districts"><code><span>SHIBUYA / ACTIVE</span><span>SEOUL / ACTIVE</span><span>SAIGON / ACTIVE</span></code></aside><footer class="dashboard-orders cyber-mission"><code><b>MISSION QUEUE</b><a href="/orders">EXECUTE →</a></code></footer>`,
    },
  },
  PRISM_GLASS: {
    landing: {
      renderer: "prism-glass-atrium",
      regions: `<nav class="theme-navigation prism-floating-nav"><figure>${brand}<span>PRISM / 01</span><a href="#services">Khám phá</a></figure></nav><section class="theme-story prism-glass-hero"><figure><small>LIGHT. COLOR. GROWTH.</small><strong data-theme-content="heroTitle">Tăng trưởng qua một lăng kính mới</strong><p data-theme-content="heroSubtitle">Trải nghiệm trong suốt, linh hoạt và đầy chiều sâu.</p><i class="prism-sphere"></i></figure></section><aside class="theme-offer prism-layer-card"><figure><small>REFRACTION</small><b>∞</b><span>Khả năng mở rộng</span></figure></aside><footer class="theme-cta prism-dock"><figure>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Mở không gian</span> →</a></figure></footer>`,
    },
    auth: {
      renderer: "prism-crystal-suite",
      regions: `<nav class="auth-navigation prism-auth-nav"><figure>${brand}<span>Private layer</span></figure></nav><section class="auth-visual prism-auth-orb"><figure><small>WELCOME THROUGH</small><h1>Không gian<br>trong suốt</h1><i class="prism-sphere"></i></figure></section><aside class="auth-form-region prism-auth-card"><figure><b>Crystal access</b><span>Đăng nhập vào lớp làm việc riêng.</span></figure></aside><footer class="auth-assurance prism-auth-foot"><figure>PRIVACY · CLARITY · CONTROL</figure></footer>`,
    },
    customer: {
      renderer: "prism-luminous-workspace",
      regions: `<nav class="dashboard-navigation prism-dock-nav"><figure>◇<br>PRISM DOCK</figure></nav><section class="dashboard-wallet prism-wallet"><figure><small>AVAILABLE LIGHT</small><h2>Không gian tài chính</h2><b>READY</b></figure></section><aside class="dashboard-kpis prism-floating-stack"><figure><span>Reach</span><span>Orders</span><span>Velocity</span></figure></aside><footer class="dashboard-orders prism-flow"><figure><b>Luồng đơn hàng</b><a href="/orders">Mở workspace →</a></figure></footer>`,
    },
  },
  OCEAN_PREMIUM: {
    landing: {
      renderer: "ocean-premium-horizon",
      regions: `<nav class="theme-navigation ocean-deck-nav"><blockquote>${brand}<span>OCEAN STANDARD</span><a href="#services">Dịch vụ</a></blockquote></nav><section class="theme-story ocean-horizon"><blockquote><small>CONFIDENCE AT SCALE</small><strong data-theme-content="heroTitle">Vững tay lái.<br>Vươn xa hơn.</strong><p data-theme-content="heroSubtitle">Hạ tầng tăng trưởng chuyên nghiệp cho hành trình dài hạn.</p><i class="ocean-wave"></i></blockquote></section><aside class="theme-offer ocean-coordinate"><blockquote><small>10°46′N 106°41′E</small><b>24/7</b><span>Điều hành liên tục</span></blockquote></aside><footer class="theme-cta ocean-route"><blockquote>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Khởi hành</span> →</a></blockquote></footer>`,
    },
    auth: {
      renderer: "ocean-secure-harbor",
      regions: `<nav class="auth-navigation ocean-auth-nav"><blockquote>${brand}<span>SECURE HARBOR</span></blockquote></nav><section class="auth-visual ocean-auth-horizon"><blockquote><small>WELCOME ABOARD</small><h1>Trở về<br>bến an toàn</h1><i class="ocean-wave"></i></blockquote></section><aside class="auth-form-region ocean-auth-guide"><blockquote><b>Member access</b><span>Phiên truy cập được mã hóa.</span></blockquote></aside><footer class="auth-assurance ocean-auth-foot"><blockquote>PROFESSIONAL · RELIABLE · ALWAYS ON</blockquote></footer>`,
    },
    customer: {
      renderer: "ocean-command-dashboard",
      regions: `<nav class="dashboard-navigation ocean-rail"><blockquote>OCEAN<br>COMMAND</blockquote></nav><section class="dashboard-wallet ocean-position"><blockquote><small>CURRENT POSITION</small><h2>Hành trình tăng trưởng</h2><b>ON COURSE</b></blockquote></section><aside class="dashboard-kpis ocean-instruments"><blockquote><span>Speed 24 kn</span><span>Reach 82%</span><span>Orders 128</span></blockquote></aside><footer class="dashboard-orders ocean-log"><blockquote><b>Nhật ký hành trình</b><a href="/orders">Xem chi tiết →</a></blockquote></footer>`,
    },
  },
  BLUE_BUSINESS: {
    landing: {
      renderer: "blue-business-report",
      regions: `<nav class="theme-navigation business-nav"><div>${brand}<span>GIẢI PHÁP</span><a href="#services">Năng lực</a><a href="#pricing">Bảng giá</a></div></nav><section class="theme-story business-lead"><div><small>ĐỐI TÁC TĂNG TRƯỞNG</small><strong data-theme-content="heroTitle">Hiệu suất rõ ràng.<br>Kết quả đáng tin cậy.</strong><p data-theme-content="heroSubtitle">Một nền tảng vận hành có cấu trúc cho doanh nghiệp hiện đại.</p></div></section><aside class="theme-offer business-proof"><div><small>HIỆU SUẤT QUÝ NÀY</small><b>+32%</b><span>Tăng trưởng ổn định</span></div></aside><footer class="theme-cta business-actions"><div>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Nhận tư vấn</span> →</a></div></footer>`,
    },
    auth: {
      renderer: "blue-business-trust",
      regions: `<nav class="auth-navigation business-auth-nav"><div>${brand}<span>BUSINESS PORTAL</span></div></nav><section class="auth-visual business-auth-proof"><div><small>TRUSTED OPERATIONS</small><h1>Chào mừng<br>trở lại</h1><p>Quản trị tập trung. Dữ liệu minh bạch.</p></div></section><aside class="auth-form-region business-auth-guide"><div><b>Đăng nhập doanh nghiệp</b><span>Hỗ trợ bảo mật nhiều lớp.</span></div></aside><footer class="auth-assurance business-auth-foot"><div>SECURE · COMPLIANT · RELIABLE</div></footer>`,
    },
    customer: {
      renderer: "blue-business-kpi-board",
      regions: `<nav class="dashboard-navigation business-rail"><div>EXECUTIVE<br>BOARD</div></nav><section class="dashboard-wallet business-summary"><div><small>TỔNG QUAN</small><h2>Hiệu suất kinh doanh</h2><b>Q3 / 2026</b></div></section><aside class="dashboard-kpis business-kpi-strip"><div><span>REACH ↗</span><span>ORDERS ↗</span><span>ROI ↗</span></div></aside><footer class="dashboard-orders business-table-link"><div><b>Báo cáo đơn hàng</b><a href="/orders">Xem báo cáo →</a></div></footer>`,
    },
  },
  ZEN_JAPANESE: {
    landing: {
      renderer: "zen-japanese-pavilion",
      regions: `<nav class="theme-navigation zen-nav"><div><span class="zen-seal">静</span>${brand}<a href="#services">Dịch vụ</a><a href="#pricing">Bảng giá</a></div></nav><section class="theme-story zen-ink-story"><div><small>静けさの中で成長する</small><strong data-theme-content="heroTitle">Tăng trưởng<br>trong tĩnh tại.</strong><p data-theme-content="heroSubtitle">Tinh giản từng bước. Bền vững từng kết quả.</p><i class="zen-sun"></i></div></section><aside class="theme-offer zen-note"><div><b>間</b><span>Khoảng thở tạo nên cân bằng.</span></div></aside><footer class="theme-cta zen-path"><div>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Bắt đầu hành trình</span> →</a></div></footer>`,
    },
    auth: {
      renderer: "zen-shoji-retreat",
      regions: `<nav class="auth-navigation zen-auth-nav"><div><span class="zen-seal">静</span>${brand}</div></nav><section class="auth-visual zen-auth-garden"><div><small>おかえりなさい</small><h1>Trở về<br>tĩnh tại.</h1><i class="zen-sun"></i></div></section><aside class="auth-form-region zen-auth-guide"><div><b>Cổng thành viên</b><span>Đăng nhập nhẹ nhàng và an toàn.</span></div></aside><footer class="auth-assurance zen-auth-foot"><div>信頼 · AN TÂM ĐỒNG HÀNH</div></footer>`,
    },
    customer: {
      renderer: "zen-quiet-ledger",
      regions: `<nav class="dashboard-navigation zen-rail"><div><span class="zen-seal">静</span><b>Mục lục</b></div></nav><section class="dashboard-wallet zen-balance"><div><small>CÂN BẰNG</small><h2>Dòng chảy tài chính</h2><b>穏</b></div></section><aside class="dashboard-kpis zen-stones"><div><span>Đơn hàng</span><span>Tăng trưởng</span><span>Hỗ trợ</span></div></aside><footer class="dashboard-orders zen-journal"><div><b>Nhật ký vận hành</b><a href="/orders">Mở nhật ký →</a></div></footer>`,
    },
  },
  BLACK_GOLD_LUXURY: {
    landing: {
      renderer: "black-gold-editorial",
      regions: `<nav class="theme-navigation luxury-nav"><header><span>EST. 2026</span>${brand}<a href="#services">COLLECTION</a></header></nav><section class="theme-story luxury-monument"><header><small>THE PRIVATE STANDARD</small><strong data-theme-content="heroTitle">Dấu ấn của<br>sự khác biệt.</strong><p data-theme-content="heroSubtitle">Dịch vụ đặc tuyển cho những thương hiệu dẫn đầu.</p><i class="gold-crown">♛</i></header></section><aside class="theme-offer luxury-edition"><header><small>EDITION</small><b>01</b><span>Private growth suite</span></header></aside><footer class="theme-cta luxury-concierge"><header>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Gia nhập đặc quyền</span> →</a></header></footer>`,
    },
    auth: {
      renderer: "black-gold-private-suite",
      regions: `<nav class="auth-navigation luxury-auth-nav"><header>${brand}<span>PRIVATE ACCESS</span></header></nav><section class="auth-visual luxury-auth-monogram"><header><small>WELCOME BACK</small><h1>Thành viên<br>đặc quyền.</h1><i class="gold-crown">♛</i></header></section><aside class="auth-form-region luxury-auth-guide"><header><b>Private suite</b><span>Xác thực dành riêng cho hội viên.</span></header></aside><footer class="auth-assurance luxury-auth-foot"><header>CONFIDENTIAL · CONCIERGE 24/7</header></footer>`,
    },
    customer: {
      renderer: "black-gold-executive",
      regions: `<nav class="dashboard-navigation luxury-rail"><header>♛<br>PRIVATE<br>DESK</header></nav><section class="dashboard-wallet luxury-portfolio"><header><small>PORTFOLIO</small><h2>Tài sản khả dụng</h2><b>MEMBER 01</b></header></section><aside class="dashboard-kpis luxury-metrics"><header><span>Influence</span><span>Prestige</span><span>Velocity</span></header></aside><footer class="dashboard-orders luxury-vault"><header><b>Order vault</b><a href="/orders">Open vault →</a></header></footer>`,
    },
  },
  BEIGE_EDITORIAL: {
    landing: {
      renderer: "beige-editorial-magazine",
      regions: `<nav class="theme-navigation editorial-masthead"><article><span>VOL. 01 / 2026</span>${brand}<a href="#services">THE EDIT</a></article></nav><section class="theme-story editorial-cover"><article><small>THE GROWTH ISSUE</small><strong data-theme-content="heroTitle">Một cách tinh tế<br>để được nhìn thấy.</strong><p data-theme-content="heroSubtitle">Chiến lược tăng trưởng được biên tập dành riêng cho thương hiệu của bạn.</p><i>01</i></article></section><aside class="theme-offer editorial-caption"><article><b>PROFILE</b><span>Ideas, influence & considered growth.</span></article></aside><footer class="theme-cta editorial-folio"><article>${tagline}<a data-theme-href="primaryCtaUrl" href="/register"><span data-theme-content="primaryCta">Khám phá ấn bản</span> →</a></article></footer>`,
    },
    auth: {
      renderer: "beige-editorial-hospitality",
      regions: `<nav class="auth-navigation editorial-auth-nav"><article>${brand}<span>MEMBERS / 01</span></article></nav><section class="auth-visual editorial-auth-cover"><article><small>PRIVATE EDITION</small><h1>Câu chuyện<br>tiếp tục.</h1><i>01</i></article></section><aside class="auth-form-region editorial-auth-note"><article><b>Member sign in</b><span>Truy cập không gian dành riêng cho bạn.</span></article></aside><footer class="auth-assurance editorial-auth-foot"><article>CURATED WITH CARE · 2026</article></footer>`,
    },
    customer: {
      renderer: "beige-editorial-ledger",
      regions: `<nav class="dashboard-navigation editorial-rail"><article>VOL.<br>01<br>DESK</article></nav><section class="dashboard-wallet editorial-opening"><article><small>THE DAILY BRIEF</small><h2>Tổng quan hôm nay</h2><b>SEPTEMBER / 16</b></article></section><aside class="dashboard-kpis editorial-columns"><article><span>01 / Reach</span><span>02 / Orders</span><span>03 / Balance</span></article></aside><footer class="dashboard-orders editorial-index"><article><b>Order index</b><a href="/orders">Turn the page →</a></article></footer>`,
    },
  },
};

const roots: Record<ReferenceScope, string> = {
  landing: "hero",
  auth: "auth",
  customer: "customer",
};
const render =
  (theme: string, scope: ReferenceScope): ReferenceRenderer =>
  (html) => {
    const screen = themedScreens[theme]?.[scope];
    if (!screen) return html;
    return html
      .replace(
        `class="${roots[scope]}`,
        `data-renderer="${screen.renderer}" data-theme-architecture="${theme.toLowerCase()}-${scope}" class="${roots[scope]} ${screen.renderer}`,
      )
      .replace(/(data-renderer="[^"]+"[^>]*>)/, `$1${screen.regions}`);
  };

export const referenceRenderers: Record<
  string,
  Record<ReferenceScope, ReferenceRenderer>
> = Object.fromEntries(
  Object.keys(themedScreens).map((theme) => [
    theme,
    {
      landing: render(theme, "landing"),
      auth: render(theme, "auth"),
      customer: render(theme, "customer"),
    },
  ]),
);

export function runtimeReferenceShells(scope: ReferenceScope) {
  return Object.fromEntries(
    Object.entries(referenceRenderers).map(([theme, renderers]) => [
      theme,
      renderers[scope](`<div class="${roots[scope]}"></div>`),
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

export function isMeaningfulReferenceRender(
  html: string,
  scope: ReferenceScope,
) {
  return scopeRegions[scope].every((className) => {
    const content = new RegExp(
      `<(?:nav|section|aside|footer) class="[^"]*${className}[^"]*">([\\s\\S]*?)<\\/(?:nav|section|aside|footer)>`,
    ).exec(html)?.[1];
    const text = content
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return Boolean(text && text.length >= 8);
  });
}
