import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
const key = (secret: string) => createHash("sha256").update(secret).digest();
export function encryptSecret(value: string, secret: string): string {
  if (!value || secret.length < 16) throw new Error("ENCRYPTION_INPUT_INVALID");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}
export function decryptSecret(value: string, secret: string): string {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data)
    throw new Error("ENCRYPTED_SECRET_INVALID");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
export const maskSecret = (value: string) =>
  value.length < 8 ? "********" : `${value.slice(0, 3)}…${value.slice(-3)}`;
