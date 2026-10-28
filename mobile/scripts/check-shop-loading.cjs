// Fixture-only browser verification. Every API request is intercepted; no business data is changed.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop-loading');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 362, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('Browser error:', message.text()); });
    const session = { user: { id: 1, name: 'Test Owner', role: 'owner' }, business: { id: 1, name: 'Test Shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process', 'ecommerce_payments', 'ecommerce_refunds', 'ecommerce_catalog', 'ecommerce_settings'], subscription: { is_valid: true } };
    let order = { id: 8, reference: 'SHOP-8', customer_name: 'Alice', phone: '091234', address: 'Test address', status: 'pending', fulfillment: 'pickup', payment_status: 'unpaid', total: 32000, currency: 'Ks', created_at: '2026-10-13 08:00:00', payment_method: { name: 'Cash', provider: 'manual' }, items: [{ product_id: 5, name: 'Rice', quantity: 2, unit_name: 'Bag', unit_price: 16000, line_total: 32000 }], payments: [], events: [], customer_requests: [] };
    const product = { id: 5, name: 'Rice', base_unit: 'Bag', purchase_unit: 'Box', purchase_conversion_factor: 2, base_price: 16000, purchase_price: 32000, currency: 'Ks', price_type: 'Retail', stock: 12, unit: 'base', published: false };
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const customer = { id: 'account:3', customer_key: 'account:3', customer_name: 'Alice', account_type: 'account', phone: '091234', email: 'alice@example.com', purchase_count: 2, blocked: false };
    const review = { id: 2, customer_name: 'Alice', rating: 5, comment: 'Great service', reply: '' };
    const promotion = { id: 7, name: 'Summer', code: 'SAVE10', type: 'coupon', discount_type: 'percentage', discount_value: 10, minimum_subtotal: 0, usage_limit: null, enabled: true, status: 'active', used_count: 0 };
    const messages = [{ id: 1, body: 'Hello shop', sender: 'customer', created_at: '2026-10-13T00:00:00Z' }];
    const settings = { slug: 'test-shop', display_name: 'Test Shop', currency: 'Ks', phone: '091234', address: 'Yangon', description: 'Test shop description', price_type: 'Retail', price_types: ['Retail'], storefront_enabled: true, accepting_orders: true, marketplace_enabled: true, delivery_zones: [], opening_hours: [], closed_until: null, pickup_instructions: 'Collect at counter', timezone: 'Asia/Rangoon' };
    const held = new Set(), pending = new Map();
    await page.route('http://127.0.0.1:5176/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^.*\/api/, '');
      calls.push({ endpoint, method: request.method(), query: url.search });
      if (held.has(endpoint)) await new Promise(resolve => pending.set(endpoint, resolve));
      let response;
      if (endpoint === '/auth/me') response = session;
      else if (endpoint === '/app-config') response = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en', business: {} };
      else if (endpoint === '/shop-admin/owner-location') response = { submitted: true };
      else if (endpoint === '/shop-admin/orders') response = { items: [order], total: 1 };
      else if (endpoint === '/shop-admin/orders/8') response = order;
      else if (endpoint === '/shop-admin/orders/8/payments/confirm') {
        const input = request.postDataJSON(); assert.equal(input.amount, 32000); assert.equal(input.verified, true);
        order = { ...order, payment_status: 'paid' }; response = order;
      }
      else if (endpoint === '/shop-admin/orders/8/transition') { order = { ...order, status: request.postDataJSON().status }; response = order; }
      else if (endpoint === '/shop-admin/publications/filters') response = { categories: ['Food'] };
      else if (endpoint === '/shop-admin/publications') response = { items: [product], total: 1, published_count: 0 };
      else if (endpoint === '/shop-admin/publications/5') response = product;
      else if (endpoint === '/shop-admin/payment-methods') response = { items: [{ id: 'cash', name: 'Cash', type: 'cash', instructions: 'Pay on pickup', is_active: true, provider: 'manual' }] };
      else if (endpoint === '/shop-admin/contacts' || endpoint === '/shop-admin/delivery-zones') response = { items: [] };
      else if (endpoint === '/shop-admin/settings') response = settings;
      else if (endpoint === '/shop-admin/promotions') response = { items: [promotion], total: 1, timezone: 'Asia/Rangoon' };
      else if (endpoint === '/shop-admin/promotions/7') response = { promotion, timezone: 'Asia/Rangoon' };
      else if (endpoint === '/shop-admin/reviews') response = { items: [review], total: 1 };
      else if (endpoint === '/shop-admin/reviews/2') response = review;
      else if (endpoint === '/shop-admin/customers') response = { items: [customer], total: 1 };
      else if (endpoint.endsWith('/history')) response = { items: [order], total: 1 };
      else if (endpoint.startsWith('/shop-admin/customers/')) response = { customer, report: { currencies: [{ currency: 'Ks', completed_spend: 32000, average_purchase: 16000 }], total_orders: 2, completed_orders: 2 } };
      else if (endpoint === '/shop-admin/chat/config') response = { enabled: true, realtime_enabled: false };
      else if (endpoint === '/shop-admin/chat') response = { items: [{ uuid, id: 1, customer_name: 'Alice', unread: 1, last_message: messages[0] }], total: 1 };
      else if (endpoint.endsWith('/messages')) {
        if (request.method() === 'POST') { const input = request.postDataJSON(); const message = { id: messages.length + 1, body: input.body, sender: 'owner', created_at: '2026-10-13T00:00:00Z' }; messages.push(message); response = { message }; }
        else response = { items: url.searchParams.has('after_id') ? [] : messages, thread: { uuid, customer_name: 'Alice', customer_key: 'account:3' }, has_more: false };
      }
      else if (endpoint.endsWith('/products') && endpoint.includes('/chat/')) response = { items: [{ id: 5, name: 'Rice', price: 16000, currency: 'Ks', unit_name: 'Bag', store_slug: 'test-shop' }], next_cursor: null };
      else if (endpoint.includes('/chat/')) response = { enabled: true, unread_count: 0, items: [] };
      else if (endpoint === '/shop-admin/report') response = { date_from: '2026-10-01', date_to: '2026-10-13', previous_from: '2026-09-18', previous_to: '2026-09-30', currency: 'Ks', currencies: ['Ks'], timezone: 'Asia/Rangoon', summary: { orders: 2, sales: 32000, completed_orders: 2, average_order_value: 16000, new_buyers: 1, returning_buyers: 1, cancellation_rate: 0, repeat_purchase_rate: 50, completion_rate: 100 }, previous: {}, trend: [{ date: '2026-10-13', sales: 32000, orders: 2 }], top_products: [{ name: 'Rice', unit_name: 'Bag', sales: 32000, quantity: 2 }], buyers: [{ name: 'New', buyers: 1 }], outcomes: [{ status: 'completed', orders: 2 }], origins: [], segments: [], prepaid: 0, follow_up: [] };
      else response = { items: [], total: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));

    const checks = [
      ['/shop/orders', '/shop-admin/orders', 'Loading orders\u2026'],
      ['/shop/customers', '/shop-admin/customers', 'Loading customers\u2026'],
      ['/shop/catalog', '/shop-admin/publications', 'Loading products\u2026'],
      ['/shop/promotions', '/shop-admin/promotions', 'Loading promotions\u2026'],
      ['/shop/reviews', '/shop-admin/reviews', 'Loading reviews\u2026'],
      ['/shop/orders/8', '/shop-admin/orders/8', 'Loading\u2026'],
      ['/shop/customers/account%3A3', '/shop-admin/customers/account%3A3', 'Loading\u2026'],
      ['/shop/methods', '/shop-admin/payment-methods', 'Loading\u2026'],
      ['/shop/chat', '/shop-admin/chat', 'Loading conversations\u2026'],
    ];
    for (const [target, endpoint, label] of checks) {
      held.add(endpoint);
      await page.goto(`http://127.0.0.1:5176${target}`);
      const status = page.locator('main .shop-loading:visible').first();
      await status.waitFor();
      for (const width of [320, 362]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator('.swipe-refresh-content').evaluate(element => parseFloat(getComputedStyle(element).paddingTop)), 12, `${target}: loading receives the shared top gap`);
        assert.equal(await status.evaluate(element => parseFloat(getComputedStyle(element.closest('main')).paddingTop)), 0, `${target}: no duplicate loading padding`);
        assert.ok(await status.evaluate(element => element.getBoundingClientRect().top - document.querySelector('.shared-app-bar').getBoundingClientRect().bottom >= 12), `${target}: skeleton clears the app bar`);
        await page.screenshot({ path: path.join(output, `${target.slice(1).replaceAll('/', '-')}-${width}.png`), fullPage: false, animations: 'disabled' });
      }
      assert.equal(await status.getByRole('button').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${target}: no loading overflow`);
      await page.screenshot({ path: path.join(output, `${target.slice(1).replaceAll('/', '-')}.png`), fullPage: false, animations: 'disabled' });
      held.delete(endpoint);
      pending.get(endpoint)?.(); pending.delete(endpoint);
      await status.waitFor({ state: 'hidden' });
      console.log(`PASS ${target}`);
    }
    if (process.argv.includes('--spacing-only')) {
      assert.deepEqual(errors, []);
      console.log('Loading spacing checks passed for 9 routes at 320px and 362px.');
      return;
    }
    await page.goto('http://127.0.0.1:5176/shop/orders/8');
    await page.getByRole('heading', { name: 'SHOP-8', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Approve full payment', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Approve full payment', exact: true });
    await dialog.getByRole('checkbox').check();
    const endpoint = '/shop-admin/orders/8/payments/confirm';
    held.add(endpoint);
    await dialog.getByRole('button', { name: 'Approve full payment', exact: true }).click();
    const saving = dialog.getByRole('button', { name: 'Saving\u2026', exact: true });
    await saving.waitFor();
    assert.equal(await saving.isDisabled(), true);
    await page.screenshot({ path: path.join(output, 'saving-payment.png'), fullPage: false, animations: 'disabled' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await saving.locator('svg').evaluate(element => getComputedStyle(element).animationName), 'none');
    held.delete(endpoint); pending.get(endpoint)?.(); pending.delete(endpoint);
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ loadingRoutes: checks.map(([route]) => route), checks: ['Accessible status labels', 'No fake controls', 'No horizontal overflow', 'Saving spinner and disabled submit', 'Reduced motion', 'Content appears after release'], errors }, null, 2));
    console.log('Shop loading browser checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
