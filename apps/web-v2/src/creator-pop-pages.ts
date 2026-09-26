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
export const creatorPopPages: ReferencePages = {
  landing: `<main class="ref-page pop-landing" data-reference-page>${nav}<section class="pop-collage">${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "✦ NỀN TẢNG CHO THẾ HỆ SÁNG TẠO", "creator")}<figure>${art("creator-pop", "Nhà sáng tạo giữa collage hồng, cam và tím")}<figcaption>Good content.<br>Brighter tomorrow ♡</figcaption></figure><aside class="pop-sticker">Create<br>Connect<br>Grow ↗</aside></section>${assurances}${platforms}${benefits}${slot("pricing")}${end}</main>`,
  auth: `<main class="ref-auth pop-auth" data-reference-page><header>${identity}<span>Creators grow together ♡</span></header><div class="pop-auth-stage"><section>${slot("form")}</section><figure>${art("creator-pop", "Nhà sáng tạo với điện thoại và sticker")}<figcaption>Mỗi ý tưởng<br><strong>đều có thể tỏa sáng.</strong></figcaption></figure></div><footer>Không gian dành cho người sáng tạo.</footer></main>`,
  customer: `<div class="ref-customer pop-customer" data-reference-page><aside class="pop-rail">${customerSide}<p class="pop-note">Make something<br>people love ♡</p></aside><div class="pop-desk">${slot("topbar")}<div class="pop-workspace">${slot("content")}</div></div></div>`,
  overview: `<div class="pop-overview">${overviewHeading}${slot("metrics")}<div class="pop-analytics"><section>${slot("orders")}${slot("transactions")}</section><aside>${slot("chart")}${shortcuts}${slot("notifications")}<p class="pop-note">Small steps.<br>Big growth ↗</p></aside></div></div>`,
};
