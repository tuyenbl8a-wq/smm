import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdmin } from "../src/admin/dashboard.js";
import { calculateSaleRate, decimalInput } from "../src/catalog/pricing.js";
import { CatalogService } from "../src/catalog/service.js";
import { uniqueConflictDetails } from "../src/auth/handler.js";

test("pricing uses exact eight-place fixed-point arithmetic", () => {
  assert.equal(decimalInput("10.00000001"), "10.00000001");
  assert.equal(
    calculateSaleRate({
      baseRate: "10",
      providerCost: "7",
      markupPercent: "10",
      fixedProfit: "0.00000001",
    }),
    "7.70000001",
  );
  assert.equal(
    calculateSaleRate({ baseRate: "8", providerCost: "9", minProfit: "2" }),
    "11.00000000",
  );
  assert.equal(
    calculateSaleRate({
      baseRate: "10",
      providerCost: "7",
      fixedRate: "12.34567891",
      markupPercent: "50",
    }),
    "12.34567891",
  );
  assert.throws(() => decimalInput("1.000000001"), /INVALID_DECIMAL/);
  assert.throws(() => decimalInput("0"), /INVALID_DECIMAL/);
});

test("catalog administration requires services.manage", () => {
  assert.equal(
    canAccessAdmin({ roles: ["USER"], permissions: [] }, "services.manage"),
    false,
  );
  assert.equal(
    canAccessAdmin(
      { roles: ["STAFF"], permissions: ["services.manage"] },
      "services.manage",
    ),
    true,
  );
  assert.equal(
    canAccessAdmin(
      { roles: ["SUPER_ADMIN"], permissions: [] },
      "services.manage",
    ),
    true,
  );
});

test("service management and import remain separately permissioned", () => {
  const viewer = { roles: ["STAFF"], permissions: ["services.view"] };
  const manager = { roles: ["STAFF"], permissions: ["services.manage"] };
  const importer = { roles: ["STAFF"], permissions: ["services.import"] };
  assert.equal(canAccessAdmin(viewer, "services.manage"), false);
  assert.equal(canAccessAdmin(viewer, "services.import"), false);
  assert.equal(canAccessAdmin(manager, "services.manage"), true);
  assert.equal(canAccessAdmin(manager, "services.import"), false);
  assert.equal(canAccessAdmin(importer, "services.import"), true);
  assert.equal(canAccessAdmin(importer, "services.manage"), false);
});

test("catalog unique conflicts expose stable Vietnamese error codes", () => {
  assert.deepEqual(uniqueConflictDetails(["slug"]), {
    code: "CATALOG_SLUG_ALREADY_USED",
    message: "Slug đã được sử dụng",
  });
  assert.deepEqual(uniqueConflictDetails(["service_categories_name_key"]), {
    code: "CATALOG_NAME_ALREADY_USED",
    message: "Tên này đã được sử dụng",
  });
  assert.deepEqual(
    uniqueConflictDetails(["service_id", "provider_service_id"]),
    {
      code: "UNIQUE_CONFLICT",
      message: "Dữ liệu đã tồn tại trong hệ thống",
    },
  );
});

test("canonical staff permissions remain distinct from commercial price tiers", () => {
  assert.equal(
    canAccessAdmin(
      { roles: ["STAFF"], permissions: ["orders.view"] },
      "orders.read",
    ),
    true,
  );
  assert.equal(
    canAccessAdmin(
      { roles: ["STAFF"], permissions: ["services.view"] },
      "services.manage",
    ),
    false,
  );
  assert.equal(
    canAccessAdmin(
      { roles: ["STAFF"], permissions: ["pricing.view"] },
      "pricing.manage",
    ),
    false,
  );
  assert.equal(
    canAccessAdmin(
      { roles: ["STAFF"], permissions: ["payments.view"] },
      "payments.manage",
    ),
    false,
  );
});

test("customer catalog is scoped to active categories and never exposes provider cost", async () => {
  const category = { id: "category-1", name: "Social", slug: "social" };
  let serviceWhere: any;
  const db = {
    serviceCategory: { findMany: async () => [category] },
    user: {
      findUnique: async ({ where }: any) => {
        assert.equal(where.id, "customer-1");
        return { priceGroupId: "group-1" };
      },
    },
    service: {
      count: async ({ where }: any) => {
        serviceWhere = where;
        return 1;
      },
      findMany: async (query: any) =>
        query.select.providerCost
          ? [{ id: "service-1", providerCost: "5", rate: "10" }]
          : [
              {
                id: "service-1",
                categoryId: category.id,
                name: "Followers",
                description: null,
                type: "DEFAULT",
                rate: "10",
                min: 100,
                max: 1000,
                averageTime: null,
                refill: true,
                cancel: false,
                customFields: null,
              },
            ],
    },
    priceRule: {
      findMany: async () => [
        {
          serviceId: "service-1",
          markupPercent: "10",
          fixedRate: null,
          fixedProfit: null,
          minProfit: "0",
        },
      ],
    },
    priceGroup: {
      findFirst: async () => ({
        id: "group-1",
        defaultMarkupPercent: "0",
        defaultFixedProfit: "0",
        defaultMinProfit: "0",
      }),
    },
  };
  const result = await new CatalogService(db).customerCatalog("customer-1", {
    page: 1,
    limit: 20,
  });
  assert.deepEqual(serviceWhere.categoryId, { in: [category.id] });
  assert.equal(result.services[0].rate, "5.50000000");
  assert.equal("providerCost" in result.services[0], false);
});

test("catalog mutations create an audit record in the same transaction", async () => {
  const audits: any[] = [];
  const tx = {
    serviceCategory: {
      create: async ({ data }: any) => ({ id: "category-1", ...data }),
    },
    auditLog: {
      create: async ({ data }: any) => {
        audits.push(data);
        return data;
      },
    },
  };
  const db = { $transaction: async (work: any) => work(tx) };
  await new CatalogService(db).createCategory("admin-1", {
    name: "Social Media",
    slug: "social-media",
  });
  assert.equal(audits[0].actorId, "admin-1");
  assert.equal(audits[0].action, "CATEGORY_CREATE");
});

test("manual service fields disable only their provider sync controls", async () => {
  let mappingUpdate: any;
  const before = {
      id: "service-1",
      categoryId: "category-1",
      name: "Tên từ NCC",
      description: "Mô tả NCC",
      type: "DEFAULT",
      averageTime: "1 giờ",
      refill: true,
      cancel: false,
      active: true,
      min: 10,
      max: 1000,
    },
    tx: any = {
      service: {
        findUnique: async () => before,
        update: async ({ data }: any) => ({ ...before, ...data }),
      },
      serviceMapping: {
        updateMany: async (query: any) => ((mappingUpdate = query), query),
      },
      auditLog: { create: async ({ data }: any) => data },
    },
    db = { $transaction: async (work: any) => work(tx) };
  await new CatalogService(db).updateService("admin-1", "service-1", {
    categoryId: "category-2",
    name: "Tên chỉnh tay",
    min: 20,
    max: 2000,
    type: "CUSTOM_COMMENTS",
    refill: false,
    cancel: true,
    description: "Mô tả chỉnh tay",
    averageTime: "2 giờ",
    active: false,
  });
  assert.deepEqual(mappingUpdate.where, {
    serviceId: "service-1",
    active: true,
  });
  assert.deepEqual(mappingUpdate.data, {
    syncAll: false,
    syncName: false,
    syncMin: false,
    syncMax: false,
    syncType: false,
    syncRefill: false,
    syncCancel: false,
    syncDescription: false,
    syncAverageTime: false,
    syncStatus: false,
  });
});
