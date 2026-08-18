import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const vietQrUrl = (
  bin: string,
  account: string,
  amount: string,
  content: string,
) =>
  `https://img.vietqr.io/image/${encodeURIComponent(bin)}-${encodeURIComponent(account)}-compact2.png?amount=${encodeURIComponent(amount)}&addInfo=${encodeURIComponent(content)}`;
export class VietQrWebhook {
  constructor(
    private db: any,
    private secret: string,
  ) {}
  verify(raw: string, signature: string) {
    const expected = createHmac("sha256", this.secret)
      .update(raw)
      .digest("hex");
    return (
      expected.length === signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    );
  }
  async process(raw: string, signature: string) {
    if (!this.verify(raw, signature)) throw new Error("SIGNATURE_INVALID");
    const p = JSON.parse(raw),
      eventId = String(p.eventId),
      transactionId = String(p.transactionId),
      code = String(p.content).match(/NAP[A-F0-9]{12}/)?.[0];
    if (!code) throw new Error("DEPOSIT_CODE_NOT_FOUND");
    try {
      return await this.db.$transaction(async (tx: any) => {
        const deposit = await tx.deposit.findUnique({ where: { code } });
        if (!deposit) throw new Error("DEPOSIT_NOT_FOUND");
        const webhook = await tx.paymentWebhook.create({
          data: {
            paymentMethodId: deposit.paymentMethodId,
            externalEventId: eventId,
            signatureValid: true,
            status: "PENDING",
            payload: p,
            payloadHash: createHash("sha256").update(raw).digest("hex"),
          },
        });
        if (
          String(deposit.grossAmount) !== String(p.amount) ||
          deposit.sourceCurrency !== String(p.currency)
        ) {
          await tx.deposit.update({
            where: { id: deposit.id },
            data: {
              status: "MANUAL_REVIEW",
              externalTransactionId: transactionId,
            },
          });
          return { status: "MANUAL_REVIEW" };
        }
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
          String(deposit.netAmount),
          deposit.userId,
        );
        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId: deposit.userId,
            type: "DEPOSIT",
            amount: String(deposit.netAmount),
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: deposit.id,
            idempotencyKey: `deposit:${transactionId}`,
          },
        });
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            externalTransactionId: transactionId,
          },
        });
        await tx.paymentWebhook.update({
          where: { id: webhook.id },
          data: { status: "SUCCEEDED", processedAt: new Date() },
        });
        return { status: "PAID" };
      });
    } catch (e: any) {
      if (e?.code === "P2002") return { status: "DUPLICATE" };
      throw e;
    }
  }
}
