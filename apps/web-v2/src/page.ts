import { brand, button, footer, header, primitives } from "./components.js";
import { styles } from "./styles.js";
const escapeJson = (value: string) => value.replaceAll("<", "\\u003c");
function shell(
  title: string,
  body: string,
  script: string,
  description: string,
) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${description}"><title>${title} · DichVu1st</title><style>${styles}</style></head><body>${body}${primitives}<script>${script}</script></body></html>`;
}
const common = `const $=(s,r=document)=>r.querySelector(s);$('.menu')?.addEventListener('click',e=>{const n=$('.nav');n.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(n.classList.contains('open')))})`;
export function landingPage(api: string) {
  const services = [
    ["♪", "TikTok", "Tăng follow, view, like, comment"],
    ["f", "Facebook", "Tăng tương tác, like, follow"],
    ["◎", "Instagram", "Tăng follow, like, comment"],
    ["▶", "YouTube", "Tăng view, like, subscribe"],
  ];
  const serviceCards = services
    .map(
      ([icon, name, copy]) =>
        `<article class="card"><span class="platform-icon">${icon}</span><h3>${name}</h3><p class="meta">${copy}</p><ul><li>Tăng trưởng chất lượng</li><li>Xử lý nhanh chóng</li><li>Minh bạch trạng thái</li></ul><a href="#pricing">Xem dịch vụ ${name} →</a></article>`,
    )
    .join("");
  const body = `${header}<main><section class="hero"><div class="container hero-grid"><div><span class="eyebrow">SMM PANEL UY TÍN HÀNG ĐẦU VIỆT NAM</span><h1>Tăng trưởng<br>mạng xã hội<br><span class="gradient">nhanh hơn.<br>Thông minh hơn.</span></h1><p class="lead">DichVu1st cung cấp các dịch vụ tăng tương tác cho TikTok, Facebook, Instagram và YouTube — nhanh chóng, an toàn và minh bạch.</p><div class="hero-actions">${button("Khám phá dịch vụ", "#services")}${button("Xem cách hoạt động", "#process", true)}</div><div class="trust"><div class="socials"><i>♪</i><i>f</i><i>◎</i><i>▶</i></div><b>4.9/5 ★★★★★</b></div></div><div class="preview" aria-label="Bản xem trước bảng điều khiển minh họa"><div class="dashboard"><div class="dashboard-head"><div><small>Chào mừng trở lại,</small><h2>DichVu1st! 👋</h2></div><span class="badge-ok">● Trực tuyến</span></div><div class="metrics"><div class="metric"><small>Tổng đơn hàng</small><b>1,248</b><span class="badge-ok">↑ 12.5%</span></div><div class="metric"><small>Tăng trưởng</small><b>+386%</b><span class="badge-ok">↑ hôm nay</span></div><div class="metric"><small>Hoàn thành</small><b>96.8%</b><span class="badge-ok">ổn định</span></div></div><div class="chart">${[25, 38, 31, 58, 47, 75, 66, 88].map((x) => `<i style="height:${x}%"></i>`).join("")}</div><div class="order"><span>TikTok · 10.000 Follow</span><span class="badge-ok">Hoàn thành</span></div><div class="order"><span>Facebook · 5.000 Like</span><span>Đang chạy</span></div></div></div></div></section><div class="container stats"><div class="stat"><b>100K+</b><span>Khách hàng tin tưởng</span></div><div class="stat"><b>1M+</b><span>Đơn hàng đã xử lý</span></div><div class="stat"><b>99.9%</b><span>Thời gian hoạt động</span></div><div class="stat"><b>24/7</b><span>Hỗ trợ khách hàng</span></div></div><section id="services" class="block"><div class="container"><div class="center"><span class="eyebrow">DỊCH VỤ CỦA CHÚNG TÔI</span><h2 class="section-title">Đa nền tảng, <span class="gradient">đa giải pháp</span></h2><p class="section-copy">Các dịch vụ tăng trưởng được thiết kế cho từng nền tảng.</p></div><div class="cards">${serviceCards}</div></div></section><section id="pricing" class="block"><div class="container pricing-layout"><div><span class="eyebrow">BẢNG GIÁ THAM KHẢO</span><h2 class="section-title">Giá tốt nhất <span class="gradient">thị trường</span></h2><p class="lead">Giá và thông tin dịch vụ đang hoạt động được tải trực tiếp từ hệ thống.</p></div><div id="catalog" class="catalog" aria-live="polite"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></section><section id="process" class="block"><div class="container"><span class="eyebrow">CÁCH HOẠT ĐỘNG</span><h2 class="section-title">Chỉ <span class="gradient">3 bước</span> đơn giản</h2><div class="process"><article class="card step"><span class="num">01</span><div><h3>Chọn dịch vụ</h3><p class="meta">Chọn nền tảng và dịch vụ phù hợp.</p></div></article><article class="card step"><span class="num">02</span><div><h3>Đặt hàng</h3><p class="meta">Điền thông tin và thanh toán an toàn.</p></div></article><article class="card step"><span class="num">03</span><div><h3>Nhận kết quả</h3><p class="meta">Theo dõi tiến độ minh bạch.</p></div></article></div></div></section><section class="block"><div class="container benefits"><article class="card"><h2>⚡ Tốc độ vượt trội</h2><p class="meta">Hệ thống tự động xử lý đơn nhanh chóng, trạng thái luôn rõ ràng.</p></article><article class="card"><h2>🛡 An toàn & bảo mật</h2><p class="meta">Phiên đăng nhập HttpOnly, bảo vệ CSRF và dữ liệu được xử lý an toàn.</p></article></div></section><section id="faq" class="block"><div class="container center"><span class="eyebrow">CÂU HỎI THƯỜNG GẶP</span><h2 class="section-title">Giải đáp thắc mắc của bạn</h2><div class="faq">${[
    [
      "Dịch vụ có an toàn không?",
      "Chúng tôi ưu tiên quy trình tăng trưởng hợp lý và minh bạch thông tin dịch vụ.",
    ],
    [
      "Thời gian hoàn thành là bao lâu?",
      "Mỗi dịch vụ có thời gian trung bình riêng được hiển thị trong bảng giá.",
    ],
    [
      "Tôi có được bảo hành không?",
      "Dịch vụ hỗ trợ refill sẽ được đánh dấu rõ ràng.",
    ],
    [
      "Có hỗ trợ nếu gặp sự cố không?",
      "Đội ngũ hỗ trợ luôn sẵn sàng tiếp nhận yêu cầu của bạn.",
    ],
  ]
    .map(
      ([q, a], i) =>
        `<details${i === 0 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`,
    )
    .join(
      "",
    )}</div><div class="cta"><h2 class="section-title">Sẵn sàng tăng trưởng?</h2><p class="section-copy">Tạo tài khoản miễn phí và khám phá danh mục dịch vụ.</p>${button("Bắt đầu ngay", "/register")}</div></div></section></main>${footer}`;
  const script = `${common};const api=${escapeJson(JSON.stringify(api))};const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:2}).format(Number(v));async function load(){const c=$('#catalog');try{const r=await fetch(api+'/api/v1/public/catalog?limit=12',{credentials:'include'});const j=await r.json();if(!r.ok)throw new Error();const cats=new Map(j.data.categories.map(x=>[x.id,x]));c.innerHTML=j.data.services.length?j.data.services.map(s=>{const x=cats.get(s.categoryId)||{};return '<article class="card price-card"><span class="meta">'+(x.platform?.name||x.name||'Dịch vụ')+' · '+(x.name||'')+'</span><h3>'+s.name+'</h3><div class="price">'+money(s.rate)+' <small>/ 1.000</small></div><p class="meta">ID: '+s.id.slice(0,8)+' · Min '+s.min+' · Max '+s.max+'</p><p class="meta">'+(s.averageTime?'⏱ '+s.averageTime+' · ':'')+(s.refill?'✓ Refill':'Không refill')+' · '+(s.cancel?'Có hủy':'Không hủy')+'</p><a class="button" href="/register">Đặt hàng ngay →</a></article>'}).join(''):'<div class="empty">Hiện chưa có dịch vụ đang hoạt động.</div>'}catch{c.innerHTML='<div class="error">Không thể tải bảng giá lúc này. <button id="retry">Thử lại</button></div>';$('#retry')?.addEventListener('click',load)}}load()`;
  return shell(
    "Tăng trưởng mạng xã hội thông minh",
    body,
    script,
    "Dịch vụ tăng tương tác mạng xã hội nhanh chóng, an toàn và minh bạch.",
  );
}
type AuthKind = "login" | "register" | "forgot" | "reset";
export function authPage(api: string, kind: AuthKind, token = "") {
  const config = {
    login: {
      title: "Chào mừng trở lại!",
      copy: "Đăng nhập để tiếp tục hành trình tăng trưởng.",
      submit: "Đăng nhập",
    },
    register: {
      title: "Tạo tài khoản",
      copy: "Bắt đầu tăng trưởng cùng DichVu1st ngay hôm nay.",
      submit: "Tạo tài khoản",
    },
    forgot: {
      title: "Quên mật khẩu",
      copy: "Nhập email để nhận hướng dẫn đặt lại mật khẩu.",
      submit: "Gửi yêu cầu",
    },
    reset: {
      title: "Đặt lại mật khẩu",
      copy: "Tạo mật khẩu mới an toàn cho tài khoản.",
      submit: "Đặt lại mật khẩu",
    },
  }[kind];
  const email =
    kind !== "reset"
      ? `<label for="email">Email</label><div class="field"><input id="email" name="email" type="email" autocomplete="email" placeholder="ban@email.com" required></div>`
      : "";
  const username =
    kind === "register"
      ? `<label for="username">Tên đăng nhập</label><div class="field"><input id="username" name="username" minlength="3" maxlength="32" autocomplete="username" placeholder="Tên đăng nhập" required></div>`
      : "";
  const password = ["login", "register", "reset"].includes(kind)
    ? `<label for="password">Mật khẩu</label><div class="field"><input id="password" name="password" type="password" minlength="${kind === "login" ? 1 : 12}" maxlength="128" autocomplete="${kind === "login" ? "current-password" : "new-password"}" placeholder="Tối thiểu 12 ký tự" required><button class="toggle" type="button" aria-label="Hiện mật khẩu">Hiện</button></div>`
    : "";
  const confirm =
    kind === "register" || kind === "reset"
      ? `<label for="confirm">Xác nhận mật khẩu</label><div class="field"><input id="confirm" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" required></div>`
      : "";
  const body = `<main class="container auth"><section class="auth-copy">${brand}<span class="eyebrow">SMM PANEL UY TÍN HÀNG ĐẦU VIỆT NAM</span><h1>Bắt đầu<br>tăng trưởng<br>cùng <span class="gradient">DichVu1st</span></h1><p class="lead">Giải pháp tăng tương tác đa nền tảng — nhanh chóng, an toàn, ổn định và hiệu quả.</p><div class="feature"><i>ϟ</i><div><b>Tốc độ vượt trội</b><div class="meta">Xử lý đơn hàng chỉ trong vài phút</div></div></div><div class="feature"><i>◇</i><div><b>An toàn & bảo mật</b><div class="meta">Bảo vệ tài khoản và phiên đăng nhập</div></div></div><div class="feature"><i>▥</i><div><b>Đa nền tảng</b><div class="meta">TikTok, Facebook, Instagram, YouTube</div></div></div></section><section class="auth-card">${brand}<h2>${config.title}</h2><p>${config.copy}</p><form novalidate>${email}${username}${password}${confirm}${kind === "login" ? `<div class="form-row"><label><input type="checkbox" name="remember"> Ghi nhớ đăng nhập</label><a href="/forgot-password">Quên mật khẩu?</a></div>` : ""}<div id="message" class="form-message" role="alert" aria-live="polite"></div><button class="button" type="submit">${config.submit} →</button></form><div class="auth-links">${kind === "login" ? `Chưa có tài khoản? <a href="/register">Tạo tài khoản ngay</a>` : kind === "register" ? `Đã có tài khoản? <a href="/login">Đăng nhập</a>` : `<a href="/login">← Quay lại đăng nhập</a>`}</div></section></main>`;
  const endpoint = {
    login: "login",
    register: "register",
    forgot: "forgot-password",
    reset: "reset-password",
  }[kind];
  const script = `const api=${escapeJson(JSON.stringify(api))},kind=${JSON.stringify(kind)},token=${escapeJson(JSON.stringify(token))};const form=document.querySelector('form'),msg=document.querySelector('#message'),btn=form.querySelector('[type=submit]');document.querySelector('.toggle')?.addEventListener('click',e=>{const i=document.querySelector('#password'),show=i.type==='password';i.type=show?'text':'password';e.currentTarget.textContent=show?'Ẩn':'Hiện';e.currentTarget.setAttribute('aria-label',show?'Ẩn mật khẩu':'Hiện mật khẩu')});const errors={INVALID_CREDENTIALS:'Email hoặc mật khẩu không đúng.',EMAIL_ALREADY_USED:'Email đã được sử dụng.',USERNAME_ALREADY_USED:'Tên đăng nhập đã tồn tại.',PASSWORD_WEAK:'Mật khẩu cần 12–128 ký tự, gồm chữ hoa, chữ thường và số.',RESET_TOKEN_INVALID:'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',AUTH_RATE_LIMITED:'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'};form.addEventListener('submit',async e=>{e.preventDefault();msg.className='form-message';msg.textContent='';const data=Object.fromEntries(new FormData(form));if(!form.checkValidity()){msg.textContent='Vui lòng kiểm tra các trường bắt buộc.';form.reportValidity();return}if((kind==='register'||kind==='reset')&&data.password!==document.querySelector('#confirm').value){msg.textContent='Mật khẩu xác nhận chưa khớp.';return}btn.disabled=true;btn.textContent='Đang xử lý…';try{const payload=kind==='reset'?{token,password:data.password}:kind==='register'?{email:data.email,username:data.username,password:data.password}:{email:data.email,...(kind==='login'?{password:data.password}:{})};const r=await fetch(api+'/api/v1/auth/${endpoint}',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw Object.assign(new Error(),{code:j.error?.code});msg.classList.add('success');msg.textContent=kind==='forgot'?'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.':kind==='reset'?'Đã đặt lại mật khẩu. Đang chuyển đến đăng nhập…':'Thành công. Đang chuyển hướng…';setTimeout(()=>location.href=kind==='forgot'?'/login':kind==='reset'?'/login':'/dashboard',600)}catch(x){msg.textContent=errors[x.code]||'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'}finally{btn.disabled=false;btn.textContent=${JSON.stringify(config.submit + " →")}}});`;
  return shell(
    config.title,
    body,
    script,
    "Đăng nhập và quản lý tài khoản DichVu1st an toàn.",
  );
}
export function dashboardHandoff(api: string) {
  return shell(
    "Tổng quan",
    `${header}<main class="container" style="min-height:70vh;padding:90px 0"><section class="card"><span class="eyebrow">TÀI KHOẢN</span><h1 style="font-size:48px">Chào mừng đến DichVu1st</h1><p id="state" class="lead">Đang xác thực phiên đăng nhập…</p><a class="button" href="/">Về trang chủ</a></section></main>${footer}`,
    `const api=${escapeJson(JSON.stringify(api))};fetch(api+'/api/v1/me',{credentials:'include'}).then(async r=>{if(r.status===401){location.href='/login';return}if(!r.ok)throw 0;const j=await r.json();document.querySelector('#state').textContent='Xin chào '+j.data.user.username+'. Customer Panel sẽ được hoàn thiện trong TASK 2.'}).catch(()=>document.querySelector('#state').textContent='Không thể tải thông tin tài khoản lúc này.')`,
    "Tài khoản DichVu1st",
  );
}
