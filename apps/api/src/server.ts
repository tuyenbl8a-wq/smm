import { createServer, type Server, type ServerResponse } from "node:http";
import type { AppConfig } from "@smm/config";
import { endpointFromUrl, probeTcp } from "@smm/health";
import type { HealthCheck } from "@smm/types";

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
export function createApiServer(config: AppConfig): Server {
  return createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", config.apiUrl).pathname;
    if (request.method === "GET" && path === "/health") {
      json(response, 200, {
        status: "ok",
        service: "api",
        timestamp: new Date().toISOString(),
      });
      return;
    }
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
