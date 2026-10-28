const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
 const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
 let reads = 0; const marks = []; const marked = new Set();
 const items = [{ id: 3, event: 'back_in_stock', created_at: '2026-10-13 14:30:00', payload: { store_name: 'Sunrise Store', name: 'Handmade Mug', slug: 'sunrise', product_id: 1 } }, { id: 2, event: 'dispatched', created_at: '2026-10-13 12:20:00', payload: { store_name: 'Demo Shop', reference: 'ORD-2026-1001' } }];
 const order = { reference: 'ORD-2026-1001', store_slug: 'demo', store_name: 'Demo Shop', status: 'dispatched', payment_status: 'paid', tracking_credential: 'fixture', items: [], subtotal: 1000, total: 1000, delivery_fee: 0, currency: 'K', payment_method: { type: 'cash' }, payment_reviews: [], customer_requests: [] };
 await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mkpos.shop.customerToken', 'fixture'); });
 await page.route('**/ecommerce/**', r => {
  const u = new URL(r.request().url());
  if (u.pathname.endsWith('/customer/me')) return r.fulfill({ json: { customer: { id: 1, name: 'Buyer' } } });
  if (u.pathname.endsWith('/notifications/read')) { const body = JSON.parse(r.request().postData()); marks.push(body); (body.ids || items.map(item => item.id)).forEach(id => marked.add(id)); return r.fulfill({ json: { read_through: 3 } }); }
  if (u.pathname.endsWith('/customer/notifications')) { if (u.searchParams.get('limit') !== '1') reads++; return r.fulfill({ json: { items, has_more: false, unread_count: items.filter(item => !marked.has(item.id)).length } }); }
  if (u.pathname.endsWith('/customer/orders/ORD-2026-1001')) return r.fulfill({ json: order });
  if (u.pathname.endsWith('/stores/sunrise/products/1')) return r.fulfill({ json: { id: 1, name: 'Handmade Mug', store_name: 'Sunrise Store', store_slug: 'sunrise', price: 1000, currency: 'K', available_quantity: 10, rating: { count: 0 } } });
  return r.fulfill({ json: { items: [], has_more: false } });
 });
 await page.goto('http://127.0.0.1:5177/#/account');
 await page.locator('.me-menu-row').filter({ hasText: 'Notifications' }).click();
 const product = page.locator('.update-card').filter({ hasText: 'Back in stock' });
 const dispatched = page.locator('.update-card').filter({ hasText: 'Order dispatched' });
 await product.waitFor(); const source = await page.locator('.updates-page').elementHandle(); const before = reads;
 fs.mkdirSync('test-artifacts/notifications', { recursive: true }); await page.screenshot({ path: 'test-artifacts/notifications/rendered.png' });
 await product.click({ position: { x: 20, y: 70 } }); await page.waitForURL('**/#/store/sunrise/products/1'); assert.deepEqual(marks, [{ ids: [3] }]);
 await page.getByRole('button', { name: 'Back', exact: true }).click(); await product.waitFor(); assert.equal(reads, before); assert.equal(await product.evaluate(el => el.classList.contains('is-unread')), false); assert.equal(await source.evaluate(el => el.isConnected), true);
 await dispatched.click({ position: { x: 20, y: 70 } }); await page.waitForURL('**/#/orders/track'); await page.getByRole('heading', { name: order.reference, exact: true }).waitFor(); assert.deepEqual(marks, [{ ids: [3] }, { ids: [2] }]);
 await page.getByRole('button', { name: 'Back', exact: true }).click(); await dispatched.waitFor(); assert.equal(reads, before);
 await dispatched.getByRole('button', { name: 'View order', exact: true }).press('Enter'); await page.waitForURL('**/#/orders/track'); await page.goBack(); await dispatched.waitFor(); assert.equal(reads, before);
 await page.goForward(); await page.getByRole('heading', { name: order.reference, exact: true }).waitFor(); await page.goBack(); await dispatched.waitFor(); assert.equal(reads, before);
 await page.getByRole('button', { name: 'Mark all read', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.update-card.is-unread').length === 0);
 for (const width of [360, 393, 440, 1366]) { await page.setViewportSize({ width, height: 852 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
 console.log('PASS: full notification item clicks, product/order destinations, one read mutation per click, keyboard activation, mark all read, app-bar/browser Back/Forward retain list without refetch, responsive layout.');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });