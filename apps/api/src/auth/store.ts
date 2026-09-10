import { ROOT_SITE_ID } from "../tenant/context.js";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  status: string;
  emailVerifiedAt: Date | null;
  siteId: string;
}
export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
export function applyPanelEntitlement(
  userId: string,
  access: { roles: string[]; permissions: string[] },
  entitlement: { ownerUserId: string | null; permissionCodes: string[] } | null,
) {
  if (!entitlement) return access;
  const ceiling = new Set(entitlement.permissionCodes);
  return {
    roles: access.roles.filter((role) => role !== "SUPER_ADMIN"),
    permissions:
      entitlement.ownerUserId === userId
        ? [...ceiling]
        : access.permissions.filter((code) => ceiling.has(code)),
  };
}
export interface CustomerDashboard {
  balance: string;
  currency: string;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalSpent: string;
  totalDeposited: string;
  openTickets: number;
  unreadNotifications: number;
  activity: Array<{ date: string; orders: number; spent: string }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: Date;
  }>;
}
export interface AdminDashboard {
  users: { total: number; active: number; today: number; sevenDays: number };
  orders: { total: number; active: number; completed: number; failed: number };
  money: {
    revenue: string;
    providerCost: string;
    profit: string;
    deposits: string;
    currency: string;
  };
  depositsPending: number;
  openTickets: number;
  providers: { active: number; inactive: number };
  services: { active: number; inactive: number };
  alerts: Array<{ type: string; message: string; count: number }>;
  priceAlerts: {
    open: number;
    recent: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
    }>;
  };
  activity: Array<{
    date: string;
    orders: number;
    revenue: string;
    providerCost: string;
    profit: string;
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    charge: string;
    profit: string;
    createdAt: Date;
  }>;
}
export interface AuthStore {
  findUserByEmail(email: string, siteId: string): Promise<AuthUser | null>;
  findUserByUsername(
    username: string,
    siteId: string,
  ): Promise<AuthUser | null>;
  findUserById(id: string, siteId: string): Promise<AuthUser | null>;
  createUser(input: {
    email: string;
    username: string;
    passwordHash: string;
    referralCode: string;
    referredByCode?: string;
    siteId: string;
  }): Promise<AuthUser>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<AuthSession>;
  findSession(tokenHash: string): Promise<AuthSession | null>;
  revokeSession(id: string): Promise<void>;
  revokeOtherSessions(userId: string, exceptId?: string): Promise<void>;
  listSessions(userId: string): Promise<
    Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      expiresAt: Date;
      createdAt: Date;
    }>
  >;
  createPasswordReset(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  claimPasswordReset(
    tokenHash: string,
    siteId?: string,
  ): Promise<{ id: string; userId: string } | null>;
  rolesAndPermissions(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }>;
  panelEntitlements(
    siteId: string,
  ): Promise<{ ownerUserId: string | null; permissionCodes: string[] } | null>;
  recordLogin(input: {
    siteId: string;
    userId?: string;
    email: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  countRecentFailures(
    siteId: string,
    email: string,
    ipAddress: string | undefined,
    since: Date,
  ): Promise<number>;
  customerDashboard(userId: string, siteId: string): Promise<CustomerDashboard>;
  adminDashboard(siteId: string): Promise<AdminDashboard>;
}
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: any) {}
  findUserByEmail(email: string, siteId = ROOT_SITE_ID) {
    return this.db.user.findUnique({
      where: { siteId_email: { siteId, email } },
    });
  }
  findUserByUsername(username: string, siteId = ROOT_SITE_ID) {
    return this.db.user.findUnique({
      where: { siteId_username: { siteId, username } },
    });
  }
  findUserById(id: string, siteId = ROOT_SITE_ID) {
    return this.db.user.findFirst({ where: { id, siteId } });
  }
  async createUser(input: {
    email: string;
    username: string;
    passwordHash: string;
    referralCode: string;
    referredByCode?: string;
    siteId?: string;
  }) {
    return this.db.$transaction(async (tx: any) => {
      const role = await tx.role.findUniqueOrThrow({ where: { code: "USER" } });
      const group =
        (await tx.priceGroup.findUnique({
          where: input.siteId
            ? { siteId_code: { siteId: input.siteId, code: "CUSTOMER" } }
            : { code: "CUSTOMER" },
        })) ??
        (await tx.priceGroup.findUniqueOrThrow({
          where: input.siteId
            ? { siteId_code: { siteId: input.siteId, code: "NORMAL" } }
            : { code: "NORMAL" },
        }));
      const { referredByCode, ...userInput } = input;
      const referrer = referredByCode
        ? await tx.user.findUnique({
            where: {
              referralCode: referredByCode.trim().toUpperCase(),
              ...(input.siteId ? { siteId: input.siteId } : {}),
            },
          })
        : null;
      if (referredByCode && !referrer) throw new Error("REFERRAL_CODE_INVALID");
      const user = await tx.user.create({
        data: { ...userInput, status: "ACTIVE", priceGroupId: group.id },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      await tx.wallet.create({
        data: {
          userId: user.id,
          ...(input.siteId ? { siteId: input.siteId } : {}),
          currency: "USD",
        },
      });
      await tx.affiliate.create({
        data: {
          userId: user.id,
          ...(input.siteId ? { siteId: input.siteId } : {}),
          code: user.referralCode,
          commissionRate: "10.000000",
        },
      });
      if (referrer) {
        const affiliate = await tx.affiliate.upsert({
          where: { userId: referrer.id },
          create: {
            userId: referrer.id,
            ...(input.siteId ? { siteId: input.siteId } : {}),
            code: referrer.referralCode,
            commissionRate: "10.000000",
          },
          update: {},
        });
        await tx.referral.create({
          data: {
            ...(input.siteId ? { siteId: input.siteId } : {}),
            affiliateId: affiliate.id,
            referrerId: referrer.id,
            referredUserId: user.id,
          },
        });
      }
      return user;
    });
  }
  updatePassword(userId: string, passwordHash: string) {
    return this.db.user
      .update({ where: { id: userId }, data: { passwordHash } })
      .then(() => undefined);
  }
  createSession(input: any) {
    return this.db.session.create({ data: input });
  }
  findSession(tokenHash: string) {
    return this.db.session.findUnique({ where: { tokenHash } });
  }
  revokeSession(id: string) {
    return this.db.session
      .update({ where: { id }, data: { revokedAt: new Date() } })
      .then(() => undefined);
  }
  revokeOtherSessions(userId: string, exceptId?: string) {
    return this.db.session
      .updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        data: { revokedAt: new Date() },
      })
      .then(() => undefined);
  }
  listSessions(userId: string) {
    return this.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.passwordResetToken
      .create({ data: { userId, tokenHash, expiresAt } })
      .then(() => undefined);
  }
  claimPasswordReset(tokenHash: string, siteId?: string) {
    return this.db.$transaction(async (tx: any) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!record || record.usedAt || record.expiresAt <= new Date())
        return null;
      if (
        siteId &&
        !(await tx.user.findFirst({ where: { id: record.userId, siteId } }))
      )
        return null;
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      return claimed.count === 1
        ? { id: record.id, userId: record.userId }
        : null;
    });
  }
  async rolesAndPermissions(userId: string) {
    const links = await this.db.userRole.findMany({ where: { userId } });
    const roles = await this.db.role.findMany({
      where: { id: { in: links.map((x: any) => x.roleId) } },
    });
    const grants = await this.db.rolePermission.findMany({
      where: { roleId: { in: roles.map((x: any) => x.id) } },
    });
    const userGrants = await this.db.userPermission.findMany({
      where: { userId },
    });
    const permissions = await this.db.permission.findMany({
      where: {
        id: {
          in: [
            ...grants.map((x: any) => x.permissionId),
            ...userGrants.map((x: any) => x.permissionId),
          ],
        },
      },
    });
    return {
      roles: roles.map((x: any) => x.code),
      permissions: permissions.map((x: any) => x.code),
    };
  }
  async panelEntitlements(siteId: string) {
    if (siteId === ROOT_SITE_ID) return null;
    const [site, subscription] = await Promise.all([
      this.db.site.findUnique({
        where: { id: siteId },
        select: { ownerUserId: true },
      }),
      this.db.panelSubscription.findFirst({
        where: {
          siteId,
          status: { in: ["ACTIVE", "PAST_DUE"] },
        },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      }),
    ]);
    if (!site || !subscription)
      return { ownerUserId: site?.ownerUserId ?? null, permissionCodes: [] };
    const [links, disabled] = await Promise.all([
      this.db.panelRentalPlanPermission.findMany({
        where: { planId: subscription.planId },
        select: { permissionId: true },
      }),
      this.db.siteDisabledPermission?.findMany
        ? this.db.siteDisabledPermission.findMany({
            where: { siteId },
            select: { permissionId: true },
          })
        : [],
    ]);
    const disabledIds = new Set(disabled.map((row: any) => row.permissionId));
    const permissions = links.length
      ? await this.db.permission.findMany({
          where: {
            id: {
              in: links
                .map((link: any) => link.permissionId)
                .filter((id: string) => !disabledIds.has(id)),
            },
          },
          select: { code: true },
        })
      : [];
    return {
      ownerUserId: site.ownerUserId,
      permissionCodes: permissions.map((permission: any) => permission.code),
    };
  }
  recordLogin(input: any) {
    return this.db.loginHistory.create({ data: input }).then(() => undefined);
  }
  countRecentFailures(
    siteId: string,
    email: string,
    ipAddress: string | undefined,
    since: Date,
  ) {
    return this.db.loginHistory.count({
      where: {
        siteId,
        success: false,
        createdAt: { gte: since },
        OR: [{ email }, ...(ipAddress ? [{ ipAddress }] : [])],
      },
    });
  }
  async customerDashboard(
    userId: string,
    siteId: string,
  ): Promise<CustomerDashboard> {
    const { buildActivitySeries, subtractDecimal } =
      await import("../customer/dashboard.js");
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);
    const [
      wallet,
      totalOrders,
      activeOrders,
      completedOrders,
      orderSpend,
      deposits,
      openTickets,
      unreadNotifications,
      notifications,
      activityRecords,
    ] = await Promise.all([
      this.db.wallet.findUnique({
        where: { userId, siteId },
        select: { balance: true, currency: true },
      }),
      this.db.order.count({ where: { userId, siteId } }),
      this.db.order.count({
        where: {
          userId,
          siteId,
          status: { in: ["PENDING", "PROCESSING", "IN_PROGRESS"] },
        },
      }),
      this.db.order.count({ where: { userId, siteId, status: "COMPLETED" } }),
      this.db.order.aggregate({
        where: { userId, siteId },
        _sum: { charge: true, refundedAmount: true },
      }),
      this.db.deposit.aggregate({
        where: { userId, siteId, status: "PAID" },
        _sum: { netAmount: true },
      }),
      this.db.ticket.count({
        where: { userId, siteId, status: { not: "CLOSED" } },
      }),
      this.db.notification.count({ where: { userId, siteId, readAt: null } }),
      this.db.notification.findMany({
        where: { userId, siteId },
        select: { id: true, title: true, body: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.db.order.findMany({
        where: { userId, siteId, createdAt: { gte: since } },
        select: { createdAt: true, charge: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return {
      balance: String(wallet?.balance ?? "0"),
      currency: wallet?.currency ?? "USD",
      totalOrders,
      activeOrders,
      completedOrders,
      totalSpent: subtractDecimal(
        orderSpend._sum.charge,
        orderSpend._sum.refundedAmount,
      ),
      totalDeposited: String(deposits._sum.netAmount ?? "0"),
      openTickets,
      unreadNotifications,
      activity: buildActivitySeries(activityRecords),
      notifications,
    };
  }
  async adminDashboard(siteId: string): Promise<AdminDashboard> {
    const { buildAdminActivity } = await import("../admin/dashboard.js");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setUTCDate(sevenDays.getUTCDate() - 6);
    const [
      totalUsers,
      activeUsers,
      usersToday,
      usersSevenDays,
      totalOrders,
      activeOrders,
      completedOrders,
      failedOrders,
      financials,
      paidDeposits,
      pendingDeposits,
      openTickets,
      activeProviders,
      inactiveProviders,
      activeServices,
      inactiveServices,
      activityRecords,
      recentOrders,
      openPriceAlerts,
      recentPriceAlerts,
    ] = await Promise.all([
      this.db.user.count({ where: { siteId, deletedAt: null } }),
      this.db.user.count({
        where: { siteId, status: "ACTIVE", deletedAt: null },
      }),
      this.db.user.count({
        where: { siteId, createdAt: { gte: today }, deletedAt: null },
      }),
      this.db.user.count({
        where: { siteId, createdAt: { gte: sevenDays }, deletedAt: null },
      }),
      this.db.order.count({ where: { siteId } }),
      this.db.order.count({
        where: {
          siteId,
          status: { in: ["PENDING", "PROCESSING", "IN_PROGRESS"] },
        },
      }),
      this.db.order.count({ where: { siteId, status: "COMPLETED" } }),
      this.db.order.count({
        where: { siteId, status: { in: ["FAILED", "CANCELED"] } },
      }),
      this.db.order.aggregate({
        where: { siteId },
        _sum: { charge: true, providerCost: true, profit: true },
      }),
      this.db.deposit.aggregate({
        where: { siteId, status: "PAID" },
        _sum: { netAmount: true },
      }),
      this.db.deposit.count({ where: { siteId, status: "PENDING" } }),
      this.db.ticket.count({ where: { siteId, status: { not: "CLOSED" } } }),
      siteId === ROOT_SITE_ID
        ? this.db.provider.count({
            where: { status: "ACTIVE", deletedAt: null },
          })
        : 0,
      siteId === ROOT_SITE_ID
        ? this.db.provider.count({
            where: { status: { not: "ACTIVE" }, deletedAt: null },
          })
        : 0,
      this.db.service.count({
        where: { siteId, active: true, deletedAt: null },
      }),
      this.db.service.count({
        where: { siteId, active: false, deletedAt: null },
      }),
      this.db.order.findMany({
        where: { siteId, createdAt: { gte: sevenDays } },
        select: {
          createdAt: true,
          charge: true,
          providerCost: true,
          profit: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      this.db.order.findMany({
        where: { siteId },
        select: {
          id: true,
          status: true,
          charge: true,
          profit: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.db.priceAlert && siteId === ROOT_SITE_ID
        ? this.db.priceAlert.count({ where: { status: "OPEN" } })
        : 0,
      this.db.priceAlert && siteId === ROOT_SITE_ID
        ? this.db.priceAlert.findMany({
            where: { status: "OPEN" },
            select: { id: true, type: true, severity: true, title: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [],
    ]);
    const alerts = [
      ...(openPriceAlerts
        ? [
            {
              type: "pricing",
              message: "Cảnh báo giá đang chờ xử lý",
              count: openPriceAlerts,
            },
          ]
        : []),
      ...(failedOrders
        ? [
            {
              type: "orders",
              message: "Đơn lỗi hoặc đã hủy cần kiểm tra",
              count: failedOrders,
            },
          ]
        : []),
      ...(pendingDeposits
        ? [
            {
              type: "payments",
              message: "Giao dịch nạp tiền đang chờ",
              count: pendingDeposits,
            },
          ]
        : []),
      ...(inactiveProviders
        ? [
            {
              type: "providers",
              message: "Provider degraded hoặc inactive",
              count: inactiveProviders,
            },
          ]
        : []),
      ...(openTickets
        ? [
            {
              type: "tickets",
              message: "Ticket hỗ trợ đang mở",
              count: openTickets,
            },
          ]
        : []),
    ];
    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        today: usersToday,
        sevenDays: usersSevenDays,
      },
      orders: {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
        failed: failedOrders,
      },
      money: {
        revenue: String(financials._sum.charge ?? "0"),
        providerCost: String(financials._sum.providerCost ?? "0"),
        profit: String(financials._sum.profit ?? "0"),
        deposits: String(paidDeposits._sum.netAmount ?? "0"),
        currency: "USD",
      },
      depositsPending: pendingDeposits,
      openTickets,
      providers: { active: activeProviders, inactive: inactiveProviders },
      services: { active: activeServices, inactive: inactiveServices },
      alerts,
      priceAlerts: {
        open: openPriceAlerts,
        recent: recentPriceAlerts,
      },
      activity: buildAdminActivity(activityRecords),
      recentOrders: recentOrders.map((order: any) => ({
        ...order,
        id: String(order.id),
        charge: String(order.charge),
        profit: String(order.profit),
      })),
    };
  }
}
