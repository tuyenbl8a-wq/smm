import { createServer } from "node:http";
import { loadConfig } from "@smm/config";
import { endpointFromUrl, probeTcp } from "@smm/health";
const config = loadConfig(process.env, 4100);
const server = createServer(async (request, response) => {
  const path = new URL(
    request.url ?? "/",
    `http://${config.host}:${config.port}`,
  ).pathname;
  if (
    request.method !== "GET" ||
    (path !== "/health" && path !== "/health/ready")
  ) {
    response.statusCode = 404;
    response.end();
    return;
  }
  let checks: Record<string, "up" | "down"> | undefined;
  let ready = true;
  if (path.endsWith("ready")) {
    const [database, redis] = await Promise.all([
      probeTcp(endpointFromUrl(config.databaseUrl), config.healthTimeoutMs),
      probeTcp(endpointFromUrl(config.redisUrl), config.healthTimeoutMs),
    ]);
    ready = database && redis;
    checks = {
      database: database ? "up" : "down",
      redis: redis ? "up" : "down",
    };
  }
  response.statusCode = ready ? 200 : 503;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(
    JSON.stringify({
      status: ready ? "ok" : "error",
      service: "worker",
      timestamp: new Date().toISOString(),
      ...(checks ? { checks } : {}),
    }),
  );
});
server.listen(config.port, config.host, () =>
  console.log(
    JSON.stringify({
      level: "info",
      service: "worker",
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
