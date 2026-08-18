import { randomBytes } from "node:crypto";
import { normalizeAmount } from "../wallet/service.js";
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
  constructor(private db: any) {}
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
  async history(userId: string) {
    return this.db.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
