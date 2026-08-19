import { orderAmount } from "./service.js";
import { settleReferral } from "../promotion/service.js";
export class LifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export class OrderLifecycleService {
  constructor(private db: any) {}
  async reconcile(
    orderId: bigint,
    status: string,
    remains: number,
    startCount?: number,
  ) {
    const allowed = [
      "PENDING",
      "PROCESSING",
      "IN_PROGRESS",
      "COMPLETED",
      "PARTIAL",
      "CANCELED",
      "FAILED",
    ];
    if (!allowed.includes(status))
      throw new LifecycleError("STATUS_INVALID", "Invalid provider status");
    return this.db.$transaction(async (tx: any) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order)
        throw new LifecycleError("ORDER_NOT_FOUND", "Order not found");
      if (["COMPLETED", "CANCELED", "REFUNDED"].includes(order.status))
        return order;
      if (status === "PARTIAL") {
        if (
          !Number.isInteger(remains) ||
          remains < 0 ||
          remains > order.quantity
        )
          throw new LifecycleError("REMAINS_INVALID", "Invalid remains");
        const refund = orderAmount(order.saleRate, remains);
        if (
          String(order.refundedAmount) !== "0" &&
          String(order.refundedAmount) !== "0.00000000"
        )
          return order;
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance"="balance"+$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid RETURNING "id","balance"-$1::numeric AS "before","balance" AS "after"`,
          refund,
          order.userId,
        );
        await tx.walletTransaction.create({
          data: {
            walletId: rows[0].id,
            userId: order.userId,
            type: "REFUND",
            amount: refund,
            balanceBefore: rows[0].before,
            balanceAfter: rows[0].after,
            referenceId: order.publicId,
            idempotencyKey: `refund:order:${order.publicId}`,
            description: "Partial order refund",
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PARTIAL",
            remains,
            startCount,
            refundedAmount: refund,
          },
        });
      } else
        await tx.order.update({
          where: { id: orderId },
          data: { status, remains, startCount },
        });
      await tx.orderHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: status,
          details: { remains, startCount },
        },
      });
      const updated = await tx.order.findUnique({ where: { id: orderId } });
      if (updated) await settleReferral(tx, updated);
      return updated;
    });
  }
  async request(
    userId: string,
    publicId: string,
    action: "refill" | "cancel",
    key: string,
  ) {
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(key))
      throw new LifecycleError(
        "IDEMPOTENCY_INVALID",
        "Invalid idempotency key",
      );
    const order = await this.db.order.findUnique({ where: { publicId } });
    if (!order || order.userId !== userId)
      throw new LifecycleError("ORDER_NOT_FOUND", "Order not found");
    if (action === "refill") {
      if (!["COMPLETED", "PARTIAL"].includes(order.status))
        throw new LifecycleError("REFILL_NOT_ALLOWED", "Refill not allowed");
      return this.db.refill.upsert({
        where: { idempotencyKey: key },
        create: { orderId: order.id, idempotencyKey: key },
        update: {},
      });
    }
    if (!["PENDING", "PROCESSING", "IN_PROGRESS"].includes(order.status))
      throw new LifecycleError("CANCEL_NOT_ALLOWED", "Cancel not allowed");
    return this.db.cancellation.upsert({
      where: { idempotencyKey: key },
      create: { orderId: order.id, idempotencyKey: key },
      update: {},
    });
  }
}
