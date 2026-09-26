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
export const oceanPremiumPages: ReferencePages = {
  landing: `<main class="ref-page ocean-landing" data-reference-page><header class="ocean-motto"><span>≈</span><p>VƯỢT SÓNG VƯƠN XA<br><small>Kết nối thương hiệu · Kiến tạo giá trị</small></p></header>${nav}<section class="ocean-horizon">${art("ocean-premium", "Hải đăng trên bờ đá và những con sóng xanh")}<div>${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "HÀNH TRÌNH THƯƠNG HIỆU VƯƠN XA", "ocean")}</div></section><section class="ocean-waterline">${assurances}${platforms}</section><div class="ocean-services">${benefits}<aside><b>Small services.<br>Big horizons.</b><a href="/register">Bắt đầu hành trình →</a></aside></div>${slot("pricing")}${end}</main>`,
  auth: `<main class="ref-auth ocean-auth" data-reference-page><section class="ocean-cabin"><header>${identity}<small>HÀNH TRÌNH CỦA BẠN BẮT ĐẦU TẠI ĐÂY</small></header>${slot("form")}<nav><a href="/">← Về trang chủ</a><a href="/help">Cần hỗ trợ?</a></nav></section><aside class="ocean-porthole"><figure>${art("ocean-premium", "Ánh hải đăng dẫn đường trên biển")}</figure><blockquote>Vươn xa hơn.<br>Vững vàng hơn.</blockquote><p>More than service. A brighter tomorrow.</p></aside></main>`,
  customer: `<div class="ref-customer ocean-customer" data-reference-page><aside class="ocean-compass">${customerSide}</aside><div class="ocean-voyage">${slot("topbar")}<div class="ocean-wave-rule" aria-hidden="true"></div><div class="ocean-logbook">${slot("content")}</div></div></div>`,
  overview: `<div class="ocean-overview"><div class="ocean-heading-band">${overviewHeading}</div><section class="ocean-deck">${slot("metrics")}${shortcuts}</section><div class="ocean-ledger"><section>${slot("orders")}${slot("transactions")}</section><aside>${slot("chart")}<h2>Nhật ký tài khoản</h2>${slot("notifications")}<a href="/support">Liên hệ đội ngũ hỗ trợ →</a></aside></div></div>`,
};
