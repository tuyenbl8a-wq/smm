import { DailySnapshotService } from "@smm/database";

export class ReportSnapshotWorker {
  private service: DailySnapshotService;
  constructor(private db: any) {
    this.service = new DailySnapshotService(db);
  }
  async once(now = new Date()) {
    const setting = await this.db.setting.findUnique({
        where: { group_key: { group: "general", key: "timezone" } },
      }),
      timezone =
        typeof setting?.value === "string" ? setting.value : "Asia/Ho_Chi_Minh",
      local = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now),
      previous = new Date(`${local}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    await this.service.build(previous.toISOString().slice(0, 10), timezone);
    await this.service.build(local, timezone);
    return 2;
  }
}
