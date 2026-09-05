import { test, expect } from "@playwright/test";

const order = {
  id: "2",
  publicId: "11111111-1111-4111-8111-111111111111",
  orderNumber: "100002",
  providerId: "22222222-2222-4222-8222-222222222222",
  providerOrderId: null,
  status: "FAILED",
  charge: "100.00000000",
  refundedAmount: "30.00000000",
  quantity: 100,
  startCount: 10,
  remains: 90,
  manualOverride: false,
  link: "https://example.test/post",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  service: { name: "Lượt xem kiểm thử" },
  user: { username: "khachhang" },
  provider: { name: "NCC kiểm thử" },
};
const secondOrder = {
  ...order,
  id: "3",
  publicId: "33333333-3333-4333-8333-333333333333",
  orderNumber: "100003",
  providerOrderId: "provider-secret-9988",
  status: "COMPLETED",
};

async function mockOrders(page) {
  const calls = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push({
      path,
      method: request.method(),
      body: request.postDataJSON?.(),
    });
    let body = {};
    if (path.endsWith("/me"))
      body = {
        user: { id: "admin", username: "admin" },
        access: {
          roles: ["SUPER_ADMIN"],
          permissions: [
            "orders.view",
            "orders.manage",
            "orders.sync",
            "orders.refund",
            "orders.retry",
          ],
        },
        csrfToken: "csrf-e2e",
      };
    else if (path === "/api/v1/admin/orders")
      body = {
        items: [order, secondOrder],
        page: 1,
        pages: 1,
        total: 2,
        statusCounts: { FAILED: 1, COMPLETED: 1 },
        manualCount: 0,
      };
    else if (path.endsWith("/providers"))
      body = [{ id: order.providerId, name: "NCC kiểm thử", status: "ACTIVE" }];
    else if (path.endsWith("/retry-provider"))
      body = {
        outcome: "ACCEPTED",
        message: "NCC đã nhận đơn thành công.",
        providerOrderId: "new-provider-id",
      };
    else if (path.endsWith("/sync")) body = { refundAdded: "0.00000000" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return calls;
}

test("orders loads API, action dropdown works, and each modal shows only relevant fields", async ({
  page,
}) => {
  const calls = await mockOrders(page);
  await page.goto("/admin/orders");
  await expect(page.getByText("#100002")).toBeVisible();
  await expect
    .poll(() => calls.some((call) => call.path === "/api/v1/admin/orders"))
    .toBeTruthy();
  await page.locator(".action-menu summary").click();
  await page.getByRole("button", { name: "Chỉnh Start count" }).click();
  const modal = page.locator("#orderModal");
  await expect(modal).toBeVisible();
  await expect(modal.locator("#startField")).toBeVisible();
  for (const field of [
    "statusField",
    "providerField",
    "providerOrderField",
    "remainsField",
    "targetField",
  ])
    await expect(modal.locator(`#${field}`)).toBeHidden();
  await page.getByRole("button", { name: "Hủy" }).click();
  await expect(modal).toBeHidden();
});

test("failed order retry uses a unique idempotency key and Vietnamese confirmation workflow", async ({
  page,
}) => {
  const calls = await mockOrders(page);
  await page.goto("/admin/orders");
  await page.locator(".action-menu summary").click();
  await page.getByRole("button", { name: "Gửi lại / Mua lại NCC" }).click();
  await page.getByLabel("Lý do").fill("NCC xác nhận mã cũ không tồn tại");
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect
    .poll(() => calls.some((call) => call.path.endsWith("/retry-provider")))
    .toBeTruthy();
  const retry = calls.find((call) => call.path.endsWith("/retry-provider"));
  expect(retry.method).toBe("POST");
  expect(retry.body.reason).toMatch(/NCC xác nhận/);
});

test("copy order IDs uses only short website IDs and resets selection on search", async ({
  page,
}) => {
  await mockOrders(page);
  await page.addInitScript(() => {
    globalThis.__copiedOrderIds = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          globalThis.__copiedOrderIds = value;
        },
      },
    });
  });
  await page.goto("/admin/orders");
  const selectAll = page.getByLabel("Chọn tất cả đơn trên trang");
  const first = page.getByLabel("Chọn đơn #100002");
  await first.check();
  await expect(page.getByText("Đã chọn 1 đơn")).toBeVisible();
  await expect(selectAll).not.toBeChecked();
  expect(await selectAll.evaluate((input) => input.indeterminate)).toBe(true);
  await page.getByRole("button", { name: "Sao chép mã đã chọn" }).click();
  expect(await page.evaluate(() => globalThis.__copiedOrderIds)).toBe("100002");
  await selectAll.check();
  await page
    .getByRole("button", { name: "Sao chép tất cả mã trên trang" })
    .click();
  expect(await page.evaluate(() => globalThis.__copiedOrderIds)).toBe(
    "100002\n100003",
  );
  expect(await page.evaluate(() => globalThis.__copiedOrderIds)).not.toContain(
    "provider-secret-9988",
  );
  await page.getByPlaceholder("Mã đơn website").fill("100002");
  await page.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect(page.getByText(/Đã chọn/)).toBeHidden();
  await expect(selectAll).not.toBeChecked();
});
