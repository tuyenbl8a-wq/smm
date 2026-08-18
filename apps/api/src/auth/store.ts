export interface AuthUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  status: string;
  emailVerifiedAt: Date | null;
}
export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
export interface AuthStore {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserByUsername(username: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createUser(input: {
    email: string;
    username: string;
    passwordHash: string;
    referralCode: string;
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
  ): Promise<{ id: string; userId: string } | null>;
  rolesAndPermissions(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }>;
  recordLogin(input: {
    userId?: string;
    email: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void>;
  countRecentFailures(
    email: string,
    ipAddress: string | undefined,
    since: Date,
  ): Promise<number>;
}
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: any) {}
  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }
  findUserByUsername(username: string) {
    return this.db.user.findUnique({ where: { username } });
  }
  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
  async createUser(input: {
    email: string;
    username: string;
    passwordHash: string;
    referralCode: string;
  }) {
    return this.db.$transaction(async (tx: any) => {
      const role = await tx.role.findUniqueOrThrow({ where: { code: "USER" } });
      const group = await tx.priceGroup.findUniqueOrThrow({
        where: { code: "NORMAL" },
      });
      const user = await tx.user.create({
        data: { ...input, status: "ACTIVE", priceGroupId: group.id },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      await tx.wallet.create({ data: { userId: user.id, currency: "USD" } });
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
  claimPasswordReset(tokenHash: string) {
    return this.db.$transaction(async (tx: any) => {
      const record = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!record || record.usedAt || record.expiresAt <= new Date())
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
    const permissions = await this.db.permission.findMany({
      where: { id: { in: grants.map((x: any) => x.permissionId) } },
    });
    return {
      roles: roles.map((x: any) => x.code),
      permissions: permissions.map((x: any) => x.code),
    };
  }
  recordLogin(input: any) {
    return this.db.loginHistory.create({ data: input }).then(() => undefined);
  }
  countRecentFailures(
    email: string,
    ipAddress: string | undefined,
    since: Date,
  ) {
    return this.db.loginHistory.count({
      where: {
        success: false,
        createdAt: { gte: since },
        OR: [{ email }, ...(ipAddress ? [{ ipAddress }] : [])],
      },
    });
  }
}
