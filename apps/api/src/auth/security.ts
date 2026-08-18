import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
export function opaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) =>
      error
        ? reject(error)
        : resolve(
            `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`,
          ),
    ),
  );
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, n, r, p, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !expected)
    return false;
  const actual = await new Promise<unknown>((resolve, reject) =>
    scrypt(
      password,
      Buffer.from(salt, "base64url"),
      64,
      { N: Number(n), r: Number(r), p: Number(p) },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
  try {
    return timingSafeEqual(actual, Buffer.from(expected, "base64url"));
  } catch {
    return false;
  }
}
export function csrfValue(sessionToken: string, secret: string): string {
  const nonce = opaqueToken(18);
  return `${nonce}.${createHmac("sha256", secret).update(`${sessionToken}.${nonce}`).digest("base64url")}`;
}
export function verifyCsrf(
  value: string,
  sessionToken: string,
  secret: string,
): boolean {
  const [nonce, signature] = value.split(".");
  if (!nonce || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(`${sessionToken}.${nonce}`)
    .digest("base64url");
  return signature === expected;
}
