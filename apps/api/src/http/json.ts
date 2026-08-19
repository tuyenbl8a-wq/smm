import type { ServerResponse } from "node:http";

/** Shared transport encoder. Prisma Decimal objects use their string toJSON,
 * bigint is normalized here, and Date keeps its ISO-8601 JSON representation. */
export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

export function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(stringifyJson(payload));
}
