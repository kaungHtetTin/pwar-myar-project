// Uses the real public-shop shell with intercepted APIs; creates no live orders.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const uuid = '12345678-1234-1234-1234-123456789abc';
const item = { product_id: 1, name: 'Soap / ဆပ်ပြာ အရည်အသွေးကောင်း', quantity: 2, unit_name: 'Unit', unit_price: 100, line_total: 200 };
const product = { id: 1, name: item.name, price: 100, currency: 'MMK', unit_name: 'Unit', available_quantity: 20, store_slug: 'demo', description: 'Published shop product' };
const thread = { uuid, shop_name: 'Demo shop', slug: 'demo', sales_ai: { enabled: true, name: 'Mia', mode: 'ai', version: 1 } };
const initial = { id: 'proposal', kind: 'checkout', status: 'pending', revision: 1, preview_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z', values: { items: [{ product_id: 1, quantity: 2 }] }, preview: { items: [item], subtotal: 200, currency: 'MMK', ready: false }, options: { delivery_zones: [{ id: 'town', name: 'Town', fee: 500 }], payment_methods: [{ id: 'cash', name: 'Cash' }] } };
(async () => {
 const browser = await chromium.launch(); await fs.mkdir('artifacts/sales-representative-ui', { recursive: true });
 try { for (const width of [393, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const calls = [], errors = []; let action = structuredClone(initial), failQuote = true, replyReady = false;
  await page.clock.install();
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('mkpos.shop.customerToken', 'fixture'); localStorage.setItem('mkpos.shop.language', 'en'); });
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname; calls.push({ path, method: req.method() });
    let json = { items: [], has_more: false, enabled: false, realtime_enabled: false };
    if (path.endsWith('/customer/me')) json = { customer: { id: 1, name: 'Buyer', email: 'buyer@example.test' } };
    else if (path.includes('/sales-actions/')) {
      if (path.endsWith('/review')) {
        if (failQuote) { failQuote = false; return route.fulfill({ status: 422, json: { message: 'Choose a valid delivery option.' } }); }
        const v = req.postDataJSON(); assert.equal(v.revision, action.revision);
        action = { ...action, values: v.values, revision: 2, preview_hash: 'b'.repeat(64), preview: { ...action.preview, total: 200, discount: 0, delivery_fee: 0, ready: true, payment_method: { name: 'Cash' } } };
      } else if (path.endsWith('/confirm')) { assert.equal(req.postDataJSON().confirmed, true); action = { ...action, status: 'completed', options: null, result: { order_created: true, reference: 'O-FIXTURE', total: 200 } }; }
      json = action;
    } else if (path.includes(`/chat/${uuid}`)) {
      const complete = action.status === 'completed';
      const items = [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Review the products and checkout.', created_at: '2026-10-25 10:00:00', sales_content: { products: [product] }, sales_actions: [{ id: action.id, kind: action.kind, status: action.status }] }];
      if (complete) items.push({ id: 2, sender: 'customer', body: 'Form activity: checkout submitted successfully.', action_event: { outcome: 'completed' }, created_at: '2026-10-26 10:00:00' });
      if (complete && replyReady) items.push({ id: 3, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'Your order O-FIXTURE is placed. Payment is awaiting shop verification.', created_at: '2026-10-26 10:01:00' });
      json = { thread: { ...thread, sales_ai: { ...thread.sales_ai, responding: complete && !replyReady } }, items, has_more: false };
    }
    else if (path.endsWith('/chat/config')) json = { enabled: true, realtime_enabled: false };
    else if (path.endsWith('/stores/demo/products/1')) json = { product, store: { name: 'Demo shop', slug: 'demo' } };
    else if (path.endsWith('/stores/demo')) json = { name: 'Demo shop', slug: 'demo' };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:5177/#/chats/${uuid}`);
  const card = page.getByRole('region', { name: 'Checkout', exact: true }).or(page.locator('section.sales-action-card[aria-label="Checkout"]'));
  await card.getByRole('button', { name: 'Review', exact: true }).click();
  await card.getByLabel('Customer name', { exact: true }).fill('Retained buyer');
  await card.getByLabel('Phone', { exact: true }).fill('099999999');
  await card.getByLabel('Fulfillment', { exact: true }).selectOption('pickup');
  await card.getByLabel('Payment method', { exact: true }).selectOption('cash');
  await page.getByLabel('Message', { exact: true }).fill('Retained chat draft');
  await card.getByRole('button', { name: 'Close review' }).click();
  await card.getByRole('button', { name: 'Review', exact: true }).click();
  assert.equal(await card.getByLabel('Customer name', { exact: true }).inputValue(), 'Retained buyer');
  assert.equal(calls.filter(c => c.path.endsWith('/sales-actions/proposal') && c.method === 'GET').length, 1);
  await page.getByRole('link', { name: `View product ${item.name}` }).click();
  await page.waitForURL('**/#/store/demo/products/1');
  await page.goBack(); await page.waitForURL(`**/#/chats/${uuid}`);
  assert.equal(await card.getByLabel('Customer name', { exact: true }).inputValue(), 'Retained buyer');
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Retained chat draft');
  await card.getByRole('button', { name: 'Calculate and review quote' }).click();
  await card.getByRole('alert').waitFor();
  const danger = await card.getByRole('alert').evaluate(el => getComputedStyle(el).color); assert.ok(danger);
  assert.equal(await card.getByLabel('Customer name', { exact: true }).inputValue(), 'Retained buyer');
  await card.screenshot({ path: `artifacts/sales-representative-ui/validation-${width}.png` });
  await card.getByRole('button', { name: 'Calculate and review quote' }).click();
  await card.getByRole('checkbox').check();
  await card.screenshot({ path: `artifacts/sales-representative-ui/checkout-${width}.png` });
  assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
  await card.getByRole('button', { name: 'Confirm order' }).click();
  await card.getByText('Order submitted. Payment is not verified.', { exact: true }).waitFor();
  assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
  assert.equal(await card.getByRole('link', { name: /View order/ }).getAttribute('href'), '#/orders/track?reference=O-FIXTURE');
  await page.getByRole('status', { name: 'AI is preparing a reply' }).waitFor();
  await page.getByText('Form activity: checkout submitted successfully.', { exact: true }).waitFor();
  replyReady = true; await page.clock.runFor(16000);
  await page.getByText('Your order O-FIXTURE is placed. Payment is awaiting shop verification.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Retained chat draft');
  assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
  await page.getByText('Your order O-FIXTURE is placed. Payment is awaiting shop verification.', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/sales-representative-ui/action-follow-up-${width}.png` });
  assert.deepEqual(errors, []); console.log(`${width}: checkout, validation, product Back, retained drafts and result-based AI follow-up passed`); await page.close();
 } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
