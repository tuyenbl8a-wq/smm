import { readFileSync } from "node:fs";
const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const required = [
  "User",
  "Role",
  "Permission",
  "UserRole",
  "Session",
  "ApiKey",
  "Wallet",
  "WalletTransaction",
  "Deposit",
  "PaymentMethod",
  "PaymentWebhook",
  "Provider",
  "ProviderService",
  "ServiceCategory",
  "Service",
  "ServiceMapping",
  "Order",
  "OrderHistory",
  "OrderProviderLog",
  "Refill",
  "Cancellation",
  "Ticket",
  "TicketMessage",
  "Notification",
  "Coupon",
  "CouponUsage",
  "Affiliate",
  "AffiliateCommission",
  "Referral",
  "PriceGroup",
  "PriceRule",
  "AuditLog",
  "LoginHistory",
  "Setting",
  "CronJobLog",
  "WebhookLog",
  "SystemLog",
];
const missing = required.filter(
  (name) => !new RegExp(`model\\s+${name}\\s*\\{`).test(schema),
);
if (missing.length)
  throw new Error(`Missing required Prisma models: ${missing.join(", ")}`);
const inlineEnums = [...schema.matchAll(/enum\s+(\w+)\s*\{[^\n{}]+\}/g)].map(
  (match) => match[1],
);
if (inlineEnums.length)
  throw new Error(
    `Prisma enums must declare one value per line: ${inlineEnums.join(", ")}`,
  );
const enumBlocks = [...schema.matchAll(/enum\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
if (enumBlocks.length === 0)
  throw new Error("Prisma schema must contain parseable multiline enum blocks");
for (const [block, name, body] of enumBlocks) {
  const values = body
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 || values.some((value) => /\s/.test(value)))
    throw new Error(`${name} contains an invalid enum declaration: ${block}`);
}
const models = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
for (const [, name, body] of models) {
  if (!/createdAt\s+DateTime/.test(body) || !/updatedAt\s+DateTime/.test(body))
    throw new Error(`${name} must have createdAt and updatedAt`);
}
if (/\b(Float)\b/.test(schema))
  throw new Error("Floating point database fields are forbidden");
for (const field of ["balance", "amount", "charge", "providerCost", "profit"]) {
  if (!new RegExp(`${field}\\s+Decimal`).test(schema))
    throw new Error(`${field} must use Decimal`);
}
console.log(
  `Validated ${models.length} Prisma models and monetary invariants.`,
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260818130000_initial/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
for (const table of schema.matchAll(/@@map\("([^"]+)"\)/g)) {
  if (!migration.includes(`CREATE TABLE "${table[1]}"`))
    throw new Error(`Initial migration does not create ${table[1]}`);
}
if (!migration.includes("FOREIGN KEY"))
  throw new Error("Initial migration must enforce foreign keys");
console.log("Validated initial migration table and foreign-key coverage.");
