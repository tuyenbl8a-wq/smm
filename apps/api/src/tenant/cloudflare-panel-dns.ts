import {
  PanelDnsProviderError,
  type PanelDnsProvider,
  type PanelDnsZone,
  type PanelDnsZoneStatus,
} from "./panel-dns-provider.js";
import { normalizeHostname } from "./context.js";

type CloudflareConfig = {
  apiToken: string;
  accountId: string;
  routingTarget: string;
  apiBaseUrl?: string;
  fetcher?: typeof fetch;
};

export class CloudflarePanelDnsProvider implements PanelDnsProvider {
  private readonly baseUrl: string;

  constructor(private readonly config: CloudflareConfig) {
    if (!config.apiToken || !config.accountId || !config.routingTarget)
      throw new PanelDnsProviderError(
        "PANEL_DNS_CONFIG_INVALID",
        "Cloudflare panel DNS configuration is incomplete",
      );
    this.baseUrl = config.apiBaseUrl ?? "https://api.cloudflare.com/client/v4";
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await (this.config.fetcher ?? fetch)(
      `${this.baseUrl}${path}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${this.config.apiToken}`,
          "content-type": "application/json",
          ...init.headers,
        },
      },
    );
    const payload = (await response.json()) as {
      success?: boolean;
      result?: any;
      errors?: Array<{ message?: string }>;
    };
    if (!response.ok || !payload.success)
      throw new PanelDnsProviderError(
        "PANEL_DNS_PROVIDER_FAILED",
        payload.errors?.[0]?.message ?? "Cloudflare request failed",
      );
    return payload.result;
  }

  async createZone(domain: string): Promise<PanelDnsZone> {
    const normalizedDomain = normalizeHostname(domain);
    const matches = await this.request(
      `/zones?name=${encodeURIComponent(normalizedDomain)}&account.id=${encodeURIComponent(this.config.accountId)}`,
    );
    const existing = Array.isArray(matches)
      ? matches.find(
          (candidate) =>
            candidate?.id &&
            normalizeHostname(String(candidate.name ?? "")) ===
              normalizedDomain &&
            (!candidate.account?.id ||
              String(candidate.account.id) === this.config.accountId),
        )
      : undefined;
    if (existing) return this.zoneResult(existing, false);

    const zone = await this.request("/zones", {
      method: "POST",
      body: JSON.stringify({
        name: normalizedDomain,
        account: { id: this.config.accountId },
        jump_start: false,
        type: "full",
      }),
    });
    return this.zoneResult(zone, true);
  }

  private zoneResult(zone: any, created: boolean): PanelDnsZone {
    const nameservers = this.normalizeNameservers(zone.name_servers);
    if (!zone.id || nameservers.length < 2)
      throw new PanelDnsProviderError(
        "PANEL_DNS_ASSIGNMENT_MISSING",
        "Cloudflare did not assign nameservers",
      );
    return { zoneId: String(zone.id), nameservers, created };
  }

  async getAssignedNameservers(zoneId: string): Promise<string[]> {
    const zone = await this.request(`/zones/${encodeURIComponent(zoneId)}`);
    return this.normalizeNameservers(zone.name_servers);
  }

  async getZoneStatus(zoneId: string): Promise<PanelDnsZoneStatus> {
    const zone = await this.request(`/zones/${encodeURIComponent(zoneId)}`);
    if (zone.status === "active") return "ACTIVE";
    if (zone.status === "pending" || zone.status === "initializing")
      return "PENDING";
    return "FAILED";
  }

  async ensurePanelRouting(zoneId: string, domain: string): Promise<void> {
    const records = await this.request(
      `/zones/${encodeURIComponent(zoneId)}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
    );
    const body = JSON.stringify({
      type: "CNAME",
      name: domain,
      content: this.config.routingTarget,
      proxied: true,
      ttl: 1,
      comment: "DichVu1st panel routing",
    });
    if (records?.[0]?.id) {
      await this.request(
        `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(records[0].id)}`,
        { method: "PUT", body },
      );
      return;
    }
    await this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records`, {
      method: "POST",
      body,
    });
  }

  async deleteZone(zoneId: string): Promise<void> {
    await this.request(`/zones/${encodeURIComponent(zoneId)}`, {
      method: "DELETE",
    });
  }

  private normalizeNameservers(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().toLowerCase().replace(/\.$/, ""))
          .filter(Boolean)
      : [];
  }
}
