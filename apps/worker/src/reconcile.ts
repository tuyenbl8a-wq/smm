export class ReconcileWorker {
  constructor(
    private db: any,
    private query: (o: any) => Promise<any>,
    private apply: (
      id: bigint,
      s: string,
      r: number,
      c?: number,
    ) => Promise<any>,
  ) {}
  async once() {
    const rows = await this.db.order.findMany({
      where: {
        status: { in: ["PROCESSING", "IN_PROGRESS"] },
        providerOrderId: { not: null },
      },
      orderBy: { updatedAt: "asc" },
      take: 50,
    });
    for (const o of rows) {
      try {
        const x = await this.query(o);
        if (x && x.status)
          await this.apply(
            o.id,
            x.status,
            Number(x.remains ?? 0),
            x.start_count == null ? undefined : Number(x.start_count),
          );
      } catch {}
    }
    return rows.length;
  }
}
