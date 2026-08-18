import { createConnection } from "node:net";

export interface Endpoint {
  readonly host: string;
  readonly port: number;
}
export function endpointFromUrl(url: URL): Endpoint {
  const fallback = url.protocol.startsWith("postgres") ? 5432 : 6379;
  return { host: url.hostname, port: url.port ? Number(url.port) : fallback };
}
export function probeTcp(
  endpoint: Endpoint,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection(endpoint);
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
