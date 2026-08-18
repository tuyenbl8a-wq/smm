import { createHash, randomBytes } from "node:crypto";
import { OrderService } from "../order/service.js";
const hash = (x: string) => createHash("sha256").update(x).digest("hex");
export class ResellerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export class ResellerService {
  constructor(
    private db: any,
    private orders: OrderService,
  ) {}
  async list(userId: string) {
    return this.db.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        keyPrefix: true,
        active: true,
        rateLimit: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }
  async disable(userId: string, id: string) {
    const x = await this.db.apiKey.updateMany({
      where: { id, userId },
      data: { active: false },
    });
    if (!x.count) throw new ResellerError("KEY_NOT_FOUND", "API key not found");
    return { disabled: true };
  }
  async generate(userId: string) {
    const raw = `smm_${randomBytes(32).toString("base64url")}`,
      keyHash = hash(raw);
    await this.db.apiKey.updateMany({
      where: { userId },
      data: { active: false },
    });
    await this.db.apiKey.create({
      data: { userId, keyPrefix: raw.slice(0, 12), keyHash },
    });
    return { key: raw, prefix: raw.slice(0, 12) };
  }
  async authenticate(raw: string) {
    const row = await this.db.apiKey.findUnique({
      where: { keyHash: hash(raw) },
    });
    if (!row || !row.active)
      throw new ResellerError("INVALID_KEY", "Invalid API key");
    await this.db.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    return row;
  }
  async execute(raw: string, input: any, authenticated?: any) {
    const key = authenticated ?? (await this.authenticate(raw)),
      action = String(input.action);
    if (action === "balance") {
      const w = await this.db.wallet.findUnique({
        where: { userId: key.userId },
      });
      return { balance: String(w.balance), currency: w.currency };
    }
    if (action === "services")
      return this.db.service
        .findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            type: true,
            rate: true,
            min: true,
            max: true,
            refill: true,
            cancel: true,
          },
        })
        .then((x: any[]) =>
          x.map((s) => ({ ...s, service: s.id, rate: String(s.rate) })),
        );
    if (action === "add")
      return this.orders
        .create(
          key.userId,
          {
            serviceId: input.service,
            link: input.link,
            quantity: Number(input.quantity),
          },
          String(
            input.idempotency_key ??
              `api:${hash(JSON.stringify(input)).slice(0, 24)}`,
          ),
        )
        .then((x) => ({ order: x.id }));
    if (action === "status") {
      const o = await this.db.order.findFirst({
        where: { id: BigInt(input.order), userId: key.userId },
      });
      if (!o) throw new ResellerError("ORDER_NOT_FOUND", "Order not found");
      return {
        charge: String(o.charge),
        start_count: o.startCount,
        status: o.status,
        remains: o.remains,
      };
    }
    throw new ResellerError("ACTION_INVALID", "Invalid action");
  }
}
