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
export const blackGoldPages: ReferencePages = {
  landing: `<main class="ref-page gold-landing" data-reference-page><div class="gold-masthead">${identity}<p>KẾT NỐI THƯƠNG HIỆU<br>VƯƠN TẦM GIÁ TRỊ</p><span>More<br>Than Service</span></div><div class="gold-monument">${nav}<section>${art("black-gold", "Tượng đài đá đen với vương miện vàng dưới ánh sáng điện ảnh")}<article>${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "GIÁ TRỊ THẬT · TẦM NHÌN DÀI HẠN", "gold")}${assurances}</article></section>${platforms}</div><section class="gold-promises">${benefits}</section>${slot("pricing")}<div class="gold-signature">${end}</div></main>`,
  auth: `<main class="ref-auth gold-auth" data-reference-page><div class="gold-suite"><section><header>${identity}<div class="gold-rule"></div></header>${slot("form")}<a class="gold-return" href="/">← Về trang chủ</a></section><div class="gold-auth-monument">${art("black-gold", "Vương miện vàng trên tượng đài đen")}<aside><p>Mỗi thương hiệu<br>đều có một<br>tương lai rạng rỡ.</p><span>MORE THAN SERVICE</span></aside></div></div></main>`,
  customer: `<div class="ref-customer gold-customer" data-reference-page><header class="gold-customer-crown">${identity}<span>KHÔNG GIAN THƯƠNG HIỆU</span></header><div class="gold-customer-frame"><aside class="gold-private-nav">${customerSide}</aside><div class="gold-workspace">${slot("topbar")}${slot("content")}</div></div></div>`,
  overview: `<div class="gold-overview"><div class="gold-summary-title">${overviewHeading}</div><div class="gold-financial-strip">${slot("metrics")}</div><section class="gold-account-grid"><article>${slot("orders")}${slot("transactions")}</article><aside class="gold-concierge">${slot("chart")}<h2>Quản lý tài khoản</h2>${shortcuts}<div>${slot("notifications")}</div></aside></section></div>`,
};
