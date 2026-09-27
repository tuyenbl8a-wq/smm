import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdmin } from "../src/admin/dashboard.js";
import { calculateSaleRate, decimalInput } from "../src/catalog/pricing.js";
import { CatalogService } from "../src/catalog/service.js";
import { uniqueConflictDetails } from "../src/auth/handler.js";

test("service creation requires a trimmed audit reason and stays tenant scoped", async () => {
  const siteId = "00000000-0000-4000-8000-000000000099";
  const categoryQueries: any[] = [],
    created: any[] = [],
    audits: any[] = [];
  const db: any = {
    $transaction: async (work: any) =>
      work({
        serviceCategory: {
          findFirst: async (query: any) => {
            categoryQueries.push(query);
            return { id: "category-1", siteId, active: true };
          },
        },
        service: {
          create: async ({ data }: any) => {
            const item = { id: `service-${created.length + 1}`, ...data };
            created.push(item);
            return item;
          },
        },
        priceGroup: { findMany: async () => [] },
        auditLog: { create: async ({ data }: any) => audits.push(data) },
      }),
  };
  const catalog = new CatalogService(db);
  const input = {
    name: "Followers",
    type: "DEFAULT",
    categoryId: "category-1",
    source: "MANUAL",
    rate: "10",
    min: 1,
    max: 100,
  };
  for (const reason of [undefined, "a", "ab", "  ", "x".repeat(501)])
    await assert.rejects(
      async () => catalog.createService("admin", siteId, { ...input, reason }),
      /Vui lòng nhập lý do từ 3 đến 500 ký tự/,
    );
  assert.equal(created.length, 0);

  await catalog.createService("admin", siteId, {
    ...input,
    reason: "  ABC  ",
  });
  await catalog.createService("admin", siteId, {
    ...input,
    reason: "R".repeat(500),
  });
  assert.equal(created.length, 2);
  assert.equal(created[0]!.siteId, siteId);
  assert.deepEqual(categoryQueries[0]!.where, {
    id: "category-1",
    siteId,
    active: true,
    deletedAt: null,
  });
  assert.equal(audits[0]!.action, "SERVICE_CREATE");
  assert.equal(audits[0]!.siteId, siteId);
  assert.equal(audits[0]!.after.reason, "ABC");
  assert.equal(audits[1]!.after.reason, "R".repeat(500));
});

test("service editor edits require a reason but generic catalog edits do not", async () => {
  await assert.rejects(
    async () => new CatalogService({}).updateServiceEditor("admin", "service-1", {}),
    /Vui lòng nhập lý do từ 3 đến 500 ký tự/,
  );
});

test("catalog delete archives records and preserves historical references", async () => {
  const updates: any[] = [],
    audits: any[] = [];
  const repository = {
    findUnique: async () => ({ id: "item", active: true }),
    update: async ({ data }: any) => {
      updates.push(data);
      return { id: "item", ...data };
    },
  };
  const db: any = {
    $transaction: async (fn: any) =>
      fn({
        platform: repository,
        serviceCategory: repository,
        service: repository,
        priceGroup: repository,
        auditLog: { create: async (x: any) => audits.push(x) },
      }),
  };
  const service = new CatalogService(db);
  for (const kind of [
    "platforms",
    "categories",
    "services",
    "price-groups",
  ] as const) {
    const result = await service.archiveEntity("admin", "00000000-0000-4000-8000-000000000001", kind, "item");
    assert.equal(result.archived, true);
  }
  assert.equal(
    updates.every((x) => x.active === false),
    true,
  );
  assert.equal(audits.length, 4);
  assert.equal(
    audits.every((x) => x.data.action === "CATALOG_ARCHIVE"),
    true,
  );
});

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

