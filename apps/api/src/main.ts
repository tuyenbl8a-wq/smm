import { loadConfig } from "@smm/config";
import { createApiServer } from "./server.js";
import { AuthHandler } from "./auth/handler.js";
import { PrismaAuthStore } from "./auth/store.js";
import { WalletService } from "./wallet/service.js";
const config = loadConfig(process.env, 4000);
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;
const { PrismaClient } = await dynamicImport("@prisma/client");
const prisma = new PrismaClient();
const server = createApiServer(
  config,
  new AuthHandler(
    new PrismaAuthStore(prisma),
    config,
    new WalletService(prisma),
  ),
);
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
    void prisma.$disconnect();
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
