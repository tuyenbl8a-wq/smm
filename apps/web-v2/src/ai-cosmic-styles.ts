/** Scoped at construction so no AI rule changes Aurora or the admin UI. */
const css = `
body{background:radial-gradient(ellipse at 40% 0,#154d9960,transparent 48%),radial-gradient(ellipse at 95% 65%,#632b9030,transparent 50%),#020916}
body>.header{display:none}
body>footer{display:none}
:is(.aiv3-landing,.aiv3-auth,.aiv3-dashboard){border:1px solid #79bbff;border-radius:26px;box-shadow:0 0 4px #94b4ff,inset 0 0 25px #1845aa44,0 0 32px #444dce55;overflow:clip}
a{color:inherit;text-decoration:none}
:is(a,button):focus-visible{outline:2px solid #4ceaff;outline-offset:4px}
.aiv3-primary{display:inline-flex;align-items:center;justify-content:center;gap:18px;padding:13px 23px;border:1px solid #c9f7ff;border-radius:12px;background:linear-gradient(110deg,#64edff,#8882ff 70%,#d29bff);box-shadow:0 0 16px #7474fa80,inset 0 0 9px #fff8;color:#02132c;font-weight:750}
.aiv3-landing{max-width:1380px;margin:20px auto;padding:0 26px;background:radial-gradient(ellipse at 80% 20%,#22277555,transparent 65%),#020b1a}
.aiv3-nav{display:flex;align-items:center;gap:24px;padding:18px;border-bottom:1px solid #28528c;background:#020b1ded;position:relative;z-index:2}
.aiv3-brand{display:flex;align-items:center;gap:12px;font-size:30px;font-weight:750;white-space:nowrap;margin-right:auto}
.aiv3-brand svg{width:46px;filter:drop-shadow(0 0 8px #9b64ff)}
.aiv3-nav nav{display:flex;gap:26px;font-size:14px}
.aiv3-nav [aria-current]{border-bottom:2px solid #9f82ff;padding-bottom:12px}
.aiv3-hero{display:grid;grid-template-columns:48% 52%;position:relative;min-height:560px}
.aiv3-copy{z-index:1;padding:60px 0 64px 24px;align-self:center}
.aiv3-copy small{font-size:11px;letter-spacing:.25em;color:#eef2ff}
.aiv3-copy h1{font-size:clamp(38px,4.7vw,68px);line-height:1.08;letter-spacing:-.045em;margin:18px -38px 24px 0;max-width:650px}
.aiv3-copy h1 em{font-style:normal;background:linear-gradient(100deg,#72e8ff,#a980ff 75%,#d262f5);background-clip:text;color:transparent}
.aiv3-copy p{font-size:17px;line-height:1.5;max-width:550px;color:#dce8ff}
.aiv3-actions{display:flex;gap:16px;margin-top:32px;flex-wrap:wrap}
.aiv3-actions a{padding:15px 28px;border:1px solid #669ed4;border-radius:12px;font-size:18px;font-weight:700}
.aiv3-art{position:relative;margin-right:-26px;min-width:0;overflow:hidden}
.aiv3-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:66% center;mask-image:linear-gradient(90deg,transparent,#000 13%)}
.aiv3-stats{position:relative;display:grid;grid-template-columns:repeat(4,1fr);width:76%;margin:-12px 0 20px;background:#03152eee;border:1px solid #409bdd;border-radius:16px;padding:18px 0;box-shadow:0 0 25px #072856}
.aiv3-stats article{padding:0 20px;border-right:1px solid #226296}
.aiv3-stats article:last-child{border:0}
.aiv3-stats b{display:block;font-size:26px;line-height:1.3;white-space:nowrap}
.aiv3-stats span{font-size:13px;color:#b8d1ed}
.aiv3-platforms{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:32px}
.aiv3-platforms>span{display:flex;align-items:center;justify-content:center;gap:15px;padding:9px;border:1px solid #286594;border-radius:12px;background:#06192e}
.aiv3-platforms b{font-size:30px;line-height:1.2;color:#41caff;text-shadow:0 0 15px #226dff}
.aiv3-services{border-top:1px solid #183955;padding:24px 4px}
.aiv3-services>header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}
.aiv3-services h2{margin:0;font-size:27px}
.aiv3-services p{color:#b8d1ed;margin:6px 0 0}
.aiv3-services>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.aiv3-services article{padding:22px;border:1px solid #337bb2;border-radius:12px;background:linear-gradient(130deg,#0a2140,#051528)}
.aiv3-services article>span{font-size:38px;color:#bcbbff;text-shadow:0 0 15px #624cff;line-height:1}
.aiv3-services h3{font-size:19px;margin:12px 0 4px}
.aiv3-services article a{display:inline-block;margin-top:16px;color:#74ddff;font-size:13px}
.aiv3-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 8px;color:#9cd8ff;font-size:12px;letter-spacing:.15em}
.aiv3-footer i{font-family:Georgia,serif;font-size:19px;letter-spacing:0}
.aiv3-auth{display:grid;grid-template-columns:2fr 1fr 1fr;max-width:1500px;width:calc(100% - 100px);min-height:820px;margin:50px auto;background:#020c20}
.aiv3-auth-left{display:grid;align-items:center;padding:44px 10%;background:linear-gradient(120deg,#03142b,#020b1c)}
.aiv3-auth-left .auth-card{width:100%;padding:0;border:0;background:transparent;box-shadow:none;max-width:none}
.aiv3-auth-left .brand{justify-content:center;font-size:38px;margin-bottom:36px}
.aiv3-auth-left .auth-card h2{font-size:40px;letter-spacing:-.035em;text-align:center;margin:0 0 15px}
.aiv3-auth-left .auth-card>p{font-size:20px;line-height:1.5;text-align:center;color:#c8d8f3;margin-bottom:26px}
.aiv3-auth-left .field input{border-radius:12px;height:62px;padding:16px 20px;border:1px solid #3476a9;background:#071d34;font-size:18px}
.aiv3-auth-left form>label{display:block;margin:14px 0 6px;color:#b3ceed}
.aiv3-auth-left .form-row{margin:22px 0;font-size:16px;gap:12px}
.aiv3-auth-left .form-row input{accent-color:#33dfff;width:20px;height:20px}
.aiv3-auth-left a:not(.brand){color:#47e9ff}
.aiv3-auth-left .button{width:100%;min-height:62px;font-size:20px;color:#021330;border:1px solid #d0fbff;background:linear-gradient(110deg,#64eaff,#a47bff);box-shadow:0 0 16px #6557ff80;border-radius:12px}
.aiv3-auth-left .auth-links{text-align:center;font-size:17px;margin-top:28px}
.aiv3-portal{position:relative;border-inline:1px solid #2785cf;min-width:0}
.aiv3-portal img{position:absolute;width:100%;height:100%;object-fit:cover;object-position:center}
.aiv3-manifesto{display:flex;flex-direction:column;align-items:flex-start;padding:70px 22%;gap:20px;min-width:0;background:radial-gradient(ellipse at 100% 50%,#17358d44,transparent 70%)}
.aiv3-manifesto strong{font-weight:400;font-size:26px;line-height:1.55;letter-spacing:.2em;color:#bfa9ff}
.aiv3-manifesto hr{width:80px;border:0;border-top:3px solid #dddfff;margin:18px 0 46px}
.aiv3-manifesto>span{font-size:32px;font-weight:750}
.aiv3-manifesto small{font-size:12px;line-height:1.8;letter-spacing:.2em;color:#9eceff}
.aiv3-manifesto q{margin-top:auto;font:italic 25px/1.65 Georgia,serif;color:#c7cfff}
.aiv3-dashboard{display:grid;grid-template-columns:285px minmax(0,1fr);min-height:calc(100vh - 36px);margin:18px;background:#020f20}
.aiv3-workspace{min-width:0}
.aiv3-close{display:none}
.aiv3-sidebar{border-right:1px solid #237ccd;background:#020d1c}
.aiv3-sidebar>.sidebar{position:sticky;top:0;height:calc(100vh - 38px);width:100%;padding:26px 14px;margin:0;border:0;border-radius:0;background:transparent;overflow-y:auto}
.sidebar .brand{font-size:28px;padding:0 8px 18px}
.sidebar nav a{font-size:16px;padding:13px 15px;color:#b9d4f4;border-radius:11px;margin:3px 0}
.sidebar nav a.active{background:linear-gradient(100deg,#2543a6,#6334f1);box-shadow:inset 3px 0 #ceadff,0 0 15px #4239ec55;color:#fff}
.aiv3-topbar>.topbar{position:relative;top:0;padding:18px 26px;min-height:92px;height:auto;border-bottom:1px solid #24567d;background:#020f20;gap:20px}
.aiv3-search{display:flex;align-items:center;border:1px solid #28649d;border-radius:12px;background:#081e38;flex:1;max-width:700px;min-width:0}
.aiv3-search label{flex:1;min-width:0}
.aiv3-search input{width:100%;border:0;background:transparent;padding:14px;font-size:17px;min-width:0}
.aiv3-search button{border:0;background:transparent;color:#cce6ff;padding:10px;font-size:26px}
.aiv3-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.aiv3-customer-content>.customer-content{padding:24px;max-width:none;margin:0}
.aiv3-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}
.aiv3-heading h1{font-size:38px;margin:0 0 6px;line-height:1.1}
.aiv3-heading p{font-size:19px;margin:0;color:#aecef5}
.aiv3-heading>span{border:1px solid #2b6fa5;border-radius:10px;padding:14px;font-size:13px;white-space:nowrap}
.aiv3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:22px 0 16px}
.aiv3-kpis article{display:grid;grid-template-columns:48px minmax(0,1fr);gap:14px;padding:22px 17px;border:1px solid #2978af;border-radius:14px;background:linear-gradient(135deg,#071b35,#021f30)}
.aiv3-kpi-icon{display:grid;place-items:center;height:52px;font-size:27px;background:linear-gradient(135deg,#0058de,#1542a0);border-radius:14px;box-shadow:0 0 22px #0755bc55;color:#efffff}
.aiv3-kpis article:nth-child(even) .aiv3-kpi-icon{background:linear-gradient(135deg,#008388,#00565c);color:#4affee}
.aiv3-kpis small{font-size:15px;color:#abcbf3}
.aiv3-kpis b{display:block;font-size:26px;margin-top:5px;overflow-wrap:anywhere;line-height:1.25}
.aiv3-kpis p{grid-column:1/-1;margin:0;color:#61d7d1;font-size:13px}
.aiv3-content{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:18px}
:is(.aiv3-chart,.aiv3-assistant){padding:22px;border:1px solid #2b7bb6;border-radius:16px;background:linear-gradient(125deg,#041730,#011525);min-width:0}
:is(.aiv3-chart,.aiv3-assistant)>header{display:flex;align-items:center;justify-content:space-between;gap:12px}
:is(.aiv3-chart,.aiv3-assistant) h2{font-size:21px;margin:0}
:is(.aiv3-chart,.aiv3-assistant)>header>span{font-size:12px;color:#9fc1df}
.aiv3-chart-empty{display:grid;place-items:center;text-align:center;height:290px;margin:20px 0;background:linear-gradient(#24609233 1px,transparent 1px),linear-gradient(90deg,#24609233 1px,transparent 1px);background-size:100% 58px,16.66% 100%;border-bottom:1px solid #346596}
.aiv3-chart-empty>div{background:#04172deb;padding:24px;max-width:85%;border:1px solid #25547c;border-radius:12px}
.aiv3-chart-empty p{font-size:14px;color:#a7c1de}
.aiv3-chart-empty a{color:#46dafa;font-size:14px}
.aiv3-assistant-intro{display:grid;grid-template-columns:88px 1fr;align-items:center;gap:15px;margin:22px 0}
.aiv3-assistant-intro img{width:88px;height:100px;object-fit:cover;object-position:right;border-radius:16px;border:1px solid #506dff}
.aiv3-assistant-intro p{margin:0;background:linear-gradient(120deg,#0d2b60,#0b244a);padding:16px;border:1px solid #346ebb;border-radius:15px;font-size:16px;line-height:1.55}
.aiv3-assistant nav{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.aiv3-assistant nav a{border:1px solid #2b6599;border-radius:10px;padding:12px 9px;font-size:12px;background:#082039}
.aiv3-assistant-note{font-size:12px;line-height:1.6;color:#a9c4e6;margin:20px 0 12px}
.aiv3-assistant>.aiv3-primary{display:flex;font-size:14px;padding:11px}
@media(max-width:1200px){
.aiv3-landing{margin:12px}
.aiv3-nav{gap:16px;padding-inline:0}
.aiv3-nav nav{gap:16px}
.aiv3-brand{font-size:25px}
.aiv3-stats{width:100%}
.aiv3-auth{width:calc(100% - 32px);margin:24px 16px;min-height:760px}
.aiv3-manifesto{padding:60px 12%}
.aiv3-manifesto strong{font-size:21px}
.aiv3-dashboard{grid-template-columns:225px minmax(0,1fr);margin:10px}
.aiv3-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
.aiv3-content{grid-template-columns:1fr}
}
@media(max-width:800px){
.aiv3-nav{flex-wrap:wrap;gap:12px}
.aiv3-nav nav{order:4;width:100%;justify-content:space-between;padding-top:10px}
.aiv3-hero{grid-template-columns:1fr}
.aiv3-copy{padding:38px 0 20px}
.aiv3-copy h1{margin-right:0;font-size:48px;max-width:620px}
.aiv3-art{height:430px;margin:0 -26px}
.aiv3-art img{mask-image:linear-gradient(180deg,transparent,#000 10%);object-position:right center}
:is(.aiv3-stats,.aiv3-services>div){grid-template-columns:repeat(2,minmax(0,1fr))}
.aiv3-stats{row-gap:18px;margin-top:0}
.aiv3-platforms{grid-template-columns:repeat(3,minmax(0,1fr))}
.aiv3-auth{grid-template-columns:2fr 1fr;min-height:760px}
.aiv3-auth-left{padding:36px 8%}
.aiv3-manifesto{grid-column:1/-1;padding:30px;display:block}
.aiv3-manifesto strong{font-size:16px;display:block;margin-bottom:16px}
.aiv3-manifesto strong br{display:none}
:is(.aiv3-manifesto hr,.aiv3-manifesto q){display:none}
.aiv3-manifesto>span{font-size:24px;margin-right:30px}
.aiv3-dashboard{grid-template-columns:1fr;margin:8px}
.aiv3-sidebar{border:0}
.aiv3-sidebar>.sidebar{position:fixed;inset:0 auto 0 0;width:270px;height:100dvh;background:#03132b;z-index:100;transform:translateX(-110%);box-shadow:15px 0 50px #0009}
.aiv3-sidebar>.sidebar.open{transform:translateX(0)}
.aiv3-close{display:block;background:#112d53;color:#c7eaff;border:1px solid #416cbe;border-radius:8px;padding:12px;width:100%;margin-bottom:16px}
#drawer-toggle{display:block}
.aiv3-topbar>.topbar{padding:14px;gap:10px;flex-wrap:wrap}
.aiv3-search{max-width:none}
.aiv3-topbar .top-actions{margin-left:auto}
.aiv3-customer-content>.customer-content{padding:18px}
.aiv3-heading>span{display:none}
.aiv3-footer{flex-wrap:wrap}
}
@media(max-width:520px){
.aiv3-landing{padding:0 16px;margin:8px;border-radius:18px}
.aiv3-brand{font-size:21px;gap:6px}
.aiv3-brand svg{width:32px}
.aiv3-nav>a:not(.aiv3-brand){font-size:12px}
.aiv3-nav>.aiv3-primary{padding:9px}
.aiv3-copy h1{font-size:40px}
.aiv3-actions{gap:10px}
.aiv3-actions a{padding:13px 16px;font-size:15px}
.aiv3-art{height:350px}
.aiv3-stats article{padding:0 12px}
.aiv3-stats b{font-size:21px}
.aiv3-platforms{grid-template-columns:repeat(2,minmax(0,1fr))}
.aiv3-services>header{display:block}
.aiv3-services>header>a{display:inline-block;margin-top:12px}
.aiv3-services>div{grid-template-columns:1fr}
.aiv3-auth{display:block;width:calc(100% - 16px);min-height:0;margin:12px 8px}
.aiv3-auth-left{padding:40px 22px}
.aiv3-auth-left .brand{font-size:30px}
.aiv3-auth-left .auth-card h2{font-size:32px}
.aiv3-auth-left .auth-card>p{font-size:17px}
.aiv3-portal{height:320px}
.aiv3-portal img{object-position:center 60%}
.aiv3-heading h1{font-size:32px}
.aiv3-heading p{font-size:16px}
.aiv3-kpis{gap:10px}
.aiv3-kpis article{display:block;padding:14px}
.aiv3-kpi-icon{width:40px;height:40px;margin-bottom:12px}
.aiv3-kpis b{font-size:23px;margin-bottom:12px}
:is(.aiv3-chart,.aiv3-assistant){padding:16px}
.aiv3-chart-empty>div{padding:18px}
}
`;
export const aiCosmicStyles =
  ':root[data-theme="AI_COSMIC_FUTURE"]{--theme-bg:#020b1a;--theme-surface:#061a30;--theme-primary:#6570ff;--theme-secondary:#36dfff;--theme-text:#f5f7ff;--theme-muted:#a8c9ed;--theme-border:#286594;--theme-font:"Segoe UI",Arial,sans-serif;color-scheme:dark}' +
  css.replace(
    /^([^@\s}][^{\n]*)\{/gm,
    ':root[data-theme="AI_COSMIC_FUTURE"] $1{',
  );