test("child service edits persist only tenant overrides and never mutate the master service", async () => {
  let serviceUpdated = false;
  let overrideData: any;
  const db: any = {
    $transaction: async (fn: any) => fn(db),
    site: {
      findUnique: async () => ({
        id: "child",
        parentSiteId: "parent",
        panelType: "CHILD_PANEL",
      }),
    },
    siteServiceRule: {
      findUnique: async () => ({
        id: "rule",
        siteId: "child",
        serviceId: "service",
      }),
      update: async ({ data }: any) => {
        overrideData = data;
        return { id: "rule", siteId: "child", serviceId: "service", ...data };
      },
    },
    service: {
      findFirst: async () => ({
        id: "service",
        siteId: "parent",
        active: true,
        deletedAt: null,
        min: 1,
        max: 10000,
      }),
      update: async () => {
        serviceUpdated = true;
      },
    },
    auditLog: { create: async ({ data }: any) => data },
  };
  const catalog = new CatalogService(db);
  await catalog.updateTenantService(
    "child-admin",
    "child",
    "service",
    { name: "Tên bán riêng", markupPercent: "15", active: false },
    { presentation: true, pricing: true, toggle: true },
  );
  assert.equal(serviceUpdated, false);
  assert.deepEqual(overrideData, {
    displayName: "Tên bán riêng",
    active: false,
    pricingMode: "COST_PLUS_PERCENT",
    markupPercent: "15.00000000",
    fixedRate: null,
  });
});

test("child service capabilities cannot create/import providers or edit unauthorized fields", async () => {
  const catalog = new CatalogService({});
  await assert.rejects(
    () =>
      catalog.updateTenantService(
        "admin",
        "child",
        "service",
        { name: "x" },
        { presentation: false, pricing: true, toggle: true },
      ),
    (error: any) => error.code === "PERMISSION_DENIED",
  );
  await assert.rejects(
    () =>
      catalog.updateTenantService(
        "admin",
        "child",
        "service",
        { providerId: "foreign" },
        { presentation: true, pricing: true, toggle: true },
      ),
    (error: any) => error.code === "TENANT_SERVICE_FIELDS_INVALID",
  );
});

