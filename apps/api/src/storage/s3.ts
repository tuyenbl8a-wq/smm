import { createHash, createHmac, randomBytes } from "node:crypto";

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

type Fetch = (input: string, init: Record<string, unknown>) => Promise<any>;
const maximumSize = 5 * 1024 * 1024;
const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const hex = (value: string | any) =>
  createHash("sha256").update(value).digest("hex");
const hmac = (key: string | any, value: string) =>
  createHmac("sha256", key).update(value).digest();
const encodePath = (value: string) =>
  value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

/** Private S3-compatible attachment storage using AWS Signature Version 4. */
export class S3Storage {
  private endpoint: URL;
  constructor(
    private config: S3StorageConfig,
    private request: Fetch = fetch as Fetch,
  ) {
    const values = Object.values(config).map((value) => value.trim());
    if (values.some((value) => !value))
      throw new Error("S3_CONFIGURATION_INCOMPLETE");
    this.endpoint = new URL(config.endpoint);
    if (
      this.endpoint.protocol !== "https:" &&
      this.endpoint.hostname !== "localhost"
    )
      throw new Error("S3_ENDPOINT_INSECURE");
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket))
      throw new Error("S3_BUCKET_INVALID");
  }

  async put(name: string, mime: string, data: any) {
    if (
      data.length <= 0 ||
      data.length > maximumSize ||
      !allowed.has(mime) ||
      name.includes("..") ||
      /[\\/]/.test(name)
    )
      throw new Error("ATTACHMENT_INVALID");
    const key = randomBytes(24).toString("hex");
    await this.send("PUT", key, data, mime);
    return { key, size: data.length };
  }

  async read(key: string) {
    if (!/^[a-f0-9]{48}$/.test(key)) throw new Error("STORAGE_KEY_INVALID");
    const response = await this.send("GET", key);
    const size = Number(response.headers?.get?.("content-length") ?? "0");
    if (size > maximumSize) throw new Error("STORAGE_OBJECT_TOO_LARGE");
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maximumSize) throw new Error("STORAGE_OBJECT_TOO_LARGE");
    return data;
  }

  private async send(
    method: "GET" | "PUT",
    key: string,
    body?: any,
    mime?: string,
  ) {
    const now = new Date(),
      stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, ""),
      day = stamp.slice(0, 8),
      payloadHash = hex(body ?? ""),
      basePath = this.endpoint.pathname.replace(/\/$/, ""),
      canonicalPath =
        `${basePath}/${encodePath(this.config.bucket)}/${key}` || "/",
      url = new URL(this.endpoint);
    url.pathname = canonicalPath;
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": stamp,
      ...(mime ? { "content-type": mime } : {}),
    };
    const names = Object.keys(headers).sort(),
      canonicalHeaders = names
        .map((name) => `${name}:${headers[name]!.trim()}\n`)
        .join(""),
      signedHeaders = names.join(";"),
      scope = `${day}/${this.config.region}/s3/aws4_request`,
      canonicalRequest = [
        method,
        canonicalPath,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join("\n"),
      stringToSign = [
        "AWS4-HMAC-SHA256",
        stamp,
        scope,
        hex(canonicalRequest),
      ].join("\n"),
      dateKey = hmac(`AWS4${this.config.secretAccessKey}`, day),
      regionKey = hmac(dateKey, this.config.region),
      serviceKey = hmac(regionKey, "s3"),
      signingKey = hmac(serviceKey, "aws4_request"),
      signature = createHmac("sha256", signingKey)
        .update(stringToSign)
        .digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await this.request(url.toString(), {
      method,
      headers,
      ...(body ? { body } : {}),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`S3_REQUEST_FAILED_${response.status}`);
    return response;
  }
}
