export interface MerchantPaymentState {
  status: "PAID" | "PENDING" | "EXPIRED" | "FAILED" | "UNKNOWN";
  transactionId?: string;
  amount?: string;
  currency?: string;
}

export class PaymentReconciliationWorker {
  constructor(
    private db: any,
    private query: (externalOrderId: string) => Promise<MerchantPaymentState>,
    private settle: (event: {
      eventId: string;
      transactionId: string;
      depositCode: string;
      amount: string;
      currency: string;
    }) => Promise<{ status: string }>,
  ) {}

  async once() {
    const row = await this.db.$transaction(async (tx: any) => {
      const rows = await tx.$queryRawUnsafe(`
        WITH candidate AS (
          SELECT j."id" FROM "payment_reconciliation_jobs" j
          JOIN "deposits" d ON d."id"=j."deposit_id"
          WHERE j."provider"='BINANCE' AND d."status"='PENDING'
            AND j."attempts"<j."max_attempts"
            AND ((j."status" IN ('PENDING','UNKNOWN') AND j."next_attempt_at"<=NOW())
              OR (j."status"='PROCESSING' AND j."claimed_at"<NOW()-INTERVAL '5 minutes'))
          ORDER BY j."next_attempt_at" ASC
          FOR UPDATE OF j SKIP LOCKED LIMIT 1
        )
        UPDATE "payment_reconciliation_jobs" j
        SET "status"='PROCESSING',"attempts"="attempts"+1,"claimed_at"=NOW(),
            "claim_token"=gen_random_uuid(),"updated_at"=NOW()
        FROM candidate c WHERE j."id"=c."id" RETURNING j.*`);
      if (!rows[0]) return null;
      const deposit = await tx.deposit.findUnique({
        where: { id: rows[0].deposit_id },
      });
      return { job: rows[0], deposit };
    });
    if (!row) return 0;
    const { job, deposit } = row;
    try {
      if (!deposit?.externalOrderId) throw new Error("EXTERNAL_ORDER_MISSING");
      const state = await this.query(deposit.externalOrderId);
      if (state.status === "PAID") {
        if (!state.transactionId || !state.amount || !state.currency)
          throw new Error("MERCHANT_RESPONSE_INCOMPLETE");
        const result = await this.settle({
          eventId: `reconcile:${state.transactionId}`,
          transactionId: state.transactionId,
          depositCode: deposit.code,
          amount: state.amount,
          currency: state.currency,
        });
        await this.finish(
          job,
          result.status === "PAID" || result.status === "DUPLICATE",
        );
        return 1;
      }
      if (state.status === "EXPIRED" || state.status === "FAILED") {
        await this.db.$transaction(async (tx: any) => {
          await tx.deposit.updateMany({
            where: { id: deposit.id, status: "PENDING" },
            data: { status: state.status },
          });
          await tx.paymentReconciliationJob.update({
            where: { id: job.id },
            data: { status: "COMPLETED", claimToken: null, claimedAt: null },
          });
        });
        return 1;
      }
      await this.retry(
        job,
        state.status === "PENDING" ? "MERCHANT_PENDING" : "MERCHANT_UNKNOWN",
      );
    } catch (error: any) {
      await this.retry(job, String(error?.message ?? "PROVIDER_ERROR"));
    }
    return 1;
  }

  private finish(job: any, successful: boolean) {
    return this.db.paymentReconciliationJob.update({
      where: { id: job.id },
      data: {
        status: successful ? "COMPLETED" : "FAILED",
        claimToken: null,
        claimedAt: null,
        lastError: successful ? null : "SETTLEMENT_REJECTED",
      },
    });
  }

  private async retry(job: any, rawError: string) {
    const exhausted = job.attempts >= (job.max_attempts ?? job.maxAttempts),
      error = rawError.replace(/[^A-Z0-9_]/gi, "_").slice(0, 120);
    await this.db.$transaction(async (tx: any) => {
      await tx.paymentReconciliationJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? "FAILED" : "UNKNOWN",
          nextAttemptAt: new Date(
            Date.now() + Math.min(3_600_000, 30_000 * 2 ** job.attempts),
          ),
          claimedAt: null,
          claimToken: null,
          lastError: error,
        },
      });
      if (exhausted)
        await tx.deposit.updateMany({
          where: { id: job.deposit_id, status: "PENDING" },
          data: { status: "MANUAL_REVIEW" },
        });
      await tx.systemLog.create({
        data: {
          level: exhausted ? "ERROR" : "WARN",
          service: "payment-reconciliation",
          event: exhausted
            ? "binance_reconciliation_exhausted"
            : "binance_reconciliation_retry",
          message: exhausted
            ? "Binance reconciliation exhausted"
            : "Binance reconciliation retry",
          context: { jobId: job.id, error, attempts: job.attempts },
        },
      });
    });
  }
}
