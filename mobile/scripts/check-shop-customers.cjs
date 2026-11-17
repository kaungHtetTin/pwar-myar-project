// Fixture-only browser verification. Every API request is intercepted; no business data is changed.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop-customers');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
    await page.route('http://127.0.0.1:5176/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^.*\/api/, '');
      calls.push({ endpoint, method: request.method(), query: url.search });
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
      else if (endpoint === '/shop-admin/customers') {
        const rows = [customer, { ...customer, id: 'guest:4', customer_key: 'guest:4', customer_name: 'Mya Win', account_type: 'guest', email: '', blocked: true, purchase_count: 4 }, { ...customer, id: 'account:5', customer_key: 'account:5', customer_name: 'Kyaw Naing', email: 'kyaw@example.com', purchase_count: 1 }];
        const items = rows.filter(row => (!url.searchParams.get('q') || row.customer_name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (url.searchParams.get('account') === 'all' || row.account_type === url.searchParams.get('account')) && (url.searchParams.get('block_status') === 'all' || row.blocked === (url.searchParams.get('block_status') === 'blocked')));
        response = { items, total: items.length };
      }
      else if (endpoint.endsWith('/history')) response = { items: [order], total: 1 };
      else if (endpoint.endsWith('/chat') && endpoint.startsWith('/shop-admin/customers/')) response = { thread: { uuid } };
      else if (endpoint.startsWith('/shop-admin/customers/')) response = { customer, report: { currencies: [{ currency: 'Ks', completed_spend: 32000, average_purchase: 16000 }], total_orders: 5, completed_orders: 2, active_orders: 1, cancelled_orders: 1, expired_orders: 1, first_purchase_at: '2026-09-10 08:00:00', last_purchase_at: '2026-10-13 08:00:00' } };
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



    Object.assign(customer, { customer_name: 'Alice Morgan', phone: '09 123 456 789', purchase_count: 12, last_purchase_at: '2026-10-13 08:00:00' });
    await page.goto('http://127.0.0.1:5176/shop/customers');
    const alice = page.getByRole('button', { name: 'View customer Alice Morgan', exact: true });
    await alice.waitFor();
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: path.join(output, `customers-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no horizontal overflow`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await alice.locator('button').count(), 0, 'Card has no nested controls');
    const historyLength = await page.evaluate(() => history.length);
    await alice.getByText('Alice Morgan', { exact: true }).click();
    await page.waitForURL('**/shop/customers/account%3A3');
    assert.equal(await page.evaluate(() => history.length), historyLength + 1, 'One click opens once');
    await page.goBack();
    await alice.waitFor();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
    await dialog.getByRole('radio', { name: 'Guest', exact: true }).check();
    await dialog.getByRole('radio', { name: 'Blocked', exact: true }).check();
    const applied = page.waitForResponse(response => response.url().includes('/shop-admin/customers?') && response.url().includes('account=guest') && response.url().includes('block_status=blocked'));
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await applied;
    const mya = page.getByRole('button', { name: 'View customer Mya Win', exact: true });
    await mya.waitFor();
    assert.equal(await page.locator('.shop-customer-list-card').count(), 1);
    const trigger = page.getByRole('button', { name: 'Filters, 2 active filters', exact: true });
    await trigger.click();
    const reset = page.waitForResponse(response => response.url().includes('/shop-admin/customers?') && response.url().includes('account=all'));
    await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await reset;
    await alice.waitFor();
    const emptyResponse = page.waitForResponse(response => response.url().includes('/shop-admin/customers?') && response.url().includes('q=nobody'));
    await page.getByRole('searchbox', { name: 'Search shop customers', exact: true }).fill('nobody');
    await emptyResponse;
    await page.getByRole('heading', { name: 'No customers found', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'customers-empty.png'), fullPage: true });
    await page.getByRole('button', { name: 'Clear customer search', exact: true }).click();
    await alice.waitFor();
    await alice.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/shop/customers/account%3A3');
    await page.goBack();
    await alice.waitFor();
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ widths: [320, 390, 768], checks: ['Account and guest cards', 'Blocked customer styling', 'Single-click and keyboard navigation', 'Account and block filter Apply and Reset', 'Active filter counts', 'Empty search and Clear search', 'Back resumes customer list'], errors }, null, 2));
    console.log('Shop customer index browser checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
