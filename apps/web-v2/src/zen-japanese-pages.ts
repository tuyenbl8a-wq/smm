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
export const zenJapanesePages: ReferencePages = {
  landing: `<main class="ref-page zen-landing" data-reference-page><div class="zen-inscription"><span>静</span><p>Kết nối thương hiệu<br>Vươn tầm giá trị</p></div>${nav}<section class="zen-landscape"><figure>${art("zen-japanese", "Vườn Nhật, thông xanh và núi mờ sương")}</figure><article>${intro("Phát triển thương hiệu của bạn từ những", "điều chân thật", "TỪNG BƯỚC NHỎ · GIÁ TRỊ BỀN LÂU", "zen")}</article><aside><span>一期一会</span><small>Mỗi kết nối<br>một giá trị.</small></aside></section><div class="zen-path">${assurances}${platforms}</div><section class="zen-principles"><blockquote>Small actions.<br>Big growth.</blockquote>${benefits}</section>${slot("pricing")}${end}</main>`,
  auth: `<main class="ref-auth zen-auth" data-reference-page><section class="zen-room"><header>${identity}</header><div class="zen-form">${slot("form")}</div><footer><a href="/">← Về trang chủ</a><span>Chậm rãi. Vững vàng. Đi xa.</span></footer></section><aside class="zen-garden"><figure>${art("zen-japanese", "Cửa tròn nhìn ra vườn thiền và núi xa")}</figure><div><span>静</span><blockquote>Sự bền bỉ<br>tạo nên giá trị.</blockquote></div></aside></main>`,
  customer: `<div class="ref-customer zen-customer" data-reference-page><div class="zen-frame"><aside class="zen-wayfinding">${customerSide}<div class="zen-seal" aria-hidden="true">静</div></aside><section class="zen-desk">${slot("topbar")}<div class="zen-paper">${slot("content")}</div></section></div><footer class="zen-bottom-line">Từng bước nhỏ · Giá trị bền lâu</footer></div>`,
  overview: `<div class="zen-overview"><header class="zen-opening">${overviewHeading}<hr></header><section class="zen-measures">${slot("metrics")}</section><div class="zen-records"><div>${slot("orders")}</div><aside>${slot("chart")}${slot("notifications")}${shortcuts}</aside></div><section class="zen-finances">${slot("transactions")}</section></div>`,
};
