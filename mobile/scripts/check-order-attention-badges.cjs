// Synthetic order actions only: no live orders or payments are changed.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const { setDrawerLanguage } = require('./drawer-language.cjs');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176';
(async () => {
  const engine = process.env.BADGE_BROWSER || 'chromium', output = path.resolve(__dirname, `../artifacts/order-attention-badges/${engine}`);
  await fs.mkdir(output, { recursive: true });
  const browser = await ({ chromium, firefox })[engine].launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
    let count = 3, order = { id: 8, reference: 'ORDER-8', customer_name: 'Test Buyer', status: 'ready_for_pickup', payment_status: 'paid', fulfillment: 'pickup', payment_method: { provider: 'manual', name: 'Cash' }, total: 2000, currency: 'Ks', items: [], events: [], payments: [], customer_requests: [] };
    const calls = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/api/**`, async route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.slice(4);
      calls.push({ endpoint, method: req.method() });
      let json = { items: [], total: 0 };
      if (endpoint === '/auth/me') json = { user: { id: 111, role: 'owner', name: 'Owner' }, business: { id: 111, name: 'Test Shop' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process'], subscription: { is_valid: true } };
      else if (endpoint === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop', 'ecommerce_orders', 'ecommerce_process'] };
      else if (endpoint === '/shop-admin/owner-location') json = { submitted: true };
      else if (endpoint === '/shop-admin/order-notifications/config') json = { realtime_enabled: false };
      else if (endpoint === '/shop-admin/order-notifications') json = { cursor: 8, items: [], action_required_count: count };
      else if (endpoint === '/shop-admin/orders') json = { items: [order], total: 1 };
      else if (endpoint === '/shop-admin/orders/8') json = order;
      else if (endpoint === '/shop-admin/orders/8/transition') { assert.equal(req.postDataJSON().status, 'completed'); order = { ...order, status: 'completed' }; count = 2; json = order; }
      else if (endpoint.startsWith('/shop-admin/chat/')) json = { enabled: false };
      else assert.equal(req.method(), 'GET', `Unexpected mutation: ${endpoint}`);
      await route.fulfill({ json });
    });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.goto(`${origin}/shop`);
    await page.waitForFunction(() => document.querySelectorAll('.order-attention-badge').length === 2);
    const source = await page.locator('.shop-overview-group').first().elementHandle();
    await page.screenshot({ path: path.join(output, 'shop-375.png'), animations: 'disabled' });
    await page.getByRole('button', { name: /^Orders/ }).click();
    await page.getByRole('button', { name: 'View order ORDER-8', exact: true }).click();
    await page.getByRole('button', { name: 'Complete order', exact: true }).click();
    await page.getByRole('dialog', { name: 'Complete order', exact: true }).getByRole('button', { name: 'Complete order', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.bottom-nav-order-badge > span')?.textContent === '2');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForURL('**/shop/orders');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForURL('**/shop');
    assert.ok(await source.evaluate(node => node.isConnected));
    assert.deepEqual(await page.locator('.order-attention-badge > span:first-child').allTextContents(), ['2', '2']);
    count = 0; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => document.querySelectorAll('.order-attention-badge').length === 0);
    count = 123; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => document.querySelector('.bottom-nav-order-badge > span')?.textContent === '99+');
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 667 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `large-count-${width}.png`), animations: 'disabled' });
    }
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, 'myanmar-375.png'), animations: 'disabled' });
    assert.deepEqual(errors, []);
    assert.equal(calls.filter(call => call.method === 'POST' && call.endpoint.endsWith('/transition')).length, 1);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, engine, calls, bothBadges: true, updatedAfterAction: true, zeroHidden: true, largeCountCapped: true, sourceRetained: true }, null, 2));
    console.log(`${engine}: order attention badges passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
