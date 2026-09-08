export type PanelDnsZone = {
  zoneId: string;
  nameservers: string[];
};

export type PanelDnsZoneStatus = "PENDING" | "ACTIVE" | "FAILED";

/** Provider boundary used by panel rentals. Tests inject a memory implementation. */
export interface PanelDnsProvider {
  createZone(domain: string): Promise<PanelDnsZone>;
  getAssignedNameservers(zoneId: string): Promise<string[]>;
  getZoneStatus(zoneId: string): Promise<PanelDnsZoneStatus>;
  ensurePanelRouting(zoneId: string, domain: string): Promise<void>;
  deleteZone(zoneId: string): Promise<void>;
}

export class PanelDnsProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Keeps the API available while making an unconfigured optional feature explicit. */
export class UnavailablePanelDnsProvider implements PanelDnsProvider {
  private unavailable(): never {
    throw new PanelDnsProviderError(
      "PANEL_DNS_NOT_CONFIGURED",
      "Panel DNS is not configured",
    );
  }

  async createZone(): Promise<PanelDnsZone> {
    return this.unavailable();
  }
  async getAssignedNameservers(): Promise<string[]> {
    return this.unavailable();
  }
  async getZoneStatus(): Promise<PanelDnsZoneStatus> {
    return this.unavailable();
  }
  async ensurePanelRouting(): Promise<void> {
    return this.unavailable();
  }
  async deleteZone(): Promise<void> {
    return this.unavailable();
  }
}
