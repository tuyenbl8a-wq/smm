import type { IncomingMessage } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ROOT_SITE_ID = "00000000-0000-4000-8000-000000000001";
export interface TenantSite {
  id: string;
  siteNumber: bigint;
  parentSiteId: string | null;
  status: string;
  depth: number;
}
export class TenantError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function normalizeHostname(value: string): string {
  const input = value.trim().toLowerCase();
  if (!input || /[\s/@\\]/.test(input))
    throw new TenantError("HOST_INVALID", "Invalid hostname");
  let hostname: string;
  try {
    hostname = new URL(`http://${input}`).hostname
      .toLowerCase()
      .replace(/\.$/, "");
  } catch {
    throw new TenantError("HOST_INVALID", "Invalid hostname");
  }
  if (
    hostname.length > 253 ||
    hostname
      .split(".")
      .some(
        (x) =>
          !x || x.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x),
      )
  )
    throw new TenantError("HOST_INVALID", "Invalid hostname");
  return hostname;
}
export class TenantResolver {
  constructor(
    private readonly db: any,
    private readonly rootHosts: Set<string>,
    private readonly proxySecret?: string,
  ) {}
  async resolve(
    request: Pick<IncomingMessage, "headers">,
  ): Promise<TenantSite> {
    const forwarded = String(request.headers["x-smm-tenant-host"] ?? "");
    let source = String(request.headers.host ?? "");
    if (forwarded) {
      const timestamp = String(request.headers["x-smm-tenant-timestamp"] ?? "");
      const signature = String(request.headers["x-smm-tenant-signature"] ?? "");
      const age = Math.abs(Date.now() - Number(timestamp));
      if (
        !this.proxySecret ||
        !/^\d{13}$/.test(timestamp) ||
        age > 30_000 ||
        !validSignature(this.proxySecret, forwarded, timestamp, signature)
      )
        throw new TenantError(
          "TENANT_FORWARD_INVALID",
          "Untrusted tenant forwarding headers",
        );
      source = forwarded;
    }
    const hostname = normalizeHostname(source);
    if (this.rootHosts.has(hostname))
      return this.db.site.findUniqueOrThrow({ where: { id: ROOT_SITE_ID } });
    const domain = await this.db.siteDomain.findFirst({
      where: { hostname, status: "VERIFIED" },
      select: { siteId: true },
    });
    const siteId = domain?.siteId ?? domain?.site?.id;
    if (!siteId)
      throw new TenantError(
        "TENANT_NOT_FOUND",
        "Unknown or unverified hostname",
      );
    const site =
      domain.site ??
      (await this.db.site.findUnique({
        where: { id: siteId },
      }));
    if (!site)
      throw new TenantError(
        "TENANT_NOT_FOUND",
        "Unknown or unverified hostname",
      );
    return site;
  }
  async assertOperational(site: TenantSite): Promise<void> {
    let current: TenantSite | null = site,
      traversed = 0;
    while (current) {
      if (!["ACTIVE", "PENDING"].includes(current.status))
        throw new TenantError(
          "PANEL_SUSPENDED",
          "Panel or an ancestor is unavailable",
        );
      if (current.parentSiteId === null) return;
      if (this.db.panelSubscription?.findFirst) {
        const subscription = await this.db.panelSubscription.findFirst({
          where: { siteId: current.id },
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        });
        if (
          !subscription ||
          subscription.status !== "ACTIVE" ||
          new Date(subscription.expiresAt) <= new Date() ||
          subscription.plan?.active === false
        )
          throw new TenantError(
            "PANEL_SUBSCRIPTION_INACTIVE",
            "Panel subscription is unavailable",
          );
      }
      if (++traversed > 64)
        throw new TenantError(
          "SITE_HIERARCHY_INVALID",
          "Invalid site hierarchy",
        );
      current = await this.db.site.findUnique({
        where: { id: current.parentSiteId },
      });
      if (!current)
        throw new TenantError("SITE_HIERARCHY_INVALID", "Missing parent site");
    }
  }
}

export function tenantForwardSignature(
  secret: string,
  hostname: string,
  timestamp: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${normalizeHostname(hostname)}`)
    .digest("hex");
}
function validSignature(
  secret: string,
  hostname: string,
  timestamp: string,
  provided: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = Buffer.from(
      tenantForwardSignature(secret, hostname, timestamp),
      "hex",
    ),
    actual = Buffer.from(provided, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
