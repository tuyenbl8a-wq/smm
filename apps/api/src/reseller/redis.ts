import { createConnection } from "node:net";
export class RedisCounterClient {
  constructor(private url: URL) {}
  private command(parts: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({
          host: this.url.hostname,
          port: Number(this.url.port || 6379),
        }),
        encode = (command: string[]) =>
          `*${command.length}\r\n` +
          command.map((x) => `$${Buffer.byteLength(x)}\r\n${x}\r\n`).join(""),
        auth = this.url.password
          ? encode([
              "AUTH",
              ...(this.url.username
                ? [
                    decodeURIComponent(this.url.username),
                    decodeURIComponent(this.url.password),
                  ]
                : [decodeURIComponent(this.url.password)]),
            ])
          : "",
        payload = auth + encode(parts);
      let data = "";
      socket.once("error", reject);
      socket.once("connect", () => socket.write(payload));
      socket.on("data", (c: any) => {
        data += String(c);
        const matches = [...data.matchAll(/:([0-9]+)\r\n/g)];
        if (data.startsWith("-") || data.includes("\r\n-")) {
          socket.destroy();
          reject(new Error("REDIS_COMMAND_FAILED"));
        } else if (matches.length) {
          socket.destroy();
          const n = Number(matches.at(-1)![1]);
          Number.isFinite(n)
            ? resolve(n)
            : reject(new Error("REDIS_RESPONSE_INVALID"));
        }
      });
    });
  }
  incr(k: string) {
    return this.command(["INCR", k]);
  }
  expire(k: string, s: number) {
    return this.command(["EXPIRE", k, String(s)]);
  }
}
