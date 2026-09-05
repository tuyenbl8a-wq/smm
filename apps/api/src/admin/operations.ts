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
const CANONICAL_ADMIN_PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  "orders.manage",
  "orders.sync",
  "orders.refund",
  "orders.retry",
  "services.view",
  "services.manage",
  "services.import",
  "providers.view",
  "providers.manage",
  "users.view",
  "users.manage",
  "users.balance.manage",
  "payments.view",
  "payments.manage",
  "payments.approve",
  "coupons.view",
  "coupons.manage",
  "support.view",
  "support.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "staff.view",
  "staff.manage",
  "audit.view",
] as const;
const STAFF_CANDIDATE_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  status: true,
  priceGroupId: true,
} as const;
const CANONICAL_ADMIN_PERMISSION_SET = new Set<string>(
  CANONICAL_ADMIN_PERMISSIONS,
);
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
  constructor(
    private db: any,
    private encryptionKey = "",
    private adapterFactory: (provider: any) => any = (provider) =>
      new StandardSmmAdapter(
        provider.apiUrl,
        decryptSecret(provider.apiKeyEncrypted, encryptionKey),
        provider.timeoutMs,
      ),
  ) {
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
          fullName: true,
          phone: true,
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
    const ids = rows.map((row: any) => row.id),
      [wallets, userRoles, roleRows, deposits, orders, lastLogins] =
        await Promise.all([
          this.db.wallet?.findMany
            ? this.db.wallet.findMany({ where: { userId: { in: ids } } })
            : [],
          this.db.userRole?.findMany
            ? this.db.userRole.findMany({ where: { userId: { in: ids } } })
            : [],
          this.db.role?.findMany ? this.db.role.findMany({}) : [],
          this.db.deposit?.groupBy
            ? this.db.deposit.groupBy({
                by: ["userId"],
                where: { userId: { in: ids }, status: "PAID" },
                _sum: { netAmount: true },
              })
            : [],
          this.db.order?.groupBy
            ? this.db.order.groupBy({
                by: ["userId"],
                where: { userId: { in: ids } },
                _sum: { charge: true, refundedAmount: true },
                _count: { _all: true },
              })
            : [],
          this.db.loginHistory?.findMany
            ? this.db.loginHistory.findMany({
                where: { userId: { in: ids }, success: true },
                orderBy: { createdAt: "desc" },
              })
            : [],
        ]),
      groupMap = new Map(groups.map((group: any) => [group.id, group])),
      roleMap = new Map(roleRows.map((role: any) => [role.id, role.code]));
    return {
      items: rows.map((row: any) => ({
        ...row,
        priceGroup: row.priceGroupId ? groupMap.get(row.priceGroupId) : null,
        balance: String(
          wallets.find((wallet: any) => wallet.userId === row.id)?.balance ??
            "0",
        ),
        roles: userRoles
          .filter((link: any) => link.userId === row.id)
          .map((link: any) => roleMap.get(link.roleId)),
        totalDeposits: String(
          deposits.find((entry: any) => entry.userId === row.id)?._sum
            .netAmount ?? "0",
        ),
        totalSpent: (() => {
          const entry = orders.find((order: any) => order.userId === row.id);
          return moneyText(
            moneyUnits(entry?._sum.charge ?? "0") -
              moneyUnits(entry?._sum.refundedAmount ?? "0"),
          );
        })(),
        orderCount:
          orders.find((entry: any) => entry.userId === row.id)?._count._all ??
          0,
        lastLoginAt:
          lastLogins.find((entry: any) => entry.userId === row.id)?.createdAt ??
          null,
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
        fullName: true,
        phone: true,
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
      loginHistory,
      recentOrders,
      relatedAudits,
      affiliate,
      walletStats,
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
      this.db.priceGroup.findMany({
        where: {
          active: true,
          code: { in: ["CUSTOMER", "AGENT", "DISTRIBUTOR"] },
        },
        orderBy: { tierOrder: "asc" },
      }),
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
      this.db.loginHistory?.findMany
        ? this.db.loginHistory.findMany({
            where: { userId: id },
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        : [],
      this.db.order?.findMany
        ? this.db.order.findMany({
            where: { userId: id },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: {
              id: true,
              publicId: true,
              status: true,
              charge: true,
              refundedAmount: true,
              createdAt: true,
            },
          })
        : [],
      this.db.auditLog?.findMany
        ? this.db.auditLog.findMany({
            where: { OR: [{ resourceId: id }, { actorId: id }] },
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        : [],
      this.db.affiliate?.findUnique
        ? this.db.affiliate.findUnique({ where: { userId: id } })
        : null,
      this.db.walletTransaction?.groupBy
        ? this.db.walletTransaction.groupBy({
            by: ["type"],
            where: { userId: id },
            _sum: { amount: true },
          })
        : [],
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
        totalRefunded: String(spending._sum.refundedAmount ?? "0"),
        totalBonus:
          String(
            walletStats
              .filter((row: any) => ["BONUS", "AFFILIATE"].includes(row.type))
              .reduce(
                (sum: bigint, row: any) =>
                  sum + moneyUnits(row._sum.amount ?? "0"),
                0n,
              ) / 100000000n,
          ) + ".00000000",
      },
      loginHistory,
      recentOrders: recentOrders.map((order: any) => ({
        ...order,
        orderNumber: String(100000n + BigInt(order.id)),
      })),
      relatedAudits,
      affiliate,
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
    const current = await this.user(id),
      before = {
        id: current.id,
        email: current.email,
        username: current.username,
        fullName: current.fullName,
        phone: current.phone,
        status: current.status,
        emailVerifiedAt: current.emailVerifiedAt,
        priceGroupId: current.priceGroupId,
      },
      email =
        input.email == null
          ? undefined
          : String(input.email).trim().toLowerCase(),
      username =
        input.username == null ? undefined : String(input.username).trim(),
      fullName =
        input.fullName == null
          ? undefined
          : String(input.fullName).trim().slice(0, 160),
      phone =
        input.phone == null
          ? undefined
          : String(input.phone).trim().slice(0, 32),
      reason = optional(input.reason);
    if (!reason)
      throw new AdminOperationError("REASON_REQUIRED", "Reason is required");
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
          ...(fullName !== undefined ? { fullName: fullName || null } : {}),
          ...(phone !== undefined ? { phone: phone || null } : {}),
          ...(input.emailVerified === true
            ? { emailVerifiedAt: new Date() }
            : {}),
          ...(input.emailVerified === false ? { emailVerifiedAt: null } : {}),
          ...(input.status ? { status: String(input.status) } : {}),
          ...(input.passwordHash
            ? { passwordHash: String(input.passwordHash) }
            : {}),
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
      if (input.status === "BANNED" || input.passwordHash)
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
          after: { ...after, reason },
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

  async recordSecurityAction(
    actorId: string,
    targetId: string,
    action: string,
  ) {
    await this.db.auditLog.create({
      data: {
        actorId,
        action,
        resource: "User",
        resourceId: targetId,
        after: { tokenExposed: false },
      },
    });
  }

  async staff() {
    const roles = await this.db.role.findMany({
      where: { code: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } },
    });
    const links = await this.db.userRole.findMany({
      where: { roleId: { in: roles.map((role: any) => role.id) } },
    });
    const users = await this.db.user.findMany({
      where: {
        id: { in: links.map((link: any) => link.userId) },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const [lastLogins, userGrants, roleGrants, permissions] = await Promise.all(
      [
        this.db.loginHistory.findMany({
          where: {
            userId: { in: users.map((user: any) => user.id) },
            success: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        this.db.userPermission.findMany({
          where: { userId: { in: users.map((user: any) => user.id) } },
        }),
        this.db.rolePermission.findMany({
          where: { roleId: { in: roles.map((role: any) => role.id) } },
        }),
        this.db.permission.findMany({
          where: { code: { in: [...CANONICAL_ADMIN_PERMISSIONS] } },
          orderBy: { code: "asc" },
        }),
      ],
    );
    const roleMap = new Map(roles.map((role: any) => [role.id, role.code])),
      permissionMap = new Map(
        permissions.map((permission: any) => [permission.id, permission.code]),
      );
    return {
      items: users.map((user: any) => ({
        ...user,
        roles: links
          .filter((link: any) => link.userId === user.id)
          .map((link: any) => roleMap.get(link.roleId)),
        lastLoginAt:
          lastLogins.find((row: any) => row.userId === user.id)?.createdAt ??
          null,
        directPermissions: userGrants
          .filter((grant: any) => grant.userId === user.id)
          .map((grant: any) => permissionMap.get(grant.permissionId))
          .filter(Boolean),
        rolePermissions: roleGrants
          .filter((grant: any) =>
            links.some(
              (link: any) =>
                link.userId === user.id && link.roleId === grant.roleId,
            ),
          )
          .map((grant: any) => permissionMap.get(grant.permissionId))
          .filter(Boolean),
        permissions: [
          ...new Set(
            [
              ...userGrants
                .filter((grant: any) => grant.userId === user.id)
                .map((grant: any) => permissionMap.get(grant.permissionId)),
              ...roleGrants
                .filter((grant: any) =>
                  links.some(
                    (link: any) =>
                      link.userId === user.id && link.roleId === grant.roleId,
                  ),
                )
                .map((grant: any) => permissionMap.get(grant.permissionId)),
            ].filter(Boolean),
          ),
        ],
      })),
      permissions,
    };
  }

  async staffCandidates(search: unknown) {
    const term = String(search ?? "").trim();
    if (term.length < 2 || term.length > 254)
      throw new AdminOperationError(
        "STAFF_SEARCH_INVALID",
        "Nhập ít nhất 2 ký tự để tìm tài khoản",
      );
    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          term,
        ),
      searchConditions: any[] = [
        { username: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    if (uuid) searchConditions.push({ id: term });
    const users = await this.db.user.findMany({
      where: {
        deletedAt: null,
        OR: searchConditions,
      },
      select: STAFF_CANDIDATE_USER_SELECT,
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    if (!users.length) return [];
    const priceGroupIds = [
        ...new Set<string>(
          users.map((user: any) => user.priceGroupId).filter(Boolean),
        ),
      ],
      priceGroups = priceGroupIds.length
        ? await this.db.priceGroup.findMany({
            where: { id: { in: priceGroupIds } },
            select: { id: true, code: true, name: true },
          })
        : [],
      priceGroupMap = new Map(
        priceGroups.map((group: any) => [
          group.id,
          { code: group.code, name: group.name },
        ]),
      ),
      links = await this.db.userRole.findMany({
        where: { userId: { in: users.map((user: any) => user.id) } },
      }),
      roles = await this.db.role.findMany({
        where: { id: { in: links.map((link: any) => link.roleId) } },
        select: { id: true, code: true },
      }),
      roleMap = new Map(roles.map((role: any) => [role.id, role.code]));
    return users.map((user: any) => {
      const { priceGroupId, ...safeUser } = user;
      return {
        ...safeUser,
        priceGroup: priceGroupId
          ? (priceGroupMap.get(priceGroupId) ?? null)
          : null,
        roles: links
          .filter((link: any) => link.userId === user.id)
          .map((link: any) => roleMap.get(link.roleId))
          .filter(Boolean),
      };
    });
  }

  async createStaff(
    actorId: string,
    input: any,
    actorPermissions: string[] = [],
    superAdmin = false,
  ) {
    const roleCode = input.role === "ADMIN" ? "ADMIN" : "STAFF",
      reason = optional(input.reason),
      requested = Array.isArray(input.permissions)
        ? [...new Set<string>(input.permissions.map(String))]
        : [];
    if (!reason)
      throw new AdminOperationError("REASON_REQUIRED", "Reason is required");
    if (roleCode === "ADMIN" && !superAdmin)
      throw new AdminOperationError(
        "ADMIN_ROLE_PROTECTED",
        "Only Super Admin can assign Admin role",
      );
    if (
      !superAdmin &&
      requested.some((code) => !actorPermissions.includes(code))
    )
      throw new AdminOperationError(
        "PERMISSION_GRANT_DENIED",
        "Cannot grant a permission you do not own",
      );
    return this.db.$transaction(async (tx: any) => {
      const role = await tx.role.findUniqueOrThrow({
          where: { code: roleCode },
        }),
        normal =
          (await tx.priceGroup.findUnique({ where: { code: "CUSTOMER" } })) ??
          (await tx.priceGroup.findFirst({
            where: { active: true },
            orderBy: { tierOrder: "asc" },
          })),
        permissions = requested.length
          ? await tx.permission.findMany({ where: { code: { in: requested } } })
          : [];
      if (permissions.length !== requested.length)
        throw new AdminOperationError(
          "PERMISSION_INVALID",
          "Unknown permission",
        );
      const user = await tx.user.create({
        data: {
          email: String(input.email).trim().toLowerCase(),
          username: String(input.username).trim(),
          passwordHash: String(input.passwordHash),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          referralCode: String(input.referralCode),
          priceGroupId: normal?.id,
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      if (permissions.length)
        await tx.userPermission.createMany({
          data: permissions.map((permission: any) => ({
            userId: user.id,
            permissionId: permission.id,
            grantedBy: actorId,
          })),
        });
      await tx.wallet.create({ data: { userId: user.id, currency: "USD" } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "STAFF_CREATE",
          resource: "User",
          resourceId: user.id,
          after: {
            email: user.email,
            username: user.username,
            role: roleCode,
            permissions: requested,
            reason,
          },
        },
      });
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: roleCode,
      };
    });
  }

  async updateStaff(
    actorId: string,
    actorPermissions: string[],
    targetId: string,
    input: any,
    superAdmin = false,
  ) {
    if (actorId === targetId)
      throw new AdminOperationError(
        "SELF_ESCALATION_DENIED",
        "Cannot change your own staff access",
      );
    const links = await this.db.userRole.findMany({
        where: { userId: targetId },
      }),
      targetRoles = await this.db.role.findMany({
        where: { id: { in: links.map((link: any) => link.roleId) } },
      }),
      requested = Array.isArray(input.permissions)
        ? [...new Set<string>(input.permissions.map(String))]
        : [],
      reason = optional(input.reason),
      roleCode = ["ADMIN", "CUSTOMER"].includes(input.role)
        ? input.role
        : "STAFF";
    if (!reason)
      throw new AdminOperationError("REASON_REQUIRED", "Reason is required");
    if (targetRoles.some((role: any) => role.code === "SUPER_ADMIN"))
      throw new AdminOperationError(
        "SUPER_ADMIN_PROTECTED",
        "Super Admin cannot be changed here",
      );
    if (roleCode === "ADMIN" && !superAdmin)
      throw new AdminOperationError(
        "ADMIN_ROLE_PROTECTED",
        "Only Super Admin can assign Admin role",
      );
    if (
      !superAdmin &&
      roleCode !== "CUSTOMER" &&
      requested.some((code) => !actorPermissions.includes(code))
    )
      throw new AdminOperationError(
        "PERMISSION_GRANT_DENIED",
        "Cannot grant a permission you do not own",
      );
    return this.db.$transaction(async (tx: any) => {
      const existing = await tx.userPermission.findMany({
          where: { userId: targetId },
        }),
        role =
          roleCode === "CUSTOMER"
            ? null
            : await tx.role.findUniqueOrThrow({ where: { code: roleCode } }),
        permissions = await tx.permission.findMany({
          where: {
            code: { in: roleCode === "CUSTOMER" ? [] : requested },
          },
        });
      if (roleCode !== "CUSTOMER" && permissions.length !== requested.length)
        throw new AdminOperationError(
          "PERMISSION_INVALID",
          "Unknown permission",
        );
      await tx.userRole.deleteMany({ where: { userId: targetId } });
      if (role)
        await tx.userRole.create({
          data: { userId: targetId, roleId: role.id },
        });
      await tx.userPermission.deleteMany({ where: { userId: targetId } });
      if (roleCode !== "CUSTOMER" && permissions.length)
        await tx.userPermission.createMany({
          data: permissions.map((permission: any) => ({
            userId: targetId,
            permissionId: permission.id,
            grantedBy: actorId,
          })),
          skipDuplicates: true,
        });
      if (["BANNED", "ACTIVE"].includes(input.status))
        await tx.user.update({
          where: { id: targetId },
          data: { status: input.status },
        });
      await tx.session.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "STAFF_PERMISSIONS_UPDATE",
          resource: "User",
          resourceId: targetId,
          before: {
            roles: targetRoles.map((role: any) => role.code),
            permissionIds: existing.map((grant: any) => grant.permissionId),
          },
          after: {
            role: roleCode,
            permissions: roleCode === "CUSTOMER" ? [] : requested,
            status: input.status,
            reason,
          },
        },
      });
      return {
        id: targetId,
        role: roleCode,
        permissions: roleCode === "CUSTOMER" ? [] : requested,
        status: input.status,
        sessionsRevoked: true,
      };
    });
  }

  async orderProviders() {
    return this.db.provider.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });
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
      searchOrderId =
        search && /^[0-9]+$/.test(search) && BigInt(search) > 100000n
          ? BigInt(search) - 100000n
          : null,
      providerOrderSearch = optional(query.providerOrderId),
      linkSearch = optional(query.link),
      customerSearch = optional(query.customer),
      serviceSearch = optional(query.serviceName),
      customerRows = customerSearch
        ? await this.db.user.findMany({
            where: {
              OR: [
                { username: { contains: customerSearch, mode: "insensitive" } },
                { email: { contains: customerSearch, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          })
        : [],
      serviceRows = serviceSearch
        ? await this.db.service.findMany({
            where: { name: { contains: serviceSearch, mode: "insensitive" } },
            select: { id: true },
          })
        : [],
      where: any = {
        ...(status ? { status } : {}),
        ...(provider ? { providerId: provider } : {}),
        ...(user ? { userId: user } : {}),
        ...(service ? { serviceId: service } : {}),
        ...(providerOrderSearch
          ? { providerOrderId: { contains: providerOrderSearch } }
          : {}),
        ...(linkSearch
          ? { link: { contains: linkSearch, mode: "insensitive" } }
          : {}),
        ...(customerSearch
          ? { userId: { in: customerRows.map((row: any) => row.id) } }
          : {}),
        ...(serviceSearch
          ? { serviceId: { in: serviceRows.map((row: any) => row.id) } }
          : {}),
        ...(optional(query.from) || optional(query.to)
          ? {
              createdAt: {
                ...(optional(query.from)
                  ? { gte: new Date(String(query.from)) }
                  : {}),
                ...(optional(query.to)
                  ? { lte: new Date(String(query.to)) }
                  : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                ...(searchOrderId ? [{ id: { equals: searchOrderId } }] : []),
                { publicId: { equals: search } },
                { providerOrderId: { equals: search } },
                { link: { contains: search } },
              ],
            }
          : {}),
      };
    const [total, items, statusRows] = await Promise.all([
      this.db.order.count({ where }),
      this.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.order.groupBy
        ? this.db.order.groupBy({
            by: ["status", "providerId"],
            _count: { _all: true },
          })
        : [],
    ]);
    const [users, services, providers] = await Promise.all([
      items.length && this.db.user?.findMany
        ? this.db.user.findMany({
            where: {
              id: { in: [...new Set(items.map((item: any) => item.userId))] },
            },
            select: { id: true, email: true, username: true },
          })
        : [],
      items.length && this.db.service?.findMany
        ? this.db.service.findMany({
            where: {
              id: {
                in: [...new Set(items.map((item: any) => item.serviceId))],
              },
            },
            select: { id: true, name: true },
          })
        : [],
      items.length && this.db.provider?.findMany
        ? this.db.provider.findMany({
            where: {
              id: {
                in: [
                  ...new Set(
                    items.map((item: any) => item.providerId).filter(Boolean),
                  ),
                ],
              },
            },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const userMap = new Map(users.map((row: any) => [row.id, row])),
      serviceMap = new Map(services.map((row: any) => [row.id, row])),
      providerMap = new Map(providers.map((row: any) => [row.id, row]));
    return {
      items: items.map((item: any) => ({
        ...item,
        orderNumber: String(100000n + BigInt(item.id)),
        user: userMap.get(item.userId),
        service: serviceMap.get(item.serviceId),
        provider: item.providerId ? providerMap.get(item.providerId) : null,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      statusCounts: statusRows.reduce(
        (counts: any, row: any) => ({
          ...counts,
          [row.status]: (counts[row.status] ?? 0) + row._count._all,
        }),
        {},
      ),
      manualCount: statusRows
        .filter((row: any) => row.providerId == null)
        .reduce((total: number, row: any) => total + row._count._all, 0),
    };
  }

  async order(reference: string) {
    const numericId = /^[0-9]+$/.test(reference)
      ? BigInt(reference) - 100000n
      : null;
    const order = await this.db.order.findFirst({
      where:
        numericId !== null && numericId > 0n
          ? { id: numericId }
          : { publicId: reference },
    });
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
      orderNumber: String(100000n + BigInt(order.id)),
      user,
      service,
      provider,
      history,
      providerLogs: logs,
      refills,
      cancellations,
    };
  }

  async syncOrderFromProvider(actorId: string, reference: string) {
    const numericId = /^[0-9]+$/.test(reference)
      ? BigInt(reference) - 100000n
      : null;
    const order = await this.db.order.findFirst({
      where:
        numericId !== null && numericId > 0n
          ? { id: numericId }
          : { publicId: reference },
    });
    if (!order)
      throw new AdminOperationError("ORDER_NOT_FOUND", "Order not found");
    if (!order.providerId || !order.providerOrderId)
      throw new AdminOperationError(
        "PROVIDER_ORDER_MISSING",
        "Order is not linked to a provider order",
      );
    const provider = await this.db.provider.findFirst({
      where: { id: order.providerId, deletedAt: null },
    });
    if (!provider)
      throw new AdminOperationError("PROVIDER_NOT_FOUND", "Provider not found");
    const adapter = this.adapterFactory(provider);
    let x: any;
    try {
      x = await adapter.getOrderStatus(String(order.providerOrderId));
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (/incorrect order id|order not found|invalid order/i.test(message))
        throw new AdminOperationError(
          "PROVIDER_ORDER_NOT_FOUND",
          "NCC không tìm thấy mã đơn hoặc mã đơn không thuộc tài khoản API đang cấu hình.",
        );
      throw new AdminOperationError(
        "PROVIDER_SYNC_FAILED",
        "Không thể cập nhật đơn từ NCC. Vui lòng kiểm tra cấu hình và thử lại.",
      );
    }
    const status = String(x?.status ?? "")
      .trim()
      .toUpperCase()
      .replaceAll(" ", "_");
    const remains =
      x?.remains == null ? Number(order.remains ?? 0) : Number(x.remains);
    const startCount = x?.start_count == null ? null : Number(x.start_count);
    const allowed = [
      "PENDING",
      "PROCESSING",
      "IN_PROGRESS",
      "COMPLETED",
      "PARTIAL",
      "CANCELED",
      "FAILED",
    ];
    if (
      !allowed.includes(status) ||
      !Number.isInteger(remains) ||
      remains < 0 ||
      remains > Number(order.quantity) ||
      (startCount !== null && (!Number.isInteger(startCount) || startCount < 0))
    )
      throw new AdminOperationError(
        "PROVIDER_RESPONSE_INVALID",
        "Provider order status is invalid",
      );
    return this.applyProviderOrderSync(
      actorId,
      order.id,
      status,
      remains,
      startCount,
    );
  }

  async retryProviderOrder(actorId: string, reference: string, input: any) {
    const reason = String(input?.reason ?? "").trim(),
      idempotencyKey = String(input?.idempotencyKey ?? "").trim();
    if (reason.length < 3 || reason.length > 500)
      throw new AdminOperationError(
        "REASON_REQUIRED",
        "Vui lòng nhập lý do từ 3 đến 500 ký tự",
      );
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey))
      throw new AdminOperationError(
        "IDEMPOTENCY_KEY_INVALID",
        "Khóa chống trùng không hợp lệ",
      );
    const order = await this.findOrderReference(reference);
    return this.db.$transaction(async (tx: any) => {
      if (tx.$executeRawUnsafe)
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          order.id,
        );
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current)
        throw new AdminOperationError("ORDER_NOT_FOUND", "Không tìm thấy đơn");
      const blocked = (reasonCode: string, message: string) => ({
        orderNumber: String(100000n + BigInt(current.id)),
        publicId: current.publicId,
        outcome: "BLOCKED",
        reasonCode,
        message,
      });
      const previousAttempt = await tx.auditLog.findFirst?.({
        where: {
          resource: "Order",
          resourceId: current.publicId,
          action: {
            in: ["ORDER_PROVIDER_RETRY", "ORDER_PROVIDER_RETRY_FAILED"],
          },
          after: { path: ["idempotencyKey"], equals: idempotencyKey },
        },
        orderBy: { createdAt: "desc" },
      });
      if (previousAttempt)
        return blocked(
          "RETRY_ALREADY_PROCESSED",
          "Yêu cầu gửi lại này đã được xử lý trước đó.",
        );
      if (current.status !== "FAILED")
        return blocked(
          "ORDER_NOT_FAILED",
          "Chỉ có thể gửi lại đơn đang thất bại.",
        );
      if (current.providerOrderId)
        return blocked(
          "PROVIDER_ORDER_EXISTS",
          "Đơn đã có mã NCC. Hãy xác minh hoặc gán lại mã đơn NCC, không tự động mua lại.",
        );
      if (moneyToUnits(current.refundedAmount) >= moneyToUnits(current.charge))
        return blocked(
          "ORDER_FULLY_REFUNDED",
          "Đơn đã được hoàn tiền toàn phần nên không thể mua lại tự động.",
        );
      if (!current.providerId)
        return blocked("PROVIDER_MISSING", "Đơn chưa được gán nhà cung cấp.");
      const mapping = await tx.serviceMapping.findFirst({
        where: {
          serviceId: current.serviceId,
          active: true,
          providerService: {
            providerId: current.providerId,
            active: true,
            stale: false,
          },
        },
        include: { providerService: true },
        orderBy: { priority: "asc" },
      });
      const provider = await tx.provider.findFirst({
        where: {
          id: current.providerId,
          status: { in: ["ACTIVE", "DEGRADED"] },
          deletedAt: null,
        },
      });
      if (!provider || !mapping?.providerService)
        return blocked(
          "PROVIDER_MAPPING_UNAVAILABLE",
          "Nhà cung cấp hoặc ánh xạ dịch vụ không còn hoạt động.",
        );
      try {
        const result = await this.adapterFactory(provider).createOrder({
          service: mapping.providerService.externalId,
          link: current.link,
          quantity: current.quantity,
          idempotencyKey: `admin-retry:${current.publicId}:${idempotencyKey}`,
        });
        const providerOrderId = String(result?.providerOrderId ?? "").trim();
        if (!providerOrderId)
          throw new ProviderError(
            "PROVIDER_RESPONSE_INVALID",
            "Missing provider order id",
            true,
          );
        const updated = await tx.order.update({
          where: { id: current.id },
          data: {
            providerOrderId,
            status: "PENDING",
            manualOverride: false,
            manualOverrideAt: null,
          },
        });
        await tx.orderHistory.create({
          data: {
            orderId: current.id,
            fromStatus: current.status,
            toStatus: "PENDING",
            actorId,
            details: {
              source: "ADMIN_PROVIDER_RETRY",
              reason,
              idempotencyKey,
              providerOrderId,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "ORDER_PROVIDER_RETRY",
            resource: "Order",
            resourceId: current.publicId,
            before: {
              status: current.status,
              providerId: current.providerId,
              providerOrderId: null,
              refundedAmount: String(current.refundedAmount),
            },
            after: {
              status: updated.status,
              providerOrderId,
              reason,
              idempotencyKey,
            },
          },
        });
        return {
          orderNumber: String(100000n + BigInt(updated.id)),
          publicId: updated.publicId,
          outcome: "ACCEPTED",
          providerOrderId,
          status: updated.status,
          message: "NCC đã nhận đơn thành công.",
        };
      } catch (error: any) {
        const unknownOutcome =
          error instanceof ProviderError ? error.unknownOutcome : true;
        const errorCode =
          error instanceof ProviderError
            ? String(error.code).slice(0, 100)
            : "PROVIDER_UNKNOWN";
        if (unknownOutcome) {
          await tx.order.update({
            where: { id: current.id },
            data: { manualOverride: true, manualOverrideAt: new Date() },
          });
        }
        await tx.orderHistory.create({
          data: {
            orderId: current.id,
            fromStatus: current.status,
            toStatus: current.status,
            actorId,
            details: {
              source: "ADMIN_PROVIDER_RETRY",
              reason,
              outcome: unknownOutcome ? "UNKNOWN" : "REJECTED",
              errorCode,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "ORDER_PROVIDER_RETRY_FAILED",
            resource: "Order",
            resourceId: current.publicId,
            before: { status: current.status, providerOrderId: null },
            after: {
              outcome: unknownOutcome ? "UNKNOWN" : "REJECTED",
              errorCode,
              reason,
              idempotencyKey,
              manualOverride: unknownOutcome,
            },
          },
        });
        return {
          orderNumber: String(100000n + BigInt(current.id)),
          publicId: current.publicId,
          outcome: unknownOutcome ? "UNKNOWN" : "REJECTED",
          errorCode,
          message: unknownOutcome
            ? "Kết quả gửi NCC chưa xác định. Đơn đã chuyển sang cần kiểm tra thủ công và sẽ không tự gửi lại."
            : "NCC từ chối nhận đơn. Vui lòng kiểm tra dịch vụ và dữ liệu đơn.",
        };
      }
    });
  }

  private async applyProviderOrderSync(
    actorId: string,
    orderId: bigint,
    status: string,
    remains: number,
    startCount: number | null,
  ) {
    return this.db.$transaction(async (tx: any) => {
      if (tx.$executeRawUnsafe)
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          orderId,
        );
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current)
        throw new AdminOperationError("ORDER_NOT_FOUND", "Order not found");
      const calculated =
        status === "PARTIAL"
          ? partialRefundTarget(current.charge, remains, current.quantity)
          : null;
      const refund =
        calculated !== null
          ? await applyOrderTargetRefund(
              tx,
              current,
              moneyToUnits(calculated) < moneyToUnits(current.refundedAmount)
                ? current.refundedAmount
                : calculated,
              "Hoàn tiền đơn một phần từ NCC",
            )
          : {
              target: String(current.refundedAmount),
              added: moneyFromUnits(0n),
            };
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status, remains, startCount, refundedAmount: refund.target },
      });
      await tx.orderHistory.create({
        data: {
          orderId,
          fromStatus: current.status,
          toStatus: status,
          actorId,
          details: {
            source: "ADMIN_PROVIDER_SYNC",
            remains,
            startCount,
            refundAdded: refund.added,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "ORDER_PROVIDER_SYNC",
          resource: "Order",
          resourceId: current.publicId,
          before: {
            status: current.status,
            remains: current.remains,
            startCount: current.startCount,
            refundedAmount: String(current.refundedAmount),
          },
          after: {
            status,
            remains,
            startCount,
            refundedAmount: refund.target,
            refundAdded: refund.added,
          },
        },
      });
      return {
        orderNumber: String(100000n + BigInt(updated.id)),
        publicId: updated.publicId,
        status: updated.status,
        remains: updated.remains,
        startCount: updated.startCount,
        refundedAmount: String(updated.refundedAmount),
        refundAdded: refund.added,
        providerOrderId: updated.providerOrderId,
      };
    });
  }

  async refundOrder(actorId: string, reference: string, input: any) {
    const reason = String(input?.reason ?? "").trim();
    if (reason.length < 3 || reason.length > 500)
      throw new AdminOperationError(
        "REASON_REQUIRED",
        "Vui lòng nhập lý do hoàn tiền từ 3 đến 500 ký tự",
      );
    const target = String(input?.targetRefundAmount ?? "");
    try {
      moneyToUnits(target);
    } catch {
      throw new AdminOperationError(
        "REFUND_AMOUNT_INVALID",
        "Tổng tiền hoàn không hợp lệ",
      );
    }
    const found = await this.findOrderReference(reference);
    return this.db.$transaction(async (tx: any) => {
      if (tx.$executeRawUnsafe)
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock($1::bigint)`,
          found.id,
        );
      const order = await tx.order.findUnique({ where: { id: found.id } });
      if (!order)
        throw new AdminOperationError("ORDER_NOT_FOUND", "Không tìm thấy đơn");
      let refund;
      try {
        refund = await applyOrderTargetRefund(
          tx,
          order,
          target,
          `Admin refund: ${reason}`,
        );
      } catch (error: any) {
        if (error?.message === "REFUND_EXCEEDS_CHARGE")
          throw new AdminOperationError(
            "REFUND_EXCEEDS_CHARGE",
            "Tổng tiền hoàn không được vượt số tiền khách đã trả",
          );
        if (error?.message === "REFUND_BELOW_EXISTING")
          throw new AdminOperationError(
            "REFUND_BELOW_EXISTING",
            "Tổng tiền hoàn không được thấp hơn số tiền đã hoàn",
          );
        throw error;
      }
      const full = moneyToUnits(refund.target) === moneyToUnits(order.charge),
        status = full ? "REFUNDED" : order.status;
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { refundedAmount: refund.target, ...(full ? { status } : {}) },
      });
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          actorId,
          details: {
            source: "ADMIN_REFUND",
            reason,
            targetRefundAmount: refund.target,
            refundAdded: refund.added,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "ORDER_REFUND",
          resource: "Order",
          resourceId: order.publicId,
          before: {
            status: order.status,
            refundedAmount: String(order.refundedAmount),
          },
          after: {
            status,
            refundedAmount: refund.target,
            refundAdded: refund.added,
            reason,
          },
        },
      });
      return {
        orderNumber: String(100000n + BigInt(order.id)),
        publicId: order.publicId,
        status: updated.status,
        refundedAmount: String(updated.refundedAmount),
        refundAdded: refund.added,
      };
    });
  }

  async updateOrder(actorId: string, reference: string, input: any) {
    const reason = String(input?.reason ?? "").trim();
    if (reason.length < 3 || reason.length > 500)
      throw new AdminOperationError(
        "REASON_REQUIRED",
        "Vui lòng nhập lý do thao tác từ 3 đến 500 ký tự",
      );
    const order = await this.findOrderReference(reference),
      allowed = [
        "PENDING",
        "PROCESSING",
        "IN_PROGRESS",
        "COMPLETED",
        "PARTIAL",
        "CANCELED",
        "REFUNDED",
        "FAILED",
      ];
    if (input.status !== undefined && !allowed.includes(input.status))
      throw new AdminOperationError(
        "ORDER_STATUS_INVALID",
        "Trạng thái đơn không hợp lệ",
      );
    for (const field of ["remains", "startCount"])
      if (
        input[field] !== undefined &&
        input[field] !== null &&
        !Number.isInteger(input[field])
      )
        throw new AdminOperationError(
          "ORDER_COUNTS_INVALID",
          "Start count và Remains phải là số nguyên",
        );
    if (
      input.remains !== undefined &&
      input.remains !== null &&
      (input.remains < 0 || input.remains > order.quantity)
    )
      throw new AdminOperationError(
        "REMAINS_INVALID",
        "Remains phải nằm trong phạm vi số lượng đơn",
      );
    if (
      input.startCount !== undefined &&
      input.startCount !== null &&
      input.startCount < 0
    )
      throw new AdminOperationError(
        "START_COUNT_INVALID",
        "Start count phải là số nguyên không âm",
      );
    if (
      input.manualOverride !== undefined &&
      typeof input.manualOverride !== "boolean"
    )
      throw new AdminOperationError(
        "MANUAL_OVERRIDE_INVALID",
        "Giá trị ghi đè thủ công không hợp lệ",
      );
    if (input.providerId) {
      const provider = await this.db.provider.findFirst({
        where: { id: input.providerId, deletedAt: null },
      });
      if (!provider)
        throw new AdminOperationError(
          "PROVIDER_NOT_FOUND",
          "Không tìm thấy nhà cung cấp",
        );
    }
    const before: any = {
      providerId: order.providerId,
      providerOrderId: order.providerOrderId,
      status: order.status,
      startCount: order.startCount,
      remains: order.remains,
      manualOverride: order.manualOverride,
    };
    const data: any = {};
    for (const field of [
      "providerId",
      "providerOrderId",
      "status",
      "startCount",
      "remains",
      "manualOverride",
    ])
      if (input[field] !== undefined)
        data[field] = input[field] === "" ? null : input[field];
    if (input.manualOverride !== undefined)
      data.manualOverrideAt = input.manualOverride ? new Date() : null;
    try {
      return await this.db.$transaction(async (tx: any) => {
        if (tx.$executeRawUnsafe)
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock($1::bigint)`,
            order.id,
          );
        const current = await tx.order.findUnique({ where: { id: order.id } });
        if (!current)
          throw new AdminOperationError(
            "ORDER_NOT_FOUND",
            "Không tìm thấy đơn",
          );
        Object.assign(before, {
          providerId: current.providerId,
          providerOrderId: current.providerOrderId,
          status: current.status,
          startCount: current.startCount,
          remains: current.remains,
          manualOverride: current.manualOverride,
        });
        let refund = {
          target: String(current.refundedAmount),
          added: moneyFromUnits(0n),
        };
        if (input.status === "PARTIAL") {
          if (input.remains === undefined || input.remains === null)
            throw new AdminOperationError(
              "REMAINS_REQUIRED",
              "Vui lòng nhập số lượng còn lại cho đơn hoàn một phần",
            );
          refund = await applyOrderTargetRefund(
            tx,
            current,
            partialRefundTarget(
              current.charge,
              input.remains,
              current.quantity,
            ),
            reason,
          );
          data.refundedAmount = refund.target;
        } else if (input.status === "CANCELED") {
          refund = await applyOrderTargetRefund(
            tx,
            current,
            String(current.charge),
            reason,
          );
          data.refundedAmount = refund.target;
        }
        const updated = await tx.order.update({
          where: { id: order.id },
          data,
        });
        if (input.status !== undefined && input.status !== order.status)
          await tx.orderHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: input.status,
              actorId,
              details: {
                source: "ADMIN_MANUAL",
                reason,
                before,
                after: data,
                refundAdded: refund.added,
              },
            },
          });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "ORDER_MANUAL_UPDATE",
            resource: "Order",
            resourceId: order.publicId,
            before,
            after: { ...data, reason, refundAdded: refund.added },
          },
        });
        return {
          orderNumber: String(100000n + BigInt(updated.id)),
          publicId: updated.publicId,
          status: updated.status,
          startCount: updated.startCount,
          remains: updated.remains,
          providerId: updated.providerId,
          providerOrderId: updated.providerOrderId,
          manualOverride: updated.manualOverride,
          manualOverrideAt: updated.manualOverrideAt,
          refundedAmount: String(updated.refundedAmount),
          refundAdded: refund.added,
        };
      });
    } catch (error: any) {
      if (error?.code === "P2002")
        throw new AdminOperationError(
          "PROVIDER_ORDER_CONFLICT",
          "Provider order ID is already in use",
        );
      throw error;
    }
  }

  private async findOrderReference(reference: string) {
    const numericId = /^[0-9]+$/.test(reference)
      ? BigInt(reference) - 100000n
      : null;
    const order = await this.db.order.findFirst({
      where:
        numericId !== null && numericId > 0n
          ? { id: numericId }
          : { publicId: reference },
    });
    if (!order)
      throw new AdminOperationError("ORDER_NOT_FOUND", "Order not found");
    return order;
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
        "metaDescription",
        "metaKeywords",
        "defaultLanguage",
        "currency",
        "timezone",
        "announcement",
        "registrationEnabled",
        "maintenanceMode",
        "maintenanceMessage",
        "serviceSalesEnabled",
        "duplicateOrderPolicy",
        "supportFacebookEnabled",
        "supportFacebook",
        "supportTelegramEnabled",
        "supportTelegram",
        "supportWhatsappEnabled",
        "supportWhatsapp",
        "supportEmailEnabled",
        "supportEmail",
        "supportPhoneEnabled",
        "supportPhone",
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

  async publicSettings() {
    const allowed = [
      "siteName",
      "defaultLanguage",
      "currency",
      "announcement",
      "supportFacebookEnabled",
      "supportFacebook",
      "supportTelegramEnabled",
      "supportTelegram",
      "supportWhatsappEnabled",
      "supportWhatsapp",
      "supportEmailEnabled",
      "supportEmail",
      "supportPhoneEnabled",
      "supportPhone",
    ];
    const rows = await this.db.setting.findMany({
      where: { group: "general", key: { in: allowed }, encrypted: false },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
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
import {
  applyOrderTargetRefund,
  DailySnapshotService,
  moneyFromUnits,
  moneyToUnits,
  partialRefundTarget,
} from "@smm/database";
import { ProviderError, StandardSmmAdapter } from "../provider/adapter.js";
import { decryptSecret } from "../provider/crypto.js";
