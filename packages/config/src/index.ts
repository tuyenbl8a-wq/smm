export type Environment = "development" | "test" | "production";

export interface AppConfig {
  readonly environment: Environment;
  readonly host: string;
  readonly port: number;
  readonly appUrl: URL;
  readonly apiUrl: URL;
  readonly databaseUrl: URL;
  readonly redisUrl: URL;
  readonly sessionSecret: string;
  readonly jwtSecret: string;
  readonly encryptionKey: string;
  readonly healthTimeoutMs: number;
}

const allowedEnvironments = new Set<Environment>([
  "development",
  "test",
  "production",
]);

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value)
    throw new Error(
      `Missing required environment variable ${key}. Copy .env.example to .env and configure it.`,
    );
  return value;
}

function url(
  env: NodeJS.ProcessEnv,
  key: string,
  protocols: readonly string[],
): URL {
  const raw = required(env, key);
  let value: URL;
  try {
    value = new URL(raw);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
  if (!protocols.includes(value.protocol))
    throw new Error(`${key} must use ${protocols.join(" or ")}.`);
  return value;
}

function integer(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}.`);
  return value;
}

function secret(
  env: NodeJS.ProcessEnv,
  key: string,
  environment: Environment,
): string {
  const value = required(env, key);
  if (environment === "production" && value.length < 32)
    throw new Error(
      `${key} must contain at least 32 characters in production.`,
    );
  return value;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  defaultPort = 4000,
): AppConfig {
  const candidate = env.NODE_ENV?.trim() ?? "development";
  if (!allowedEnvironments.has(candidate as Environment))
    throw new Error("NODE_ENV must be development, test, or production.");
  const environment = candidate as Environment;
  return Object.freeze({
    environment,
    host: env.HOST?.trim() || "0.0.0.0",
    port: integer(env, "PORT", defaultPort, 1, 65535),
    appUrl: url(env, "APP_URL", ["http:", "https:"]),
    apiUrl: url(env, "API_URL", ["http:", "https:"]),
    databaseUrl: url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
    redisUrl: url(env, "REDIS_URL", ["redis:", "rediss:"]),
    sessionSecret: secret(env, "SESSION_SECRET", environment),
    jwtSecret: secret(env, "JWT_SECRET", environment),
    encryptionKey: secret(env, "ENCRYPTION_KEY", environment),
    healthTimeoutMs: integer(env, "HEALTH_TIMEOUT_MS", 1500, 100, 10000),
  });
}
