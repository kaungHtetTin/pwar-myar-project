// Fixture-only browser verification. Every API request is intercepted; no business data is changed.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop-reviews');
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
      else if (endpoint === '/shop-admin/reviews') {
        const rows = [review, { id: 3, customer_name: 'Mya Win', rating: 3, target_id: 5, product_name: 'Rice', comment: 'Good quality. Please improve the packaging next time.', reply: 'Thank you for your feedback. We will take extra care with the next delivery.', created_at: '2026-10-12T09:00:00Z' }, { id: 4, customer_name: 'Kyaw Naing', rating: 4, comment: '', reply: '', created_at: '2026-10-11T09:00:00Z' }];
        const items = rows.filter(row => (!url.searchParams.get('q') || row.customer_name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('rating') || row.rating === Number(url.searchParams.get('rating'))));
        response = { items, total: items.length };
      }
      else if (endpoint === '/shop-admin/reviews/2/reply') { review.reply = request.postDataJSON().reply; response = review; }
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

    Object.assign(review, { created_at: '2026-10-13T08:00:00Z', comment: 'Lovely service and a smooth pickup. Thank you!' });
    await page.goto('http://127.0.0.1:5176/shop/reviews');
    await page.getByRole('button', { name: 'Reply to Alice', exact: true }).waitFor();
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: path.join(output, `reviews-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no horizontal overflow`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const filtered = page.waitForResponse(response => response.url().includes('/shop-admin/reviews?') && response.url().includes('q=Alice'));
    await page.getByRole('searchbox', { name: 'Search reviews', exact: true }).fill('Alice');
    await filtered;
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
    await dialog.getByLabel('From date', { exact: true }).fill('2026-10-15');
    await dialog.getByLabel('To date', { exact: true }).fill('2026-10-01');
    await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await dialog.getByRole('alert').waitFor();
    await dialog.getByLabel('From date', { exact: true }).fill('');
    await dialog.getByLabel('To date', { exact: true }).fill('');
    await dialog.getByLabel('Star rating', { exact: true }).selectOption('5');
    const applied = page.waitForResponse(response => response.url().includes('/shop-admin/reviews?') && response.url().includes('rating=5'));
    await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await applied;
    await page.getByRole('button', { name: 'Filters, 1 active filters', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reply to Alice', exact: true }).click();
    await page.getByRole('heading', { name: 'Reply to review', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Reply to Alice', exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search reviews' }).inputValue(), 'Alice');
    assert.equal(calls.filter(call => call.method === 'PUT').length, 0);
    await page.getByRole('button', { name: 'Reply to Alice', exact: true }).click();
    await page.getByLabel('Public reply').fill('Thank you for shopping with us!');
    await page.getByRole('button', { name: 'Save reply', exact: true }).click();
    await page.getByRole('button', { name: 'Edit reply to Alice', exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search reviews' }).inputValue(), 'Alice');
    assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
    await page.getByRole('button', { name: 'Clear review search' }).click();
    await page.getByRole('button', { name: /^Filters,/ }).click();
    await dialog.getByRole('button', { name: 'Reset' }).click();
    await dialog.getByRole('button', { name: 'Close filters' }).click();
    const empty = page.waitForResponse(response => response.url().includes('/shop-admin/reviews?') && response.url().includes('q=nobody'));
    await page.getByRole('searchbox', { name: 'Search reviews' }).fill('nobody');
    await empty;
    await page.getByRole('heading', { name: 'No reviews found' }).waitFor();
    await page.getByRole('button', { name: 'Clear review search' }).click();
    await page.getByRole('button', { name: 'Edit reply to Alice' }).waitFor();
    session.user.role = 'staff'; session.permissions = ['shop', 'ecommerce_orders'];
    await page.goto('http://127.0.0.1:5176/shop/reviews');
    await page.locator('.shop-review-card').first().waitFor();
    assert.equal(await page.locator('.shop-review-reply-action').count(), 0, 'Reply permission remains enforced');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ widths: [320, 390, 768], checks: ['Written, rating-only, product and replied cards', 'Search, clear and empty state', 'Filter Apply and Reset', 'Invalid dates keep drawer open', 'Reply Cancel preserves source search', 'Reply Save updates card once and preserves search', 'Read-only staff permissions'], errors }, null, 2));
    console.log('Shop reviews browser checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
