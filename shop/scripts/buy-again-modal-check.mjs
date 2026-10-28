import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await mkdir('test-artifacts/buy-again', { recursive: true });
const items = ['Drinking Water', 'Orange Juice', 'Toothpaste'].map((name, index) => ({ id: index + 1, name, price: [3500, 4000, 7500][index], currency: 'Ks', quantity: 2, previous_quantity: 2, unit_name: 'Piece', available_quantity: 20, store_slug: 'demo', photo_url: '/src/assets/home-local-groceries.webp' }));
const preview = { slug: 'demo', name: 'Demo Shop', origin: 'storefront', items, skipped: [] };
const order = { reference: 'ORDER-1', store_name: 'Demo Shop', store_slug: 'demo', status: 'packing', payment_status: 'paid', tracking_credential: 'fixture', items: [], subtotal: 30000, delivery_fee: 0, total: 30000, currency: 'K', payment_method: { type: 'cash', name: 'Cash' }, payment_reviews: [], customer_requests: [] };
try {
for (const width of [360, 440, 1366]) {
 const page = await browser.newPage({ viewport: { width, height: 956 } }); let empty = false;
 await page.addInitScript(() => { localStorage.setItem('mkpos.shop.customerToken', 'fixture'); sessionStorage.setItem('mkpos.shop.tracking', JSON.stringify({ reference: 'ORDER-1' })); sessionStorage.setItem('mkpos.shop.tracking.customer', '42'); localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([{ slug: 'demo', name: 'Demo Shop', origin: 'storefront', items: [{ id: 9, name: 'Existing item', price: 1000, currency: 'Ks', quantity: 1 }] }])); });
 await page.route('**/ecommerce/**', route => {
  const path = new URL(route.request().url()).pathname.split('/ecommerce')[1]; let data = { items: [], has_more: false, unread_count: 0 };
  if (path === '/customer/me') data = { customer: { id: 42, name: 'Buyer' } };
  if (path === '/customer/orders/ORDER-1') data = order;
  if (path.endsWith('/buy-again')) data = empty ? { ...preview, items: [], skipped: ['Drinking Water', 'Orange Juice', 'Toothpaste'] } : preview;
  if (path === '/stores/demo') data = { slug: 'demo', display_name: 'Demo Shop', accepting_orders: true, currency: 'K', categories: [], payment_methods: [], delivery_zones: [] };
  return route.fulfill({ json: data });
 });
 await page.goto('http://127.0.0.1:5177/#/orders/track');
 const launch = page.getByRole('button', { name: 'Buy again', exact: true }); await launch.click();
 const modal = page.getByRole('dialog', { name: 'Review your repeat order' }); await modal.waitFor();
 assert.equal(await modal.locator('.buy-again-item').count(), 3);
 assert.equal(await modal.locator('.buy-again-line-total').first().innerText(), 'K 7,000');
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
 await page.screenshot({ path: `test-artifacts/buy-again/modal-${width}.png` });
 await page.keyboard.press('Escape'); await modal.waitFor({ state: 'hidden' }); assert.equal(await launch.evaluate(el => document.activeElement === el), true);
 await launch.click(); await modal.waitFor(); assert.equal(await modal.getByRole('button', { name: 'Cancel', exact: true }).count(), 0); await modal.getByRole('button', { name: 'Close repeat order' }).click(); await modal.waitFor({ state: 'hidden' });
 await launch.click(); await modal.waitFor(); await modal.getByRole('button', { name: 'Close repeat order' }).click(); await modal.waitFor({ state: 'hidden' });
 await launch.click(); await modal.waitFor();
 page.once('dialog', dialog => dialog.dismiss()); await modal.getByRole('button', { name: 'Use these items in my cart' }).click(); assert.equal(await modal.isVisible(), true);
 page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: 'Use these items in my cart' }).click(); await page.waitForURL('**/#/cart/demo'); assert.equal(await modal.count(), 0);
 assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mkpos.shop.carts.v2'))[0].items.length), 3);
 await page.goBack(); await launch.waitFor(); empty = true; await launch.click(); await modal.waitFor(); assert.equal(await modal.getByRole('button', { name: 'Use these items in my cart' }).isDisabled(), true); assert.equal(await modal.getByRole('button', { name: 'Cancel', exact: true }).count(), 0); await modal.getByRole('button', { name: 'Close repeat order' }).click();
 console.log(`PASS ${width}: modal layout, line totals, Escape/focus, no Cancel button, Close, replacement cancellation, confirmed cart, empty preview`);
 await page.close();
}
const comparison = await browser.newPage({ viewport: { width: 920, height: 1010 } });
const before = (await readFile('C:/Users/Hp/Pictures/Screenshots/Screenshot (1865).png')).toString('base64');
const after = (await readFile('test-artifacts/buy-again/modal-440.png')).toString('base64');
await comparison.setContent(`<body style="margin:0;padding:10px;background:#e8eeec;display:flex;gap:20px;font:14px Arial"><div>Before: inline review (reference)<div style="width:440px;height:956px;position:relative;overflow:hidden"><img src="data:image/png;base64,${before}" style="position:absolute;width:2816px;max-width:none;left:-470.8px;top:-473.7px"></div></div><div>After: modal review (440px viewport)<img src="data:image/png;base64,${after}" style="display:block;width:440px"></div></body>`);
await comparison.screenshot({ path: 'test-artifacts/buy-again/comparison.png', fullPage: true });
} finally { await browser.close(); }