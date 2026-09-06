import { createServer } from "node:http";
import { loadConfig } from "@smm/config";
import { authPage, landingPage } from "./page.js";
import { customerPage } from "./customer.js";
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
  };
  const customerRoute =
    path === "/dashboard" ||
    path === "/orders" ||
    path === "/orders/new" ||
    /^\/orders\/(?:[0-9]{6,}|[0-9a-f-]{36})$/.test(path) ||
    path === "/services" ||
    path === "/wallet" ||
    path === "/deposit" ||
    /^\/deposit\/[0-9a-f-]{36}$/.test(path) ||
    path === "/transactions" ||
    path === "/affiliate" ||
    path === "/api" ||
    path === "/support" ||
    /^\/support\/\d+$/.test(path) ||
    path === "/notifications" ||
    path === "/account";
  const render = customerRoute
    ? () => customerPage(config.apiUrl.origin, path)
    : pages[path];
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "content-security-policy",
    `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data:; connect-src ${config.apiUrl.origin}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
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
