import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
export class LocalStorage {
  constructor(
    private root: string,
    private production = false,
  ) {
    if (production) throw new Error("DURABLE_STORAGE_REQUIRED");
  }
  async put(name: string, mime: string, data: any) {
    if (
      data.length > 5242880 ||
      !allowed.has(mime) ||
      name.includes("..") ||
      /[\\/]/.test(name)
    )
      throw new Error("ATTACHMENT_INVALID");
    const hex = data.subarray(0, 12).toString("hex"),
      valid =
        (mime === "image/png" && hex.startsWith("89504e470d0a1a0a")) ||
        (mime === "image/jpeg" && hex.startsWith("ffd8ff")) ||
        (mime === "application/pdf" && hex.startsWith("255044462d")) ||
        (mime === "image/webp" &&
          hex.startsWith("52494646") &&
          hex.slice(16, 24) === "57454250");
    if (!valid) throw new Error("MIME_MISMATCH");
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = randomBytes(24).toString("hex");
    await writeFile(join(this.root, key), data, { mode: 0o600 });
    return { key, size: data.length };
  }
  read(key: string) {
    if (!/^[a-f0-9]{48}$/.test(key)) throw new Error("STORAGE_KEY_INVALID");
    return readFile(join(this.root, key));
  }
}
