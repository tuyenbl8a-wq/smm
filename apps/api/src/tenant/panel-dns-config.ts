import { CloudflarePanelDnsProvider } from "./cloudflare-panel-dns.js";
import {
  UnavailablePanelDnsProvider,
  type PanelDnsProvider,
} from "./panel-dns-provider.js";

export type PanelDnsEnvironment = Partial<
  Record<
    "CLOUDFLARE_API_TOKEN" | "CLOUDFLARE_ACCOUNT_ID" | "PANEL_ROUTING_TARGET",
    string
  >
>;

/** Cloudflare is optional at bootstrap, but never replaced by synthetic DNS. */
export function createPanelDnsProvider(
  env: PanelDnsEnvironment,
): PanelDnsProvider {
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const routingTarget = env.PANEL_ROUTING_TARGET?.trim();
  if (!apiToken || !accountId || !routingTarget)
    return new UnavailablePanelDnsProvider();
  return new CloudflarePanelDnsProvider({
    apiToken,
    accountId,
    routingTarget,
  });
}
