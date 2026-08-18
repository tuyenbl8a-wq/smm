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
