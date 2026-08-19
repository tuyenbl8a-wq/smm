export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
  timeoutMs: number;
}

export const smtpConfig = (env: NodeJS.ProcessEnv): SmtpConfig | null => {
  const host = env.SMTP_HOST?.trim(),
    user = env.SMTP_USER?.trim(),
    password = env.SMTP_PASSWORD?.trim(),
    from = env.SMTP_FROM?.trim();
  if (!host && !user && !password && !from) return null;
  if (!host || !user || !password || !from)
    throw new Error("SMTP_CONFIGURATION_INCOMPLETE");
  const port = Number(env.SMTP_PORT ?? "465"),
    timeoutMs = Number(env.SMTP_TIMEOUT_MS ?? "10000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SMTP_PORT_INVALID");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
    throw new Error("SMTP_TIMEOUT_INVALID");
  return {
    host,
    port,
    user,
    password,
    from,
    secure: (env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true",
    timeoutMs,
  };
};

const cleanHeader = (value: string) => value.replace(/[\r\n]/g, " ").trim();

export class SmtpTransport {
  constructor(private config: SmtpConfig) {}

  async send(input: { to: string; title: string; body: string }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to))
      throw new Error("SMTP_RECIPIENT_INVALID");
    const net = await import("node:net"),
      tls = await import("node:tls"),
      socket: any = this.config.secure
        ? tls.connect({
            host: this.config.host,
            port: this.config.port,
            servername: this.config.host,
            rejectUnauthorized: true,
          })
        : net.createConnection({
            host: this.config.host,
            port: this.config.port,
          });
    socket.setTimeout(this.config.timeoutMs);
    let buffer = "";
    const response = () =>
        new Promise<string>((resolve, reject) => {
          const onData = (chunk: any) => {
            buffer += chunk.toString("utf8");
            const lines = buffer.split("\r\n"),
              complete = lines.find((line) => /^\d{3} /.test(line));
            if (!complete) return;
            socket.off("data", onData);
            buffer = "";
            const code = Number(complete.slice(0, 3));
            if (code >= 400) reject(new Error(`SMTP_${code}`));
            else resolve(complete);
          };
          socket.on("data", onData);
          socket.once("error", () =>
            reject(new Error("SMTP_CONNECTION_FAILED")),
          );
          socket.once("timeout", () => reject(new Error("SMTP_TIMEOUT")));
        }),
      command = async (value: string) => {
        socket.write(`${value}\r\n`);
        return response();
      };
    try {
      await response();
      await command(`EHLO ${this.config.host}`);
      if (!this.config.secure)
        throw new Error("SMTP_STARTTLS_REQUIRED_USE_SECURE_PORT");
      await command(
        `AUTH PLAIN ${Buffer.from(`\0${this.config.user}\0${this.config.password}`).toString("base64")}`,
      );
      await command(`MAIL FROM:<${cleanHeader(this.config.from)}>`);
      await command(`RCPT TO:<${cleanHeader(input.to)}>`);
      await command("DATA");
      const message = [
        `From: ${cleanHeader(this.config.from)}`,
        `To: ${cleanHeader(input.to)}`,
        `Subject: ${cleanHeader(input.title)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        input.body.replace(/^\./gm, ".."),
        ".",
      ].join("\r\n");
      await command(message);
      await command("QUIT");
    } finally {
      socket.destroy();
    }
  }
}
