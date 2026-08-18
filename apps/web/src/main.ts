import { createServer } from "node:http";
import { loadConfig } from "@smm/config";
import { authPage, panelPage } from "./page.js";
const config = loadConfig(process.env, 3000);
const server = createServer((request, response) => {
  const path = new URL(request.url ?? "/", config.appUrl).pathname;
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
  if (
    request.method === "GET" &&
    [
      "/",
      "/dashboard",
      "/admin",
      "/login",
      "/register",
      "/forgot-password",
    ].includes(path)
  ) {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader(
      "content-security-policy",
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ${config.apiUrl.origin}; img-src data:; base-uri 'none'; frame-ancestors 'none'`,
    );
    response.setHeader("x-content-type-options", "nosniff");
    const page =
      path === "/login" || path === "/"
        ? authPage("login", config.apiUrl.origin)
        : path === "/register"
          ? authPage("register", config.apiUrl.origin)
          : path === "/forgot-password"
            ? authPage("forgot", config.apiUrl.origin)
            : panelPage(path === "/admin", config.apiUrl.origin);
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
