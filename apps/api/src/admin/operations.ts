const clamp = (value: unknown, fallback = 20) =>
  Math.min(100, Math.max(1, Number(value) || fallback));
const optional = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text && text !== "undefined" && text !== "null" ? text : undefined;
};
const enumFilter = (
  value: unknown,
  allowed: readonly string[],
  code: string,
) => {
  const text = optional(value);
  if (text && !allowed.includes(text))
    throw new AdminOperationError(code, "Invalid filter value");
  return text;
};
const uuidFilter = (value: unknown, code: string) => {
  const text = optional(value);
  if (text && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(text))
    throw new AdminOperationError(code, "Invalid identifier filter");
  return text;
};

export class AdminOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AdminOperationsService {
  constructor(private db: any) {}

  async users(query: any) {
    const page = Math.max(1, Number(query.page) || 1),
      limit = clamp(query.limit),
      search = optional(query.search) ?? "",
      status = enumFilter(
        query.status,
        ["PENDING", "ACTIVE", "BANNED", "DELETED"],
        "USER_STATUS_INVALID",
      ),
      where: any = {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { id: { equals: search } },
                { email: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
    const roleCode = optional(query.role);
    if (roleCode) {
      const role = await this.db.role.findUnique({
        where: { code: roleCode },
      });
      const links = role
        ? await this.db.userRole.findMany({ where: { roleId: role.id } })
        : [];
      where.id = { in: links.map((x: any) => x.userId) };
    }
    const [total, rows] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: rows, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async user(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user)
      throw new AdminOperationError("USER_NOT_FOUND", "User not found");
    const links = await this.db.userRole.findMany({ where: { userId: id } }),
      roles = await this.db.role.findMany({
        where: { id: { in: links.map((x: any) => x.roleId) } },
        select: { id: true, code: true, name: true },
      }),
      wallet = await this.db.wallet.findUnique({ where: { userId: id } });
    const [orders, deposits, tickets, sessions] = await Promise.all([
      this.db.order.count({ where: { userId: id } }),
      this.db.deposit.count({ where: { userId: id } }),
      this.db.ticket.count({ where: { userId: id } }),
      this.db.session.count({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    return {
      ...user,
      roles,
      wallet: wallet
        ? { balance: String(wallet.balance), currency: wallet.currency }
        : null,
      counts: { orders, deposits, tickets, activeSessions: sessions },
    };
  }

  async updateUser(actorId: string, id: string, input: any) {
    if (actorId === id && input.status === "BANNED")
      throw new AdminOperationError("SELF_BAN_DENIED", "Cannot ban yourself");
    const before = await this.user(id),
      email =
        input.email == null
          ? undefined
          : String(input.email).trim().toLowerCase(),
      username =
        input.username == null ? undefined : String(input.username).trim();
    if (email !== undefined && !/^\S+@\S+\.\S+$/.test(email))
      throw new AdminOperationError("EMAIL_INVALID", "Invalid email");
    if (username !== undefined && !/^[a-zA-Z0-9_.-]{3,64}$/.test(username))
      throw new AdminOperationError("USERNAME_INVALID", "Invalid username");
    return this.db.$transaction(async (tx: any) => {
      const after = await tx.user.update({
        where: { id },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(username !== undefined ? { username } : {}),
          ...(input.emailVerified === true
            ? { emailVerifiedAt: new Date() }
            : {}),
          ...(input.emailVerified === false ? { emailVerifiedAt: null } : {}),
          ...(input.status ? { status: String(input.status) } : {}),
        },
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          emailVerifiedAt: true,
        },
      });
      if (input.status === "BANNED")
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_UPDATE",
          resource: "User",
          resourceId: id,
          before,
          after,
        },
      });
      return after;
    });
  }

  async roles(actorId: string, id: string, codes: string[]) {
    if (!Array.isArray(codes) || !codes.length)
      throw new AdminOperationError(
        "ROLES_REQUIRED",
        "At least one role required",
      );
    if (actorId === id && !codes.includes("SUPER_ADMIN"))
      throw new AdminOperationError(
        "SELF_DEMOTION_DENIED",
        "Cannot remove your own SUPER_ADMIN role",
      );
    const roles = await this.db.role.findMany({
      where: { code: { in: codes } },
    });
    if (roles.length !== new Set(codes).size)
      throw new AdminOperationError("ROLE_INVALID", "Invalid role");
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.userRole.findMany({ where: { userId: id } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role: any) => ({ userId: id, roleId: role.id })),
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_ROLES_UPDATE",
          resource: "User",
          resourceId: id,
          before,
          after: { roles: codes },
        },
      });
      return { roles: codes };
    });
  }

  async revokeSessions(actorId: string, id: string) {
    const result = await this.db.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.db.auditLog.create({
      data: {
        actorId,
        action: "USER_SESSIONS_REVOKE",
        resource: "User",
        resourceId: id,
        after: { count: result.count },
      },
    });
    return { revoked: result.count };
  }

  async orders(query: any) {
    const page = Math.max(1, Number(query.page) || 1),
      limit = clamp(query.limit),
      status = enumFilter(
        query.status,
        [
          "PENDING",
          "PROCESSING",
          "IN_PROGRESS",
          "COMPLETED",
          "PARTIAL",
          "CANCELED",
          "REFUNDED",
          "FAILED",
        ],
        "ORDER_STATUS_INVALID",
      ),
      provider = uuidFilter(query.provider, "PROVIDER_FILTER_INVALID"),
      user = uuidFilter(query.user, "USER_FILTER_INVALID"),
      service = uuidFilter(query.service, "SERVICE_FILTER_INVALID"),
      search = optional(query.search),
      where: any = {
        ...(status ? { status } : {}),
        ...(provider ? { providerId: provider } : {}),
        ...(user ? { userId: user } : {}),
        ...(service ? { serviceId: service } : {}),
        ...(search
          ? {
              OR: [
                { publicId: { equals: search } },
                { link: { contains: search } },
              ],
            }
          : {}),
      };
    const [total, items] = await Promise.all([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async order(publicId: string) {
    const order = await this.db.order.findUnique({ where: { publicId } });
    if (!order)
      throw new AdminOperationError("ORDER_NOT_FOUND", "Order not found");
    const [history, logs, refills, cancellations, user, service, provider] =
      await Promise.all([
        this.db.orderHistory.findMany({
          where: { orderId: order.id },
          orderBy: { createdAt: "asc" },
        }),
        this.db.orderProviderLog.findMany({
          where: { orderId: order.id },
          orderBy: { createdAt: "desc" },
        }),
        this.db.refill.findMany({ where: { orderId: order.id } }),
        this.db.cancellation.findMany({ where: { orderId: order.id } }),
        this.db.user.findUnique({
          where: { id: order.userId },
          select: { id: true, email: true, username: true },
        }),
        this.db.service.findUnique({
          where: { id: order.serviceId },
          select: { id: true, name: true },
        }),
        order.providerId
          ? this.db.provider.findUnique({
              where: { id: order.providerId },
              select: { id: true, name: true, status: true },
            })
          : null,
      ]);
    return {
      ...order,
      user,
      service,
      provider,
      history,
      providerLogs: logs,
      refills,
      cancellations,
    };
  }

  async reports(from?: Date, to?: Date) {
    const createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
      orderWhere = from || to ? { createdAt } : {},
      depositWhere = { ...(from || to ? { createdAt } : {}), status: "PAID" };
    const [
      orders,
      money,
      deposits,
      failed,
      partial,
      refunded,
      users,
      manual,
      services,
      providers,
    ] = await Promise.all([
      this.db.order.count({ where: orderWhere }),
      this.db.order.aggregate({
        where: orderWhere,
        _sum: { charge: true, providerCost: true, profit: true },
      }),
      this.db.deposit.aggregate({
        where: depositWhere,
        _sum: { netAmount: true },
        _count: true,
      }),
      this.db.order.count({ where: { ...orderWhere, status: "FAILED" } }),
      this.db.order.count({ where: { ...orderWhere, status: "PARTIAL" } }),
      this.db.order.count({ where: { ...orderWhere, status: "REFUNDED" } }),
      this.db.user.count({
        where: from || to ? { createdAt } : undefined,
      }),
      this.db.deposit.count({ where: { status: "MANUAL_REVIEW" } }),
      this.db.order.groupBy({
        by: ["serviceId"],
        where: orderWhere,
        _count: true,
        _sum: { charge: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 10,
      }),
      this.db.order.groupBy({
        by: ["providerId"],
        where: { ...orderWhere, providerId: { not: null } },
        _count: true,
        _sum: { providerCost: true, profit: true },
        orderBy: { _count: { providerId: "desc" } },
        take: 10,
      }),
    ]);
    return {
      orders: { total: orders, failed, partial, refunded },
      users,
      money: {
        revenue: String(money._sum.charge ?? 0),
        providerCost: String(money._sum.providerCost ?? 0),
        profit: String(money._sum.profit ?? 0),
        deposits: String(deposits._sum.netAmount ?? 0),
      },
      deposits: { paid: deposits._count, manualReview: manual },
      topServices: services.map((x: any) => ({
        serviceId: x.serviceId,
        orders: Number(x._count?.serviceId ?? x._count ?? 0),
        charge: String(x._sum.charge ?? 0),
      })),
      providerPerformance: providers.map((x: any) => ({
        providerId: x.providerId,
        orders: Number(x._count?.providerId ?? x._count ?? 0),
        cost: String(x._sum.providerCost ?? 0),
        profit: String(x._sum.profit ?? 0),
      })),
    };
  }

  async reportsCsv(from?: Date, to?: Date) {
    const report = await this.reports(from, to),
      safe = (value: unknown) => {
        const text = String(value ?? "").replaceAll('"', '""');
        return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`;
      },
      rows = [
        ["Chỉ số", "Giá trị"],
        ["Tổng đơn", report.orders.total],
        ["Đơn thất bại", report.orders.failed],
        ["Đơn một phần", report.orders.partial],
        ["Đơn hoàn tiền", report.orders.refunded],
        ["Người dùng mới", report.users],
        ["Doanh thu", report.money.revenue],
        ["Chi phí nhà cung cấp", report.money.providerCost],
        ["Lợi nhuận", report.money.profit],
        ["Tiền nạp", report.money.deposits],
      ];
    return rows.map((row) => row.map(safe).join(",")).join("\r\n");
  }

  async logs(kind: string, page = 1, limit = 50) {
    const model =
      kind === "system"
        ? this.db.systemLog
        : kind === "webhook"
          ? this.db.webhookLog
          : this.db.auditLog;
    return model.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * clamp(limit, 50),
      take: clamp(limit, 50),
    });
  }

  async settings() {
    return this.db.setting.findMany({
      where: { encrypted: false },
      select: { group: true, key: true, value: true, updatedAt: true },
      orderBy: [{ group: "asc" }, { key: "asc" }],
    });
  }

  async updateSettings(actorId: string, input: any) {
    const allowed = new Set([
        "siteName",
        "currency",
        "timezone",
        "registrationEnabled",
        "maintenanceMode",
      ]),
      entries = Object.entries(input).filter(([key]) => allowed.has(key));
    if (!entries.length)
      throw new AdminOperationError("SETTING_INVALID", "No supported settings");
    return this.db.$transaction(async (tx: any) => {
      for (const [key, value] of entries)
        await tx.setting.upsert({
          where: { group_key: { group: "general", key } },
          update: { value, encrypted: false },
          create: { group: "general", key, value, encrypted: false },
        });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "SETTINGS_UPDATE",
          resource: "Setting",
          after: Object.fromEntries(entries),
        },
      });
      return { updated: entries.map(([key]) => key) };
    });
  }
}
