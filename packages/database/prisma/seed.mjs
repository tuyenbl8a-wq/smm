import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed is disabled when NODE_ENV=production.");
}
const adminEmail = required("DEV_SEED_ADMIN_EMAIL").toLowerCase();
const adminUsername =
  process.env.DEV_SEED_ADMIN_USERNAME?.trim() || "superadmin";
const adminPassword = required("DEV_SEED_ADMIN_PASSWORD");
if (adminPassword.length < 12)
  throw new Error(
    "DEV_SEED_ADMIN_PASSWORD must contain at least 12 characters.",
  );
const customerEmail = process.env.DEV_SEED_CUSTOMER_EMAIL?.trim().toLowerCase();
const customerPassword = process.env.DEV_SEED_CUSTOMER_PASSWORD?.trim();
if (
  (customerEmail && !customerPassword) ||
  (!customerEmail && customerPassword)
)
  throw new Error(
    "Configure both DEV_SEED_CUSTOMER_EMAIL and DEV_SEED_CUSTOMER_PASSWORD, or neither.",
  );
if (customerPassword && customerPassword.length < 12)
  throw new Error(
    "DEV_SEED_CUSTOMER_PASSWORD must contain at least 12 characters.",
  );

function required(key) {
  const value = process.env[key]?.trim();
  if (!value)
    throw new Error(
      `Missing ${key}. Development credentials must be provided explicitly.`,
    );
  return value;
}
function hashPassword(password) {
  const salt = randomBytes(16);
  const result = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${result.toString("base64url")}`;
}
function referralCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

const prisma = new PrismaClient();
const roles = ["USER", "RESELLER", "SUPPORT", "STAFF", "ADMIN", "SUPER_ADMIN"];
const permissions = [
  "users.read",
  "users.update",
  "users.ban",
  "users.pricing.manage",
  "orders.read",
  "orders.update",
  "services.manage",
  "providers.manage",
  "payments.manage",
  "tickets.manage",
  "settings.manage",
  "logs.read",
  "reports.read",
  "wallets.adjust",
  "audit.read",
  "services.view",
  "pricing.view",
  "pricing.manage",
  "providers.view",
  "staff.view",
  "staff.manage",
  "users.security.manage",
  "settings.view",
  "audit.view",
];
try {
  await prisma.$transaction(async (tx) => {
    const normalGroup = await tx.priceGroup.upsert({
      where: { code: "KHACH_LE" },
      update: { active: true, name: "Khách lẻ", tierOrder: 0 },
      create: {
        code: "KHACH_LE",
        name: "Khách lẻ",
        active: true,
        tierOrder: 0,
        publicDescription: "Mức giá tiêu chuẩn dành cho khách hàng mới.",
      },
    });
    await tx.priceGroup.upsert({
      where: { code: "CTV" },
      update: { active: true, name: "Cộng tác viên", tierOrder: 10 },
      create: {
        code: "CTV",
        name: "Cộng tác viên",
        active: true,
        tierOrder: 10,
        upgradeEnabled: true,
        publicDescription: "Mức giá ưu đãi dành cho cộng tác viên.",
      },
    });
    await tx.priceGroup.upsert({
      where: { code: "DAI_LY" },
      update: { active: true, name: "Đại lý", tierOrder: 20 },
      create: {
        code: "DAI_LY",
        name: "Đại lý",
        active: true,
        tierOrder: 20,
        upgradeEnabled: true,
        publicDescription: "Mức giá dành cho khách hàng đại lý.",
      },
    });
    for (const code of roles)
      await tx.role.upsert({
        where: { code },
        update: { name: code.replaceAll("_", " ") },
        create: { code, name: code.replaceAll("_", " ") },
      });
    for (const code of permissions)
      await tx.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: `Allows ${code}` },
      });
    const superRole = await tx.role.findUniqueOrThrow({
      where: { code: "SUPER_ADMIN" },
    });
    const allPermissions = await tx.permission.findMany({
      select: { id: true },
    });
    await tx.rolePermission.createMany({
      data: allPermissions.map(({ id }) => ({
        roleId: superRole.id,
        permissionId: id,
      })),
      skipDuplicates: true,
    });
    const admin = await tx.user.upsert({
      where: { email: adminEmail },
      update: {
        username: adminUsername,
        passwordHash: hashPassword(adminPassword),
        status: "ACTIVE",
        priceGroupId: normalGroup.id,
      },
      create: {
        email: adminEmail,
        username: adminUsername,
        passwordHash: hashPassword(adminPassword),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        referralCode: referralCode(),
        priceGroupId: normalGroup.id,
      },
    });
    await tx.userRole.createMany({
      data: [{ userId: admin.id, roleId: superRole.id }],
      skipDuplicates: true,
    });
    await tx.wallet.upsert({
      where: { userId: admin.id },
      update: {},
      create: { userId: admin.id, currency: "USD" },
    });
    if (customerEmail && customerPassword) {
      const userRole = await tx.role.findUniqueOrThrow({
        where: { code: "USER" },
      });
      const customer = await tx.user.upsert({
        where: { email: customerEmail },
        update: {
          passwordHash: hashPassword(customerPassword),
          status: "ACTIVE",
          priceGroupId: normalGroup.id,
        },
        create: {
          email: customerEmail,
          username:
            process.env.DEV_SEED_CUSTOMER_USERNAME?.trim() || "demo_customer",
          passwordHash: hashPassword(customerPassword),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          referralCode: referralCode(),
          priceGroupId: normalGroup.id,
        },
      });
      await tx.userRole.createMany({
        data: [{ userId: customer.id, roleId: userRole.id }],
        skipDuplicates: true,
      });
      await tx.wallet.upsert({
        where: { userId: customer.id },
        update: {},
        create: { userId: customer.id, currency: "USD" },
      });
    }
    const category = await tx.serviceCategory.upsert({
      where: { slug: "social-marketing" },
      update: { active: true },
      create: {
        name: "Social Marketing",
        slug: "social-marketing",
        description: "Development catalog for permitted marketing services",
      },
    });
    const existingService = await tx.service.findFirst({
      where: {
        categoryId: category.id,
        name: "Development Engagement Service",
      },
    });
    if (!existingService)
      await tx.service.create({
        data: {
          categoryId: category.id,
          name: "Development Engagement Service",
          description:
            "Disabled development service; connect an approved provider before activation.",
          type: "DEFAULT",
          rate: "1.00000000",
          providerCost: "0.80000000",
          min: 10,
          max: 10000,
          active: false,
        },
      });
    const settings = [
      ["general", "siteName", "SMM Panel"],
      ["general", "currency", "USD"],
      ["general", "timezone", "UTC"],
      ["general", "registrationEnabled", true],
      ["security", "maintenanceMode", false],
    ];
    for (const [group, key, value] of settings)
      await tx.setting.upsert({
        where: { group_key: { group, key } },
        update: { value },
        create: { group, key, value },
      });
  });
  console.log(
    "Development database seeded. Rotate or remove all seed credentials before any shared deployment.",
  );
} finally {
  await prisma.$disconnect();
}
