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
const MONEY_SCALE = 100_000_000n;
const moneyUnits = (value: unknown): bigint => {
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(value ?? "0"));
  if (!match)
    throw new AdminOperationError("MONEY_INVALID", "Invalid money value");
  return (
    BigInt(match[1]!) * MONEY_SCALE + BigInt((match[2] ?? "").padEnd(8, "0"))
  );
};
const moneyText = (value: bigint): string =>
  `${value / MONEY_SCALE}.${String(value % MONEY_SCALE).padStart(8, "0")}`;

export class AdminOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AdminOperationsService {
  private snapshots: DailySnapshotService;
  constructor(private db: any) {
    this.snapshots = new DailySnapshotService(db);
  }

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
        ...(optional(query.priceGroupId)
          ? {
              priceGroupId: uuidFilter(
                query.priceGroupId,
                "PRICE_GROUP_FILTER_INVALID",
              ),
            }
          : {}),
        ...(optional(query.registeredFrom) || optional(query.registeredTo)
          ? {
              createdAt: {
                ...(optional(query.registeredFrom)
                  ? { gte: new Date(String(query.registeredFrom)) }
                  : {}),
                ...(optional(query.registeredTo)
                  ? { lte: new Date(String(query.registeredTo)) }
                  : {}),
              },
            }
          : {}),
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
          priceGroupId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const groupIds = rows
      .map((row: any) => row.priceGroupId)
      .filter((id: any): id is string => Boolean(id));
    const groups = groupIds.length
      ? await this.db.priceGroup.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const groupMap = new Map(groups.map((group: any) => [group.id, group]));
    return {
      items: rows.map((row: any) => ({
        ...row,
        priceGroup: row.priceGroupId ? groupMap.get(row.priceGroupId) : null,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
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
        priceGroupId: true,
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
    const [
      orders,
      deposits,
      tickets,
      sessions,
      priceGroup,
      priceGroups,
      priceGroupHistory,
      successfulDeposits,
      spending,
      completedOrders,
    ] = await Promise.all([
      this.db.order.count({ where: { userId: id } }),
      this.db.deposit.count({ where: { userId: id } }),
      this.db.ticket.count({ where: { userId: id } }),
      this.db.session.count({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      user.priceGroupId
        ? this.db.priceGroup.findUnique({ where: { id: user.priceGroupId } })
        : null,
      this.db.priceGroup.findMany({ orderBy: { tierOrder: "asc" } }),
      this.db.priceGroupHistory.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.db.deposit.aggregate({
        where: { userId: id, status: "PAID" },
        _sum: { netAmount: true },
      }),
      this.db.order.aggregate({
        where: { userId: id },
        _sum: { charge: true, refundedAmount: true },
      }),
      this.db.order.count({ where: { userId: id, status: "COMPLETED" } }),
    ]);
    return {
      ...user,
      roles,
      wallet: wallet
        ? { balance: String(wallet.balance), currency: wallet.currency }
        : null,
      counts: { orders, deposits, tickets, activeSessions: sessions },
      priceGroup,
      priceGroups,
      priceGroupHistory,
      upgradeStats: {
        successfulDeposits: String(successfulDeposits._sum.netAmount ?? "0"),
        totalSpent: moneyText(
          moneyUnits(spending._sum.charge ?? "0") -
            moneyUnits(spending._sum.refundedAmount ?? "0"),
        ),
        completedOrders,
      },
    };
  }

  async assignPriceGroup(actorId: string, userId: string, input: any) {
    const reason = optional(input.reason)?.slice(0, 500);
    return this.db.$transaction(async (tx: any) => {
      const [user, next] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { id: true, priceGroupId: true },
        }),
        tx.priceGroup.findFirst({
          where: { id: String(input.priceGroupId ?? ""), active: true },
        }),
      ]);
      if (!user)
        throw new AdminOperationError("USER_NOT_FOUND", "User not found");
      if (!next)
        throw new AdminOperationError(
          "PRICE_GROUP_NOT_FOUND",
          "Price group not found or inactive",
        );
      const previous = user.priceGroupId
        ? await tx.priceGroup.findUnique({ where: { id: user.priceGroupId } })
        : null;
      if (previous?.id === next.id) return { changed: false, priceGroup: next };
      const changed = await tx.user.updateMany({
        where: { id: userId, priceGroupId: user.priceGroupId },
        data: { priceGroupId: next.id, priceGroupEvaluatedAt: new Date() },
      });
      if (!changed.count)
        throw new AdminOperationError(
          "PRICE_GROUP_CONFLICT",
          "Price group changed concurrently",
        );
      const history = await tx.priceGroupHistory.create({
        data: {
          userId,
          oldPriceGroupId: previous?.id,
          oldPriceGroupCode: previous?.code,
          oldPriceGroupName: previous?.name,
          newPriceGroupId: next.id,
          newPriceGroupCode: next.code,
          newPriceGroupName: next.name,
          source: "MANUAL",
          actorId,
          reason,
          metadata: { operation: "single" },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_PRICE_GROUP_CHANGE",
          resource: "User",
          resourceId: userId,
          before: { priceGroupId: previous?.id, code: previous?.code },
          after: { priceGroupId: next.id, code: next.code, reason },
        },
      });
      return { changed: true, priceGroup: next, historyId: history.id };
    });
  }

  private async bulkPriceGroupCandidates(db: any, input: any) {
    const ids = Array.isArray(input.userIds)
      ? [...new Set(input.userIds.map(String))].slice(0, 5000)
      : [];
    if (!ids.length)
      throw new AdminOperationError(
        "USERS_REQUIRED",
        "Select at least one user",
      );
    const [next, users] = await Promise.all([
      db.priceGroup.findFirst({
        where: { id: String(input.priceGroupId ?? ""), active: true },
      }),
      db.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, email: true, username: true, priceGroupId: true },
      }),
    ]);
    if (!next)
      throw new AdminOperationError(
        "PRICE_GROUP_NOT_FOUND",
        "Price group not found or inactive",
      );
    const oldGroups = await db.priceGroup.findMany({
      where: {
        id: { in: users.map((user: any) => user.priceGroupId).filter(Boolean) },
      },
    });
    const oldMap = new Map(oldGroups.map((group: any) => [group.id, group]));
    return {
      next,
      users: users
        .filter((user: any) => user.priceGroupId !== next.id)
        .map((user: any) => ({
          ...user,
          oldPriceGroup: oldMap.get(user.priceGroupId) ?? null,
        })),
    };
  }

  async bulkPriceGroupPreview(input: any) {
    const result = await this.bulkPriceGroupCandidates(this.db, input);
    return {
      count: result.users.length,
      priceGroup: {
        id: result.next.id,
        code: result.next.code,
        name: result.next.name,
      },
      users: result.users,
    };
  }

  async bulkAssignPriceGroup(actorId: string, input: any) {
    const reason = optional(input.reason)?.slice(0, 500);
    return this.db.$transaction(async (tx: any) => {
      const result = await this.bulkPriceGroupCandidates(tx, input);
      for (const user of result.users) {
        const changed = await tx.user.updateMany({
          where: { id: user.id, priceGroupId: user.priceGroupId },
          data: {
            priceGroupId: result.next.id,
            priceGroupEvaluatedAt: new Date(),
          },
        });
        if (!changed.count)
          throw new AdminOperationError(
            "PRICE_GROUP_CONFLICT",
            "A user changed concurrently",
          );
        await tx.priceGroupHistory.create({
          data: {
            userId: user.id,
            oldPriceGroupId: user.oldPriceGroup?.id,
            oldPriceGroupCode: user.oldPriceGroup?.code,
            oldPriceGroupName: user.oldPriceGroup?.name,
            newPriceGroupId: result.next.id,
            newPriceGroupCode: result.next.code,
            newPriceGroupName: result.next.name,
            source: "MANUAL",
            actorId,
            reason,
            metadata: { operation: "bulk" },
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_PRICE_GROUP_BULK_CHANGE",
          resource: "User",
          after: {
            userIds: result.users.map((user: any) => user.id),
            priceGroupId: result.next.id,
            reason,
          },
        },
      });
      return { changed: result.users.length, priceGroup: result.next };
    });
  }

  async customerPriceGroup(userId: string) {
    const [user, settings, groups] = await Promise.all([
      this.db.user.findUnique({
        where: { id: userId },
        select: { priceGroupId: true },
      }),
      this.db.setting.findMany({
        where: {
          group: "pricing",
          key: { in: ["autoUpgradeEnabled", "autoDowngradeEnabled"] },
        },
      }),
      this.db.priceGroup.findMany({
        where: { active: true },
        orderBy: { tierOrder: "asc" },
      }),
    ]);
    if (!user)
      throw new AdminOperationError("USER_NOT_FOUND", "User not found");
    const currentIndex = groups.findIndex(
      (group: any) => group.id === user.priceGroupId,
    );
    const current = currentIndex >= 0 ? groups[currentIndex] : null;
    const next =
      currentIndex >= 0
        ? groups
            .slice(currentIndex + 1)
            .find((group: any) => group.upgradeEnabled)
        : null;
    const [deposits, spending, completedOrders] = await Promise.all([
      this.db.deposit.aggregate({
        where: { userId, status: "PAID" },
        _sum: { netAmount: true },
      }),
      this.db.order.aggregate({
        where: { userId },
        _sum: { charge: true, refundedAmount: true },
      }),
      this.db.order.count({ where: { userId, status: "COMPLETED" } }),
    ]);
    const stats = {
      successfulDeposits: String(deposits._sum.netAmount ?? "0"),
      totalSpent: moneyText(
        moneyUnits(spending._sum.charge ?? "0") -
          moneyUnits(spending._sum.refundedAmount ?? "0"),
      ),
      completedOrders,
    };
    const requirements = next
      ? [
          ...(next.minSuccessfulDeposits != null
            ? [
                {
                  key: "successfulDeposits",
                  required: String(next.minSuccessfulDeposits),
                  current: stats.successfulDeposits,
                  remaining: moneyText(
                    moneyUnits(next.minSuccessfulDeposits) >
                      moneyUnits(stats.successfulDeposits)
                      ? moneyUnits(next.minSuccessfulDeposits) -
                          moneyUnits(stats.successfulDeposits)
                      : 0n,
                  ),
                },
              ]
            : []),
          ...(next.minTotalSpent != null
            ? [
                {
                  key: "totalSpent",
                  required: String(next.minTotalSpent),
                  current: stats.totalSpent,
                  remaining: moneyText(
                    moneyUnits(next.minTotalSpent) >
                      moneyUnits(stats.totalSpent)
                      ? moneyUnits(next.minTotalSpent) -
                          moneyUnits(stats.totalSpent)
                      : 0n,
                  ),
                },
              ]
            : []),
          ...(next.minCompletedOrders != null
            ? [
                {
                  key: "completedOrders",
                  required: next.minCompletedOrders,
                  current: completedOrders,
                  remaining: Math.max(
                    0,
                    next.minCompletedOrders - completedOrders,
                  ),
                },
              ]
            : []),
        ]
      : [];
    const settingMap = Object.fromEntries(
      settings.map((row: any) => [row.key, row.value]),
    );
    return {
      current: current
        ? {
            id: current.id,
            code: current.code,
            name: current.name,
            description: current.publicDescription,
          }
        : null,
      autoUpgradeEnabled: settingMap.autoUpgradeEnabled === true,
      autoDowngradeEnabled: settingMap.autoDowngradeEnabled === true,
      next: next
        ? {
            id: next.id,
            code: next.code,
            name: next.name,
            description: next.publicDescription,
            matchMode: next.upgradeMatchMode,
          }
        : null,
      stats,
      requirements,
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
          priceGroupId: true,
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

  async priceGroupConfiguration() {
    const [priceGroups, settings] = await Promise.all([
      this.db.priceGroup.findMany({
        orderBy: [{ tierOrder: "asc" }, { name: "asc" }],
      }),
      this.db.setting.findMany({
        where: {
          group: "pricing",
          key: { in: ["autoUpgradeEnabled", "autoDowngradeEnabled"] },
        },
      }),
    ]);
    const values = Object.fromEntries(
      settings.map((row: any) => [row.key, row.value]),
    );
    return {
      priceGroups,
      autoUpgradeEnabled: values.autoUpgradeEnabled === true,
      autoDowngradeEnabled: values.autoDowngradeEnabled === true,
    };
  }

  async updatePriceGroupSettings(actorId: string, input: any) {
    const values = {
      autoUpgradeEnabled: input.autoUpgradeEnabled === true,
      autoDowngradeEnabled: input.autoDowngradeEnabled === true,
    };
    return this.db.$transaction(async (tx: any) => {
      const before = await tx.setting.findMany({ where: { group: "pricing" } });
      for (const [key, value] of Object.entries(values))
        await tx.setting.upsert({
          where: { group_key: { group: "pricing", key } },
          create: { key, value, group: "pricing", encrypted: false },
          update: { value, encrypted: false },
        });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PRICE_GROUP_POLICY_UPDATE",
          resource: "Setting",
          before,
          after: values,
        },
      });
      return values;
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

  async reportTrend(from: string, to: string) {
    const setting = await this.db.setting.findUnique({
      where: { group_key: { group: "general", key: "timezone" } },
    });
    const timezone =
      typeof setting?.value === "string" ? setting.value : "Asia/Ho_Chi_Minh";
    return {
      timezone,
      items: await this.snapshots.trend(timezone, from, to),
    };
  }

  async rebuildReport(actorId: string, date: string) {
    const setting = await this.db.setting.findUnique({
      where: { group_key: { group: "general", key: "timezone" } },
    });
    const timezone =
        typeof setting?.value === "string" ? setting.value : "Asia/Ho_Chi_Minh",
      snapshot = await this.snapshots.build(date, timezone);
    await this.db.auditLog.create({
      data: {
        actorId,
        action: "REPORT_SNAPSHOT_REBUILD",
        resource: "DailyReportSnapshot",
        resourceId: snapshot.id,
        after: { date, timezone },
      },
    });
    return snapshot;
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
        "maintenanceMessage",
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

  async maintenance() {
    const rows = await this.db.setting.findMany({
      where: {
        group: "general",
        key: { in: ["maintenanceMode", "maintenanceMessage"] },
        encrypted: false,
      },
      select: { key: true, value: true },
    });
    const values = Object.fromEntries(
      rows.map((row: any) => [row.key, row.value]),
    );
    return {
      enabled: values.maintenanceMode === true,
      message:
        typeof values.maintenanceMessage === "string"
          ? values.maintenanceMessage.slice(0, 500)
          : "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
    };
  }
}
import { DailySnapshotService } from "@smm/database";
