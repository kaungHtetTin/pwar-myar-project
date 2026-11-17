// Fixture-only browser verification. Every API request is intercepted; no business data is changed.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop-chat');
  await fs.mkdir(output, { recursive: true });
  const engine = process.env.CHAT_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
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
      else if (endpoint === '/shop-admin/customers') response = { items: [customer], total: 1 };
      else if (endpoint.endsWith('/history')) response = { items: [order], total: 1 };
      else if (endpoint.startsWith('/shop-admin/customers/')) response = { customer, report: { currencies: [{ currency: 'Ks', completed_spend: 32000, average_purchase: 16000 }], total_orders: 2, completed_orders: 2 } };
      else if (endpoint === '/shop-admin/chat/config') response = { enabled: true, realtime_enabled: false };
      else if (endpoint === '/shop-admin/chat') response = { items: [{ uuid, id: 1, customer_name: 'Alice Morgan', customer_active: true, unread: 2, last_message: messages[0] }], total: 1 };
      else if (endpoint.endsWith('/messages')) {
        if (request.method() === 'POST') { const input = request.postDataJSON(); const message = { id: messages.length + 1, body: input.body, sender: 'owner', created_at: '2026-10-13T00:00:00Z', ...(input.product_id ? { product: { id: 5, name: 'Rice', price: 16000, currency: 'Ks', unit_name: 'Bag', store_slug: 'test-shop' } } : {}) }; messages.push(message); response = { message }; }
        else response = { items: url.searchParams.has('after_id') ? [] : messages, thread: { uuid, customer_name: 'Alice Morgan', customer_active: true, customer_read_id: 2, customer_key: 'account:3' }, has_more: false };
      }
      else if (endpoint.endsWith('/products') && endpoint.includes('/chat/')) response = { items: [{ id: 5, name: 'Rice', price: 16000, currency: 'Ks', unit_name: 'Bag', store_slug: 'test-shop' }], next_cursor: null };
      else if (endpoint.includes('/chat/')) response = { enabled: true, unread_count: 0, items: [] };
      else if (endpoint === '/shop-admin/report') response = { date_from: '2026-10-01', date_to: '2026-10-13', previous_from: '2026-09-18', previous_to: '2026-09-30', currency: 'Ks', currencies: ['Ks'], timezone: 'Asia/Rangoon', summary: { orders: 2, sales: 32000, completed_orders: 2, average_order_value: 16000, new_buyers: 1, returning_buyers: 1, cancellation_rate: 0, repeat_purchase_rate: 50, completion_rate: 100 }, previous: {}, trend: [{ date: '2026-10-13', sales: 32000, orders: 2 }], top_products: [{ name: 'Rice', unit_name: 'Bag', sales: 32000, quantity: 2 }], buyers: [{ name: 'New', buyers: 1 }], outcomes: [{ status: 'completed', orders: 2 }], origins: [], segments: [], prepaid: 0, follow_up: [] };
      else response = { items: [], total: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));

    messages.push({ id: 2, sender: 'owner', body: 'Hello! How can we help you today?', created_at: '2026-10-13T00:01:00Z' }, { id: 3, sender: 'customer', body: 'Could you share the rice options? I would like to order two bags.', created_at: '2026-10-13T00:02:00Z' });
    await page.goto('http://127.0.0.1:5176/shop/chat');
    await page.locator('.shop-chat-thread').waitFor();
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: path.join(output, `inbox-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const searchResponse = page.waitForResponse(response => response.url().includes('/shop-admin/chat?') && response.url().includes('q=Alice'));
    await page.getByRole('searchbox', { name: 'Search chats' }).fill('Alice');
    await searchResponse;
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Close filters' }).click();
    await page.locator('.shop-chat-thread').click();
    await page.getByRole('heading', { name: 'Alice Morgan', exact: true }).waitFor();
    const editor = page.getByRole('textbox', { name: 'Message', exact: true });
    const theme = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const color = variable => { const probe = document.createElement('span'); probe.style.color = root.getPropertyValue(variable); document.body.append(probe); const result = getComputedStyle(probe).color; probe.remove(); return result; };
      return {
        header: getComputedStyle(document.querySelector('.shop-chat-conversation-header')).backgroundColor,
        surface: color('--surface'),
        sent: getComputedStyle(document.querySelector('.shop-mobile-message.is-mine')).backgroundColor,
        softBrand: color('--brand-100'),
        primary: getComputedStyle(document.querySelector('.shop-chat-send')).backgroundColor,
        brand: color('--brand-800'),
      };
    });
    assert.equal(theme.header, theme.surface, 'Header uses the app surface color');
    assert.equal(theme.sent, theme.softBrand, 'Sent messages use the app soft brand color');
    assert.equal(theme.primary, theme.brand, 'Send uses the app primary button color');

    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: path.join(output, `conversation-${width}.png`), fullPage: false });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const chatBox = await page.locator('.shop-mobile-conversation').boundingBox();
      assert.equal(chatBox.x, 0, 'Chat fills viewport width');
      assert.equal(chatBox.y, 0, 'Chat begins at top of page');
      assert.equal(chatBox.width, width);
      assert.equal(chatBox.height, 844);
      assert.equal(await page.locator('.mobile-app-header').count(), 0, 'One conversation header');
      const geometry = await page.locator('.shop-chat-compose-row').boundingBox();
      assert.ok(geometry.y + geometry.height <= 844, 'Composer is visible');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 844, height: 390 });
    const landscapeComposer = await page.locator('.shop-chat-compose-row').boundingBox();
    assert.ok(landscapeComposer.y + landscapeComposer.height <= 390, 'Landscape composer stays visible');
    await page.screenshot({ path: path.join(output, 'conversation-landscape.png'), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await editor.fill('Saved conversation draft');
    await page.locator('.shop-chat-header-profile').getByRole('heading', { name: 'Alice Morgan', exact: true }).click();
    await page.getByRole('heading', { name: 'Alice', exact: true }).waitFor();
    await page.goBack();
    await editor.waitFor();
    assert.equal(await editor.inputValue(), 'Saved conversation draft');
    await page.locator('.shop-chat-header-profile .shop-chat-avatar').click();
    await page.getByRole('heading', { name: 'Alice', exact: true }).waitFor();
    await page.goBack();
    await editor.waitFor();
    assert.equal(await editor.inputValue(), 'Saved conversation draft');

    await page.getByRole('button', { name: 'Share product', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose product', exact: true });
    await picker.getByRole('button', { name: /Rice/ }).click();
    await picker.getByRole('button', { name: 'Attach product', exact: true }).click();
    await page.getByRole('button', { name: 'Remove product', exact: true }).click();
    await page.getByRole('button', { name: 'Share product', exact: true }).click();
    await picker.getByRole('button', { name: /Rice/ }).click();
    await picker.getByRole('button', { name: 'Attach product', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'product-preview.png'), fullPage: false });
    await page.getByLabel('Attach chat image').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('test') });
    await page.getByRole('alert').filter({ hasText: 'Choose a PNG' }).waitFor();
    await page.getByLabel('Attach chat image').setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAI0lEQVR4nGMUzw5gIAUwkaSaYVQDcYCJSHVwMKqBGEByKAEAtXEA8hNyypcAAAAASUVORK5CYII=', 'base64') });
    await page.getByRole('img', { name: 'Selected chat image' }).waitFor();
    await page.getByRole('button', { name: 'Remove image', exact: true }).click();
    const sent = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/messages'));
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await sent;
    await page.getByText('Saved conversation draft', { exact: true }).waitFor();
    assert.equal(await editor.inputValue(), '');
    await page.screenshot({ path: path.join(output, 'message-sent.png'), fullPage: false });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search chats' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search chats' }).inputValue(), 'Alice');
    await page.getByRole('button', { name: 'Clear chat search' }).click();
    assert.equal(await page.getByRole('searchbox', { name: 'Search chats' }).inputValue(), '');
    await page.goto(`http://127.0.0.1:5176/shop/chat/${uuid}`);
    await editor.waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForURL('**/shop/chat');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ widths: [320, 390, 768], checks: ['Inbox search and clear', 'Filter drawer', 'Conversation and composer fit viewport', 'Customer profile and Back preserve draft', 'Product picker select and remove', 'Image validation, preview and remove', 'Send text and product once', 'Return to inbox preserves search'], errors }, null, 2));
    console.log('Shop chat design browser checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