test("customer catalog is scoped to active categories and never exposes provider cost", async () => {
  const category = { id: "category-1", name: "Social", slug: "social" };
  let serviceWhere: any;
  const db = {
    serviceCategory: { findMany: async () => [category] },
    user: {
      findFirst: async ({ where }: any) => {
        assert.equal(where.id, "customer-1");
        assert.equal(where.siteId, "00000000-0000-4000-8000-000000000001");
        return { priceGroupId: "group-1" };
      },
    },
    service: {
      count: async ({ where }: any) => {
        serviceWhere = where;
        return 1;
      },
      findMany: async (query: any) => {
        if (query.select.name) assert.equal(query.select.serviceNumber, true);
        return query.select.providerCost
          ? [{ id: "service-1", providerCost: "5", rate: "10" }]
          : [
              {
                id: "service-1",
                serviceNumber: 123n,
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
            ];
      },
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
    siteId: "00000000-0000-4000-8000-000000000001",
    page: 1,
    limit: 20,
  });
  assert.deepEqual(serviceWhere.categoryId, { in: [category.id] });
  assert.equal(result.services[0].rate, "5.50000000");
  assert.equal(result.services[0].serviceNumber, "123");
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
  await new CatalogService(db).createCategory("admin-1", "00000000-0000-4000-8000-000000000001", {
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
      siteId: "00000000-0000-4000-8000-000000000001",
      categoryId: "category-1",
      name: "Tên từ NCC",
      description: "Mô tả NCC",
      type: "DEFAULT",
      averageTime: "1 giờ",
      refill: true,
      cancel: false,
      active: true,
      providerCost: "7.25",
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
  const updated = await new CatalogService(db).updateService("admin-1", "00000000-0000-4000-8000-000000000001", "service-1", {
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
  assert.equal(updated.siteId, before.siteId);
  assert.equal(updated.providerCost, before.providerCost);
  assert.equal(updated.name, "Tên chỉnh tay");
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

test("public catalog returns only explicitly selected safe fields", async () => {
  const db: any = {
    serviceCategory: {
      findMany: async () => [
        { id: "c", platformId: "p", name: "Follow", slug: "follow" },
      ],
    },
    platform: {
      findMany: async () => [{ id: "p", name: "TikTok", slug: "tiktok" }],
    },
    service: {
      count: async () => 1,
      findMany: async ({ select }: any) => {
        if (select?.categoryId) return [{ categoryId: "c" }];
        assert.equal(select.providerCost, undefined);
        assert.equal(select.providerId, undefined);
        return [
          {
            id: "s",
            categoryId: "c",
            name: "Followers",
            rate: "10",
            min: 10,
            max: 1000,
            averageTime: "1 giờ",
            refill: true,
            cancel: false,
          },
        ];
      },
    },
  };
  const result = await new CatalogService(db).publicCatalog({
    siteId: "00000000-0000-4000-8000-000000000001",
    page: 1,
    limit: 12,
  });
  assert.equal(result.categories[0]!.platform!.name, "TikTok");
  assert.equal((result.services[0] as any).providerCost, undefined);
});

test("child catalog exposes only explicitly inherited services with site overrides", async () => {
  const child = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let serviceWhere: any;
  const inherited = {
    serviceId: "allowed-service",
    fixedRate: "12.00000000",
    markupPercent: null,
    fixedProfit: null,
    minProfit: "0",
    minOverride: 25,
    maxOverride: 500,
  };
  const db: any = {
    site: {
      findUnique: async () => ({
        id: child,
        parentSiteId: "parent",
        panelType: "CHILD_PANEL",
      }),
    },
    serviceCategory: {
      findMany: async () => [
        { id: "category", name: "Social", slug: "social", platformId: null },
      ],
    },
    platform: { findMany: async () => [] },
    siteServiceRule: {
      findMany: async ({ where }: any) => {
        assert.deepEqual(where, { siteId: child, active: true });
        return [inherited];
      },
    },
    service: {
      count: async ({ where }: any) => ((serviceWhere = where), 1),
      findMany: async ({ where, select }: any) => {
        if (select?.providerCost)
          return [
            {
              id: "allowed-service",
              providerCost: "5",
              rate: "10",
              pricingMode: "FIXED",
              defaultMarkupPercent: "0",
              defaultFixedProfit: "0",
              defaultMinProfit: "0",
            },
          ];
        serviceWhere = where;
        return [
          {
            id: "allowed-service",
            serviceNumber: 1001n,
            categoryId: "category",
            name: "Allowed",
            rate: "10",
            min: 1,
            max: 1000,
          },
        ];
      },
    },
    user: { findFirst: async () => ({ priceGroupId: null }) },
  };
  const result = await new CatalogService(db).customerCatalog("child-user", {
    siteId: child,
    page: 1,
    limit: 20,
  });
  assert.deepEqual(serviceWhere.id, { in: ["allowed-service"] });
  assert.equal(result.services[0].rate, "12.00000000");
  assert.equal(result.services[0].min, 25);
  assert.equal(result.services[0].max, 500);
});

test("child platform presentation is stored locally and never updates parent master", async () => {
  let masterUpdated = false;
  let overlay: any;
  const tx: any = {
    serviceCategory: { findMany: async () => [{ id: "category" }] },
    service: { findMany: async () => [{ id: "service" }] },
    siteServiceRule: { findFirst: async () => ({ id: "assignment" }) },
    sitePlatformRule: {
      findUnique: async () => null,
      upsert: async ({ create }: any) => (overlay = { id: "overlay", ...create }),
    },
    platform: { update: async () => (masterUpdated = true) },
    auditLog: { create: async ({ data }: any) => data },
  };
  const db = { ...tx, $transaction: async (run: any) => run(tx) };
  await new CatalogService(db).updatePlatformPresentation(
    "child-admin",
    "child-site",
    "parent-platform",
    { name: "Tên riêng", active: false },
  );
  assert.equal(masterUpdated, false);
  assert.equal(overlay.siteId, "child-site");
  assert.equal(overlay.platformId, "parent-platform");
  assert.equal(overlay.displayName, "Tên riêng");
  assert.equal(overlay.active, false);
});

test("child category presentation rejects unassigned cross-tenant category", async () => {
  const tx: any = {
    service: { findMany: async () => [{ id: "foreign-service" }] },
    siteServiceRule: { findFirst: async () => null },
  };
  const db = { ...tx, $transaction: async (run: any) => run(tx) };
  await assert.rejects(
    () =>
      new CatalogService(db).updateCategoryPresentation(
        "child-admin",
        "child-site",
        "foreign-category",
        { name: "Không được phép" },
      ),
    (error: any) => error.code === "CATEGORY_NOT_FOUND",
  );
});

test("public panel catalog exposes categories only through services visible to that tenant", async () => {
  const root = "00000000-0000-4000-8000-000000000001";
  const childA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const childB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const categories = [
    { id: "root-cat", name: "Root only", slug: "root-only", platformId: null },
    { id: "a-cat", name: "Child A private", slug: "child-a", platformId: null },
    { id: "b-cat", name: "Child B private", slug: "child-b", platformId: null },
  ];
  const services = [
    { id: "root-service", siteId: root, categoryId: "root-cat" },
    { id: "a-service", siteId: root, categoryId: "a-cat" },
    { id: "b-service", siteId: root, categoryId: "b-cat" },
  ];
  const rules: Record<string, string[]> = {
    [childA]: ["a-service"],
  };
  const db: any = {
    site: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        parentSiteId: where.id === root ? null : root,
        panelType: "CHILD_PANEL",
      }),
    },
    serviceCategory: {
      findMany: async ({ where }: any) =>
        categories.filter((category) => where.id.in.includes(category.id)),
    },
    platform: { findMany: async () => [] },
    siteServiceRule: {
      findMany: async ({ where }: any) =>
        (rules[where.siteId] || []).map((serviceId) => ({ serviceId })),
    },
    service: {
      findMany: async ({ where, select }: any) => {
        const visible = services.filter(
          (service) =>
            (!where.siteId || service.siteId === where.siteId) &&
            (!where.id?.in || where.id.in.includes(service.id)),
        );
        return select?.categoryId
          ? visible.map(({ categoryId }) => ({ categoryId }))
          : visible.map((service) => ({ ...service, name: service.id }));
      },
      count: async () => 0,
    },
  };
  const catalog = new CatalogService(db);
  const load = (siteId: string) =>
    catalog.publicCatalog({ siteId, page: 1, limit: 20 });
  const [rootResult, aResult, bResult] = await Promise.all([
    load(root),
    load(childA),
    load(childB),
  ]);
  assert.deepEqual(rootResult.categories.map((x: any) => x.name), ["Root only", "Child A private", "Child B private"]);
  assert.deepEqual(aResult.categories.map((x: any) => x.name), ["Child A private"]);
  assert.deepEqual(bResult.categories.map((x: any) => x.name), []);
  assert.deepEqual(bResult.services, []);
  assert.equal(aResult.categories.some((x: any) => x.id === "b-cat" || x.slug === "child-b"), false);
  assert.equal(bResult.categories.some((x: any) => x.id === "a-cat" || x.slug === "child-a"), false);
});


test("public catalog search preserves PANEL ancestry scope and tenant presentation overlays", async () => {
  const root = "00000000-0000-4000-8000-000000000001";
  const services = [
    { id: "owned", siteId: "panel-a", categoryId: "shared", name: "match owned", rate: "1" },
    { id: "inherited", siteId: root, categoryId: "shared", name: "match parent", rate: "1" },
    { id: "foreign", siteId: "panel-b", categoryId: "shared", name: "match foreign", rate: "1" },
  ].map((row, index) => ({ ...row, active: true, deletedAt: null, serviceNumber: BigInt(index + 1) }));
  const matches = (row: any, where: any): boolean => Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((part: any) => matches(row, part));
    if (key === "AND") return value.every((part: any) => matches(row, part));
    if (value && typeof value === "object") {
      if (value.in) return value.in.includes(row[key]);
      if (value.contains) return row[key].includes(value.contains);
      if (value.equals !== undefined) return row[key] === value.equals;
    }
    return row[key] === value;
  });
  let panelType = "PANEL", hidden = false;
  const db: any = {
    site: { findUnique: async () => ({ id: "panel-a", parentSiteId: root, panelType }) },
    siteServiceRule: { findMany: async () => [{ serviceId: "inherited", active: true }] },
    service: {
      findMany: async ({ where }: any) => services.filter((row) => matches(row, where)),
      count: async ({ where }: any) => services.filter((row) => matches(row, where)).length,
    },
    serviceCategory: { findMany: async () => [{ id: "shared", name: "Master category", slug: "shared", platformId: null }] },
    platform: { findMany: async () => [] },
    siteCategoryRule: { findMany: async ({ where }: any) => {
      assert.equal(where.siteId, "panel-a");
      return [{ categoryId: "shared", displayName: "Tenant category", active: !hidden }];
    } },
  };
  const catalog = new CatalogService(db);
  const load = () => catalog.publicCatalog({ siteId: "panel-a", page: 1, limit: 20, search: "match" });
  const panel = await load();
  assert.deepEqual(panel.services.map((row: any) => row.id), ["owned", "inherited"]);
  assert.equal(panel.total, 2);
  assert.equal(panel.categories[0]!.name, "Tenant category");
  panelType = "CHILD_PANEL";
  assert.deepEqual((await load()).services.map((row: any) => row.id), ["inherited"]);
  hidden = true;
  assert.deepEqual((await load()).services, []);
});
