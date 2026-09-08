import { randomBytes } from "node:crypto";
const randomUUID = () => {
  const x = randomBytes(16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20)}`;
};
import { normalizeHostname, TenantError } from "./context.js";
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
    private readonly rootDomain = "dichvu1st.com",
    private readonly nameservers = [
      "ns1.dichvu1st.com",
      "ns2.dichvu1st.com",
    ] as const,
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
    const txKey = `panel-rent:${parentSiteId}:${renterUserId}:${key}`.slice(
        0,
        128,
      ),
      existing = await this.db.walletTransaction.findUnique({
        where: { idempotencyKey: txKey },
      });
    if (existing) {
      const site = await this.db.site.findUnique({
        where: { id: String(existing.referenceId) },
      });
      return {
        site,
        subscription: await this.db.panelSubscription.findFirst({
          where: { siteId: site.id },
        }),
      };
    }
    return this.db.$transaction(async (tx: any) => {
      const [parent, plan, renter] = await Promise.all([
        tx.site.findUnique({ where: { id: parentSiteId } }),
        tx.panelRentalPlan.findFirst({
          where: {
            id: String(input.planId),
            sellerSiteId: parentSiteId,
            active: true,
          },
        }),
        tx.user.findFirst({
          where: { id: renterUserId, siteId: parentSiteId, status: "ACTIVE" },
        }),
      ]);
      if (!parent || parent.status !== "ACTIVE")
        throw new TenantError("PANEL_SUSPENDED", "Seller panel unavailable");
      if (!plan || !renter)
        throw new TenantError("PANEL_PLAN_UNAVAILABLE", "Plan unavailable");
      if (parent.depth > 0) {
        const own = await tx.panelSubscription.findFirst({
            where: { siteId: parent.id, status: "ACTIVE" },
          }),
          ownPlan = own
            ? await tx.panelRentalPlan.findUnique({ where: { id: own.planId } })
            : null;
        if (!ownPlan?.allowPanelResale)
          throw new TenantError(
            "PANEL_RESALE_NOT_ALLOWED",
            "Panel resale is not allowed",
          );
        if (
          plan.maxDepth > ownPlan.maxDepth ||
          (plan.allowCustomDomain && !ownPlan.allowCustomDomain) ||
          (plan.allowApi && !ownPlan.allowApi) ||
          (plan.allowThemes && !ownPlan.allowThemes) ||
          (plan.allowPanelResale && !ownPlan.allowPanelResale)
        )
          throw new TenantError(
            "PANEL_PRIVILEGE_ESCALATION",
            "Child plan exceeds seller entitlement",
          );
      }
      const depth = parent.depth + 1;
      if (depth > plan.maxDepth)
        throw new TenantError("PANEL_MAX_DEPTH", "Maximum depth reached");
      const count = await tx.site.count({
        where: { parentSiteId, deletedAt: null, status: { not: "ARCHIVED" } },
      });
      if (count >= plan.maxDirectChildren)
        throw new TenantError(
          "PANEL_CHILD_LIMIT",
          "Direct child limit reached",
        );
      const requestedDomain = input.domain
          ? normalizeHostname(String(input.domain))
          : null,
        panelSlug = slug(input.slug ?? requestedDomain?.split(".")[0]),
        hostname =
          requestedDomain ??
          normalizeHostname(`${panelSlug}.${this.rootDomain}`),
        siteId = randomUUID(),
        price = decimal(units(plan.price));
      if (requestedDomain && !plan.allowCustomDomain)
        throw new TenantError(
          "CUSTOM_DOMAIN_NOT_ALLOWED",
          "Plan does not allow custom domains",
        );
      const rows = await tx.$queryRawUnsafe(
        'UPDATE "wallets" SET "balance"="balance"-$1::numeric,"version"="version"+1,"updated_at"=CURRENT_TIMESTAMP WHERE "user_id"=$2::uuid AND "site_id"=$3::uuid AND "balance">=$1::numeric RETURNING "id","balance"+$1::numeric AS "before","balance" AS "after"',
        price,
        renterUserId,
        parentSiteId,
      );
      if (!rows[0])
        throw new TenantError("INSUFFICIENT_BALANCE", "Insufficient balance");
      const now = new Date(),
        expiresAt = new Date(now.getTime() + plan.billingDays * 86400000),
        graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);
      const site = await tx.site.create({
        data: {
          id: siteId,
          parentSiteId,
          ownerUserId: renterUserId,
          name: String(input.name).trim(),
          slug: panelSlug,
          status: requestedDomain ? "PENDING" : "ACTIVE",
          depth,
        },
      });
      const domain = await tx.siteDomain.create({
        data: {
          siteId,
          hostname,
          type: requestedDomain ? "CUSTOM" : "SUBDOMAIN",
          status: requestedDomain ? "PENDING" : "VERIFIED",
          isPrimary: !requestedDomain,
          verificationToken: randomUUID(),
          verifiedAt: requestedDomain ? null : now,
        },
      });
      const subscription = await tx.panelSubscription.create({
        data: {
          siteId,
          sellerSiteId: parentSiteId,
          planId: plan.id,
          renterUserId,
          status: "ACTIVE",
          startedAt: now,
          expiresAt,
          graceUntil,
          autoRenew: Boolean(input.autoRenew),
        },
      });
      await tx.walletTransaction.create({
        data: {
          siteId: parentSiteId,
          walletId: rows[0].id,
          userId: renterUserId,
          type: "PANEL_RENT",
          amount: `-${price}`,
          balanceBefore: rows[0].before,
          balanceAfter: rows[0].after,
          referenceId: siteId,
          idempotencyKey: txKey,
          description: `Panel rental: ${plan.code}`,
        },
      });
      await tx.auditLog.create({
        data: {
          siteId: parentSiteId,
          actorId: renterUserId,
          action: "PANEL_RENT",
          resource: "Site",
          resourceId: siteId,
          after: { planId: plan.id, depth, expiresAt, hostname },
        },
      });
      return {
        site,
        subscription,
        domain: hostname,
        domainId: domain.id,
        nameservers: this.nameservers,
      };
    });
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
    private readonly verifyNameservers: (
      hostname: string,
      nameservers: readonly string[],
    ) => Promise<boolean> = async () => false,
    private readonly nameservers = [
      "ns1.dichvu1st.com",
      "ns2.dichvu1st.com",
    ] as const,
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
    const hostname = normalizeHostname(String(value)),
      token = randomBytes(24).toString("base64url"),
      domain = await this.db.siteDomain.create({
        data: {
          siteId: panel.id,
          hostname,
          type: "CUSTOM",
          status: "PENDING",
          isPrimary: false,
          verificationToken: token,
        },
      });
    return { ...domain, nameservers: this.nameservers };
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
    if (!(await this.verifyNameservers(domain.hostname, this.nameservers)))
      throw new TenantError(
        "DOMAIN_VERIFICATION_FAILED",
        `Nameserver must be ${this.nameservers.join(" and ")}`,
      );
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
      changed = await this.db.siteDomain.updateMany({
        where: { id, siteId: panel.id, type: "CUSTOM" },
        data: { status: "DISABLED", isPrimary: false },
      });
    if (!changed.count)
      throw new TenantError("DOMAIN_NOT_FOUND", "Domain not found");
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
