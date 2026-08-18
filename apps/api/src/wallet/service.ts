export type WalletMutationType =
  | "DEPOSIT"
  | "ORDER"
  | "REFUND"
  | "ADMIN_ADD"
  | "ADMIN_SUBTRACT"
  | "AFFILIATE"
  | "BONUS"
  | "ADJUSTMENT";
export interface WalletMutation {
  userId: string;
  amount: string;
  type: WalletMutationType;
  direction: "credit" | "debit";
  idempotencyKey: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  actorId?: string;
  audit?: boolean;
}
export class WalletError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function normalizeAmount(input: unknown): string {
  const value = String(input ?? "").trim();
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(value);
  if (!match || (/^0+$/.test(match[1] ?? "") && /^0*$/.test(match[2] ?? "")))
    throw new WalletError(
      "AMOUNT_INVALID",
      "Amount must be greater than zero with at most 8 decimal places",
    );
  return `${(match[1] ?? "0").replace(/^0+(?=\d)/, "")}.${(match[2] ?? "").padEnd(8, "0")}`;
}
function canonicalSigned(value: unknown): string {
  const raw = String(value);
  return raw.startsWith("-")
    ? `-${normalizeAmount(raw.slice(1))}`
    : normalizeAmount(raw);
}
function same(
  existing: any,
  mutation: WalletMutation,
  signed: string,
): boolean {
  return (
    existing.userId === mutation.userId &&
    existing.type === mutation.type &&
    canonicalSigned(existing.amount) === signed
  );
}
export class WalletService {
  constructor(private readonly db: any) {}
  async summary(userId: string) {
    const wallet = await this.db.wallet.findUnique({
      where: { userId },
      select: { balance: true, currency: true, updatedAt: true },
    });
    if (!wallet) throw new WalletError("WALLET_NOT_FOUND", "Wallet not found");
    return {
      balance: String(wallet.balance),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }
  async history(userId: string, page: number, limit: number) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new WalletError("PAGINATION_INVALID", "Invalid pagination");
    const [total, items] = await Promise.all([
      this.db.walletTransaction.count({ where: { userId } }),
      this.db.walletTransaction.findMany({
        where: { userId },
        select: {
          id: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          type: true,
          referenceId: true,
          description: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items: items.map((item: any) => ({
        ...item,
        amount: String(item.amount),
        balanceBefore: String(item.balanceBefore),
        balanceAfter: String(item.balanceAfter),
      })),
    };
  }
  async mutate(mutation: WalletMutation) {
    const amount = normalizeAmount(mutation.amount);
    const signed = mutation.direction === "credit" ? amount : `-${amount}`;
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(mutation.idempotencyKey))
      throw new WalletError(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency key must be 12–128 safe characters",
      );
    const execute = async () =>
      this.db.$transaction(async (tx: any) => {
        const existing = await tx.walletTransaction.findUnique({
          where: { idempotencyKey: mutation.idempotencyKey },
        });
        if (existing) {
          if (!same(existing, mutation, signed))
            throw new WalletError(
              "IDEMPOTENCY_CONFLICT",
              "Idempotency key belongs to another operation",
            );
          return existing;
        }
        const rows = await tx.$queryRawUnsafe(
          `UPDATE "wallets" SET "balance" = "balance" + $1::numeric, "version" = "version" + 1, "updated_at" = CURRENT_TIMESTAMP WHERE "user_id" = $2::uuid AND ($1::numeric >= 0 OR "balance" + $1::numeric >= 0) RETURNING "id", "balance" - $1::numeric AS "balanceBefore", "balance" AS "balanceAfter"`,
          signed,
          mutation.userId,
        );
        const row = rows[0];
        if (!row) {
          const wallet = await tx.wallet.findUnique({
            where: { userId: mutation.userId },
            select: { id: true },
          });
          throw new WalletError(
            wallet ? "INSUFFICIENT_BALANCE" : "WALLET_NOT_FOUND",
            wallet ? "Insufficient balance" : "Wallet not found",
          );
        }
        const ledger = await tx.walletTransaction.create({
          data: {
            walletId: row.id,
            userId: mutation.userId,
            type: mutation.type,
            amount: signed,
            balanceBefore: row.balanceBefore,
            balanceAfter: row.balanceAfter,
            idempotencyKey: mutation.idempotencyKey,
            ...(mutation.referenceId
              ? { referenceId: mutation.referenceId }
              : {}),
            ...(mutation.description
              ? { description: mutation.description.slice(0, 500) }
              : {}),
            ...(mutation.metadata ? { metadata: mutation.metadata } : {}),
          },
        });
        if (mutation.audit && mutation.actorId)
          await tx.auditLog.create({
            data: {
              actorId: mutation.actorId,
              action: "BALANCE_ADJUST",
              resource: "wallet",
              resourceId: mutation.userId,
              before: { balance: String(row.balanceBefore) },
              after: {
                balance: String(row.balanceAfter),
                amount: signed,
                type: mutation.type,
                idempotencyKey: mutation.idempotencyKey,
              },
            },
          });
        return ledger;
      });
    try {
      const result = await execute();
      return this.serialize(result);
    } catch (error: any) {
      if (error?.code === "P2002") {
        const existing = await this.db.walletTransaction.findUnique({
          where: { idempotencyKey: mutation.idempotencyKey },
        });
        if (existing && same(existing, mutation, signed))
          return this.serialize(existing);
        throw new WalletError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key belongs to another operation",
        );
      }
      throw error;
    }
  }
  private serialize(value: any) {
    return {
      id: value.id,
      userId: value.userId,
      type: value.type,
      amount: String(value.amount),
      balanceBefore: String(value.balanceBefore),
      balanceAfter: String(value.balanceAfter),
      referenceId: value.referenceId ?? null,
      description: value.description ?? null,
      createdAt: value.createdAt,
    };
  }
}
