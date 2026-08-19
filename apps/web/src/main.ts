import { createServer } from "node:http";
import { loadConfig } from "@smm/config";
import {
  adminCatalogPage,
  adminProvidersPage,
  adminWalletPage,
  authPage,
  panelPage,
  ordersPage,
  servicesPage,
  walletPage,
  featurePage,
  orderDetailPage,
  depositDetailPage,
  adminSupportPage,
  adminDepositsPage,
  adminModulePage,
  adminRecordPage,
  accountPage,
  adminPaymentsPage,
  adminProviderDetailPage,
  resetPasswordPage,
} from "./page.js";
const config = loadConfig(process.env, 3000);
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", config.appUrl).pathname;
  const requestUrl = new URL(request.url ?? "/", config.appUrl);
  if (request.method === "GET" && path === "/health") {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        status: "ok",
        service: "web",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }
  const orderMatch = /^\/orders\/([0-9a-f-]{36})$/.exec(path),
    depositMatch = /^\/deposit\/([0-9a-f-]{36})$/.exec(path),
    adminRecord = /^\/admin\/(users|orders)\/([0-9a-f-]{36})$/.exec(path),
    providerRecord = /^\/admin\/providers\/([0-9a-f-]{36})$/.exec(path);
  if (request.method === "GET" && providerRecord) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      adminProviderDetailPage(config.apiUrl.origin, providerRecord[1]!),
    );
    return;
  }
  if (request.method === "GET" && adminRecord) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      adminRecordPage(
        config.apiUrl.origin,
        adminRecord[1] as "users" | "orders",
        adminRecord[2]!,
      ),
    );
    return;
  }
  if (request.method === "GET" && (orderMatch || depositMatch)) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      orderMatch
        ? orderDetailPage(config.apiUrl.origin, orderMatch[1]!)
        : depositDetailPage(config.apiUrl.origin, depositMatch![1]!),
    );
    return;
  }
  if (
    request.method === "GET" &&
    [
      "/",
      "/dashboard",
      "/admin",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/wallet",
      "/admin/wallet",
      "/services",
      "/orders",
      "/admin/catalog",
      "/admin/providers",
      "/api-docs",
      "/deposit",
      "/support",
      "/notifications",
      "/admin/support",
      "/admin/deposits",
      "/admin/users",
      "/admin/orders",
      "/admin/reports",
      "/admin/logs",
      "/admin/settings",
      "/admin/payments",
      "/account",
    ].includes(path)
  ) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader(
      "content-security-policy",
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ${config.apiUrl.origin}; img-src data: https://img.vietqr.io; base-uri 'none'; frame-ancestors 'none'`,
    );
    response.setHeader("x-content-type-options", "nosniff");
    const page =
      path === "/login" || path === "/"
        ? authPage("login", config.apiUrl.origin)
        : path === "/register"
          ? authPage("register", config.apiUrl.origin)
          : path === "/forgot-password"
            ? authPage("forgot", config.apiUrl.origin)
            : path === "/reset-password"
              ? resetPasswordPage(
                  config.apiUrl.origin,
                  requestUrl.searchParams.get("token") ?? "",
                )
              : path === "/wallet"
                ? walletPage(config.apiUrl.origin)
                : path === "/account"
                  ? accountPage(config.apiUrl.origin)
                  : path === "/services"
                    ? servicesPage(config.apiUrl.origin)
                    : path === "/orders"
                      ? ordersPage(config.apiUrl.origin)
                      : path === "/admin/catalog"
                        ? adminCatalogPage(config.apiUrl.origin)
                        : path === "/admin/providers"
                          ? adminProvidersPage(config.apiUrl.origin)
                          : path === "/admin/support"
                            ? adminSupportPage(config.apiUrl.origin)
                            : path === "/admin/payments"
                              ? adminPaymentsPage(config.apiUrl.origin)
                              : path === "/admin/deposits"
                                ? adminDepositsPage(config.apiUrl.origin)
                                : [
                                      "/admin/users",
                                      "/admin/orders",
                                      "/admin/reports",
                                      "/admin/logs",
                                      "/admin/settings",
                                    ].includes(path)
                                  ? adminModulePage(
                                      config.apiUrl.origin,
                                      path.split("/").at(-1) as any,
                                    )
                                  : [
                                        "/api-docs",
                                        "/deposit",
                                        "/support",
                                        "/notifications",
                                      ].includes(path)
                                    ? featurePage(
                                        path === "/api-docs"
                                          ? "api"
                                          : (path.slice(1) as any),
                                        config.apiUrl.origin,
                                      )
                                    : path === "/admin/wallet"
                                      ? adminWalletPage(config.apiUrl.origin)
                                      : panelPage(
                                          path === "/admin",
                                          config.apiUrl.origin,
                                        );
    response.end(page);
    return;
  }
  response.statusCode = 404;
  response.end("Not found");
});
server.listen(config.port, config.host, () =>
  console.log(
    JSON.stringify({
      level: "info",
      service: "web",
      event: "started",
      port: config.port,
    }),
  ),
);
function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
