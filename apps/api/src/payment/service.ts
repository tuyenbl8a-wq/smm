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
    private bank = {
      bin: process.env.BANK_BIN ?? "",
      name: process.env.BANK_NAME ?? "",
      account: process.env.BANK_ACCOUNT_NUMBER ?? "",
      accountName: process.env.BANK_ACCOUNT_NAME ?? "",
    },
  ) {}
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
    if (
      BigInt(amount.replace(".", "")) <
      BigInt(String(method.minAmount).replace(".", ""))
    )
      throw new PaymentError("AMOUNT_TOO_SMALL", "Amount below minimum");
    const code = `NAP${randomBytes(6).toString("hex").toUpperCase()}`;
    return this.db.deposit.create({
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
        exchangeRate: "1",
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
  }
  async detail(userId: string, id: string) {
    const x = await this.db.deposit.findFirst({ where: { id, userId } });
    if (!x) throw new PaymentError("DEPOSIT_NOT_FOUND", "Deposit not found");
    const paymentMethod = await this.db.paymentMethod.findUnique({
      where: { id: x.paymentMethodId },
      select: { code: true, name: true, providerType: true },
    });
    const isBank = ["VIETQR", "CASSO", "BANK"].includes(
      String(paymentMethod?.providerType).toUpperCase(),
    );
    return {
      ...x,
      paymentMethod,
      payment: isBank
        ? {
            available: Boolean(this.bank.bin && this.bank.account),
            bankName: this.bank.name,
            accountNumber: this.bank.account,
            accountName: this.bank.accountName,
            transferContent: x.code,
            qrUrl:
              this.bank.bin && this.bank.account
                ? vietQrUrl(
                    this.bank.bin,
                    this.bank.account,
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
    const rows = await this.db.deposit.findMany({
      where: query.status ? { status: query.status } : undefined,
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
      })),
    );
  }
}
