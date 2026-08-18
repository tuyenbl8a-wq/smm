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
    const signatures: any = {
      "image/png": "89504e47",
      "image/jpeg": "ffd8ff",
      "image/webp": "52494646",
      "application/pdf": "25504446",
    };
    if (data.subarray(0, 4).toString("hex") !== signatures[mime])
      throw new Error("MIME_MISMATCH");
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
