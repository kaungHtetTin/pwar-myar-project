export const MOBILE_NAVIGATION_SECTIONS = [
  { id: "operations", label: "Operations", modules: ["sell", "products", "purchases", "sales", "shop"] },
  { id: "contacts", label: "Contacts", modules: ["suppliers", "customers"] },
  { id: "finance", label: "Finance", modules: ["expenses", "transactions", "reports"] },
  { id: "administration", label: "Administration", modules: ["billing", "access", "settings"] },
];

export const MOBILE_MODULES = [
  {
    id: "shop",
    label: "My Shop",
    path: "/shop",
    description: "Online orders and storefront",
  },
  {
    id: "sell",
    label: "Sell",
    path: "/sell",
    description: "Fast 3-step checkout",
  },
  {
    id: "products",
    label: "Products",
    path: "/products",
    description: "Inventory and pricing",
  },
  {
    id: "purchases",
    label: "Purchases",
    path: "/purchases",
    description: "Purchase orders and receiving",
  },
  {
    id: "sales",
    label: "Sales",
    path: "/sales",
    description: "Sales history and receipts",
  },
  {
    id: "suppliers",
    label: "Suppliers",
    path: "/suppliers",
    description: "Supplier directory",
  },
  {
    id: "customers",
    label: "Customers",
    path: "/customers",
    description: "Customer accounts",
  },
  {
    id: "expenses",
    label: "Expenses",
    path: "/expenses",
    description: "Business expenses",
  },
  {
    id: "transactions",
    label: "Transactions",
    path: "/transactions",
    description: "Payment history",
  },
  {
    id: "reports",
    label: "Reports",
    path: "/reports",
    description: "Business performance",
  },
  {
    id: "billing",
    label: "Billing",
    path: "/billing",
    description: "Plan and payments",
  },
  {
    id: "access",
    label: "Access",
    path: "/access",
    description: "Staff and permissions",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    description: "Workspace preferences",
  },
];

export function resolveEnabledModules(
  configuredIds = [],
  permissionIds = [],
  role = "",
) {
  const allIds = MOBILE_MODULES.map(({ id }) => id);
  const configured =
    Array.isArray(configuredIds) && configuredIds.length
      ? configuredIds
      : allIds;
  const permissions =
    Array.isArray(permissionIds) && permissionIds.length
      ? permissionIds
      : String(role).toLowerCase() === "owner"
        ? allIds
        : [];

  return MOBILE_MODULES.filter(
    ({ id }) =>
      id === "settings" ||
      (permissions.includes(id) && (id === "access" || configured.includes(id))),
  );
}

export function moduleFromPath(pathname, modules = MOBILE_MODULES) {
  return (
    modules.find(
      ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
    ) || null
  );
}

export function defaultModule(modules) {
  return modules.find(({ id }) => id === "sell") || modules.find(({ id }) => id === "products") || modules[0] || null;
}
