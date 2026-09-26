import {
  nav,
  intro,
  art,
  platforms,
  assurances,
  end,
  identity,
  slot,
  shortcuts,
  customerSide,
  overviewHeading,
  type ReferencePages,
} from "./reference-primitives.js";
export const beigeEditorialPages: ReferencePages = {
  landing: `<main class="ref-page beige-landing" data-reference-page><header class="beige-masthead">${identity}<p>THƯƠNG HIỆU HÔM NAY<br>GIÁ TRỊ NGÀY MAI</p><i>More than<br>services</i></header>${nav}<section class="beige-cover"><div class="beige-cover-copy">${intro("Phát triển thương hiệu vững vàng trên", "mạng xã hội", "DỊCH VỤ MARKETING MẠNG XÃ HỘI", "beige")}${assurances}<p class="beige-handnote">Good brands create<br>a better tomorrow.</p></div><figure>${art("beige-editorial", "Không gian kiến trúc đá sáng và người phụ nữ trong bộ suit ngà")}<figcaption>CHIẾN LƯỢC<br>NỘI DUNG<br>TƯƠNG TÁC<br>GIÁ TRỊ</figcaption></figure></section><section id="services" class="beige-index"><header><span>DỊCH VỤ NỔI BẬT</span><a href="#pricing">Xem toàn bộ danh mục ↗</a></header>${platforms}<div class="beige-editor-note"><p>Mỗi thương hiệu có một câu chuyện.</p><span>Chọn dịch vụ phù hợp và viết tiếp hành trình của bạn.</span></div></section>${slot("pricing")}${end}</main>`,
  auth: `<main class="ref-auth beige-auth" data-reference-page><div class="beige-auth-layout"><header>${identity}<p>PEOPLE · BRANDS · GROW TOGETHER</p></header><section class="beige-member">${slot("form")}<a href="/">← Khám phá trang chủ</a></section><figure>${art("beige-editorial", "Ánh nắng trong không gian editorial màu ngà")}<figcaption>Thương hiệu<br>vượt thời gian.</figcaption></figure><footer><span>MORE THAN SERVICES</span><a href="/help">Liên hệ hỗ trợ ↗</a></footer></div></main>`,
  customer: `<div class="ref-customer beige-customer" data-reference-page><div class="beige-workbook"><aside class="beige-contents"><header><small>THE WORKSPACE</small></header>${customerSide}</aside><div class="beige-main"><div class="beige-topline">${slot("topbar")}</div><section class="beige-pages">${slot("content")}</section></div></div></div>`,
  overview: `<div class="beige-overview"><div class="beige-opening"><section>${overviewHeading}</section><aside><small>THƯƠNG HIỆU CỦA BẠN</small><p>Từng tương tác.<br>Từng bước tiến.</p></aside></div><div class="beige-metrics-column">${slot("metrics")}<section>${slot("orders")}</section></div><div class="beige-journal"><article>${slot("transactions")}</article><aside>${slot("chart")}${shortcuts}${slot("notifications")}</aside></div></div>`,
};
