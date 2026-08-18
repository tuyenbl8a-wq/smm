import { loadConfig } from "@smm/config";
import { createApiServer } from "./server.js";
const config = loadConfig(process.env, 4000);
const server = createApiServer(config);
server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      service: "api",
      event: "started",
      port: config.port,
    }),
  );
});
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
