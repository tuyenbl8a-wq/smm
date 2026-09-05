import { test, expect } from "@playwright/test";

const uuid = (value) =>
  `${value}0000000-0000-4000-8000-000000000000`.slice(0, 36);
const fixture = {
  platforms: [
    { id: uuid("10000000-"), name: "YouTube", slug: "youtube", active: true },
  ],
  categories: [
    {
      id: uuid("20000000-"),
      platformId: uuid("10000000-"),
      name: "Lượt xem",
      slug: "views",
      active: true,
    },
  ],
  services: [
    {
      id: uuid("30000000-"),
      categoryId: uuid("20000000-"),
      name: "YouTube Views",
      source: "API",
      type: "DEFAULT",
      rate: "1.30000000",
      providerCost: "1.00000000",
      min: 100,
      max: 10000,
      averageTime: "30 phút",
      refill: true,
      cancel: false,
      active: true,
      priceReviewStatus: "OK",
    },
  ],
  providers: [
    { id: uuid("40000000-"), name: "NCC thử nghiệm", status: "ACTIVE" },
  ],
  providerServices: [
    {
      id: uuid("50000000-"),
      providerId: uuid("40000000-"),
      externalId: "987",
      name: "Provider Views",
      category: "Video",
      type: "DEFAULT",
      rate: "1.00000000",
      min: 100,
      max: 10000,
      active: true,
      stale: false,
    },
  ],
  mappings: [
    {
      serviceId: uuid("30000000-"),
      providerServiceId: uuid("50000000-"),
      active: true,
    },
  ],
  priceGroups: ["CUSTOMER", "AGENT", "DISTRIBUTOR"].map((code, index) => ({
    id: uuid(`6${index}000000-`),
    code,
    defaultMarkupPercent: String(30 - index * 5),
  })),
  priceRules: [],
  priceHistory: [],
};

async function mockAdminApi(page) {
  const mutations = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (request.method() !== "GET")
      mutations.push({ path, body: request.postDataJSON?.() });
    let body = {};
    if (path === "/api/v1/auth/me")
      body = {
        user: { id: uuid("90000000-"), username: "admin" },
        access: { roles: ["SUPER_ADMIN"], permissions: [] },
        csrfToken: "e2e-csrf",
      };
    else if (path === "/api/v1/admin/services") body = fixture;
    else if (path === "/api/v1/admin/providers") body = fixture.providers;
    else if (/\/api\/v1\/admin\/services\/[0-9a-f-]{36}$/.test(path))
      body = {
        service: fixture.services[0],
        mappings: fixture.mappings,
        providerServices: fixture.providerServices,
        pricing: [
          { code: "CUSTOMER", mode: "PERCENT", value: "30" },
          { code: "AGENT", mode: "PERCENT", value: "25" },
          { code: "DISTRIBUTOR", mode: "PERCENT", value: "20" },
        ],
      };
    else if (path.endsWith("/services") && path.includes("/providers/"))
      body = {
        page: 1,
        pages: 1,
        categories: ["Video"],
        items: fixture.providerServices,
      };
    else if (path.endsWith("/import/preview"))
      body = {
        count: 1,
        items: [
          {
            externalServiceId: "987",
            localName: "Provider Views",
            providerCost: "1.00000000",
            suggestedPlatform: "YouTube",
            suggestedCategory: "Lượt xem",
            min: 100,
            max: 10000,
            prices: {
              CUSTOMER: "1.30000000",
              AGENT: "1.25000000",
              DISTRIBUTOR: "1.20000000",
            },
            state: "NEW",
          },
        ],
      };
    else if (path.endsWith("/import/apply"))
      body = { created: 1, updated: 0, skipped: 0, failed: 0 };
    else if (path === "/api/v1/admin/catalog/services")
      body = { service: { id: uuid("70000000-") }, mapping: null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return mutations;
}

test("danh sách dịch vụ lọc, phân cấp, phân trang và mở form nhân bản", async ({
  page,
}) => {
  await mockAdminApi(page);
  await page.goto("/admin/services");
  await expect(page.getByText("YouTube → Lượt xem")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Giá CUSTOMER" }),
  ).toBeVisible();
  await page.getByPlaceholder("ID nội bộ, ID NCC hoặc tên").fill("987");
  await expect(page.getByText("YouTube Views")).toBeVisible();
  await expect(page.getByText(/Trang 1\/1/)).toBeVisible();
  await page.getByRole("button", { name: "Nhân bản" }).click();
  await expect(page).toHaveURL(/\/admin\/services\/add\?clone=/);
  await expect(
    page.getByRole("heading", { name: "Nhân bản dịch vụ" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên dịch vụ")).toHaveValue(/bản sao/);
  await expect(page.getByLabel("Trạng thái")).toHaveValue("false");
});

test("tạo Manual và API dùng cùng form ba cấp giá", async ({ page }) => {
  const mutations = await mockAdminApi(page);
  await page.goto("/admin/services/add");
  await page.getByLabel("Tên dịch vụ").fill("Dịch vụ Manual mới");
  await page.getByLabel("Min").fill("100");
  await page.getByLabel("Max").fill("1000");
  await page.getByLabel("Giá vốn").fill("1");
  await expect(page.getByText(/Giá bán 1\.30000000/).first()).toBeVisible();
  await page.getByLabel("Lý do tạo dịch vụ").fill("Tạo bằng kiểm thử E2E");
  await page.getByRole("button", { name: "Lưu dịch vụ" }).click();
  await expect
    .poll(() =>
      mutations.some(
        (row) =>
          row.path === "/api/v1/admin/catalog/services" &&
          row.body.pricing.CUSTOMER,
      ),
    )
    .toBeTruthy();
});

test("import NCC tìm kiếm, chọn nhiều, preview và báo kết quả", async ({
  page,
}) => {
  await mockAdminApi(page);
  await page.goto("/admin/services/import");
  await page.getByPlaceholder("Tên nhà cung cấp").fill("thử nghiệm");
  await page.getByRole("button", { name: "Lấy danh sách dịch vụ" }).click();
  await page.locator('[data-id="987"]').check();
  await page.getByRole("button", { name: "Xem trước nhập" }).click();
  await expect(page.getByText("1.30000000")).toBeVisible();
  await page.getByLabel("Dịch vụ đã tồn tại").selectOption("UPDATE");
  await page.getByRole("button", { name: "Áp dụng nhập dịch vụ" }).click();
  await page.getByRole("button", { name: /Xác nhận/ }).click();
  await expect(
    page.getByText(/1 mới, 0 cập nhật, 0 bỏ qua, 0 lỗi/),
  ).toBeVisible();
});
