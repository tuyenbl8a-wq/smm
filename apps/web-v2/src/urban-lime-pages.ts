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
export const urbanLimePages: ReferencePages = {
  landing: `<main class="ref-page urban-landing" data-reference-page><div class="urban-masthead"><span>VIETNAM / SOCIAL PLATFORM</span><b>MORE THAN SERVICE ↗</b></div>${nav}<section class="urban-poster"><div>${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "CHIẾN LƯỢC / DỊCH VỤ / CON NGƯỜI", "urban")}${assurances}</div><figure>${art("urban-lime", "Khối kiến trúc bê tông với mảng lime")}<figcaption>IDEAS<br>GROW<br>BRANDS.</figcaption></figure></section>${platforms}<div class="urban-service-grid"><aside>DỊCH VỤ<br>CHO MỌI<br>NHU CẦU ↗</aside>${benefits}</div>${slot("pricing")}${end}</main>`,
  auth: `<main class="ref-auth urban-auth" data-reference-page><aside><span>SOCIAL / FASTER / TOGETHER</span><h1>IDEAS.<br>GROW.<br>BRANDS.</h1>${art("urban-lime", "Kiến trúc bê tông mạnh mẽ")}<a href="/">← Trang chủ</a></aside><section><header>${identity}<b>MEMBER ACCESS / →</b></header>${slot("form")}<footer>Thương hiệu hôm nay. Giá trị ngày mai.</footer></section></main>`,
  customer: `<div class="ref-customer urban-customer" data-reference-page><header class="urban-command">${slot("topbar")}</header><div class="urban-console"><aside>${customerSide}</aside><section><div class="urban-section-label">WORKSPACE / OPERATIONS</div>${slot("content")}</section></div></div>`,
  overview: `<div class="urban-overview"><section class="urban-summary">${overviewHeading}${slot("metrics")}</section><div class="urban-operations"><article>${slot("orders")}</article><aside>${slot("chart")}${slot("transactions")}${slot("notifications")}</aside></div><footer>${shortcuts}</footer></div>`,
};
