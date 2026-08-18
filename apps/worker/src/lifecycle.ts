import { createDecipheriv, createHash } from "node:crypto";
const dec = (v: string, k: string) => {
  const [x, i, t, d] = v.split(".");
  if (x !== "v1") throw Error("SECRET");
  const c = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(k).digest(),
    Buffer.from(i!, "base64url"),
  );
  c.setAuthTag(Buffer.from(t!, "base64url"));
  return Buffer.concat([
    c.update(Buffer.from(d!, "base64url")),
    c.final(),
  ]).toString("utf8");
};
export class LifecycleWorker {
  private running = false;
  constructor(
    private db: any,
    private key: string,
  ) {}
  async run() {
    if (this.running) return 0;
    this.running = true;
    try {
      let count = 0;
      const orders = await this.db.order.findMany({
        where: {
          status: { in: ["PROCESSING", "IN_PROGRESS"] },
          providerOrderId: { not: null },
        },
        take: 50,
        orderBy: { updatedAt: "asc" },
      });
      for (const o of orders) {
        try {
          const p = await this.db.provider.findUnique({
              where: { id: o.providerId },
            }),
            controller = new AbortController(),
            timer = setTimeout(() => controller.abort(), p.timeoutMs);
          try {
            const r = await fetch(p.apiUrl, {
              method: "POST",
              body: new URLSearchParams({
                key: dec(p.apiKeyEncrypted, this.key),
                action: "status",
                order: o.providerOrderId,
              }),
              signal: controller.signal,
            });
            const x = await r.json();
            if (r.ok && x?.status)
              await this.db.order.update({
                where: { id: o.id },
                data: {
                  status: String(x.status).toUpperCase().replaceAll(" ", "_"),
                  remains: Number(x.remains ?? 0),
                  startCount:
                    x.start_count == null ? undefined : Number(x.start_count),
                },
              });
          } finally {
            clearTimeout(timer);
          }
          count++;
        } catch {}
      }
      await this.actions("refill");
      await this.actions("cancel");
      return count;
    } finally {
      this.running = false;
    }
  }
  private async actions(kind: "refill" | "cancel") {
    const model = kind === "refill" ? this.db.refill : this.db.cancellation,
      rows = await model.findMany({ where: { status: "PENDING" }, take: 20 });
    for (const row of rows) {
      const o = await this.db.order.findUnique({ where: { id: row.orderId } });
      if (!o?.providerOrderId) continue;
      const p = await this.db.provider.findUnique({
        where: { id: o.providerId },
      });
      try {
        const r = await fetch(p.apiUrl, {
          method: "POST",
          body: new URLSearchParams({
            key: dec(p.apiKeyEncrypted, this.key),
            action: kind,
            order: o.providerOrderId,
          }),
        });
        const x = await r.json();
        if (!r.ok || x?.error) throw Error("REJECTED");
        await model.update({
          where: { id: row.id },
          data: {
            status: "SUCCEEDED",
            ...(kind === "refill" && x.refill
              ? { providerRefillId: String(x.refill) }
              : {}),
          },
        });
      } catch {
        await model.update({
          where: { id: row.id },
          data: { status: "FAILED" },
        });
      }
    }
  }
}
