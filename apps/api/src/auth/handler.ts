import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppConfig } from "@smm/config";
import type { AuthStore, AuthUser } from "./store.js";
import { canAccessAdmin } from "../admin/dashboard.js";
import { WalletError, type WalletService } from "../wallet/service.js";
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
      if (request.method === "POST" && path === "/api/v1/auth/logout") {
        await this.store.revokeSession(auth.session.id);
        this.clearCookies(response);
        return this.ok(response, { loggedOut: true });
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
      if (error instanceof WalletError) {
        const status =
          error.code === "INSUFFICIENT_BALANCE"
            ? 409
            : error.code === "WALLET_NOT_FOUND"
              ? 404
              : 422;
        return this.error(response, status, error.code, error.message);
      }
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
    const user = await this.store.createUser({
      email,
      username,
      passwordHash: await hashPassword(password),
      referralCode: opaqueToken(9).toUpperCase(),
    });
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
        if (Buffer.byteLength(data) > 32_768) {
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
    response.end(JSON.stringify({ success: true, data }));
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
    response.end(JSON.stringify({ success: false, error: { code, message } }));
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
