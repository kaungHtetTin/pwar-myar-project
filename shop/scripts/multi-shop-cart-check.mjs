import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'test-artifacts/multi-shop-cart';
await mkdir(output, { recursive: true });
const photo = index => `http://127.0.0.1:8000/api/ecommerce/stores/demo-shop-01/products/${201 + index % 4}/photo`;
const names = ['Demo Shop', 'Sunrise Store', "Nature’s Best", 'Move On'];
const slugs = ['demo', 'sunrise', 'nature', 'move-on'];
const products = slugs.flatMap((slug, shopIndex) => Array.from({ length: 3 }, (_, index) => ({ id: shopIndex * 10 + index + 1, name: ['Rice 5 kg', 'Cooking Oil', 'Green Tea'][index], store_slug: slug, store_name: names[shopIndex], price: 3000 + index * 1000, currency: 'Ks', unit_name: 'Piece', available_quantity: 20, photo_url: photo(index), rating: { count: 0 }, category: 'Groceries' })));
const carts = slugs.map((slug, index) => ({ slug, name: names[index], origin: 'marketplace', items: products.filter(product => product.store_slug === slug).map(product => ({ ...product, quantity: 1 })) }));
const requests = [], submissions = [];
let statusFailure = false, checkoutFailure = false;
const browser = await chromium.launch();
async function mock(route) {
  const url = new URL(route.request().url()), path = url.pathname.split('/ecommerce')[1];
  if (path.endsWith('/photo') || path.endsWith('/logo')) return route.continue();
  requests.push(path);
  if (path === '/marketplace/products') return route.fulfill({ json: { items: products, has_more: false } });
  if (path === '/marketplace/shops') return route.fulfill({ json: { items: [], has_more: false } });
  if (/\/stores\/[^/]+$/.test(path)) {
    const slug = path.split('/').at(-1), index = slugs.indexOf(slug);
    if (statusFailure) { statusFailure = false; return route.fulfill({ status: 503, json: { message: 'Shop unavailable' } }); }
    return route.fulfill({ json: { slug, display_name: names[index], description: 'Everyday essentials from your local shop.', accepting_orders: slug !== 'move-on', logo_url: 'http://127.0.0.1:8000/api/ecommerce/stores/demo-shop-01/logo', currency: 'Ks', payment_methods: [{ id: 'cash', name: 'Cash on pickup', type: 'cash' }], delivery_zones: [{ id: 'city', name: 'City', fee: 3000 }], categories: [] } });
  }
  if (/\/products\/\d+$/.test(path)) return route.fulfill({ json: products.find(product => product.id === Number(path.split('/').at(-1))) });
  if (path.endsWith('/reviews')) return route.fulfill({ json: { items: [], has_more: false, summary: { count: 0 } } });
  if (path.endsWith('/quote') || path.endsWith('/checkout')) {
    const body = route.request().postDataJSON(); submissions.push({ path, body });
    if (path.endsWith('/checkout')) {
      if (checkoutFailure) { checkoutFailure = false; return route.fulfill({ status: 503, json: { message: 'Connection lost. Please retry.' } }); }
      return route.fulfill({ json: { reference: 'TEST-CART', tracking_credential: 'c'.repeat(64) } });
    }
    const items = body.items.map(item => ({ ...item, name: products.find(product => product.id === item.product_id).name, unit_name: 'Piece', line_total: products.find(product => product.id === item.product_id).price * item.quantity }));
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    return route.fulfill({ json: { items, subtotal, total: subtotal, currency: 'Ks', delivery_fee: 0, quote_hash: 'a'.repeat(64) } });
  }
  if (path === '/tracking') return route.fulfill({ status: 404, json: { message: 'Test order only.' } });
  return route.fulfill({ json: { items: [], has_more: false, enabled: false, unread_count: 0 } });
}
async function fonts(page) { await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); }); }
const persisted = page => page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2')));
try {
  for (const width of [360, 393, 430, 768, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 852 } });
    await page.route('**/ecommerce/**', mock);
    await page.goto('http://127.0.0.1:5177');
    await page.evaluate(carts => { localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify(carts)); }, carts);
    await page.goto('http://127.0.0.1:5177/#/cart'); await page.reload();
    await page.locator('.cart-selection-card').first().waitFor();
    await page.locator('.cart-selection-card .is-open').first().waitFor();
    await fonts(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `selector overflow ${width}`);
    await page.screenshot({ path: `${output}/selection-${width}.png`, fullPage: true });
    await page.locator('.cart-selection-summary a').first().click();
    await page.locator('.cart-proceed[href]').waitFor(); await fonts(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `review overflow ${width}`);
    await page.screenshot({ path: `${output}/review-${width}.png`, fullPage: true });
    if (width === 393) {
      await page.locator('.language').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Myanmar review overflow');
      await page.screenshot({ path: `${output}/review-my.png`, fullPage: true });
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.route('**/ecommerce/**', mock);
  page.on('dialog', () => { throw new Error('Adding across shops must not ask to replace a cart.'); });
  await page.goto('http://127.0.0.1:5177');
  await page.getByRole('button', { name: 'Add to cart: Rice 5 kg', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add to cart: Rice 5 kg', exact: true }).nth(1).click();
  assert.equal((await persisted(page)).length, 2);
  await page.reload();
  await page.locator('.mobile-navigation a[href="#/cart"]').click();
  await page.locator('.cart-selection-card').first().waitFor();
  assert.equal(await page.locator('.cart-selection-card').count(), 2);
  const search = page.getByRole('searchbox', { name: 'Search your carts' });
  await search.fill('Demo');
  const selectionCalls = requests.length;
  await page.locator('.cart-selection-summary a').first().click();
  await page.locator('.cart-proceed[href]').waitFor();
  const itemSearch = page.getByRole('searchbox', { name: 'Search items in this cart' });
  await itemSearch.fill('missing item');
  assert.equal(await page.locator('.cart-review-item:visible').count(), 0);
  await itemSearch.fill('Rice');
  await page.getByRole('button', { name: 'Increase quantity: Rice 5 kg', exact: true }).click();
  assert.equal((await persisted(page)).find(cart => cart.slug === 'demo').items[0].quantity, 2);
  await page.getByRole('button', { name: 'Decrease quantity: Rice 5 kg', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Rice 5 kg quantity', exact: true }).fill('0.375');
  assert.equal((await persisted(page)).find(cart => cart.slug === 'demo').items[0].quantity, .375);
  await page.locator('.cart-back').click();
  assert.equal(await search.inputValue(), 'Demo');
  assert.equal(requests.length, selectionCalls + 1, 'Back must not reload selector shops');
  await page.goForward(); await page.locator('.cart-proceed[href]').waitFor();
  await page.locator('.cart-review-item-info a').first().click();
  await page.getByRole('heading', { name: 'Rice 5 kg', exact: true }).waitFor();
  const productCalls = requests.length;
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.cart-review-item').waitFor();
  assert.equal(requests.length, productCalls, 'Product Back must retain review without fetching');
  assert.equal(await itemSearch.inputValue(), 'Rice');
  await page.locator('.cart-proceed[href]').click();
  await page.getByLabel('Your name', { exact: true }).fill('Test buyer');
  await page.getByLabel('Phone number', { exact: true }).fill('090000000');
  const checkoutCalls = requests.length;
  await page.locator('.checkout-layout a.back').click();
  await page.locator('.cart-proceed[href]').waitFor();
  assert.equal(await itemSearch.inputValue(), 'Rice');
  assert.equal(requests.length, checkoutCalls, 'Checkout Back must retain shop cart without fetching');
  await page.goForward();
  assert.equal(await page.getByLabel('Your name', { exact: true }).inputValue(), 'Test buyer');
  await page.getByRole('button', { name: 'Review order', exact: true }).click();
  await page.getByRole('button', { name: 'Place order', exact: true }).waitFor();
  const quoteSubmission = submissions.at(-1);
  assert.equal(quoteSubmission.path, '/stores/demo/quote');
  assert.deepEqual(quoteSubmission.body.items, [{ product_id: 1, quantity: .375 }]);
  checkoutFailure = true;
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await page.getByRole('button', { name: 'Retry submission', exact: true }).waitFor();
  assert.equal((await persisted(page)).length, 2, 'Failed checkout preserves both shop carts');
  await page.getByRole('button', { name: 'Retry submission', exact: true }).click();
  await page.waitForURL('**/#/orders/track');
  assert.deepEqual((await persisted(page)).map(cart => cart.slug), ['sunrise']);
  const placed = submissions.filter(entry => entry.path.endsWith('/checkout'));
  assert.equal(placed.length, 2);
  assert.equal(placed[0].body.idempotency_key, placed[1].body.idempotency_key);
  await page.locator('.mobile-navigation a[href="#/cart"]').click();
  await search.fill('');
  await page.locator('.cart-selection-summary a').first().click();
  await page.getByRole('button', { name: 'Remove Rice 5 kg', exact: true }).click();
  await page.getByRole('heading', { name: 'Your cart is empty', exact: true }).waitFor();
  assert.deepEqual(await persisted(page), []);
  await page.close();
  const closed = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await closed.route('**/ecommerce/**', mock);
  await closed.goto('http://127.0.0.1:5177');
  await closed.evaluate(cart => localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([cart])), carts[3]);
  await closed.goto('http://127.0.0.1:5177/#/cart/move-on'); await closed.reload();
  assert.equal(await closed.getByRole('button', { name: 'Checkout unavailable', exact: true }).isDisabled(), true);
  await closed.close();
  statusFailure = true;
  const retry = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await retry.route('**/ecommerce/**', mock);
  await retry.addInitScript(cart => localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([cart])), carts[0]);
  await retry.goto('http://127.0.0.1:5177/#/cart/demo');
  await retry.getByRole('button', { name: 'Try again', exact: true }).click();
  await retry.locator('.cart-shop-status.is-open').waitFor();
  await retry.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ responsive: 'pass', crossShopAdd: 'pass', persistence: 'pass', quantityRemove: 'pass', retainedSearchBackForward: 'pass', checkoutIsolation: 'pass', retryIdempotency: 'pass', closedShop: 'pass', statusRetry: 'pass', liveWrites: 0 }, null, 2));
  console.log('PASS: separate persisted shop carts, responsive selection/review, quantity/remove, search/Back retention, single-shop quote/checkout, failed-submit retry, clearing only the completed shop, closed shop and status retry. All writes intercepted.');
} finally { await browser.close(); }
