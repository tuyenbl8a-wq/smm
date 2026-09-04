import {
  applyOrderTargetRefund,
  moneyToUnits,
  partialRefundTarget,
} from "@smm/database";
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
      if (tx.$executeRawUnsafe)
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          orderId,
        );
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order)
        throw new LifecycleError("ORDER_NOT_FOUND", "Order not found");
      if (order.manualOverride) return order;
      if (["COMPLETED", "CANCELED", "REFUNDED"].includes(order.status))
        return order;
      if (status === "PARTIAL") {
        if (
          !Number.isInteger(remains) ||
          remains < 0 ||
          remains > order.quantity
        )
          throw new LifecycleError("REMAINS_INVALID", "Invalid remains");
        const calculated = partialRefundTarget(
          order.charge,
          remains,
          order.quantity,
        );
        const refund = await applyOrderTargetRefund(
          tx,
          order,
          moneyToUnits(calculated) < moneyToUnits(order.refundedAmount)
            ? order.refundedAmount
            : calculated,
          "Partial order refund",
        );
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PARTIAL",
            remains,
            startCount,
            refundedAmount: refund.target,
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
          details: { source: "WORKER_PROVIDER_SYNC", remains, startCount },
        },
      });
      await tx.auditLog?.create({
        data: {
          action: "ORDER_PROVIDER_SYNC",
          resource: "Order",
          resourceId: order.publicId,
          before: {
            status: order.status,
            remains: order.remains,
            startCount: order.startCount,
            refundedAmount: String(order.refundedAmount),
          },
          after: { status, remains, startCount },
        },
      });
      const updated = await tx.order.findUnique({ where: { id: orderId } });
      if (updated) await settleReferral(tx, updated);
      return updated;
    });
  }
  async request(
    userId: string,
    reference: string,
    action: "refill" | "cancel",
    key: string,
  ) {
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(key))
      throw new LifecycleError(
        "IDEMPOTENCY_INVALID",
        "Invalid idempotency key",
      );
    const numericId = /^\d+$/.test(reference)
      ? BigInt(reference) - 100000n
      : null;
    const where =
      numericId !== null && numericId > 0n
        ? { id: numericId }
        : { publicId: reference };
    const order = this.db.order.findFirst
      ? await this.db.order.findFirst({ where })
      : await this.db.order.findUnique({ where });
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
