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
export const cyberNeonPages: ReferencePages = {
  landing: `<main class="ref-page cyber-landing" data-reference-page>${nav}<div class="cyber-signal"><span>VIETNAM → WORLDWIDE</span><span>SOCIAL / POWER / GROWTH</span></div><section class="cyber-city">${art("cyber-neon", "Nhà sáng tạo trong thành phố neon về đêm")}<div class="cyber-hud">${intro("Tăng trưởng thương hiệu của bạn", "bắt đầu từ đây", "KẾT NỐI NHỊP SỐNG SỐ", "cyber")}${assurances}</div><aside>CREATE<br>SHARE<br>GROW ↗</aside></section><div class="cyber-dock">${platforms}</div>${benefits}<section class="cyber-catalog">${slot("pricing")}</section>${end}</main>`,
  auth: `<main class="ref-auth cyber-auth" data-reference-page><div class="cyber-auth-banner">${identity}<span>YOUR NEXT CHAPTER / CONNECT</span></div><div class="cyber-access"><div class="cyber-access-form"><small>ACCOUNT / ACCESS</small>${slot("form")}</div><aside class="cyber-window">${art("cyber-neon", "Cửa sổ nhìn ra đại đô thị neon")}<div><h1>Thành phố không ngủ.<br>Ý tưởng không giới hạn.</h1><a href="/">Khám phá nền tảng ↗</a></div></aside></div><nav class="cyber-auth-links"><a href="/help">Hỗ trợ</a><span>MORE THAN A SERVICE</span></nav></main>`,
  customer: `<div class="ref-customer cyber-customer" data-reference-page><aside class="cyber-navigation">${customerSide}</aside><div class="cyber-main"><div class="cyber-telemetry"><span>SOCIAL OPERATIONS / CONSOLE</span><a href="/api">API & kết nối ↗</a></div>${slot("topbar")}<section class="cyber-screen">${slot("content")}</section><footer class="cyber-system-footer">Dữ liệu thật · Tương tác thật · Giá trị thật</footer></div></div>`,
  overview: `<div class="cyber-overview">${overviewHeading}<div class="cyber-instruments">${slot("metrics")}<aside>${shortcuts}</aside></div><section class="cyber-feeds"><div>${slot("orders")}${slot("notifications")}</div><article>${slot("chart")}${slot("transactions")}</article></section></div>`,
};
