import { createServer } from "node:http";
import { loadConfig } from "@smm/config";
import { authPage, dashboardHandoff, landingPage } from "./page.js";
const config = loadConfig(process.env, 3001);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", config.appUrl),
    path = url.pathname;
  if (path === "/health") {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        status: "ok",
        service: "web-v2",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }
  const pages: Record<string, () => string> = {
    "/": () => landingPage(config.apiUrl.origin),
    "/login": () => authPage(config.apiUrl.origin, "login"),
    "/register": () => authPage(config.apiUrl.origin, "register"),
    "/forgot-password": () => authPage(config.apiUrl.origin, "forgot"),
    "/reset-password": () =>
      authPage(
        config.apiUrl.origin,
        "reset",
        url.searchParams.get("token") ?? "",
      ),
    "/dashboard": () => dashboardHandoff(config.apiUrl.origin),
  };
  const render = pages[path];
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "content-security-policy",
    `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ${config.apiUrl.origin}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  );
  if (!render) {
    response.statusCode = 404;
    response.end(
      '<!doctype html><html lang="vi"><title>Không tìm thấy</title><body><h1>Không tìm thấy trang</h1><a href="/">Về trang chủ</a></body></html>',
    );
    return;
  }
  response.end(render());
});
server.listen(config.port, config.host, () =>
  console.log(
    JSON.stringify({
      level: "info",
      service: "web-v2",
      event: "started",
      port: config.port,
    }),
  ),
);
