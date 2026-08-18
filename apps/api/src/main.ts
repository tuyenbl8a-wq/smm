import { loadConfig } from "@smm/config";
import { createApiServer } from "./server.js";
import { AuthHandler } from "./auth/handler.js";
import { PrismaAuthStore } from "./auth/store.js";
import { WalletService } from "./wallet/service.js";
import { CatalogService } from "./catalog/service.js";
import { ProviderService } from "./provider/service.js";
import { OrderService } from "./order/service.js";
import { ResellerService } from "./reseller/service.js";
import { DistributedRateLimiter } from "./reseller/rate-limit.js";
import { RedisCounterClient } from "./reseller/redis.js";
import { OrderLifecycleService } from "./order/lifecycle.js";
import { DepositService } from "./payment/service.js";
import { SupportService } from "./support/service.js";
import { VietQrWebhook } from "./payment/vietqr.js";
import {
  BinanceMerchantProvider,
  BinanceWebhookProcessor,
} from "./payment/binance.js";
import { CassoWebhook } from "./payment/casso.js";
const config = loadConfig(process.env, 4000);
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;
const { PrismaClient } = await dynamicImport("@prisma/client");
const prisma = new PrismaClient();
const orderService = new OrderService(prisma);
const resellerService = new ResellerService(prisma, orderService);
const server = createApiServer(
  config,
  new AuthHandler(
    new PrismaAuthStore(prisma),
    config,
    new WalletService(prisma),
    new CatalogService(prisma),
    new ProviderService(prisma, config.encryptionKey),
    orderService,
    new OrderLifecycleService(prisma),
    resellerService,
    new DepositService(prisma),
    new SupportService(prisma),
  ),
  resellerService,
  new VietQrWebhook(prisma, process.env.VIETQR_WEBHOOK_SECRET ?? ""),
  new BinanceWebhookProcessor(
    prisma,
    new BinanceMerchantProvider(
      "https://bpay.binanceapi.com",
      process.env.BINANCE_MERCHANT_API_KEY ?? "",
      process.env.BINANCE_MERCHANT_SECRET ?? "",
      process.env.BINANCE_WEBHOOK_SECRET ?? "disabled",
    ),
  ),
  new DistributedRateLimiter(new RedisCounterClient(new URL(config.redisUrl))),
  new CassoWebhook(prisma, process.env.CASSO_WEBHOOK_SECURE_TOKEN ?? ""),
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
