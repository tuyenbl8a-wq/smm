import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppConfig } from "@smm/config";
import type { AuthStore, AuthUser } from "./store.js";
import { canAccessAdmin } from "../admin/dashboard.js";
import { WalletError, type WalletService } from "../wallet/service.js";
import { CatalogError, type CatalogService } from "../catalog/service.js";
import {
  ProviderConfigError,
  type ProviderService,
} from "../provider/service.js";
import { OrderError, type OrderService } from "../order/service.js";
import { OrderLifecycleService } from "../order/lifecycle.js";
import { ResellerService } from "../reseller/service.js";
import { DepositService, PaymentError } from "../payment/service.js";
import { SupportError, SupportService } from "../support/service.js";
import {
  AdminOperationError,
  AdminOperationsService,
} from "../admin/operations.js";
import { PaymentSettingsService } from "../payment/settings.js";
import { stringifyJson } from "../http/json.js";
import type { LocalStorage } from "../storage/local.js";
import { PromotionError, PromotionService } from "../promotion/service.js";
import { endpointFromUrl, probeTcp } from "@smm/health";
import {
  csrfValue,
  hashPassword,
  opaqueToken,
  tokenHash,
  verifyCsrf,
  verifyPassword,
} from "./security.js";

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const authPaths = new Set([
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
]);
export class AuthHandler {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly store: AuthStore,
    private readonly config: AppConfig,
    private readonly wallet?: WalletService,
    private readonly catalog?: CatalogService,
    private readonly providers?: ProviderService,
    private readonly orders?: OrderService,
    private readonly lifecycle?: OrderLifecycleService,
    private readonly reseller?: ResellerService,
    private readonly deposits?: DepositService,
    private readonly support?: SupportService,
    private readonly admin?: AdminOperationsService,
    private readonly paymentSettings?: PaymentSettingsService,
    private readonly storage?: LocalStorage,
    private readonly promotions?: PromotionService,
  ) {}
  async handle(
    request: IncomingMessage,
    response: ServerResponse,
    path: string,
  ): Promise<boolean> {
    if (
      !path.startsWith("/api/v1/auth") &&
      path !== "/api/v1/me" &&
      !path.startsWith("/api/v1/customer") &&
      !path.startsWith("/api/v1/admin")
    )
      return false;
    try {
      if (authPaths.has(path)) this.checkBurst(request, path);
      if (request.method === "POST" && path === "/api/v1/auth/register")
        return await this.register(request, response);
      if (request.method === "POST" && path === "/api/v1/auth/login")
        return await this.login(request, response);
      if (request.method === "POST" && path === "/api/v1/auth/forgot-password")
        return await this.forgot(request, response);
      if (request.method === "POST" && path === "/api/v1/auth/reset-password")
        return await this.reset(request, response);
      const auth = await this.authenticate(request);
      if (!auth)
        return this.error(
          response,
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication required",
        );
      if (
        path.startsWith("/api/v1/customer") &&
        this.admin &&
        !canAccessAdmin(auth.access, "settings.manage")
      ) {
        const maintenance = await this.admin.maintenance();
        if (maintenance.enabled)
          return this.error(
            response,
            503,
            "MAINTENANCE_MODE",
            maintenance.message,
          );
      }
      if (request.method === "GET" && path === "/api/v1/me")
        return this.ok(response, {
          user: this.publicUser(auth.user),
          ...auth.access,
        });
      if (request.method === "GET" && path === "/api/v1/auth/sessions")
        return this.ok(response, {
          sessions: await this.store.listSessions(auth.user.id),
        });
      if (request.method === "GET" && path === "/api/v1/customer/wallet") {
        if (!this.wallet) throw new Error("Wallet service unavailable");
        return this.ok(response, await this.wallet.summary(auth.user.id));
      }
      if (request.method === "GET" && path === "/api/v1/customer/price-group") {
        if (!this.admin) throw new Error("Admin service unavailable");
        return this.ok(
          response,
          await this.admin.customerPriceGroup(auth.user.id),
        );
      }
      if (request.method === "GET" && path === "/api/v1/customer/settings")
        return this.ok(response, await this.admin!.publicSettings());
      if (request.method === "GET" && path === "/api/v1/customer/catalog") {
        if (!this.catalog) throw new Error("Catalog service unavailable");
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.catalog.customerCatalog(auth.user.id, {
            page: Number(url.searchParams.get("page") ?? "1"),
            limit: Number(url.searchParams.get("limit") ?? "50"),
            ...(url.searchParams.get("category")
              ? { category: url.searchParams.get("category")! }
              : {}),
            ...(url.searchParams.get("search")
              ? { search: url.searchParams.get("search")! }
              : {}),
          }),
        );
      }
      if (request.method === "GET" && path === "/api/v1/customer/referral")
        return this.ok(
          response,
          await this.promotions!.referralSummary(auth.user.id),
        );
      if (request.method === "GET" && path === "/api/v1/admin/coupons") {
        if (!canAccessAdmin(auth.access, "services.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const query = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.promotions!.listCoupons(
            query.searchParams.get("search") ?? "",
          ),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/referrals") {
        if (!canAccessAdmin(auth.access, "reports.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.promotions!.adminReferrals());
      }
      if (
        request.method === "GET" &&
        path === "/api/v1/customer/wallet/transactions"
      ) {
        if (!this.wallet) throw new Error("Wallet service unavailable");
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.wallet.history(
            auth.user.id,
            Number(url.searchParams.get("page") ?? "1"),
            Number(url.searchParams.get("limit") ?? "20"),
          ),
        );
      }
      if (request.method === "GET" && path === "/api/v1/customer/orders") {
        if (!this.orders) throw new Error("Order service unavailable");
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.orders.list(
            auth.user.id,
            Number(url.searchParams.get("page") ?? "1"),
            Number(url.searchParams.get("limit") ?? "20"),
          ),
        );
      }
      const orderDetail = /^\/api\/v1\/customer\/orders\/([0-9a-f-]{36})$/.exec(
        path,
      );
      if (request.method === "GET" && orderDetail)
        return this.ok(
          response,
          await this.orders!.detail(auth.user.id, orderDetail[1]!),
        );
      if (request.method === "GET" && path === "/api/v1/customer/api-keys")
        return this.ok(response, await this.reseller!.list(auth.user.id));
      if (
        request.method === "GET" &&
        path === "/api/v1/customer/payment-methods"
      )
        return this.ok(response, await this.deposits!.methods());
      if (request.method === "GET" && path === "/api/v1/customer/deposits")
        return this.ok(response, await this.deposits!.history(auth.user.id));
      const depositDetail =
        /^\/api\/v1\/customer\/deposits\/([0-9a-f-]{36})$/.exec(path);
      if (request.method === "GET" && depositDetail)
        return this.ok(
          response,
          await this.deposits!.detail(auth.user.id, depositDetail[1]!),
        );
      if (request.method === "GET" && path === "/api/v1/customer/tickets")
        return this.ok(response, await this.support!.list(auth.user.id));
      const ticketDetail = /^\/api\/v1\/customer\/tickets\/(\d+)$/.exec(path);
      if (request.method === "GET" && ticketDetail)
        return this.ok(
          response,
          await this.support!.detail(auth.user.id, BigInt(ticketDetail[1]!)),
        );
      if (request.method === "GET" && path === "/api/v1/customer/notifications")
        return this.ok(
          response,
          await this.support!.notifications(auth.user.id),
        );
      if (
        request.method === "GET" &&
        path === "/api/v1/customer/notifications/unread-count"
      )
        return this.ok(response, await this.support!.unreadCount(auth.user.id));
      if (request.method === "GET" && path === "/api/v1/admin/users") {
        if (!canAccessAdmin(auth.access, "users.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.admin!.users(Object.fromEntries(url.searchParams)),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/staff") {
        if (!canAccessAdmin(auth.access, "staff.view"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.admin!.staff());
      }
      if (request.method === "GET" && path === "/api/v1/admin/price-groups") {
        if (!canAccessAdmin(auth.access, "users.pricing.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.admin!.priceGroupConfiguration());
      }
      const adminUser = /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(path);
      if (request.method === "GET" && adminUser) {
        if (!canAccessAdmin(auth.access, "users.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.admin!.user(adminUser[1]!));
      }
      if (request.method === "GET" && path === "/api/v1/admin/orders") {
        if (!canAccessAdmin(auth.access, "orders.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.admin!.orders(Object.fromEntries(url.searchParams)),
        );
      }
      const adminOrder = /^\/api\/v1\/admin\/orders\/([0-9a-f-]{36})$/.exec(
        path,
      );
      if (request.method === "GET" && adminOrder) {
        if (!canAccessAdmin(auth.access, "orders.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.admin!.order(adminOrder[1]!));
      }
      if (request.method === "GET" && path === "/api/v1/admin/reports") {
        if (!canAccessAdmin(auth.access, "reports.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.admin!.reports(
            url.searchParams.get("from")
              ? new Date(url.searchParams.get("from")!)
              : undefined,
            url.searchParams.get("to")
              ? new Date(url.searchParams.get("to")!)
              : undefined,
          ),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/reports/trend") {
        if (!canAccessAdmin(auth.access, "reports.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const query = new URL(request.url ?? path, this.config.apiUrl),
          from = query.searchParams.get("from") ?? "",
          to = query.searchParams.get("to") ?? "";
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(to)
        )
          throw new InputError("REPORT_RANGE_INVALID", "Invalid report range");
        return this.ok(response, await this.admin!.reportTrend(from, to));
      }
      if (request.method === "GET" && path === "/api/v1/admin/reports.csv") {
        if (!canAccessAdmin(auth.access, "reports.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl),
          from = url.searchParams.get("from"),
          to = url.searchParams.get("to");
        response.statusCode = 200;
        response.setHeader("content-type", "text/csv; charset=utf-8");
        response.setHeader(
          "content-disposition",
          'attachment; filename="bao-cao-smm.csv"',
        );
        response.setHeader("cache-control", "no-store");
        response.end(
          await this.admin!.reportsCsv(
            from ? new Date(from) : undefined,
            to ? new Date(to) : undefined,
          ),
        );
        return true;
      }
      if (request.method === "GET" && path === "/api/v1/admin/logs") {
        if (
          !canAccessAdmin(auth.access, "logs.read") &&
          !canAccessAdmin(auth.access, "audit.read")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.admin!.logs(
            url.searchParams.get("kind") ?? "audit",
            Number(url.searchParams.get("page") ?? 1),
            Number(url.searchParams.get("limit") ?? 50),
          ),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/settings") {
        if (!canAccessAdmin(auth.access, "settings.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.admin!.settings());
      }
      if (
        request.method === "GET" &&
        path === "/api/v1/admin/payment-settings"
      ) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, await this.paymentSettings!.adminView());
      }
      if (
        request.method === "GET" &&
        path === "/api/v1/admin/payment-methods"
      ) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.paymentSettings!.methods(
            url.searchParams.get("includeInactive") !== "false",
          ),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/tickets") {
        if (!canAccessAdmin(auth.access, "tickets.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const u = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.support!.adminInbox(Object.fromEntries(u.searchParams)),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/system-status") {
        if (!canAccessAdmin(auth.access, "settings.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const [database, redis] = await Promise.all([
          probeTcp(
            endpointFromUrl(this.config.databaseUrl),
            this.config.healthTimeoutMs,
          ),
          probeTcp(
            endpointFromUrl(this.config.redisUrl),
            this.config.healthTimeoutMs,
          ),
        ]);
        return this.ok(response, {
          checkedAt: new Date(),
          api: { status: "healthy", message: "API đang hoạt động" },
          database: { status: database ? "healthy" : "down" },
          redis: { status: redis ? "healthy" : "down" },
          email: {
            status: process.env.SMTP_HOST ? "healthy" : "not_configured",
            message: process.env.SMTP_HOST
              ? "SMTP đã cấu hình"
              : "SMTP chưa cấu hình",
          },
          storage: {
            status: this.storage ? "healthy" : "not_configured",
            message: this.storage
              ? "Kho tệp riêng tư khả dụng"
              : "Cần cấu hình lưu trữ bền vững",
          },
          payments: {
            casso: process.env.CASSO_WEBHOOK_SECURE_TOKEN
              ? "healthy"
              : "not_configured",
            binance: process.env.BINANCE_MERCHANT_API_KEY
              ? "healthy"
              : "not_configured",
          },
        });
      }
      if (request.method === "GET" && path === "/api/v1/admin/deposits") {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const u = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.deposits!.adminHistory({
            ...(u.searchParams.get("status")
              ? { status: u.searchParams.get("status")! }
              : {}),
            ...(u.searchParams.get("method")
              ? { method: u.searchParams.get("method")! }
              : {}),
            ...(u.searchParams.get("user")
              ? { user: u.searchParams.get("user")! }
              : {}),
            ...(u.searchParams.get("transactionId")
              ? { transactionId: u.searchParams.get("transactionId")! }
              : {}),
            ...(u.searchParams.get("from")
              ? { from: u.searchParams.get("from")! }
              : {}),
            ...(u.searchParams.get("to")
              ? { to: u.searchParams.get("to")! }
              : {}),
            take: Number(u.searchParams.get("limit") ?? "50"),
          }),
        );
      }
      const adminTicket = /^\/api\/v1\/admin\/tickets\/(\d+)$/.exec(path);
      if (request.method === "GET" && adminTicket) {
        if (!canAccessAdmin(auth.access, "tickets.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.support!.detail(
            auth.user.id,
            BigInt(adminTicket[1]!),
            true,
          ),
        );
      }
      const adminAttachmentDownload =
        /^\/api\/v1\/admin\/attachments\/([0-9a-f-]{36})$/.exec(path);
      if (request.method === "GET" && adminAttachmentDownload) {
        if (!canAccessAdmin(auth.access, "tickets.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return await this.downloadAttachment(
          response,
          auth.user.id,
          adminAttachmentDownload[1]!,
          true,
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/catalog") {
        if (!canAccessAdmin(auth.access, "services.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.catalog) throw new Error("Catalog service unavailable");
        return this.ok(response, await this.catalog.adminOverview());
      }
      if (request.method === "GET" && path === "/api/v1/admin/services") {
        if (
          !canAccessAdmin(auth.access, "services.view") &&
          !canAccessAdmin(auth.access, "services.manage")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.catalog!.adminOverview(
            canAccessAdmin(auth.access, "pricing.view") ||
              canAccessAdmin(auth.access, "pricing.manage"),
          ),
        );
      }
      if (
        request.method === "GET" &&
        (path === "/api/v1/admin/pricing" ||
          path === "/api/v1/admin/pricing/alerts")
      ) {
        if (
          !canAccessAdmin(auth.access, "pricing.view") &&
          !canAccessAdmin(auth.access, "services.manage")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.catalog) throw new Error("Catalog service unavailable");
        return this.ok(
          response,
          path.endsWith("/alerts")
            ? await this.catalog.pricingAlerts()
            : await this.catalog.adminOverview(),
        );
      }
      if (request.method === "GET" && path === "/api/v1/admin/providers") {
        if (!canAccessAdmin(auth.access, "providers.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.providers) throw new Error("Provider service unavailable");
        return this.ok(response, await this.providers.list());
      }
      const providerDetail =
          /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})$/.exec(path),
        providerServices =
          /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})\/services$/.exec(path),
        providerSyncLogs =
          /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})\/sync-logs$/.exec(
            path,
          );
      if (request.method === "GET" && providerServices) {
        if (
          !canAccessAdmin(auth.access, "providers.view") &&
          !canAccessAdmin(auth.access, "providers.manage")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.providers!.fetchServices(
            providerServices[1]!,
            Object.fromEntries(url.searchParams),
          ),
        );
      }
      if (request.method === "GET" && providerSyncLogs) {
        if (
          !canAccessAdmin(auth.access, "providers.view") &&
          !canAccessAdmin(auth.access, "providers.manage")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const url = new URL(request.url ?? path, this.config.apiUrl);
        return this.ok(
          response,
          await this.providers!.syncLogs(
            providerSyncLogs[1]!,
            Number(url.searchParams.get("page") ?? "1"),
          ),
        );
      }
      if (request.method === "GET" && providerDetail) {
        if (!canAccessAdmin(auth.access, "providers.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.providers!.detail(providerDetail[1]!),
        );
      }
      const adminWallet =
        /^\/api\/v1\/admin\/wallets\/([0-9a-f-]{36})(?:\/transactions|\/mutations)?$/.exec(
          path,
        );
      if (request.method === "GET" && adminWallet) {
        if (!canAccessAdmin(auth.access))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.wallet) throw new Error("Wallet service unavailable");
        if (path.endsWith("/transactions")) {
          const url = new URL(request.url ?? path, this.config.apiUrl);
          return this.ok(
            response,
            await this.wallet.history(
              adminWallet[1]!,
              Number(url.searchParams.get("page") ?? "1"),
              Number(url.searchParams.get("limit") ?? "20"),
            ),
          );
        }
        return this.ok(response, await this.wallet.summary(adminWallet[1]!));
      }
      if (request.method === "POST") {
        const csrf = this.cookie(request, "smm_csrf");
        const header = this.header(request, "x-csrf-token");
        if (
          !csrf ||
          csrf !== header ||
          !verifyCsrf(csrf, auth.rawToken, this.config.sessionSecret)
        )
          return this.error(
            response,
            403,
            "CSRF_INVALID",
            "Invalid CSRF token",
          );
      }
      if (request.method === "POST" && path === "/api/v1/customer/orders") {
        this.checkBurst(request, "customer-order-create");
        if (!this.orders) throw new Error("Order service unavailable");
        const key = this.header(request, "idempotency-key");
        if (!key)
          throw new InputError(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key header is required",
          );
        return this.ok(
          response,
          await this.orders.create(auth.user.id, await this.body(request), key),
        );
      }
      const userUpdate = /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(
          path,
        ),
        userRoles = /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})\/roles$/.exec(
          path,
        ),
        userSessions =
          /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})\/revoke-sessions$/.exec(
            path,
          );
      const userPriceGroup =
        /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})\/price-group$/.exec(path);
      if (request.method === "POST" && userPriceGroup) {
        if (!canAccessAdmin(auth.access, "users.pricing.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.assignPriceGroup(
            auth.user.id,
            userPriceGroup[1]!,
            await this.body(request),
          ),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/users/price-group/bulk/preview"
      ) {
        if (!canAccessAdmin(auth.access, "users.pricing.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.bulkPriceGroupPreview(await this.body(request)),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/users/price-group/bulk/apply"
      ) {
        if (!canAccessAdmin(auth.access, "users.pricing.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.bulkAssignPriceGroup(
            auth.user.id,
            await this.body(request),
          ),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/price-groups/settings"
      ) {
        if (!canAccessAdmin(auth.access, "users.pricing.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.updatePriceGroupSettings(
            auth.user.id,
            await this.body(request),
          ),
        );
      }
      if (request.method === "POST" && userUpdate) {
        if (
          !canAccessAdmin(auth.access, "users.update") &&
          !canAccessAdmin(auth.access, "users.ban")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.updateUser(
            auth.user.id,
            userUpdate[1]!,
            await this.body(request),
          ),
        );
      }
      if (request.method === "POST" && userRoles) {
        if (!canAccessAdmin(auth.access, "users.update"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const body = await this.body(request);
        const roles = Array.isArray(body.roles)
          ? body.roles.map((role) => String(role))
          : [];
        return this.ok(
          response,
          await this.admin!.roles(auth.user.id, userRoles[1]!, roles),
        );
      }
      if (request.method === "POST" && userSessions) {
        if (!canAccessAdmin(auth.access, "users.update"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.revokeSessions(auth.user.id, userSessions[1]!),
        );
      }
      if (request.method === "POST" && path === "/api/v1/admin/staff") {
        if (!canAccessAdmin(auth.access, "staff.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const body = await this.body(request),
          resetToken = opaqueToken(),
          staff = await this.admin!.createStaff(auth.user.id, {
            ...body,
            passwordHash: await hashPassword(opaqueToken(48)),
            referralCode: opaqueToken(9).toUpperCase(),
          });
        await this.store.createPasswordReset(
          staff.id,
          tokenHash(resetToken),
          new Date(Date.now() + 60 * 60 * 1000),
        );
        return this.ok(response, {
          staff,
          resetToken:
            this.config.environment === "development" ? resetToken : undefined,
          resetRequired: true,
        });
      }
      const staffUpdate = /^\/api\/v1\/admin\/staff\/([0-9a-f-]{36})$/.exec(
          path,
        ),
        adminReset =
          /^\/api\/v1\/admin\/users\/([0-9a-f-]{36})\/password-reset$/.exec(
            path,
          );
      if (request.method === "POST" && staffUpdate) {
        if (!canAccessAdmin(auth.access, "staff.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.updateStaff(
            auth.user.id,
            auth.access.permissions,
            staffUpdate[1]!,
            await this.body(request),
            auth.access.roles.includes("SUPER_ADMIN"),
          ),
        );
      }
      if (request.method === "POST" && adminReset) {
        if (!canAccessAdmin(auth.access, "users.security.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const token = opaqueToken();
        await this.store.createPasswordReset(
          adminReset[1]!,
          tokenHash(token),
          new Date(Date.now() + 60 * 60 * 1000),
        );
        await this.admin!.revokeSessions(auth.user.id, adminReset[1]!);
        await this.admin!.recordSecurityAction(
          auth.user.id,
          adminReset[1]!,
          "USER_PASSWORD_RESET_ISSUED",
        );
        return this.ok(response, {
          resetToken:
            this.config.environment === "development" ? token : undefined,
          expiresInSeconds: 3600,
        });
      }
      if (request.method === "POST" && path === "/api/v1/admin/settings") {
        if (!canAccessAdmin(auth.access, "settings.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.admin!.updateSettings(
            auth.user.id,
            await this.body(request),
          ),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/payment-settings"
      ) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.paymentSettings!.update(
            auth.user.id,
            await this.body(request),
          ),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/payment-methods"
      ) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.paymentSettings!.saveMethod(
            auth.user.id,
            null,
            await this.body(request),
          ),
        );
      }
      const paymentMethodUpdate =
        /^\/api\/v1\/admin\/payment-methods\/([0-9a-f-]{36})$/.exec(path);
      const paymentMethodTest =
        /^\/api\/v1\/admin\/payment-methods\/([0-9a-f-]{36})\/test$/.exec(path);
      if (request.method === "POST" && paymentMethodTest) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.paymentSettings!.testMethod(paymentMethodTest[1]!),
        );
      }
      if (request.method === "POST" && paymentMethodUpdate) {
        if (!canAccessAdmin(auth.access, "payments.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.paymentSettings!.saveMethod(
            auth.user.id,
            paymentMethodUpdate[1]!,
            await this.body(request),
          ),
        );
      }
      if (request.method === "POST" && path === "/api/v1/customer/api-keys")
        return this.ok(response, await this.reseller!.generate(auth.user.id));
      const keyDisable =
        /^\/api\/v1\/customer\/api-keys\/([0-9a-f-]{36})\/disable$/.exec(path);
      if (request.method === "POST" && keyDisable)
        return this.ok(
          response,
          await this.reseller!.disable(auth.user.id, keyDisable[1]!),
        );
      if (request.method === "POST" && path === "/api/v1/customer/deposits")
        return this.ok(
          response,
          await this.deposits!.create(auth.user.id, await this.body(request)),
        );
      if (
        request.method === "POST" &&
        path === "/api/v1/customer/coupons/preview"
      ) {
        const body = await this.body(request);
        return this.ok(
          response,
          await this.promotions!.preview(auth.user.id, body.code, body.amount),
        );
      }
      if (request.method === "POST" && path === "/api/v1/admin/coupons") {
        if (!canAccessAdmin(auth.access, "services.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.promotions!.saveCoupon(
            auth.user.id,
            await this.body(request),
          ),
        );
      }
      if (
        request.method === "POST" &&
        path === "/api/v1/admin/reports/rebuild"
      ) {
        if (!canAccessAdmin(auth.access, "reports.read"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        const body = await this.body(request),
          date = String(body.date ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
          throw new InputError("REPORT_DATE_INVALID", "Invalid report date");
        return this.ok(
          response,
          await this.admin!.rebuildReport(auth.user.id, date),
        );
      }
      const couponUpdate = /^\/api\/v1\/admin\/coupons\/([0-9a-f-]{36})$/.exec(
        path,
      );
      if (request.method === "POST" && couponUpdate) {
        if (!canAccessAdmin(auth.access, "services.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(
          response,
          await this.promotions!.saveCoupon(
            auth.user.id,
            await this.body(request),
            couponUpdate[1]!,
          ),
        );
      }
      if (request.method === "POST" && path === "/api/v1/customer/tickets")
        return this.ok(
          response,
          await this.support!.create(auth.user.id, await this.body(request)),
        );
      const adminAttachmentUpload =
        /^\/api\/v1\/admin\/tickets\/(\d+)\/attachments$/.exec(path);
      if (request.method === "POST" && adminAttachmentUpload) {
        if (!canAccessAdmin(auth.access, "tickets.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return await this.uploadAttachment(
          request,
          response,
          auth.user.id,
          BigInt(adminAttachmentUpload[1]!),
          true,
        );
      }
      const customerAttachmentUpload =
          /^\/api\/v1\/customer\/tickets\/(\d+)\/attachments$/.exec(path),
        customerAttachmentDownload =
          /^\/api\/v1\/customer\/attachments\/([0-9a-f-]{36})$/.exec(path);
      if (request.method === "POST" && customerAttachmentUpload)
        return await this.uploadAttachment(
          request,
          response,
          auth.user.id,
          BigInt(customerAttachmentUpload[1]!),
          false,
        );
      if (request.method === "GET" && customerAttachmentDownload)
        return await this.downloadAttachment(
          response,
          auth.user.id,
          customerAttachmentDownload[1]!,
          false,
        );
      const ticketReply = /^\/api\/v1\/customer\/tickets\/(\d+)\/reply$/.exec(
        path,
      );
      if (request.method === "POST" && ticketReply)
        return this.ok(
          response,
          await this.support!.reply(
            auth.user.id,
            BigInt(ticketReply[1]!),
            await this.body(request),
          ),
        );
      const notificationRead =
        /^\/api\/v1\/customer\/notifications\/([0-9a-f-]{36})\/read$/.exec(
          path,
        );
      if (
        request.method === "POST" &&
        path === "/api/v1/customer/notifications/read-all"
      )
        return this.ok(response, await this.support!.markAllRead(auth.user.id));
      if (request.method === "POST" && notificationRead)
        return this.ok(
          response,
          await this.support!.markRead(auth.user.id, notificationRead[1]!),
        );
      const lifecycle =
        /^\/api\/v1\/customer\/orders\/([0-9a-f-]{36})\/(refill|cancel)$/.exec(
          path,
        );
      if (request.method === "POST" && lifecycle) {
        const key = this.header(request, "idempotency-key");
        if (!key)
          throw new InputError(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key required",
          );
        return this.ok(
          response,
          await this.lifecycle!.request(
            auth.user.id,
            lifecycle[1]!,
            lifecycle[2] as any,
            key,
          ),
        );
      }
      if (request.method === "POST" && path === "/api/v1/auth/logout") {
        await this.store.revokeSession(auth.session.id);
        this.clearCookies(response);
        return this.ok(response, { loggedOut: true });
      }
      if (
        request.method === "POST" &&
        path.startsWith("/api/v1/admin/pricing/")
      ) {
        this.checkBurst(request, "admin-pricing-mutation");
        if (
          !canAccessAdmin(auth.access, "pricing.manage") &&
          !canAccessAdmin(auth.access, "services.manage")
        )
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.catalog) throw new Error("Catalog service unavailable");
        const body = await this.body(request);
        if (path === "/api/v1/admin/pricing/simple/preview")
          return this.ok(
            response,
            await this.catalog.simplePricingPreview(body),
          );
        if (path === "/api/v1/admin/pricing/simple/apply")
          return this.ok(
            response,
            await this.catalog.simplePricingApply(auth.user.id, body),
          );
        if (path === "/api/v1/admin/pricing/bulk/preview")
          return this.ok(response, await this.catalog.bulkPreview(body));
        if (path === "/api/v1/admin/pricing/bulk/apply")
          return this.ok(
            response,
            await this.catalog.bulkApply(auth.user.id, body),
          );
        const alert =
          /^\/api\/v1\/admin\/pricing\/alerts\/([0-9a-f-]{36})\/resolve$/.exec(
            path,
          );
        if (alert)
          return this.ok(
            response,
            await this.catalog.resolvePricingAlert(auth.user.id, alert[1]!),
          );
      }
      if (
        request.method === "POST" &&
        path.startsWith("/api/v1/admin/catalog/")
      ) {
        this.checkBurst(request, "admin-catalog-mutation");
        if (!canAccessAdmin(auth.access, "services.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.catalog) throw new Error("Catalog service unavailable");
        const body = await this.body(request);
        if (path === "/api/v1/admin/catalog/platforms")
          return this.ok(
            response,
            await this.catalog.createPlatform(auth.user.id, body),
          );
        if (path === "/api/v1/admin/catalog/categories")
          return this.ok(
            response,
            await this.catalog.createCategory(auth.user.id, body),
          );
        if (path === "/api/v1/admin/catalog/services")
          return this.ok(
            response,
            await this.catalog.createService(auth.user.id, body),
          );
        if (path === "/api/v1/admin/catalog/price-groups")
          return this.ok(
            response,
            await this.catalog.createPriceGroup(auth.user.id, body),
          );
        if (path === "/api/v1/admin/catalog/price-rules")
          return this.ok(
            response,
            await this.catalog.upsertPriceRule(auth.user.id, body),
          );
        if (path === "/api/v1/admin/catalog/mappings")
          return this.ok(
            response,
            await this.catalog.upsertMapping(auth.user.id, body),
          );
        const category =
          /^\/api\/v1\/admin\/catalog\/categories\/([0-9a-f-]{36})\/update$/.exec(
            path,
          );
        if (category)
          return this.ok(
            response,
            await this.catalog.updateCategory(auth.user.id, category[1]!, body),
          );
        const platform =
          /^\/api\/v1\/admin\/catalog\/platforms\/([0-9a-f-]{36})\/update$/.exec(
            path,
          );
        if (platform)
          return this.ok(
            response,
            await this.catalog.updatePlatform(auth.user.id, platform[1]!, body),
          );
        const service =
          /^\/api\/v1\/admin\/catalog\/services\/([0-9a-f-]{36})\/update$/.exec(
            path,
          );
        if (service)
          return this.ok(
            response,
            await this.catalog.updateService(auth.user.id, service[1]!, body),
          );
        const priceGroup =
          /^\/api\/v1\/admin\/catalog\/price-groups\/([0-9a-f-]{36})\/update$/.exec(
            path,
          );
        if (priceGroup)
          return this.ok(
            response,
            await this.catalog.updatePriceGroup(
              auth.user.id,
              priceGroup[1]!,
              body,
            ),
          );
      }
      if (
        request.method === "POST" &&
        path.startsWith("/api/v1/admin/providers")
      ) {
        this.checkBurst(request, "admin-provider-mutation");
        if (!canAccessAdmin(auth.access, "providers.manage"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.providers) throw new Error("Provider service unavailable");
        const importPreview =
            /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})\/import\/preview$/.exec(
              path,
            ),
          importApply =
            /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})\/import\/apply$/.exec(
              path,
            );
        if (importPreview)
          return this.ok(
            response,
            await this.providers.importPreview(
              importPreview[1]!,
              await this.body(request),
            ),
          );
        if (importApply)
          return this.ok(
            response,
            await this.providers.importApply(
              auth.user.id,
              importApply[1]!,
              await this.body(request),
            ),
          );
        if (path === "/api/v1/admin/providers")
          return this.ok(
            response,
            await this.providers.create(auth.user.id, await this.body(request)),
          );
        const update = /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})$/.exec(
          path,
        );
        if (update)
          return this.ok(
            response,
            await this.providers.update(
              auth.user.id,
              update[1]!,
              await this.body(request),
            ),
          );
        const action =
          /^\/api\/v1\/admin\/providers\/([0-9a-f-]{36})\/(test|sync)$/.exec(
            path,
          );
        if (action)
          return this.ok(
            response,
            action[2] === "test"
              ? await this.providers.test(action[1]!)
              : await this.providers.sync(auth.user.id, action[1]!),
          );
      }
      if (
        request.method === "POST" &&
        adminWallet &&
        path.endsWith("/mutations")
      ) {
        this.checkBurst(request, "admin-wallet-mutation");
        if (!canAccessAdmin(auth.access, "wallets.adjust"))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        if (!this.wallet) throw new Error("Wallet service unavailable");
        const body = await this.body(request);
        const type = String(body.type ?? "");
        if (!["ADMIN_ADD", "ADMIN_SUBTRACT", "ADJUSTMENT"].includes(type))
          throw new InputError(
            "TRANSACTION_TYPE_INVALID",
            "Invalid admin transaction type",
          );
        const key = this.header(request, "idempotency-key");
        if (!key)
          throw new InputError(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key header is required",
          );
        return this.ok(
          response,
          await this.wallet.mutate({
            userId: adminWallet[1]!,
            amount: String(body.amount ?? ""),
            type: type as "ADMIN_ADD" | "ADMIN_SUBTRACT" | "ADJUSTMENT",
            direction:
              type === "ADMIN_SUBTRACT" || body.direction === "debit"
                ? "debit"
                : "credit",
            idempotencyKey: key,
            actorId: auth.user.id,
            audit: true,
            ...(body.referenceId
              ? { referenceId: String(body.referenceId).slice(0, 128) }
              : {}),
            ...(body.description
              ? { description: String(body.description) }
              : {}),
          }),
        );
      }
      if (request.method === "POST" && path === "/api/v1/auth/change-password")
        return await this.changePassword(
          request,
          response,
          auth.user,
          auth.session.id,
        );
      if (request.method === "POST" && path === "/api/v1/auth/logout-others") {
        await this.store.revokeOtherSessions(auth.user.id, auth.session.id);
        return this.ok(response, { revoked: true });
      }
      if (
        request.method === "POST" &&
        path.startsWith("/api/v1/auth/sessions/") &&
        path.endsWith("/revoke")
      ) {
        const id = path.split("/")[5];
        if (!id)
          return this.error(
            response,
            400,
            "INVALID_SESSION",
            "Invalid session id",
          );
        const sessions = await this.store.listSessions(auth.user.id);
        if (!sessions.some((item) => item.id === id))
          return this.error(
            response,
            404,
            "SESSION_NOT_FOUND",
            "Session not found",
          );
        await this.store.revokeSession(id);
        if (id === auth.session.id) this.clearCookies(response);
        return this.ok(response, { revoked: true });
      }
      if (path.startsWith("/api/v1/customer") && request.method === "GET")
        return this.ok(response, {
          user: this.publicUser(auth.user),
          area: "customer",
          dashboard: await this.store.customerDashboard(auth.user.id),
        });
      if (path.startsWith("/api/v1/admin") && request.method === "GET") {
        if (!canAccessAdmin(auth.access))
          return this.error(
            response,
            403,
            "PERMISSION_DENIED",
            "Permission denied",
          );
        return this.ok(response, {
          user: this.publicUser(auth.user),
          area: "admin",
          access: auth.access,
          dashboard: await this.store.adminDashboard(),
        });
      }
      return this.error(response, 404, "NOT_FOUND", "Route not found");
    } catch (error) {
      if (error instanceof CatalogError)
        return this.error(response, 422, error.code, error.message);
      if (error instanceof ProviderConfigError)
        return this.error(response, 422, error.code, error.message);
      if (error instanceof OrderError)
        return this.error(
          response,
          error.code === "INSUFFICIENT_BALANCE" ? 409 : 422,
          error.code,
          error.message,
        );
      if (error instanceof WalletError) {
        const status =
          error.code === "INSUFFICIENT_BALANCE"
            ? 409
            : error.code === "WALLET_NOT_FOUND"
              ? 404
              : 422;
        return this.error(response, status, error.code, error.message);
      }
      if (
        error instanceof AdminOperationError ||
        error instanceof SupportError ||
        error instanceof PaymentError ||
        error instanceof PromotionError
      )
        return this.error(response, 422, error.code, error.message);
      if (error instanceof InputError)
        return this.error(
          response,
          error.code === "AUTH_RATE_LIMITED" ? 429 : 422,
          error.code,
          error.message,
        );
      console.error(
        JSON.stringify({
          level: "error",
          event: "auth_request_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      return this.error(
        response,
        500,
        "INTERNAL_ERROR",
        "Request could not be completed",
      );
    }
  }
  private async register(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<true> {
    await this.rateLimit(request, "register");
    const body = await this.body(request);
    const email = this.email(body.email);
    const username = this.username(body.username);
    const password = this.password(body.password);
    if (await this.store.findUserByEmail(email))
      throw new InputError("EMAIL_IN_USE", "Email is already registered");
    if (await this.store.findUserByUsername(username))
      throw new InputError("USERNAME_IN_USE", "Username is already registered");
    let user: AuthUser;
    try {
      user = await this.store.createUser({
        email,
        username,
        passwordHash: await hashPassword(password),
        referralCode: opaqueToken(9).toUpperCase(),
        ...(body.referralCode
          ? { referredByCode: String(body.referralCode).trim().toUpperCase() }
          : {}),
      });
    } catch (error: any) {
      if (error?.message === "REFERRAL_CODE_INVALID")
        throw new InputError(
          "REFERRAL_CODE_INVALID",
          "Mã giới thiệu không hợp lệ.",
        );
      throw error;
    }
    return this.issueSession(response, request, user, 201);
  }
  private async login(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<true> {
    const body = await this.body(request);
    const email = this.email(body.email);
    await this.rateLimit(request, email);
    const user = await this.store.findUserByEmail(email);
    const valid = user
      ? await verifyPassword(String(body.password ?? ""), user.passwordHash)
      : false;
    const meta = this.meta(request);
    if (!user || !valid || user.status !== "ACTIVE") {
      await this.store.recordLogin({
        ...(user ? { userId: user.id } : {}),
        email,
        success: false,
        reason: "INVALID_CREDENTIALS",
        ...meta,
      });
      return this.error(
        response,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }
    await this.store.recordLogin({
      userId: user.id,
      email,
      success: true,
      ...meta,
    });
    return this.issueSession(response, request, user, 200);
  }
  private async forgot(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<true> {
    const body = await this.body(request);
    const email = this.email(body.email);
    await this.rateLimit(request, email);
    const user = await this.store.findUserByEmail(email);
    let developmentToken: string | undefined;
    if (user) {
      const token = opaqueToken();
      await this.store.createPasswordReset(
        user.id,
        tokenHash(token),
        new Date(Date.now() + 30 * 60_000),
      );
      if (this.config.environment === "development") developmentToken = token;
    }
    return this.ok(response, {
      accepted: true,
      ...(developmentToken ? { developmentToken } : {}),
    });
  }
  private async reset(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<true> {
    const body = await this.body(request);
    const token = String(body.token ?? "");
    const password = this.password(body.password);
    const record = token
      ? await this.store.claimPasswordReset(tokenHash(token))
      : null;
    if (!record)
      throw new InputError(
        "RESET_TOKEN_INVALID",
        "Reset token is invalid or expired",
      );
    await this.store.updatePassword(
      record.userId,
      await hashPassword(password),
    );
    await this.store.revokeOtherSessions(record.userId);
    this.clearCookies(response);
    return this.ok(response, { reset: true });
  }
  private async changePassword(
    request: IncomingMessage,
    response: ServerResponse,
    user: AuthUser,
    sessionId: string,
  ): Promise<true> {
    const body = await this.body(request);
    if (
      !(await verifyPassword(
        String(body.currentPassword ?? ""),
        user.passwordHash,
      ))
    )
      throw new InputError(
        "CURRENT_PASSWORD_INVALID",
        "Current password is invalid",
      );
    await this.store.updatePassword(
      user.id,
      await hashPassword(this.password(body.newPassword)),
    );
    await this.store.revokeOtherSessions(user.id, sessionId);
    return this.ok(response, { changed: true });
  }
  private async authenticate(request: IncomingMessage) {
    const rawToken = this.cookie(request, "smm_session");
    if (!rawToken) return null;
    const session = await this.store.findSession(tokenHash(rawToken));
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      return null;
    const user = await this.store.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE") return null;
    return {
      rawToken,
      session,
      user,
      access: await this.store.rolesAndPermissions(user.id),
    };
  }
  private async issueSession(
    response: ServerResponse,
    request: IncomingMessage,
    user: AuthUser,
    status: number,
  ): Promise<true> {
    const rawToken = opaqueToken();
    const session = await this.store.createSession({
      userId: user.id,
      tokenHash: tokenHash(rawToken),
      ...this.meta(request),
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
    });
    const csrf = csrfValue(rawToken, this.config.sessionSecret);
    const secure = this.config.environment === "production" ? "; Secure" : "";
    response.setHeader("set-cookie", [
      `smm_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`,
      `smm_csrf=${csrf}; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`,
    ]);
    return this.ok(
      response,
      {
        user: this.publicUser(user),
        sessionId: session.id,
        access: await this.store.rolesAndPermissions(user.id),
      },
      status,
    );
  }
  private clearCookies(response: ServerResponse) {
    response.setHeader("set-cookie", [
      "smm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      "smm_csrf=; Path=/; SameSite=Lax; Max-Age=0",
    ]);
  }
  private async rateLimit(request: IncomingMessage, identity: string) {
    const meta = this.meta(request);
    const failures = await this.store.countRecentFailures(
      identity,
      meta.ipAddress,
      new Date(Date.now() - 15 * 60_000),
    );
    if (failures >= 10)
      throw new InputError(
        "AUTH_RATE_LIMITED",
        "Too many authentication attempts",
      );
  }
  private checkBurst(request: IncomingMessage, path: string) {
    const now = Date.now();
    const key = `${request.socket.remoteAddress ?? "unknown"}:${path}`;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > now - 60_000,
    );
    if (recent.length >= 20)
      throw new InputError(
        "AUTH_RATE_LIMITED",
        "Too many authentication requests",
      );
    recent.push(now);
    this.attempts.set(key, recent);
    if (this.attempts.size > 10_000)
      for (const [candidate, timestamps] of this.attempts)
        if (!timestamps.some((timestamp) => timestamp > now - 60_000))
          this.attempts.delete(candidate);
  }
  private meta(request: IncomingMessage) {
    const ipAddress = request.socket.remoteAddress;
    const userAgent = this.header(request, "user-agent");
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
    };
  }
  private async body(
    request: IncomingMessage,
  ): Promise<Record<string, unknown>> {
    if (
      !authPaths.has(
        new URL(request.url ?? "/", this.config.apiUrl).pathname,
      ) &&
      request.method !== "POST"
    )
      return {};
    return new Promise((resolve, reject) => {
      let data = "";
      request.on("data", (chunk) => {
        data += String(chunk ?? "");
        const attachment = /\/attachments$/.test(
          new URL(request.url ?? "/", this.config.apiUrl).pathname,
        );
        if (Buffer.byteLength(data) > (attachment ? 7_100_000 : 32_768)) {
          request.destroy();
          reject(new InputError("PAYLOAD_TOO_LARGE", "Payload too large"));
        }
      });
      request.on("end", () => {
        try {
          const value = JSON.parse(data || "{}");
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
          resolve(value);
        } catch {
          reject(
            new InputError("INVALID_JSON", "Request body must be valid JSON"),
          );
        }
      });
      request.on("error", () =>
        reject(
          new InputError("INVALID_REQUEST", "Request body could not be read"),
        ),
      );
    });
  }
  private async uploadAttachment(
    request: IncomingMessage,
    response: ServerResponse,
    userId: string,
    ticketId: bigint,
    isStaff: boolean,
  ): Promise<true> {
    if (!this.storage)
      return this.error(
        response,
        503,
        "STORAGE_UNAVAILABLE",
        "Storage unavailable",
      );
    const body = await this.body(request),
      name = String(body.name ?? ""),
      mime = String(body.mime ?? ""),
      encoded = String(body.data ?? "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
      throw new SupportError("ATTACHMENT_INVALID", "Invalid attachment");
    const data = Buffer.from(encoded, "base64");
    this.support!.validateAttachment({ name, mime, size: data.length });
    const stored = await this.storage.put(name, mime, data);
    return this.ok(
      response,
      await this.support!.addAttachment(
        userId,
        ticketId,
        { storageKey: stored.key, originalName: name, mime, size: stored.size },
        isStaff,
      ),
    );
  }
  private async downloadAttachment(
    response: ServerResponse,
    userId: string,
    id: string,
    isStaff: boolean,
  ): Promise<true> {
    if (!this.storage)
      return this.error(
        response,
        503,
        "STORAGE_UNAVAILABLE",
        "Storage unavailable",
      );
    const item = await this.support!.attachment(userId, id, isStaff),
      data = await this.storage.read(item.storageKey),
      filename = String(item.originalName).replace(/[^A-Za-z0-9._-]/g, "_");
    response.statusCode = 200;
    response.setHeader("content-type", item.mime);
    response.setHeader("content-length", String(data.length));
    response.setHeader(
      "content-disposition",
      `attachment; filename="${filename || "attachment"}"`,
    );
    response.setHeader("cache-control", "private, no-store");
    response.end(data);
    return true;
  }
  private email(value: unknown) {
    const email = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
      throw new InputError("EMAIL_INVALID", "Enter a valid email address");
    return email;
  }
  private username(value: unknown) {
    const username = String(value ?? "").trim();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username))
      throw new InputError(
        "USERNAME_INVALID",
        "Username must be 3–32 letters, numbers, or underscores",
      );
    return username;
  }
  private password(value: unknown) {
    const password = String(value ?? "");
    if (
      password.length < 12 ||
      password.length > 128 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    )
      throw new InputError(
        "PASSWORD_WEAK",
        "Password must be 12–128 characters with upper, lower, and number",
      );
    return password;
  }
  private cookie(request: IncomingMessage, name: string) {
    const raw = this.header(request, "cookie");
    return raw
      ?.split(";")
      .map((item) => item.trim().split("="))
      .find(([key]) => key === name)
      ?.slice(1)
      .join("=");
  }
  private header(request: IncomingMessage, name: string) {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
  private publicUser(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
  private ok(response: ServerResponse, data: unknown, status = 200): true {
    response.statusCode = status;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(stringifyJson({ success: true, data }));
    return true;
  }
  private error(
    response: ServerResponse,
    status: number,
    code: string,
    message: string,
  ): true {
    response.statusCode = status;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(stringifyJson({ success: false, error: { code, message } }));
    return true;
  }
}
class InputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
