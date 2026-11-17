// Run against two PHP workers connected to an isolated, migrated test database.
// ECOMMERCE_TEST_API=http://127.0.0.1:8000/api
// ECOMMERCE_TEST_API_SECOND=http://127.0.0.1:8001/api
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const api = process.env.ECOMMERCE_TEST_API;
const second = process.env.ECOMMERCE_TEST_API_SECOND;
if (!api || !second || process.env.ECOMMERCE_TEST_CONFIRM !== "isolated")
  throw new Error(
    "Set both test worker URLs and ECOMMERCE_TEST_CONFIRM=isolated. This test creates fixture businesses and orders.",
  );
const shop = process.env.ECOMMERCE_TEST_SHOP || "http://127.0.0.1:5177";
const staff = process.env.ECOMMERCE_TEST_STAFF || "http://127.0.0.1:5173";
let token = "";
async function call(
  path,
  body,
  method = body ? "POST" : "GET",
  base = api,
  auth = true,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(auth
        ? {
            "X-MKPOS-Auth": "token",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  return { status: response.status, result };
}
async function ok(...args) {
  const response = await call(...args);
  assert.ok(
    response.status >= 200 && response.status < 300,
    JSON.stringify(response),
  );
  return response.result;
}
const email = `shop-e2e-${Date.now()}@example.test`;
const session = await ok("/auth/register", {
  business_name: "The Corner Pantry",
  owner_name: "Fixture owner",
  email,
  password: "fixture-password-123",
  password_confirmation: "fixture-password-123",
});
token = session.access_token;
assert.ok(token);
const settings = await ok("/shop-admin/settings");
await ok(
  "/shop-admin/settings",
  {
    ...settings,
    storefront_enabled: true,
    accepting_orders: true,
    marketplace_enabled: true,
    description:
      "Everyday essentials, thoughtfully picked for your neighbourhood.",
    pickup_instructions: "Collect at the test shop counter.",
    phone: "000000",
    delivery_zones: [{ id: "city", name: "City delivery", fee: 500 }],
  },
  "PUT",
);
const names = [
  "Jasmine rice",
  "Green tea",
  "Organic lentils",
  "Morning coffee",
  "Wildflower honey",
  "Oat biscuits",
  "Coconut milk",
  "Sesame oil",
];
const products = [];
for (const [i, name] of names.entries()) {
  const product = await ok("/products", {
    name,
    category: ["Pantry", "Drinks", "Snacks"][i % 3],
    base_unit: "Pack",
    price: 1500 + i * 250,
    stock: 20,
  });
  await ok(
    `/shop-admin/publications/${product.id}`,
    {
      published: true,
      unit: "base",
      description: "A pantry favourite from your local shop.",
    },
    "PUT",
  );
  products.push(product);
}
const race = await ok("/products", {
  name: "Last pack",
  price: 1000,
  stock: 1,
});
await ok(
  `/shop-admin/publications/${race.id}`,
  { published: true, unit: "base" },
  "PUT",
);
const raceBase = {
  items: [{ product_id: race.id, quantity: 1 }],
  fulfillment: "pickup",
  payment_method_id: "cash",
};
const quote = await ok(
  `/ecommerce/stores/${settings.slug}/quote`,
  raceBase,
  "POST",
  api,
  false,
);
const raceData = {
  ...raceBase,
  customer_name: "Fixture buyer",
  phone: "000000",
  quote_hash: quote.quote_hash,
};
const raced = await Promise.all(
  [api, second].map((base) =>
    call(
      `/ecommerce/stores/${settings.slug}/checkout`,
      { ...raceData, idempotency_key: crypto.randomUUID() },
      "POST",
      base,
      false,
    ),
  ),
);
assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
console.log("PASS: competing PHP workers cannot oversell the last item.");
const retryBase = {
  ...raceBase,
  items: [{ product_id: products[0].id, quantity: 1 }],
};
const retryQuote = await ok(
  `/ecommerce/stores/${settings.slug}/quote`,
  retryBase,
  "POST",
  api,
  false,
);
const retryData = {
  ...retryBase,
  customer_name: "Fixture buyer",
  phone: "000000",
  quote_hash: retryQuote.quote_hash,
  idempotency_key: crypto.randomUUID(),
};
const retries = await Promise.all(
  [api, second].map((base) =>
    ok(
      `/ecommerce/stores/${settings.slug}/checkout`,
      retryData,
      "POST",
      base,
      false,
    ),
  ),
);
assert.equal(retries[0].reference, retries[1].reference);
console.log("PASS: concurrent retries return the same order.");

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${shop}/#/store/${settings.slug}`);
  await page
    .getByRole("heading", { name: "The Corner Pantry", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Jasmine rice", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/store-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "Jasmine rice", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Added to your cart." })
    .waitFor();
  await page.getByRole("link", { name: "Cart 1", exact: true }).click();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Fixture customer");
  await page.getByLabel("Phone number", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  await page
    .getByRole("button", { name: "Place order", exact: true })
    .waitFor();
  await page.screenshot({
    path: "artifacts/checkout-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await page.getByRole("heading", { name: /^O-/ }).waitFor();
  assert.equal(await page.getByText("pending · Payment: unpaid").count(), 1);
  const order = await ok("/shop-admin/orders");
  const submitted = order.items.find(
    (o) => o.customer_name === "Fixture customer",
  );
  assert.ok(submitted);
  for (const status of ["accepted", "packing", "ready_for_pickup"])
    await ok(`/shop-admin/orders/${submitted.id}/transition`, { status });
  await ok(`/shop-admin/orders/${submitted.id}/payments/confirm`, {
    amount: Number(submitted.total),
    reference: "Fixture cash receipt",
    verified: true,
  });
  await ok(`/shop-admin/orders/${submitted.id}/transition`, {
    status: "completed",
  });
  await page.getByRole("button", { name: "View order", exact: true }).click();
  await page.getByText("completed · Payment: paid").waitFor();
  const crossOriginStatus = await page.evaluate(async ({ api, slug, payload }) => {
    const response = await fetch(`${api}/ecommerce/stores/${slug}/quote`, {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
    });
    return response.status;
  }, { api, slug: settings.slug, payload: retryBase });
  assert.equal(crossOriginStatus, 200);
  console.log('PASS: customer-origin quote works directly across origins without staff cookies.');
  console.log(
    "PASS: customer checkout, staff fulfillment, POS completion and private tracking.",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${shop}/#/store/${settings.slug}`);
  await page
    .getByRole("heading", { name: "Jasmine rice", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({ path: "artifacts/store-mobile.png", fullPage: true });
  await page
    .getByRole("heading", { name: "Jasmine rice", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await page.getByRole("link", { name: "Cart 1", exact: true }).click();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Fixture mobile customer");
  await page.getByLabel("Phone number", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  await page
    .getByRole("button", { name: "Place order", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/checkout-mobile.png",
    fullPage: true,
  });
  await page.goto(`${shop}/#/marketplace`);
  await page
    .locator(`a[href="#/store/${settings.slug}?origin=marketplace"]`)
    .waitFor();
  await page.screenshot({
    path: "artifacts/marketplace-mobile.png",
    fullPage: true,
  });
  console.log("PASS: mobile storefront and marketplace fit the viewport.");

  const pos = await context.newPage();
  pos.on("pageerror", (e) => errors.push(e.message));
  await pos.goto(staff);
  await pos.evaluate(
    ({ token, session }) => {
      localStorage.setItem("mkpos.accessToken", token);
      localStorage.setItem("mkpos.activeModule", "shop");
    },
    { token, session },
  );
  await pos.reload();
  await pos
    .getByRole("heading", { name: "Online shop", exact: true })
    .waitFor();
  await pos.getByRole("button", { name: "Orders", exact: true }).waitFor();
  await pos
    .locator(".shop-order-row")
    .filter({ hasText: submitted.reference })
    .waitFor();
  await pos.screenshot({
    path: "artifacts/staff-orders-desktop.png",
    fullPage: true,
  });
  await pos
    .locator(".shop-order-row")
    .filter({ hasText: submitted.reference })
    .click();
  await pos
    .getByRole("heading", { name: submitted.reference, exact: true })
    .waitFor();
  await pos.screenshot({
    path: "artifacts/staff-order-detail-desktop.png",
    fullPage: true,
  });
  await pos
    .getByRole("button", { name: "Back to orders", exact: true })
    .click();
  await pos
    .locator(".shop-tabs")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await pos.getByLabel("Public shop name", { exact: true }).waitFor();
  await pos.screenshot({
    path: "artifacts/staff-settings-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: staff order list and configuration render without browser errors.",
  );
} finally {
  await browser.close();
}
