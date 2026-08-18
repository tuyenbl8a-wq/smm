const styles = `:root{color-scheme:dark;--bg:#07111f;--panel:#0d1b2d;--line:#20364e;--text:#eff7ff;--muted:#94aac0;--a:#43dfca;--b:#8b7dff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 85% 0,#183e68,transparent 32%),var(--bg);font:15px/1.5 Inter,system-ui;color:var(--text)}a{color:var(--a)}.auth{min-height:100vh;display:grid;place-items:center;padding:24px}.box{width:min(450px,100%);background:#0c1b2ddd;border:1px solid var(--line);border-radius:22px;padding:30px;box-shadow:0 25px 80px #0006}.brand{font-weight:900;font-size:20px}.mark{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:12px;margin-right:10px;background:linear-gradient(135deg,var(--a),var(--b));color:#07111f}h1{font-size:30px;margin:28px 0 6px}.muted{color:var(--muted)}label{display:block;margin-top:17px;font-weight:700}input{width:100%;margin-top:7px;padding:13px 14px;border-radius:11px;border:1px solid var(--line);background:#071522;color:var(--text);font:inherit}button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:11px;background:linear-gradient(135deg,var(--a),#60a8ff);color:#04111e;font-weight:900;cursor:pointer}.error{min-height:22px;color:#ff9d9d;margin-top:12px}.foot{text-align:center;margin-top:20px}.shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.side{padding:28px 20px;border-right:1px solid var(--line)}nav{display:grid;gap:8px;margin-top:35px}nav a{padding:11px 13px;text-decoration:none;color:var(--muted)}main{padding:36px;max-width:1200px}.top{display:flex;justify-content:space-between;gap:20px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:28px}.card{padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:17px}.value{font-size:25px;font-weight:900;color:var(--a)}@media(max-width:700px){.shell{display:block}.side{border:0;padding-bottom:0}nav{display:flex;overflow:auto;margin-top:18px}main{padding:22px}.cards{grid-template-columns:1fr}}`;
function layout(title: string, body: string, script = "") {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Nexus SMM</title><style>${styles}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}
const client = (api: string) =>
  `const API=${JSON.stringify(api)};const csrf=()=>document.cookie.split('; ').find(x=>x.startsWith('smm_csrf='))?.split('=').slice(1).join('=')||'';async function call(path,options={}){const r=await fetch(API+path,{credentials:'include',headers:{'content-type':'application/json',...(csrf()?{'x-csrf-token':csrf()}:{})},...options});const v=await r.json();if(!r.ok)throw new Error(v.error?.message||'Request failed');return v.data}`;
export function authPage(kind: "login" | "register" | "forgot", api: string) {
  const data =
    kind === "login"
      ? {
          title: "Đăng nhập",
          fields: `<label>Email<input name="email" type="email" autocomplete="email" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label>`,
          endpoint: "/api/v1/auth/login",
          foot: `<a href="/forgot-password">Quên mật khẩu?</a> · <a href="/register">Tạo tài khoản</a>`,
        }
      : kind === "register"
        ? {
            title: "Tạo tài khoản",
            fields: `<label>Email<input name="email" type="email" required></label><label>Tên người dùng<input name="username" minlength="3" required></label><label>Mật khẩu<input name="password" type="password" minlength="12" required></label>`,
            endpoint: "/api/v1/auth/register",
            foot: `Đã có tài khoản? <a href="/login">Đăng nhập</a>`,
          }
        : {
            title: "Khôi phục mật khẩu",
            fields: `<label>Email<input name="email" type="email" required></label>`,
            endpoint: "/api/v1/auth/forgot-password",
            foot: `<a href="/login">Quay lại đăng nhập</a>`,
          };
  const body = `<div class="auth"><section class="box"><div class="brand"><span class="mark">N</span>Nexus Panel</div><h1>${data.title}</h1><p class="muted">Bảo mật phiên đăng nhập và dữ liệu tài khoản.</p><form id="form">${data.fields}<button>${data.title}</button><div class="error" id="message" role="alert"></div></form><div class="foot muted">${data.foot}</div></section></div>`;
  const script = `${client(api)};form.addEventListener('submit',async e=>{e.preventDefault();message.textContent='';const values=Object.fromEntries(new FormData(form));try{const data=await call('${data.endpoint}',{method:'POST',body:JSON.stringify(values)});${kind === "forgot" ? "message.textContent=data.developmentToken?'Token development: '+data.developmentToken:'Nếu email tồn tại, hướng dẫn đã được tạo.'" : "location.href=data.access?.roles?.includes('SUPER_ADMIN')?'/admin':'/dashboard'"}}catch(error){message.textContent=error.message}})`;
  return layout(data.title, body, script);
}
export function panelPage(admin: boolean, api: string) {
  const endpoint = admin
    ? "/api/v1/admin/overview"
    : "/api/v1/customer/overview";
  const body = `<div class="shell"><aside class="side"><div class="brand"><span class="mark">N</span>Nexus Panel</div><nav><a href="${admin ? "/admin" : "/dashboard"}">Tổng quan</a><a href="/dashboard">Customer Panel</a>${admin ? "<a href='/admin'>Admin Panel</a>" : ""}<a href="#" id="logout">Đăng xuất</a></nav></aside><main><div class="top"><div><div class="muted">${admin ? "ADMIN CONTROL" : "CUSTOMER PANEL"}</div><h1 id="welcome">Đang tải…</h1></div></div><section class="cards"><article class="card"><div class="muted">Phiên</div><div class="value">Bảo mật</div></article><article class="card"><div class="muted">Vai trò</div><div class="value" id="role">—</div></article><article class="card"><div class="muted">Trạng thái</div><div class="value">Online</div></article></section><div class="error" id="message"></div></main></div>`;
  const script = `${client(api)};(async()=>{try{const data=await call('${endpoint}');welcome.textContent='Xin chào, '+data.user.username;const me=await call('/api/v1/me');role.textContent=me.roles?.[0]||'USER'}catch(e){location.href='/login'}})();logout.addEventListener('click',async e=>{e.preventDefault();try{await call('/api/v1/auth/logout',{method:'POST',body:'{}'});location.href='/login'}catch(e){message.textContent=e.message}})`;
  return layout(admin ? "Admin Panel" : "Customer Panel", body, script);
}
export const dashboardPage = panelPage(false, "http://localhost:4000");
