import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { loadConfig } from "@smm/config";
import { authPage, landingPage } from "./page.js";
import { customerPage } from "./customer.js";
import { adminPage, isAdminRoute } from "./admin.js";
import { themeEditorPage, themePreviewPage } from "./theme-builder.js";
const config = loadConfig(process.env, 3001);
const browserHost = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return null;
  const host = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!host || host.length > 253 || /[\s\\/@]/.test(host)) return null;
  try {
    const parsed = new URL(`http://${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/")
      return null;
    return parsed.host;
  } catch {
    return null;
  }
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", config.appUrl),
    path = url.pathname;
  if (path.startsWith("/api/")) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const chunk of request as any) {
        size += chunk.length;
        if (size > 1_048_576) throw new Error("PAYLOAD_TOO_LARGE");
        chunks.push(chunk);
      }
    } catch {
      response.statusCode = 413;
      response.end("Payload too large");
      return;
    }
    const validatedHost = browserHost(request.headers.host);
    if (!validatedHost) {
      response.statusCode = 400;
      response.end("Invalid Host header");
      return;
    }
    const proxySecret =
      process.env.TENANT_PROXY_SECRET?.trim() || config.sessionSecret;
    const tenantHost = new URL(`http://${validatedHost}`).hostname;
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", proxySecret)
      .update(`${timestamp}\n${tenantHost}`)
      .digest("hex");
    const headers: Record<string, string> = {
      "x-smm-tenant-host": tenantHost,
      "x-smm-tenant-timestamp": timestamp,
      "x-smm-tenant-signature": signature,
    };
    for (const name of [
      "content-type",
      "cookie",
      "x-csrf-token",
      "idempotency-key",
      "accept",
    ]) {
      const value = request.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    try {
      const upstream = await fetch(new URL(path + url.search, config.apiUrl), {
        method: request.method ?? "GET",
        headers,
        body: ["GET", "HEAD"].includes(request.method ?? "GET")
          ? undefined
          : Buffer.concat(chunks),
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      response.statusCode = upstream.status;
      for (const name of [
        "content-type",
        "cache-control",
        "location",
        "retry-after",
      ]) {
        const value = upstream.headers.get(name);
        if (value) response.setHeader(name, value);
      }
      const cookies = (upstream.headers as any).getSetCookie?.() ?? [];
      if (cookies.length) response.setHeader("set-cookie", cookies);
      response.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    } catch {
      response.statusCode = 502;
      response.end("API upstream unavailable");
      return;
    }
  }
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
    "/": () => landingPage(""),
    "/services": () => landingPage(""),
    "/pricing": () => landingPage(""),
    "/help": () => landingPage(""),
    "/login": () => authPage("", "login"),
    "/register": () => authPage("", "register"),
    "/forgot-password": () => authPage("", "forgot"),
    "/reset-password": () =>
      authPage("", "reset", url.searchParams.get("token") ?? ""),
  };
  const customerRoute =
    path === "/dashboard" ||
    path === "/orders" ||
    path === "/orders/new" ||
    path === "/orders/bulk" ||
    /^\/orders\/(?:[0-9]{6,}|[0-9a-f-]{36})$/.test(path) ||
    path === "/services" ||
    path === "/wallet" ||
    path === "/deposit" ||
    /^\/deposit\/[0-9a-f-]{36}$/.test(path) ||
    path === "/transactions" ||
    path === "/panels" ||
    path === "/panels/new" ||
    /^\/panels\/activate\/[0-9a-f-]{36}$/.test(path) ||
    path === "/panel-plans" ||
    /^\/panels\/\d+$/.test(path) ||
    path === "/affiliate" ||
    path === "/api" ||
    path === "/support" ||
    /^\/support\/\d+$/.test(path) ||
    path === "/notifications" ||
    path === "/account";
  const editorMatch = /^\/admin\/themes\/([A-Z0-9_]+)\/editor$/.exec(path);
  const render =
    path === "/admin/theme-preview"
      ? () => themePreviewPage("", url)
      : editorMatch
        ? () => themeEditorPage(editorMatch[1] ?? null)
        : isAdminRoute(path)
          ? () => adminPage("", path)
          : customerRoute
            ? () => customerPage("", path)
            : pages[path];
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "content-security-policy",
    `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors ${path === "/admin/theme-preview" ? "'self'" : "'none'"}`,
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
