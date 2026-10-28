export function appBarRoute(pathname, fallbackTitle = "Workspace") {
  const routes = [
    [/^\/shop\/promotions\/(?:new\/(?:coupon|flash_sale)|\d+\/edit)$/, "Promotion", "/shop/promotions"],
    [/^\/shop\/promotions$/, "Promotions", "/shop"],
    [/^\/shop\/reviews\/\d+\/edit$/, "Reply to review", "/shop/reviews"],
    [/^\/shop\/reviews$/, "Ratings and reviews", "/shop"],
    [/^\/shop\/(reviews|report)$/, "My Shop", "/shop"],
    [/^\/shop\/chat\/[^/]+$/, "Customer conversation", "/shop/chat"],
    [/^\/shop\/chat$/, "Customer chat", "/shop"],
    [/^\/shop\/customers\/[^/]+\/action\/[^/]+$/, "Customer action", pathname?.split('/action/')[0]],
    [/^\/shop\/customers\/[^/]+$/, "Shop customer", "/shop/customers"],
    [/^\/shop\/customers$/, "Shop customers", "/shop"],
    [/^\/shop\/(storefront|fulfillment|cover|logo)$/, "Shop settings", "/shop"],
    [/^\/shop\/(contacts|delivery|methods)\/(?:new|[^/]+\/edit)$/, "Shop configuration", `/shop/${pathname?.split('/')[2]}`],
    [/^\/shop\/catalog\/\d+\/edit$/, "Product publication", "/shop/catalog"],
    [/^\/shop\/(contacts|delivery|methods|catalog)$/, "My Shop", "/shop"],
    [/^\/shop\/orders\/\d+\/action\/[^/]+$/, "Order action", pathname?.split('/action/')[0]],
    [/^\/shop\/orders\/\d+\/requests\/\d+\/review$/, "Review customer request", pathname?.split('/requests/')[0]],
    [/^\/shop\/orders\/\d+$/, "Order detail", "/shop/orders"],
    [/^\/shop\/orders$/, "Online orders", "/shop"],
    [/^\/shop\/location$/, "Shop location", "/shop"],
    [/^\/products\/new$/, "Add product", "/products"],
    [/^\/products\/\d+\/edit$/, "Edit product", "/products"],
    [/^\/products\/\d+\/stock$/, "Stock adjustment", "/products"],
    [/^\/purchases\/new$/, "New purchase", "/purchases"],
    [/^\/purchases\/\d+\/edit$/, "Edit purchase", "/purchases"],
    [/^\/purchases\/\d+$/, "Purchase detail", "/purchases"],
    [/^\/sales\/\d+\/edit$/, "Edit sale", "/sales"],
    [/^\/sales\/\d+$/, "Sale detail", "/sales"],
    [/^\/suppliers\/new$/, "New supplier", "/suppliers"],
    [/^\/suppliers\/\d+\/edit$/, "Edit supplier", "/suppliers"],
    [/^\/suppliers\/\d+\/payments\/new$/, "Record movement", "/suppliers"],
    [/^\/suppliers\/\d+\/payments\/\d+\/edit$/, "Edit movement", "/suppliers"],
    [/^\/suppliers\/\d+$/, "Supplier detail", "/suppliers"],
    [/^\/customers\/new$/, "New customer", "/customers"],
    [/^\/customers\/\d+\/edit$/, "Edit customer", "/customers"],
    [/^\/customers\/\d+\/payments\/new$/, "Record payment", "/customers"],
    [/^\/customers\/\d+\/payments\/\d+\/edit$/, "Edit payment", "/customers"],
    [/^\/customers\/\d+$/, "Customer detail", "/customers"],
    [/^\/expenses\/new$/, "New expense", "/expenses"],
    [/^\/expenses\/\d+\/edit$/, "Edit expense", "/expenses"],
    [/^\/transactions\/payments\/\d+\/edit$/, "Edit payment", "/transactions"],
    [
      /^\/transactions\/supplier-payments\/\d+\/edit$/,
      "Edit supplier payment",
      "/transactions",
    ],
    [/^\/billing\/request\/[^/]+$/, "Request plan", "/billing"],
    [/^\/settings\/prices\/new$/, "New price type", "/settings/prices"],
    [
      /^\/settings\/prices\/[^/]+\/edit$/,
      "Edit price type",
      "/settings/prices",
    ],
    [/^\/settings\/data\/restore$/, "Restore backup", "/settings/data"],
    [/^\/settings\/data\/reset$/, "Reset business data", "/settings/data"],
    [/^\/settings\/([^/]+)$/, null, "/settings"],
    [/^\/access\/roles\/new$/, "New role", "/access"],
    [/^\/access\/roles\/\d+\/edit$/, "Edit role", "/access"],
    [/^\/access\/staff\/new$/, "New staff account", "/access"],
    [/^\/access\/staff\/\d+\/edit$/, "Edit staff", "/access"],
    [/^\/access\/staff\/\d+\/password$/, "Reset password", "/access"],
    [/^\/sell\/cart$/, "Cart", "/sell"],
    [/^\/sell\/checkout$/, "Checkout", "/sell/cart"],
    [/^\/sell\/customer\/new$/, "New customer", "/sell/checkout"],
    [/^\/sell\/offline-sales$/, "Offline invoices", "/sell"],
  ];
  const match = routes.find(([pattern]) => pattern.test(pathname || ""));
  if (!match) return { title: fallbackTitle, backPath: null };
  const settingsSection = pathname.match(/^\/settings\/([^/]+)$/)?.[1];
  const title =
    match[1] ||
    (settingsSection
      ? settingsSection[0].toUpperCase() + settingsSection.slice(1)
      : fallbackTitle);
  const contactForm = pathname.match(/^\/(customers|suppliers)\/(\d+)\/(?:edit|payments\/(?:new|\d+\/edit))$/);
  return { title, backPath: contactForm ? `/${contactForm[1]}/${contactForm[2]}` : match[2] };
}
