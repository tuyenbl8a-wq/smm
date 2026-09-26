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
export const blueBusinessPages: ReferencePages = {
  landing: `<main class="ref-page blue-landing" data-reference-page>${nav}<section class="blue-hero"><article>${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "GIẢI PHÁP SOCIAL MEDIA CHO DOANH NGHIỆP", "blue")}${assurances}</article><figure>${art("blue-business", "Chuyên viên doanh nghiệp giới thiệu nền tảng trên điện thoại")}</figure></section>${platforms}<section class="blue-process"><header><small>ĐƠN GIẢN. RÕ RÀNG. HIỆU QUẢ.</small><h2>Một nền tảng cho mọi chiến dịch</h2></header><ol><li><b>01</b><h3>Chọn dịch vụ</h3><p>Tra cứu giá và điều kiện trong danh mục.</p></li><li><b>02</b><h3>Tạo đơn hàng</h3><p>Kiểm tra thông tin trước khi xác nhận.</p></li><li><b>03</b><h3>Theo dõi kết quả</h3><p>Quản lý đơn và giao dịch tại một nơi.</p></li></ol></section>${slot("pricing")}${benefits}${end}</main>`,
  auth: `<main class="ref-auth blue-auth" data-reference-page><header>${identity}<a href="/help">Trung tâm hỗ trợ ↗</a></header><div class="blue-auth-grid"><section>${slot("form")}</section><aside><div><small>GIẢI PHÁP HÔM NAY</small><h1>Thương hiệu<br>vững mạnh ngày mai.</h1><p>Một nơi để quản lý dịch vụ, đơn hàng và tài khoản của bạn.</p></div>${art("blue-business", "Không gian làm việc sáng và chuyên nghiệp")}</aside></div><footer>Minh bạch trong từng tương tác.</footer></main>`,
  customer: `<div class="ref-customer blue-customer" data-reference-page><aside class="blue-sidebar">${customerSide}</aside><div class="blue-workarea"><header class="blue-app-header">${slot("topbar")}</header><section class="blue-app-body">${slot("content")}</section><nav class="blue-helpbar" aria-label="Trợ giúp tài khoản"><a href="/support">Trung tâm hỗ trợ</a><a href="/account">Cài đặt tài khoản</a></nav></div></div>`,
  overview: `<div class="blue-overview">${overviewHeading}${slot("metrics")}<section class="blue-overview-actions">${shortcuts}</section><section class="blue-recent">${slot("orders")}</section><div class="blue-bottom-grid">${slot("chart")}${slot("transactions")}${slot("notifications")}</div></div>`,
};
