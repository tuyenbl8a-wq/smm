export const specializedAdminRoutes = new Set([
  "/admin/users",
  "/admin/staff",
  "/admin/platforms",
  "/admin/categories",
  "/admin/services",
  "/admin/providers",
  "/admin/price-groups",
  "/admin/pricing",
  "/admin/deposits",
  "/admin/payment-methods",
  "/admin/transactions",
  "/admin/coupons",
  "/admin/support",
  "/admin/logs",
  "/admin/settings",
  "/admin/themes",
]);

export function renderWithFallback(
  path: string,
  specialized: () => unknown,
  fallback: () => void,
) {
  const result = specializedAdminRoutes.has(path) ? specialized() : false;
  if (result === false) fallback();
}
