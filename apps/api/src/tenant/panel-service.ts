import { randomBytes } from "node:crypto";
const randomUUID = () => {
  const x = randomBytes(16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20)}`;
};
import { normalizeHostname, TenantError } from "./context.js";
import type { PanelDnsProvider } from "./panel-dns-provider.js";
const SCALE = 100_000_000n;
const units = (v: unknown) => {
  const m = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(String(v));
  if (!m) throw new TenantError("AMOUNT_INVALID", "Invalid amount");
  return BigInt(m[1]!) * SCALE + BigInt((m[2] ?? "").padEnd(8, "0"));
};
const decimal = (v: bigint) =>
  `${v / SCALE}.${String(v % SCALE).padStart(8, "0")}`;
const slug = (v: unknown) => {
  const x = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(x))
    throw new TenantError("PANEL_SLUG_INVALID", "Invalid panel slug");
  return x;
};
export class PanelService {
  constructor(
    private readonly db: any,
    private readonly dns: PanelDnsProvider,
  ) {}

  async rent(
    parentSiteId: string,
    renterUserId: string,
    input: any,
    key: string,
  ) {
    if (!/^[A-Za-z0-9:_-]{12,128}$/.test(key))
      throw new TenantError(
        "IDEMPOTENCY_KEY_INVALID",
        "Idempotency key required",
      );
    const requestKey =
      `panel-rent:${parentSiteId}:${renterUserId}:${key}`.slice(0, 128);
    const existing = await this.db.panelRentalIntent.findUnique({
      where: { requestKey },
    });
    if (existing) return this.intentResult(existing);
    const [parent, plan, renter] = await Promise.all([
      this.db.site.findUnique({ where: { id: parentSiteId } }),
      this.db.panelRentalPlan.findFirst({
        where: {
          id: String(input.planId),
          sellerSiteId: parentSiteId,
          active: true,
        },
      }),
      this.db.user.findFirst({
        where: { id: renterUserId, siteId: parentSiteId, status: "ACTIVE" },
      }),
    ]);
    if (!parent || parent.status !== "ACTIVE")
      throw new TenantError("PANEL_SUSPENDED", "Seller panel unavailable");
    if (!plan || !renter)
      throw new TenantError("PANEL_PLAN_UNAVAILABLE", "Plan unavailable");
    if (!plan.allowCustomDomain)
      throw new TenantError(
        "CUSTOM_DOMAIN_NOT_ALLOWED",
        "Plan does not allow custom domains",
      );
    const depth = parent.depth + 1;
    if (depth > plan.maxDepth)
      throw new TenantError("PANEL_MAX_DEPTH", "Maximum depth reached");
    const count = await this.db.site.count({
      where: { parentSiteId, deletedAt: null, status: { not: "ARCHIVED" } },
    });
    if (count >= plan.maxDirectChildren)
      throw new TenantError("PANEL_CHILD_LIMIT", "Direct child limit reached");
    const hostname = normalizeHostname(String(input.domain));
    const panelSlug = slug(input.slug ?? hostname.split(".")[0]);
    const name = String(input.name ?? "").trim();
    if (name.length < 2 || name.length > 160)
      throw new TenantError("PANEL_NAME_INVALID", "Invalid panel name");
    const zone = await this.dns.createZone(hostname);
    try {
      const intent = await this.db.panelRentalIntent.create({
        data: {
          sellerSiteId: parentSiteId,
          renterUserId,
          planId: plan.id,
          name,
          slug: panelSlug,
          hostname,
          providerZoneId: zone.zoneId,
          assignedNameservers: zone.nameservers,
          status: "PENDING_DNS",
          autoRenew: Boolean(input.autoRenew),
          requestKey,
          activationKey: `panel-activate:${randomUUID()}`,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      return this.intentResult(intent);
    } catch (error) {
      await this.dns.deleteZone(zone.zoneId).catch(() => undefined);
      throw error;
    }
  }

  async rentalIntent(sellerSiteId: string, renterUserId: string, id: string) {
    const intent = await this.db.panelRentalIntent.findFirst({
      where: { id, sellerSiteId, renterUserId },
    });
    if (!intent)
      throw new TenantError("PANEL_RENTAL_NOT_FOUND", "Panel rental not found");
    return this.intentResult(intent);
  }

  async activate(sellerSiteId: string, renterUserId: string, id: string) {
    const initial = await this.db.panelRentalIntent.findFirst({
      where: { id, sellerSiteId, renterUserId },
    });
    if (!initial)
      throw new TenantError("PANEL_RENTAL_NOT_FOUND", "Panel rental not found");
    if (initial.status === "ACTIVATED") {
      const site = await this.db.site.findUnique({
        where: { id: initial.activatedSiteId },
      });
      return { activated: true, site, charged: false };
    }
    if (new Date(initial.expiresAt) <= new Date())
      throw new TenantError(
        "PANEL_RENTAL_EXPIRED",
        "Panel rental request expired",
      );
    const [zoneStatus, assigned] = await Promise.all([
      this.dns.getZoneStatus(initial.providerZoneId),
      this.dns.getAssignedNameservers(initial.providerZoneId),
    ]);
    const expected = this.nameserversOf(initial.assignedNameservers);
    if (
      zoneStatus !== "ACTIVE" ||
      !expected.every((ns) => assigned.includes(ns))
    )
      throw new TenantError(
        "DOMAIN_VERIFICATION_FAILED",
        "Nameserver delegation is not active",
      );
    const result = await this.db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe?.(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        initial.id,
      );
      const intent = await tx.panelRentalIntent.findUnique({
        where: { id: initial.id },
      });
      if (intent.status === "ACTIVATED") {
        return {
          activated: true,
          site: await tx.site.findUnique({
            where: { id: intent.activatedSiteId },
          }),
          charged: false,
        };
      }
      if (intent.status === "ROUTING_REQUIRED") {
        return {
          routingRequired: true,
          site: await tx.site.findUnique({
            where: { id: intent.activatedSiteId },
          }),
          charged: false,
          intent,
        };
      }
      const [parent, plan, renter] = await Promise.all([
        tx.site.findUnique({ where: { id: sellerSiteId } }),
        tx.panelRentalPlan.findUnique({ where: { id: intent.planId } }),
        tx.user.findFirst({
          where: { id: renterUserId, siteId: sellerSiteId, status: "ACTIVE" },
        }),
      ]);
      if (!parent || parent.status !== "ACTIVE" || !plan?.active || !renter)
        throw new TenantError(
          "PANEL_PLAN_UNAVAILABLE",
          "Panel plan is unavailable",
        );
      const price = decimal(units(plan.price));
      const wallets = await tx.$queryRawUnsafe(
        'UPDATE "wallets" SET "balance"="balance"-$1::numeric,"version"="version"+1,"updated_at"=CURRENT_TIMESTAMP WHERE "user_id"=$2::uuid AND "site_id"=$3::uuid AND "balance">=$1::numeric RETURNING "id","balance"+$1::numeric AS "before","balance" AS "after"',
        price,
        renterUserId,
        sellerSiteId,
      );
      if (!wallets[0]) {
        await tx.panelRentalIntent.update({
          where: { id: intent.id },
          data: { status: "PAYMENT_REQUIRED" },
        });
        return { paymentRequired: true };
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.billingDays * 86_400_000);
      const siteId = randomUUID();
      await tx.site.create({
        data: {
          id: siteId,
          parentSiteId: sellerSiteId,
          name: intent.name,
          slug: intent.slug,
          status: "PENDING",
          depth: parent.depth + 1,
        },
      });
      const childOwner = await tx.user.create({
        data: {
          siteId,
          email: renter.email,
          username: renter.username,
          fullName: renter.fullName,
          phone: renter.phone,
          passwordHash: renter.passwordHash,
          status: "ACTIVE",
          emailVerifiedAt: renter.emailVerifiedAt,
          referralCode: `P${randomBytes(10).toString("hex").toUpperCase()}`,
        },
      });
      const adminRole = await tx.role.findUniqueOrThrow({
        where: { code: "ADMIN" },
      });
      await tx.userRole.create({
        data: { userId: childOwner.id, roleId: adminRole.id },
      });
      await tx.wallet.create({
        data: { siteId, userId: childOwner.id, currency: "USD" },
      });
      await tx.affiliate.create({
        data: {
          siteId,
          userId: childOwner.id,
          code: childOwner.referralCode,
          commissionRate: "10.000000",
        },
      });
      const site = await tx.site.update({
        where: { id: siteId },
        data: { ownerUserId: childOwner.id },
      });
      await tx.siteDomain.create({
        data: {
          siteId,
          hostname: intent.hostname,
          type: "CUSTOM",
          status: "VERIFIED",
          isPrimary: true,
          verificationToken: randomUUID(),
          verifiedAt: now,
          providerZoneId: intent.providerZoneId,
          assignedNameservers: intent.assignedNameservers,
        },
      });
      await tx.panelSubscription.create({
        data: {
          siteId,
          sellerSiteId,
          planId: plan.id,
          renterUserId,
          status: "ACTIVE",
          startedAt: now,
          expiresAt,
          graceUntil: new Date(expiresAt.getTime() + 7 * 86_400_000),
          autoRenew: intent.autoRenew,
        },
      });
      await tx.walletTransaction.create({
        data: {
          siteId: sellerSiteId,
          walletId: wallets[0].id,
          userId: renterUserId,
          type: "PANEL_RENT",
          amount: `-${price}`,
          balanceBefore: wallets[0].before,
          balanceAfter: wallets[0].after,
          referenceId: siteId,
          idempotencyKey: intent.activationKey,
          description: `Panel rental: ${plan.code}`,
        },
      });
      await tx.panelRentalIntent.update({
        where: { id: intent.id },
        data: { status: "ROUTING_REQUIRED", activatedSiteId: siteId },
      });
      await tx.auditLog.create({
        data: {
          siteId: sellerSiteId,
          actorId: renterUserId,
          action: "PANEL_RENT_PAYMENT_CAPTURED",
          resource: "Site",
          resourceId: siteId,
          after: {
            planId: plan.id,
            hostname: intent.hostname,
            providerZoneId: intent.providerZoneId,
          },
        },
      });
      return { routingRequired: true, site, charged: true, intent };
    });
    if (result.paymentRequired)
      throw new TenantError("PAYMENT_REQUIRED", "Insufficient wallet balance");
    if (!result.routingRequired) return result;

    // External routing only happens after the debit and pending site are durably
    // committed. A provider/second-transaction failure leaves a retryable state;
    // subsequent Verify calls do not charge again and routing is idempotent.
    await this.dns.ensurePanelRouting(
      result.intent.providerZoneId,
      result.intent.hostname,
    );
    return this.db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe?.(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        initial.id,
      );
      const intent = await tx.panelRentalIntent.findUnique({
        where: { id: initial.id },
      });
      if (intent.status === "ACTIVATED") {
        return {
          activated: true,
          site: await tx.site.findUnique({
            where: { id: intent.activatedSiteId },
          }),
          charged: false,
        };
      }
      if (intent.status !== "ROUTING_REQUIRED")
        throw new TenantError(
          "PANEL_ACTIVATION_STATE_INVALID",
          "Panel activation is not ready for routing",
        );
      const site = await tx.site.update({
        where: { id: intent.activatedSiteId },
        data: { status: "ACTIVE" },
      });
      await tx.panelRentalIntent.update({
        where: { id: intent.id },
        data: { status: "ACTIVATED" },
      });
      await tx.auditLog.create({
        data: {
          siteId: sellerSiteId,
          actorId: renterUserId,
          action: "PANEL_RENT_ACTIVATE",
          resource: "Site",
          resourceId: site.id,
          after: {
            hostname: intent.hostname,
            providerZoneId: intent.providerZoneId,
          },
        },
      });
      return { activated: true, site, charged: result.charged };
    });
  }

  private intentResult(intent: any) {
    return {
      rental: {
        id: intent.id,
        status: intent.status,
        domain: intent.hostname,
        expiresAt: intent.expiresAt,
      },
      nameservers: this.nameserversOf(intent.assignedNameservers),
    };
  }

  private nameserversOf(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  async renew(siteId: string, renterUserId: string, key: string) {
    const txKey = `panel-renew:${siteId}:${key}`.slice(0, 128);
    return this.db.$transaction(async (tx: any) => {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: txKey },
      });
      const subscription = await tx.panelSubscription.findFirst({
        where: { siteId, renterUserId },
      });
      if (!subscription)
        throw new TenantError(
          "SUBSCRIPTION_NOT_FOUND",
          "Subscription not found",
        );
      const plan = await tx.panelRentalPlan.findUnique({
        where: { id: subscription.planId },
      });
      if (!plan)
        throw new TenantError("PANEL_PLAN_UNAVAILABLE", "Plan unavailable");
      if (existing) return subscription;
      const price = decimal(units(plan.price)),
        rows = await tx.$queryRawUnsafe(
          'UPDATE "wallets" SET "balance"="balance"-$1::numeric,"version"="version"+1 WHERE "user_id"=$2::uuid AND "site_id"=$3::uuid AND "balance">=$1::numeric RETURNING "id","balance"+$1::numeric AS "before","balance" AS "after"',
          price,
          renterUserId,
          subscription.sellerSiteId,
        );
      if (!rows[0])
        throw new TenantError("INSUFFICIENT_BALANCE", "Insufficient balance");
      const base = Math.max(
          Date.now(),
          new Date(subscription.expiresAt).getTime(),
        ),
        expiresAt = new Date(base + plan.billingDays * 86400000),
        updated = await tx.panelSubscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            expiresAt,
            graceUntil: new Date(expiresAt.getTime() + 7 * 86400000),
          },
        });
      await tx.site.update({
        where: { id: siteId },
        data: { status: "ACTIVE" },
      });
      await tx.walletTransaction.create({
        data: {
          siteId: subscription.sellerSiteId,
          walletId: rows[0].id,
          userId: renterUserId,
          type: "PANEL_RENEWAL",
          amount: `-${price}`,
          balanceBefore: rows[0].before,
          balanceAfter: rows[0].after,
          referenceId: siteId,
          idempotencyKey: txKey,
          description: "Panel renewal",
        },
      });
      return updated;
    });
  }
}

export class PanelManagementService {
  constructor(
    private readonly db: any,
    private readonly rental: PanelService,
    private readonly dns: PanelDnsProvider,
  ) {}
  plans(siteId: string) {
    return this.db.panelRentalPlan.findMany({
      where: { sellerSiteId: siteId, active: true },
      orderBy: { price: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        billingDays: true,
        maxDirectChildren: true,
        maxDepth: true,
        allowCustomDomain: true,
        allowPanelResale: true,
        allowApi: true,
        allowThemes: true,
      },
    });
  }
  async panels(siteId: string, userId: string) {
    const sites = await this.db.site.findMany({
      where: { parentSiteId: siteId, ownerUserId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      sites.map(async (site: any) => {
        const domains = await this.db.siteDomain.findMany({
          where: { siteId: site.id, isPrimary: true, status: "VERIFIED" },
          select: { hostname: true },
        });
        const subscriptions = await this.db.panelSubscription.findMany({
          where: { siteId: site.id },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            expiresAt: true,
            graceUntil: true,
            autoRenew: true,
          },
        });
        return {
          ...site,
          domains,
          subscriptions,
          primaryDomain: domains[0]?.hostname ?? null,
          subscription: subscriptions[0] ?? null,
        };
      }),
    );
  }
  async owned(siteId: string, userId: string, siteNumber: string) {
    const site = await this.db.site.findFirst({
      where: {
        siteNumber: BigInt(siteNumber),
        parentSiteId: siteId,
        ownerUserId: userId,
        deletedAt: null,
      },
    });
    if (!site)
      throw new TenantError(
        "PANEL_FORBIDDEN",
        "Panel is outside your ownership scope",
      );
    const subscriptions = await this.db.panelSubscription.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const plan = subscriptions[0]
      ? await this.db.panelRentalPlan.findUnique({
          where: { id: subscriptions[0].planId },
        })
      : null;
    return {
      ...site,
      domains: await this.db.siteDomain.findMany({
        where: { siteId: site.id },
        select: {
          id: true,
          hostname: true,
          type: true,
          status: true,
          isPrimary: true,
          verifiedAt: true,
          verificationToken: true,
          providerZoneId: true,
          assignedNameservers: true,
        },
      }),
      subscriptions: subscriptions.map((x: any) => ({ ...x, plan })),
      children: await this.db.site.findMany({
        where: { parentSiteId: site.id, deletedAt: null },
        select: { siteNumber: true, name: true, status: true },
      }),
    };
  }
  rent(siteId: string, userId: string, input: any, key: string) {
    return this.rental.rent(siteId, userId, input, key);
  }
  rentalIntent(siteId: string, userId: string, id: string) {
    return this.rental.rentalIntent(siteId, userId, id);
  }
  activate(siteId: string, userId: string, id: string) {
    return this.rental.activate(siteId, userId, id);
  }
  async renew(siteId: string, userId: string, siteNumber: string, key: string) {
    const panel = await this.owned(siteId, userId, siteNumber);
    return this.rental.renew(panel.id, userId, key);
  }
  async branding(
    siteId: string,
    userId: string,
    siteNumber: string,
    input: any,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber),
      allowed = new Set([
        "siteName",
        "siteDescription",
        "logo",
        "favicon",
        "supportEmail",
        "supportContact",
        "themeGlobal",
        "themeContent",
      ]),
      entries = Object.entries(input ?? {}).filter(([k]) => allowed.has(k));
    for (const [key, value] of entries)
      if (["logo", "favicon"].includes(key) && String(value).trim()) {
        let url: URL;
        try {
          url = new URL(String(value));
        } catch {
          throw new TenantError("IMAGE_URL_INVALID", "Image URL is invalid");
        }
        if (!["http:", "https:"].includes(url.protocol))
          throw new TenantError(
            "IMAGE_URL_INVALID",
            "Image URL must use HTTP or HTTPS",
          );
      }
    return this.db.$transaction(async (tx: any) => {
      for (const [key, value] of entries)
        await tx.setting.upsert({
          where: {
            siteId_group_key: { siteId: panel.id, group: "branding", key },
          },
          create: { siteId: panel.id, group: "branding", key, value },
          update: { value },
        });
      return { updated: entries.map(([key]) => key) };
    });
  }
  async domains(siteId: string, userId: string, siteNumber: string) {
    return (await this.owned(siteId, userId, siteNumber)).domains;
  }
  async addDomain(
    siteId: string,
    userId: string,
    siteNumber: string,
    value: unknown,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber),
      sub = panel.subscriptions[0];
    if (!sub?.plan?.allowCustomDomain)
      throw new TenantError(
        "CUSTOM_DOMAIN_NOT_ALLOWED",
        "Plan does not allow custom domains",
      );
    const hostname = normalizeHostname(String(value));
    const zone = await this.dns.createZone(hostname);
    try {
      const domain = await this.db.siteDomain.create({
        data: {
          siteId: panel.id,
          hostname,
          type: "CUSTOM",
          status: "PENDING",
          isPrimary: false,
          verificationToken: randomBytes(24).toString("base64url"),
          providerZoneId: zone.zoneId,
          assignedNameservers: zone.nameservers,
        },
      });
      return { ...domain, nameservers: zone.nameservers };
    } catch (error) {
      await this.dns.deleteZone(zone.zoneId).catch(() => undefined);
      throw error;
    }
  }
  async verifyDomain(
    siteId: string,
    userId: string,
    siteNumber: string,
    id: string,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber),
      domain = await this.db.siteDomain.findFirst({
        where: { id, siteId: panel.id, type: "CUSTOM", status: "PENDING" },
      });
    if (!domain) throw new TenantError("DOMAIN_NOT_FOUND", "Domain not found");
    if (!domain.providerZoneId)
      throw new TenantError("DOMAIN_ZONE_MISSING", "DNS zone is missing");
    const expected = Array.isArray(domain.assignedNameservers)
      ? domain.assignedNameservers
      : [];
    const [zoneStatus, assigned] = await Promise.all([
      this.dns.getZoneStatus(domain.providerZoneId),
      this.dns.getAssignedNameservers(domain.providerZoneId),
    ]);
    if (
      zoneStatus !== "ACTIVE" ||
      !expected.every((nameserver: string) => assigned.includes(nameserver))
    )
      throw new TenantError(
        "DOMAIN_VERIFICATION_FAILED",
        "Nameserver delegation is not active",
      );
    await this.dns.ensurePanelRouting(domain.providerZoneId, domain.hostname);
    return this.db.$transaction(async (tx: any) => {
      await tx.siteDomain.updateMany({
        where: { siteId: panel.id },
        data: { isPrimary: false },
      });
      const verified = await tx.siteDomain.update({
        where: { id },
        data: { status: "VERIFIED", verifiedAt: new Date(), isPrimary: true },
      });
      await tx.site.update({
        where: { id: panel.id },
        data: { status: "ACTIVE" },
      });
      return { ...verified, activated: true };
    });
  }
  async autoRenew(
    siteId: string,
    userId: string,
    siteNumber: string,
    value: unknown,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber),
      subscription = panel.subscriptions[0];
    if (!subscription)
      throw new TenantError("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    return this.db.panelSubscription.update({
      where: { id: subscription.id },
      data: { autoRenew: Boolean(value) },
    });
  }
  async primaryDomain(
    siteId: string,
    userId: string,
    siteNumber: string,
    id: string,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber);
    return this.db.$transaction(async (tx: any) => {
      const domain = await tx.siteDomain.findFirst({
        where: { id, siteId: panel.id, status: "VERIFIED" },
      });
      if (!domain)
        throw new TenantError(
          "DOMAIN_NOT_VERIFIED",
          "Only a verified domain can be primary",
        );
      await tx.siteDomain.updateMany({
        where: { siteId: panel.id },
        data: { isPrimary: false },
      });
      return tx.siteDomain.update({ where: { id }, data: { isPrimary: true } });
    });
  }
  async removeDomain(
    siteId: string,
    userId: string,
    siteNumber: string,
    id: string,
  ) {
    const panel = await this.owned(siteId, userId, siteNumber),
      domain = await this.db.siteDomain.findFirst({
        where: { id, siteId: panel.id, type: "CUSTOM" },
      }),
      changed = await this.db.siteDomain.updateMany({
        where: { id, siteId: panel.id, type: "CUSTOM" },
        data: { status: "DISABLED", isPrimary: false },
      });
    if (!changed.count)
      throw new TenantError("DOMAIN_NOT_FOUND", "Domain not found");
    if (domain?.providerZoneId)
      await this.dns.deleteZone(domain.providerZoneId).catch(() => undefined);
    return { disabled: true };
  }
  async adminPanels(query: URLSearchParams) {
    const search = query.get("search")?.trim(),
      status = query.get("status") || undefined,
      depth = query.get("depth");
    let related: string[] = [];
    if (search) {
      const [domains, owners] = await Promise.all([
        this.db.siteDomain.findMany({
          where: { hostname: { contains: search, mode: "insensitive" } },
          select: { siteId: true },
        }),
        this.db.user.findMany({
          where: {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        }),
      ]);
      const ownerSites = await this.db.site.findMany({
        where: { ownerUserId: { in: owners.map((x: any) => x.id) } },
        select: { id: true },
      });
      related = [
        ...domains.map((x: any) => x.siteId),
        ...ownerSites.map((x: any) => x.id),
      ];
    }
    const sites = await this.db.site.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(depth !== null && depth !== "" ? { depth: Number(depth) } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
                { id: { in: related } },
                ...(/^\d+$/.test(search)
                  ? [{ siteNumber: BigInt(search) }]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ depth: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: {
        id: true,
        siteNumber: true,
        parentSiteId: true,
        ownerUserId: true,
        name: true,
        slug: true,
        status: true,
        depth: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Promise.all(
      sites.map(async (site: any) => {
        const [owner, domain, subscription] = await Promise.all([
          site.ownerUserId
            ? this.db.user.findUnique({
                where: { id: site.ownerUserId },
                select: { username: true, email: true },
              })
            : null,
          this.db.siteDomain.findFirst({
            where: { siteId: site.id, isPrimary: true, status: "VERIFIED" },
            select: { hostname: true },
          }),
          this.db.panelSubscription.findFirst({
            where: { siteId: site.id },
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              expiresAt: true,
              plan: { select: { name: true, code: true } },
            },
          }),
        ]);
        return {
          ...site,
          owner,
          primaryDomain: domain?.hostname ?? null,
          subscription,
        };
      }),
    );
  }
  adminPlans() {
    return this.db.panelRentalPlan.findMany({ orderBy: { createdAt: "desc" } });
  }
  async adminSubscriptions() {
    const rows = await this.db.panelSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return Promise.all(
      rows.map(async (row: any) => {
        const [site, sellerSite, plan, renter] = await Promise.all([
          this.db.site.findUnique({
            where: { id: row.siteId },
            select: { siteNumber: true, name: true },
          }),
          this.db.site.findUnique({
            where: { id: row.sellerSiteId },
            select: { siteNumber: true, name: true },
          }),
          this.db.panelRentalPlan.findUnique({
            where: { id: row.planId },
            select: { code: true, name: true },
          }),
          this.db.user.findUnique({
            where: { id: row.renterUserId },
            select: { username: true, email: true },
          }),
        ]);
        return { ...row, site, sellerSite, plan, renter };
      }),
    );
  }
  async savePlan(siteId: string, input: any, id?: string) {
    const data = {
      sellerSiteId: siteId,
      code: String(input.code).trim().toUpperCase(),
      name: String(input.name).trim(),
      description: String(input.description ?? "").trim() || null,
      price: String(input.price),
      currency: String(input.currency ?? "USD").toUpperCase(),
      billingDays: Number(input.billingDays),
      maxDirectChildren: Number(input.maxDirectChildren),
      maxDepth: Number(input.maxDepth),
      allowCustomDomain: Boolean(input.allowCustomDomain),
      allowPanelResale: Boolean(input.allowPanelResale),
      allowApi: Boolean(input.allowApi),
      allowThemes: Boolean(input.allowThemes),
      active: input.active !== false,
    };
    if (
      !data.code ||
      !data.name ||
      !/^\d+(?:\.\d{1,8})?$/.test(data.price) ||
      !Number.isInteger(data.billingDays) ||
      data.billingDays < 1
    )
      throw new TenantError("PLAN_INVALID", "Invalid panel plan");
    return id
      ? this.db.panelRentalPlan.update({ where: { id }, data })
      : this.db.panelRentalPlan.create({ data });
  }
}
