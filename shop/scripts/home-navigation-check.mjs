import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'test-artifacts/home-navigation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const products = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, name: ['Fresh Apples', 'Handmade Mug', 'Organic Honey', 'Sports Shoes'][index % 4] + (index > 3 ? ` ${index + 1}` : ''), category: ['Food & Drinks', 'Home & Living', 'Beauty', 'Electronics', 'Fashion'][index % 5], price: 4500 + index * 1000, currency: 'Ks', unit_name: 'Piece', available_quantity: index === 4 ? 0 : 20, store_slug: index === 3 ? 'move-on' : 'demo-shop', store_name: index === 3 ? 'Move On' : 'Demo Shop', rating: { average: 4.8, count: 12 }, photo_url: `http://127.0.0.1:8000/api/ecommerce/stores/demo-shop-01/products/${201 + index % 4}/photo`, description: 'Test fixture for navigation verification.' }));
const shops = ['Demo Shop', 'Sunrise Store', "Nature’s Best", 'Move On'].map((display_name, index) => ({ slug: index === 3 ? 'move-on' : `demo-shop${index ? `-${index}` : ''}`, display_name, accepting_orders: true, rating: { average: 4.8, count: 128 }, logo_url: null }));
products[1].available_quantity = .375;
const saleProducts = products.slice(5, 9).map(product => ({ ...product, original_price: product.price * 1.2, flash_sale: { name: 'Test sale' } }));
const calls = [], results = [];
let failSearch = true;
async function mock(route) {
  const url = new URL(route.request().url()), path = url.pathname.split('/ecommerce')[1];
  if (path.endsWith('/photo')) return route.continue();
  calls.push(path + url.search);
  if (path === '/marketplace/products') {
    if (url.searchParams.get('q') === 'offline' && failSearch) { failSearch = false; return route.fulfill({ status: 503, json: { message: 'Unable to load products.' } }); }
    let rows = url.searchParams.get('on_sale') === '1' ? saleProducts : products;
    if (url.searchParams.get('category')) rows = rows.filter(product => product.category === url.searchParams.get('category'));
    if (url.searchParams.get('in_stock') === '1') rows = rows.filter(product => product.available_quantity > 0);
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 24);
    return route.fulfill({ json: { items: rows.slice(offset, offset + limit), has_more: offset + limit < rows.length } });
  }
  if (path === '/marketplace/shops') return route.fulfill({ json: { items: shops, has_more: false } });
  if (/\/products\/\d+$/.test(path)) return route.fulfill({ json: products.find(product => product.id === Number(path.split('/').at(-1))) });
  if (/\/stores\/[^/]+$/.test(path)) return route.fulfill({ json: { ...shops[0], categories: ['Food & Drinks'], currency: 'Ks', payment_methods: [], delivery_zones: [] } });
  if (path.endsWith('/reviews')) return route.fulfill({ json: { items: [], summary: { count: 0 }, has_more: false } });
  return route.fulfill({ json: { items: [], has_more: false, enabled: false, unread_count: 0 } });
}
async function fonts(page) { await page.evaluate(async () => { await Promise.all([400, 700, 800].map(weight => document.fonts.load(`${weight} 16px "Shop Auth DM Sans"`))); await document.fonts.ready; }); }
try {
  for (const width of [360, 393, 430, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 852 } });
    await page.route('**/ecommerce/**', mock);
    await page.goto('http://127.0.0.1:5177/#/marketplace', { waitUntil: 'domcontentloaded' });
    await page.locator('.home-shop-card').first().waitFor(); await fonts(page);
    await page.evaluate(() => Promise.all([...document.querySelectorAll('.home-section:first-of-type img')].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); }))));
    await page.screenshot({ path: `${output}/home-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const nav = page.locator(width > 760 ? '.desktop-navigation' : '.mobile-navigation');
    assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Home', 'Cart', 'Orders', 'Chats', 'Me']);
    await page.getByRole('button', { name: 'Change language' }).click();
    await page.screenshot({ path: `${output}/home-my-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.language').click();
    results.push({ width, english: 'pass', myanmar: 'pass', destinations: 'pass' });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.route('**/ecommerce/**', mock);
  await page.goto('http://127.0.0.1:5177/#/marketplace', { waitUntil: 'domcontentloaded' });
  await page.locator('.home-shop-card').first().waitFor();
  const nav = page.locator('.mobile-navigation'), search = page.locator('.marketplace-home:visible .home-search input');
  await page.evaluate(() => { window.__homeOriginal = document.querySelector('.home-search input'); });
  await search.fill('Retained draft');
  const initialLoads = () => calls.filter(path => path.startsWith('/marketplace/products?') && path.includes('offset=0') && !path.includes('on_sale=1')).length;
  const loads = initialLoads();
  await page.getByRole('button', { name: 'Add to cart: Fresh Apples', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Added to cart' }).waitFor();
  assert.equal(await nav.getByRole('link', { name: 'Cart', exact: false }).locator('b').innerText(), '1');
  await nav.getByRole('link', { name: 'Cart', exact: false }).click();
  await page.getByRole('heading', { name: 'Your cart', exact: true }).waitFor();
  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  assert.equal(await search.inputValue(), 'Retained draft');
  assert.equal(await page.evaluate(() => window.__homeOriginal === document.querySelector('.home-search input')), true);
  assert.equal(initialLoads(), loads);
  await page.locator('.home-section').first().getByRole('link').filter({ hasText: 'Fresh Apples' }).click();
  await page.getByRole('heading', { name: 'Fresh Apples', exact: true }).waitFor();
  await page.locator('.shopping-header-back').click();
  await search.waitFor(); assert.equal(await search.inputValue(), 'Retained draft'); assert.equal(initialLoads(), loads);
  await page.goForward(); await page.getByRole('heading', { name: 'Fresh Apples', exact: true }).waitFor();
  await page.goBack(); await search.waitFor(); assert.equal(initialLoads(), loads);
  await page.getByRole('button', { name: 'Add to cart: Handmade Mug', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2')).find(cart => cart.slug === 'demo-shop').items.find(item => item.id === 2).quantity), .375);
  assert.equal(await page.getByRole('button', { name: 'Add to cart: Handmade Mug', exact: true }).isDisabled(), true);

  await page.getByRole('button', { name: 'Add to cart: Sports Shoes', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2')).map(cart => cart.slug)), ['demo-shop', 'move-on']);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Food & Drinks', exact: true }).click();
  await page.locator('.home-selected-category').waitFor();
  assert.ok(calls.some(path => path.includes('category=Food%20%26%20Drinks')));
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('In stock only').check();
  await Promise.all([page.waitForResponse(response => response.url().includes('in_stock=1')), page.getByRole('button', { name: 'Apply filters' }).click()]);
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await Promise.all([page.waitForResponse(response => response.url().includes('on_sale=1') && response.url().includes('offset=0')), page.locator('.home-section').filter({ has: page.getByRole('heading', { name: 'Special Deals' }) }).getByRole('button', { name: 'See all', exact: true }).click()]);
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await page.getByRole('button', { name: 'Shops', exact: true }).click(); await page.locator('.home-shop-grid .home-shop-card').first().waitFor();
  await page.screenshot({ path: `${output}/shops-mobile.png` });
  await page.locator('.home-shop-grid .home-shop-card').first().click(); await page.getByRole('heading', { name: 'Demo Shop', exact: true }).waitFor();
  await page.locator('.shopping-header-back').click(); await page.locator('.home-shop-grid .home-shop-card').first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Shops', exact: true }).getAttribute('aria-pressed'), 'true');
  await nav.getByRole('link', { name: 'Orders', exact: true }).click(); assert.match(page.url(), /orders\/track/);
  await nav.getByRole('link', { name: 'Chats', exact: true }).click(); await page.getByRole('heading', { name: 'Chats', exact: true }).waitFor();
  await nav.getByRole('link', { name: 'Me', exact: true }).click(); await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.equal(await page.locator('.mobile-navigation').count(), 0);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('heading', { name: 'Chats', exact: true }).waitFor();
  await nav.getByRole('link', { name: 'Home', exact: true }).click(); await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await search.fill('offline'); await search.press('Enter'); await page.getByRole('alert').waitFor();
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('alert').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await page.locator('.marketplace-home:visible .list-end').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('.home-product-tile').length >= 40);
  await page.screenshot({ path: `${output}/home-loaded.png`, fullPage: true });
  const lastProduct = page.locator('.marketplace-home:visible .home-product-tile').last().getByRole('link');
  await lastProduct.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => scrollY), loadedBefore = await page.locator('.marketplace-home:visible .home-product-tile').count(), loadsBefore = initialLoads();
  await lastProduct.click(); await page.getByRole('heading', { name: 'Sports Shoes 36', exact: true }).waitFor();
  await page.locator('.shopping-header-back').click(); await search.waitFor();
  assert.equal(await page.locator('.marketplace-home:visible .home-product-tile').count(), loadedBefore);
  assert.equal(initialLoads(), loadsBefore);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 3);
  await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  for (const name of ['Shop Now', 'More']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  }
  for (const title of ['Featured Products', 'Local Shops']) {
    await page.locator('.home-section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).getByRole('button', { name: 'See all', exact: true }).click();
    await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  }
  await page.locator('.marketplace-home:visible .favorite-button').first().click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.match(page.url(), /next=%2Fmarketplace/);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await search.waitFor();
  await page.getByRole('link', { name: 'Updates', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.match(page.url(), /next=%2Faccount%2Fnotifications/);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await search.waitFor();
  await page.locator('.marketplace-home:visible .home-tools').getByRole('link', { name: 'Favorites', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor(); assert.equal(await page.locator('.mobile-navigation').count(), 0);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await search.waitFor();
  await page.locator('.marketplace-home:visible .home-tools').getByRole('link', { name: 'Recently viewed', exact: true }).click();
  await page.getByRole('heading', { name: 'Recently viewed', exact: true }).waitFor();
  await page.locator('.shopping-header-back').click(); await search.waitFor();
  assert.equal(await page.locator('.marketplace-home:visible .home-product-tile').count(), loadedBefore);
  for (const width of [393, 1366]) {
    const realPage = await browser.newPage({ viewport: { width, height: 852 } });
    await realPage.goto('http://127.0.0.1:5177/#/marketplace', { waitUntil: 'domcontentloaded' });
    await realPage.locator('.home-product-tile').first().waitFor(); await fonts(realPage);
    await realPage.evaluate(() => Promise.all([...document.querySelectorAll('.home-hero img, .home-section:first-of-type img')].map(image => image.decode().catch(() => {}))));
    await realPage.screenshot({ path: `${output}/home-local-${width}.png` });
    await realPage.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ viewports: results, controls: 'pass', retention: 'pass', pagination: 'pass' }, null, 2));
  console.log('PASS: responsive bilingual home; five destinations; quick add; category/filter/deal/shop actions; failure/retry; retained tab/search/loaded lists; app-bar/browser Back/Forward; endless pagination. Data and writes intercepted.');
} finally { await browser.close(); }
