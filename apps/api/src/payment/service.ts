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
  async create(userId: string, input: any) {
    const amount = normalizeAmount(input.amount),
      method = await this.db.paymentMethod.findUnique({
        where: { id: String(input.paymentMethodId) },
      });
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
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    if (Number(method.dailyTransactionLimit ?? 0) > 0) {
      const count = await this.db.deposit.count({
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
      const aggregate = await this.db.deposit.aggregate({
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
    const code = `NAP${randomBytes(6).toString("hex").toUpperCase()}`;
    const deposit = await this.db.deposit.create({
      data: {
        userId,
        paymentMethodId: method.id,
        code,
        status: "PENDING",
        grossAmount: amount,
        feeAmount: "0",
        netAmount: amount,
        sourceCurrency: method.currency,
        baseCurrency: "USD",
        exchangeRate: String(method.exchangeRate ?? "1"),
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
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
  async detail(userId: string, id: string) {
    let x = await this.db.deposit.findFirst({ where: { id, userId } });
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
      x = await this.db.deposit.findFirst({ where: { id, userId } });
    }
    const paymentMethod = await this.db.paymentMethod.findUnique({
      where: { id: x.paymentMethodId },
      select: { code: true, name: true, providerType: true },
    });
    const isBank = ["VIETQR", "CASSO", "BANK"].includes(
        String(paymentMethod?.providerType).toUpperCase(),
      ),
      bank = typeof this.bank === "function" ? await this.bank() : this.bank;
    return {
      ...x,
      paymentMethod,
      payment: isBank
        ? {
            available: Boolean(bank.bin && bank.account),
            bankName: bank.name,
            accountNumber: bank.account,
            accountName: bank.accountName,
            transferContent: x.code,
            qrUrl:
              bank.bin && bank.account
                ? vietQrUrl(
                    bank.bin,
                    bank.account,
                    String(x.grossAmount),
                    x.code,
                  )
                : null,
          }
        : null,
    };
  }
  async methods() {
    return this.db.paymentMethod.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        minAmount: true,
        maxAmount: true,
        feeFixed: true,
        feePercent: true,
      },
    });
  }
  async history(userId: string) {
    return this.db.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async adminHistory(query: { status?: string; take?: number } = {}) {
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
    const rows = await this.db.deposit.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, query.take ?? 50)),
    });
    return Promise.all(
      rows.map(async (row: any) => ({
        ...row,
        user: await this.db.user.findUnique({
          where: { id: row.userId },
          select: { id: true, email: true, username: true },
        }),
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
