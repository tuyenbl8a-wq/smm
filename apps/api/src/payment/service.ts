import { ROOT_SITE_ID } from "../tenant/context.js";
import { randomBytes } from "node:crypto";
import { normalizeAmount } from "../wallet/service.js";
import { vietQrUrl } from "./vietqr.js";
export interface PaymentProvider {
  createPayment(
    deposit: any,
  ): Promise<{ externalOrderId?: string; qr?: string; deeplink?: string }>;
  verifyPayment(payload: unknown): Promise<boolean>;
  handleWebhook(payload: unknown): Promise<{
    eventId: string;
    transactionId: string;
    depositCode: string;
    amount: string;
    currency: string;
  }>;
  queryTransaction(id: string): Promise<{ status: string }>;
  refund?(id: string, amount: string): Promise<void>;
}
export class PaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export class DepositService {
  constructor(
    private db: any,
    private bank:
      | { bin: string; name: string; account: string; accountName: string }
      | (() => Promise<{
          bin: string;
          name: string;
          account: string;
          accountName: string;
        }>) = {
      bin: process.env.BANK_BIN ?? "",
      name: process.env.BANK_NAME ?? "",
      account: process.env.BANK_ACCOUNT_NUMBER ?? "",
      accountName: process.env.BANK_ACCOUNT_NAME ?? "",
    },
    private providers: Record<string, PaymentProvider> = {},
    private recipientForMethod?: (id: string) => Promise<{
      bankName: string;
      bankBin: string;
      account: string;
      accountName: string;
      qrTemplate?: string;
    } | null>,
  ) {}
  private units(value: unknown) {
    const raw = String(value ?? "0").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(raw))
      throw new PaymentError("AMOUNT_INVALID", "Invalid payment amount");
    const normalized = raw,
      [whole, fraction = ""] = normalized.split(".");
    return (
      BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, "0").slice(0, 8))
    );
  }
  private money(units: bigint) {
    return `${units / 100000000n}.${String(units % 100000000n).padStart(8, "0")}`;
  }
  private percentUnits(value: unknown) {
    const raw = String(value ?? "0").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(raw))
      throw new PaymentError("BONUS_INVALID", "Invalid bonus rate");
    const [whole, fraction = ""] = raw.split(".");
    return BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  }
  async create(userId: string, input: any, siteId?: string) {
    const amount = normalizeAmount(input.amount),
      paymentMethodId = String(input.paymentMethodId),
      dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const reservation = await this.db.$transaction(async (tx: any) => {
      if (tx.$queryRawUnsafe)
        await tx.$queryRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          `payment-limit:${paymentMethodId}:${dayStart.toISOString().slice(0, 10)}`,
        );
      const user =
        siteId && tx.user
          ? await tx.user.findUnique({
              where: { id: userId },
              select: { siteId: true },
            })
          : null;
      const tenantId = siteId ?? user?.siteId;
      if (siteId && (!user || user.siteId !== siteId))
        throw new PaymentError(
          "TENANT_MISMATCH",
          "User does not belong to this site",
        );
      const method = tenantId
        ? await tx.paymentMethod.findFirst({
            where: { id: paymentMethodId, siteId: tenantId },
          })
        : await tx.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (!method || !method.active)
        throw new PaymentError(
          "METHOD_UNAVAILABLE",
          "Payment method unavailable",
        );
      const amountUnits = this.units(amount),
        minUnits = this.units(method.minAmount),
        maxUnits = this.units(method.maxAmount ?? "0");
      if (amountUnits < minUnits)
        throw new PaymentError("AMOUNT_TOO_SMALL", "Amount below minimum");
      if (maxUnits > 0n && amountUnits > maxUnits)
        throw new PaymentError("AMOUNT_TOO_LARGE", "Amount above maximum");
      if (Number(method.dailyTransactionLimit ?? 0) > 0) {
        const count = await tx.deposit.count({
          where: {
            paymentMethodId: method.id,
            createdAt: { gte: dayStart },
            status: { notIn: ["FAILED", "CANCELED", "EXPIRED"] },
          },
        });
        if (count >= Number(method.dailyTransactionLimit))
          throw new PaymentError(
            "METHOD_DAILY_LIMIT",
            "Daily transaction limit reached",
          );
      }
      const dailyAmountLimit = this.units(method.dailyAmountLimit ?? "0");
      if (dailyAmountLimit > 0n) {
        const aggregate = await tx.deposit.aggregate({
          where: {
            paymentMethodId: method.id,
            createdAt: { gte: dayStart },
            status: { notIn: ["FAILED", "CANCELED", "EXPIRED"] },
          },
          _sum: { grossAmount: true },
        });
        if (
          this.units(aggregate._sum.grossAmount ?? "0") + amountUnits >
          dailyAmountLimit
        )
          throw new PaymentError(
            "METHOD_DAILY_AMOUNT_LIMIT",
            "Daily amount limit reached",
          );
      }
      const bonusRate = this.percentUnits(method.bonusPercent ?? "0"),
        bonusUnits = (amountUnits * bonusRate) / 100000000n,
        creditedAmount = this.money(amountUnits + bonusUnits),
        code = `NAP${randomBytes(6).toString("hex").toUpperCase()}`,
        deposit = await tx.deposit.create({
          data: {
            ...(tenantId ? { siteId: tenantId } : {}),
            userId,
            paymentMethodId: method.id,
            code,
            status: "PENDING",
            grossAmount: amount,
            feeAmount: "0",
            netAmount: creditedAmount,
            bonusRateSnapshot: String(method.bonusPercent ?? "0"),
            creditedAmount,
            sourceCurrency: method.currency,
            baseCurrency: "USD",
            exchangeRate: String(method.exchangeRate ?? "1"),
            expiresAt: new Date(Date.now() + 30 * 60000),
          },
        });
      return { method, deposit };
    });
    const { method, deposit } = reservation;
    const provider = this.providers[String(method.providerType).toUpperCase()];
    if (!provider) return deposit;
    try {
      const payment = await provider.createPayment(deposit);
      return await this.db.$transaction(async (tx: any) => {
        const updated = await tx.deposit.update({
          where: { id: deposit.id },
          data: { externalOrderId: payment.externalOrderId },
        });
        if (String(method.providerType).toUpperCase() === "BINANCE")
          await tx.paymentReconciliationJob.create({
            data: { depositId: deposit.id, provider: "BINANCE" },
          });
        return { ...updated, payment };
      });
    } catch (error) {
      await this.db.deposit.update({
        where: { id: deposit.id },
        data: { status: "FAILED" },
      });
      throw error;
    }
  }
  async detail(userId: string, id: string, siteId?: string) {
    let x = await this.db.deposit.findFirst({
      where: { id, userId, ...(siteId ? { siteId } : {}) },
    });
    if (!x) throw new PaymentError("DEPOSIT_NOT_FOUND", "Deposit not found");
    if (x.status === "PENDING" && x.expiresAt <= new Date()) {
      await this.db.deposit.updateMany({
        where: {
          id,
          userId,
          status: "PENDING",
          expiresAt: { lte: new Date() },
        },
        data: { status: "EXPIRED" },
      });
      x = await this.db.deposit.findFirst({
        where: { id, userId, ...(siteId ? { siteId } : {}) },
      });
    }
    const paymentMethod = await this.db.paymentMethod.findUnique({
      where: { id: x.paymentMethodId },
      select: { code: true, name: true, providerType: true },
    });
    const isBank = ["MANUAL", "VIETQR", "CASSO", "BANK"].includes(
        String(paymentMethod?.providerType).toUpperCase(),
      ),
      selected = this.recipientForMethod
        ? await this.recipientForMethod(x.paymentMethodId)
        : null,
      fallback =
        typeof this.bank === "function" ? await this.bank() : this.bank,
      bank = selected ?? {
        bankName: fallback.name,
        bankBin: fallback.bin,
        account: fallback.account,
        accountName: fallback.accountName,
      };
    return {
      ...x,
      paymentMethod,
      payment: isBank
        ? {
            available: Boolean(bank.bankBin && bank.account),
            bankName: bank.bankName,
            account: bank.account,
            accountName: bank.accountName,
            transferContent: x.code,
            qrUrl:
              bank.bankBin && bank.account
                ? vietQrUrl(
                    bank.bankBin,
                    bank.account,
                    String(x.grossAmount),
                    x.code,
                  )
                : null,
          }
        : null,
    };
  }
  async methods(siteId?: string) {
    return this.db.paymentMethod.findMany({
      where: { active: true, ...(siteId ? { siteId } : {}) },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        minAmount: true,
        maxAmount: true,
        feeFixed: true,
        feePercent: true,
        exchangeRate: true,
        bonusPercent: true,
        instructions: true,
        icon: true,
      },
    });
  }
  async history(userId: string, siteId?: string) {
    return this.db.deposit.findMany({
      where: { userId, ...(siteId ? { siteId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async adminOperate(
    actorId: string,
    id: string,
    action: unknown,
    reasonValue: unknown,
    siteId = ROOT_SITE_ID,
  ) {
    const operation = String(action ?? "").toUpperCase();
    const reason = String(reasonValue ?? "").trim();
    if (reason.length < 3)
      throw new PaymentError("REASON_REQUIRED", "Reason is required");
    if (!["APPROVE", "REJECT", "REVIEW"].includes(operation))
      throw new PaymentError(
        "DEPOSIT_ACTION_INVALID",
        "Invalid deposit action",
      );
    return this.db.$transaction(async (tx: any) => {
      const rows = tx.$queryRawUnsafe
        ? await tx.$queryRawUnsafe(
            `SELECT * FROM "deposits" WHERE "id" = $1::uuid AND "site_id" = $2::uuid FOR UPDATE`,
            id,
            siteId,
          )
        : [];
      const deposit =
        rows[0] ?? (await tx.deposit.findFirst({ where: { id, siteId } }));
      if (!deposit)
        throw new PaymentError("DEPOSIT_NOT_FOUND", "Deposit not found");
      const current = String(deposit.status);
      if (operation === "APPROVE") {
        const key = `deposit-approval:${id}`;
        const existing = await tx.walletTransaction.findUnique({
          where: { idempotencyKey: key },
        });
        if (existing) {
          if (current !== "PAID")
            throw new PaymentError(
              "DEPOSIT_STATE_CONFLICT",
              "Deposit state conflicts with existing credit",
            );
          return { deposit, walletTransaction: existing, idempotent: true };
        }
        if (!["PENDING", "MANUAL_REVIEW"].includes(current))
          throw new PaymentError(
            "DEPOSIT_TRANSITION_INVALID",
            "Deposit cannot be approved from its current status",
          );
        const amount = String(
          deposit.credited_amount ?? deposit.creditedAmount,
        );
        const walletRows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance" = "balance" + $1::numeric, "version" = "version" + 1, "updated_at" = CURRENT_TIMESTAMP WHERE "user_id" = $2::uuid AND "site_id" = $3::uuid RETURNING "id", "balance" - $1::numeric AS "balanceBefore", "balance" AS "balanceAfter"`,
          amount,
          deposit.user_id ?? deposit.userId,
          siteId,
        );
        const wallet = walletRows[0];
        if (!wallet)
          throw new PaymentError("WALLET_NOT_FOUND", "Wallet not found");
        const userId = deposit.user_id ?? deposit.userId;
        const ledger = await tx.walletTransaction.create({
          data: {
            siteId,
            walletId: wallet.id,
            userId,
            type: "DEPOSIT",
            amount,
            balanceBefore: wallet.balanceBefore,
            balanceAfter: wallet.balanceAfter,
            referenceId: id,
            idempotencyKey: key,
            description: reason.slice(0, 500),
            metadata: { depositId: id, approvedBy: actorId },
          },
        });
        const updated = await tx.deposit.update({
          where: { id },
          data: { status: "PAID", paidAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            siteId,
            actorId,
            action: "DEPOSIT_APPROVE",
            resource: "deposit",
            resourceId: id,
            before: { status: current },
            after: { status: "PAID", reason, walletTransactionId: ledger.id },
          },
        });
        return {
          deposit: updated,
          walletTransaction: ledger,
          idempotent: false,
        };
      }
      if (!["PENDING", "MANUAL_REVIEW"].includes(current))
        throw new PaymentError(
          "DEPOSIT_TRANSITION_INVALID",
          "Deposit cannot be changed from its current status",
        );
      const next = operation === "REJECT" ? "CANCELED" : "MANUAL_REVIEW";
      if (current === next)
        throw new PaymentError(
          "DEPOSIT_TRANSITION_INVALID",
          "Deposit already has this status",
        );
      const updated = await tx.deposit.update({
        where: { id },
        data: { status: next },
      });
      await tx.auditLog.create({
        data: {
          siteId,
          actorId,
          action: operation === "REJECT" ? "DEPOSIT_REJECT" : "DEPOSIT_REVIEW",
          resource: "deposit",
          resourceId: id,
          before: { status: current },
          after: { status: next, reason },
        },
      });
      return { deposit: updated };
    });
  }

  async adminHistory(query: any = {}, siteId = ROOT_SITE_ID) {
    const rawStatus = String(query.status ?? "").trim(),
      status = ["", "undefined", "null"].includes(rawStatus)
        ? undefined
        : rawStatus;
    if (
      status &&
      ![
        "PENDING",
        "PAID",
        "EXPIRED",
        "CANCELED",
        "FAILED",
        "MANUAL_REVIEW",
      ].includes(status)
    )
      throw new PaymentError(
        "DEPOSIT_STATUS_INVALID",
        "Invalid deposit status",
      );
    for (const field of ["method", "user"])
      if (query[field] && !/^[0-9a-f-]{36}$/i.test(String(query[field])))
        throw new PaymentError("DEPOSIT_FILTER_INVALID", "Invalid filter");
    const from = query.from ? new Date(String(query.from)) : undefined,
      to = query.to ? new Date(String(query.to)) : undefined;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to)))
      to.setUTCHours(23, 59, 59, 999);
    if (
      (from && Number.isNaN(from.valueOf())) ||
      (to && Number.isNaN(to.valueOf()))
    )
      throw new PaymentError("DEPOSIT_FILTER_INVALID", "Invalid date filter");
    const transactionId = String(query.transactionId ?? "")
        .trim()
        .slice(0, 128),
      where = {
        siteId,
        ...(status ? { status } : {}),
        ...(query.method ? { paymentMethodId: String(query.method) } : {}),
        ...(query.user ? { userId: String(query.user) } : {}),
        ...(transactionId
          ? {
              OR: [
                { code: transactionId },
                { externalTransactionId: transactionId },
              ],
            }
          : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };
    const rows = await this.db.deposit.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, query.take ?? 50)),
    });
    return Promise.all(
      rows.map(async (row: any) => ({
        ...row,
        user: await this.db.user
          .findUnique({
            where: { id: row.userId },
            select: { id: true, userNumber: true, email: true, username: true },
          })
          .then((user: any) =>
            user ? { ...user, userNumber: String(user.userNumber) } : null,
          ),
        paymentMethod: await this.db.paymentMethod.findUnique({
          where: { id: row.paymentMethodId },
          select: { code: true, name: true },
        }),
        reconciliation: await this.db.paymentReconciliationJob.findUnique({
          where: { depositId: row.id },
          select: {
            status: true,
            attempts: true,
            maxAttempts: true,
            nextAttemptAt: true,
            claimedAt: true,
            lastError: true,
          },
        }),
      })),
    );
  }
}
