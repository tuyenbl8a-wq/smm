import {
  nav,
  intro,
  art,
  platforms,
  assurances,
  benefits,
  end,
  identity,
  slot,
  shortcuts,
  customerSide,
  overviewHeading,
  type ReferencePages,
} from "./reference-primitives.js";
export const prismGlassPages: ReferencePages = {
  landing: `<main class="ref-page prism-landing" data-reference-page><div class="prism-stage">${nav}<section class="prism-hero"><div class="prism-message">${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "MORE THAN SERVICE", "prism")}${platforms}</div><figure>${art("prism-glass", "Vương miện và số một bằng pha lê giữa thành phố trên mây")}</figure><aside class="prism-float">Mỗi kết nối<br>mở một cơ hội ✧</aside></section><div class="prism-stat-shelf">${assurances}</div></div><div class="prism-lower">${benefits}${slot("pricing")}</div>${end}</main>`,
  auth: `<main class="ref-auth prism-auth" data-reference-page><div class="prism-environment">${art("prism-glass", "Không gian pha lê ngập ánh sáng")}</div><header>${identity}<a href="/">← Về trang chủ</a></header><section class="prism-auth-island"><div class="prism-auth-card">${slot("form")}</div><aside><span>✧</span><h1>Mỗi thương hiệu<br>đều có một<br>tương lai rạng rỡ.</h1><p>Growth creates opportunities.</p></aside></section></main>`,
  customer: `<div class="ref-customer prism-customer" data-reference-page><div class="prism-shell">${slot("topbar")}<div class="prism-body"><aside class="prism-menu">${customerSide}</aside><section class="prism-content-glass">${slot("content")}</section></div></div></div>`,
  overview: `<div class="prism-overview"><div class="prism-welcome">${overviewHeading}${shortcuts}</div><section class="prism-metric-shelf">${slot("metrics")}</section><div class="prism-panes"><article>${slot("orders")}</article><div>${slot("chart")}${slot("transactions")}${slot("notifications")}</div></div></div>`,
};
