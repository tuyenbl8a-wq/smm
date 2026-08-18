import { createServer, type Server, type ServerResponse } from "node:http";
import type { AppConfig } from "@smm/config";
import { endpointFromUrl, probeTcp } from "@smm/health";
import type { HealthCheck } from "@smm/types";
import type { AuthHandler } from "./auth/handler.js";
import type { ResellerService } from "./reseller/service.js";
import type { VietQrWebhook } from "./payment/vietqr.js";
import type { BinanceWebhookProcessor } from "./payment/binance.js";
import type { DistributedRateLimiter } from "./reseller/rate-limit.js";
import type { CassoWebhook } from "./payment/casso.js";

function json(
  response: ServerResponse,
  status: number,
  payload:
    | HealthCheck
    | { success: false; error: { code: string; message: string } },
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(JSON.stringify(payload));
}
export function createApiServer(
  config: AppConfig,
  auth?: AuthHandler,
  reseller?: ResellerService,
  vietqr?: VietQrWebhook,
  binance?: BinanceWebhookProcessor,
  limiter?: DistributedRateLimiter,
  casso?: CassoWebhook,
): Server {
  return createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", config.apiUrl).pathname;
    const origin =
      typeof request.headers.origin === "string"
        ? request.headers.origin
        : undefined;
    if (origin === config.appUrl.origin) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("access-control-allow-credentials", "true");
      response.setHeader("vary", "origin");
    }
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      response.setHeader(
        "access-control-allow-headers",
        "content-type,x-csrf-token,idempotency-key",
      );
      response.end();
      return;
    }
    if (
      request.method === "POST" &&
      (path === "/webhooks/payments/vietqr" ||
        path === "/webhooks/payments/binance" ||
        path === "/webhooks/payments/casso")
    ) {
      const chunks: any[] = [];
      for await (const c of request as any) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        if (path.endsWith("vietqr")) {
          const sig = String(request.headers["x-webhook-signature"] ?? "");
          const result = await vietqr!.process(raw, sig);
          response.statusCode = 200;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify(result));
          return;
        }
        if (path.endsWith("casso")) {
          const token = String(
            request.headers["secure-token"] ??
              request.headers["x-casso-token"] ??
              "",
          );
          const result = await casso!.process(raw, token);
          response.statusCode = 200;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify(result));
          return;
        }
        const sig = String(request.headers["binancepay-signature"] ?? "");
        const result = await binance!.process(raw, sig);
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(result));
        return;
      } catch {
        response.statusCode = 401;
        response.end(JSON.stringify({ error: "Webhook rejected" }));
        return;
      }
    }
    if (request.method === "GET" && path === "/health") {
      json(response, 200, {
        status: "ok",
        service: "api",
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (request.method === "POST" && path === "/api/v2" && reseller) {
      try {
        const chunks: any[] = [];
        for await (const chunk of request as any) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8"),
          input = raw.trim().startsWith("{")
            ? JSON.parse(raw)
            : Object.fromEntries(new URLSearchParams(raw));
        const rawKey = String(input.key ?? request.headers["x-api-key"] ?? ""),
          identity = await reseller.authenticate(rawKey);
        if (limiter) {
          const result = await limiter.consume(
            `${identity.id}:${request.socket.remoteAddress ?? "unknown"}`,
            Number(identity.rateLimit ?? 60),
          );
          response.setHeader("x-ratelimit-remaining", String(result.remaining));
          if (!result.allowed) {
            response.statusCode = 429;
            response.setHeader("retry-after", String(result.retryAfter));
            response.setHeader("content-type", "application/json");
            response.end(
              JSON.stringify({
                error: "Rate limit exceeded",
                code: "RATE_LIMITED",
              }),
            );
            return;
          }
        }
        const data = await reseller.execute(rawKey, input, identity);
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(data));
        return;
      } catch (error: any) {
        response.statusCode = String(error?.message).startsWith("REDIS_")
          ? 503
          : error?.code === "RATE_LIMITED"
            ? 429
            : 400;
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({ error: error?.message ?? "Request failed" }),
        );
        return;
      }
    }
    if (auth && (await auth.handle(request, response, path))) return;
    if (request.method === "GET" && path === "/health/ready") {
      const [database, redis] = await Promise.all([
        probeTcp(endpointFromUrl(config.databaseUrl), config.healthTimeoutMs),
        probeTcp(endpointFromUrl(config.redisUrl), config.healthTimeoutMs),
      ]);
      const ready = database && redis;
      json(response, ready ? 200 : 503, {
        status: ready ? "ok" : "error",
        service: "api",
        timestamp: new Date().toISOString(),
        checks: {
          database: database ? "up" : "down",
          redis: redis ? "up" : "down",
        },
      });
      return;
    }
    json(response, 404, {
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
}
