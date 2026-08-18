export class SupportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const message = (v: unknown) => {
  const x = String(v ?? "").trim();
  if (x.length < 2 || x.length > 10000)
    throw new SupportError(
      "MESSAGE_INVALID",
      "Message must be 2-10000 characters",
    );
  return x;
};
export class SupportService {
  constructor(private db: any) {}
  async adminInbox(query: any) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            subject: {
              contains: String(query.search).slice(0, 100),
              mode: "insensitive",
            },
          }
        : {}),
    };
    const page = Math.max(1, Number(query.page) || 1),
      limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const [total, items] = await Promise.all([
      this.db.ticket.count({ where }),
      this.db.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    return {
      page,
      limit,
      total,
      items: items.map((x: any) => ({ ...x, id: String(x.id) })),
    };
  }
  async adminStatus(actorId: string, id: bigint, status: string) {
    if (!["OPEN", "ANSWERED", "CUSTOMER_REPLY", "CLOSED"].includes(status))
      throw new SupportError("STATUS_INVALID", "Invalid status");
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.ticket.findUnique({ where: { id } });
      if (!before)
        throw new SupportError("TICKET_NOT_FOUND", "Ticket not found");
      const item = await tx.ticket.update({
        where: { id },
        data: { status, closedAt: status === "CLOSED" ? new Date() : null },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "TICKET_STATUS",
          resource: "ticket",
          resourceId: String(id),
          before: { status: before.status },
          after: { status },
        },
      });
      return item;
    });
  }
  async create(userId: string, input: any) {
    const subject = String(input.subject ?? "").trim();
    if (subject.length < 3 || subject.length > 255)
      throw new SupportError("SUBJECT_INVALID", "Invalid subject");
    return this.db.$transaction(async (tx: any) => {
      const ticket = await tx.ticket.create({
        data: {
          userId,
          subject,
          category: String(input.category ?? "GENERAL").slice(0, 80),
          status: "OPEN",
          priority: "NORMAL",
        },
      });
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: userId,
          message: message(input.message),
        },
      });
      return { ...ticket, id: String(ticket.id) };
    });
  }
  async list(userId: string) {
    const rows = await this.db.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map((x: any) => ({ ...x, id: String(x.id) }));
  }
  async detail(userId: string, id: bigint, isStaff = false) {
    const t = await this.db.ticket.findUnique({ where: { id } });
    if (!t || (!isStaff && t.userId !== userId))
      throw new SupportError("TICKET_NOT_FOUND", "Ticket not found");
    const messages = await this.db.ticketMessage.findMany({
      where: { ticketId: id, ...(!isStaff ? { internal: false } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return { ...t, id: String(t.id), messages };
  }
  async reply(userId: string, id: bigint, input: any, isStaff = false) {
    return this.db.$transaction(async (tx: any) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket || (!isStaff && ticket.userId !== userId))
        throw new SupportError("TICKET_NOT_FOUND", "Ticket not found");
      const item = await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorId: userId,
          message: message(input.message),
          internal: isStaff && Boolean(input.internal),
        },
      });
      await tx.ticket.update({
        where: { id },
        data: { status: isStaff ? "ANSWERED" : "CUSTOMER_REPLY" },
      });
      if (isStaff && !input.internal)
        await tx.notification.create({
          data: {
            userId: ticket.userId,
            channel: "IN_APP",
            type: "TICKET_REPLY",
            title: `Ticket #${id} replied`,
            body: "Support has replied to your ticket",
            data: { ticketId: String(id) },
          },
        });
      return item;
    });
  }
  async markRead(userId: string, id: string) {
    const x = await this.db.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!x.count)
      throw new SupportError(
        "NOTIFICATION_NOT_FOUND",
        "Notification not found",
      );
    return { read: true };
  }
  notifications(userId: string) {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  validateAttachment(x: { name: string; mime: string; size: number }) {
    if (
      x.size > 5 * 1024 * 1024 ||
      ![/^image\/(png|jpeg|webp)$/, /^application\/pdf$/].some((r) =>
        r.test(x.mime),
      ) ||
      !/^[-_.A-Za-z0-9]+$/.test(x.name)
    )
      throw new SupportError("ATTACHMENT_INVALID", "Invalid attachment");
    return `${crypto.randomUUID()}-${x.name}`;
  }
}
