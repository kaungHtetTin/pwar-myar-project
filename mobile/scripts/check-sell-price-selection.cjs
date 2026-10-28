// Synthetic fixtures only: no live inventory, customers or sales are changed.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const { setDrawerLanguage } = require('./drawer-language.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176';
const session = { user: { id: 111, role: 'owner', name: 'Fixture Owner' }, business: { id: 111, name: 'Test Shop', currency: 'Ks' }, permissions: ['sell', 'products', 'shop'], subscription: { is_valid: true } };
const products = [
  { id: 1, name: 'Rice', price: 1000, prices: [{ name: 'Retail', price: 1000 }, { name: 'Wholesale', price: 800 }] },
  { id: 2, name: 'Green Tea', price: 700, prices: [{ name: 'Retail', price: 700 }, { name: 'Wholesale', price: 500 }] },
  { id: 3, name: 'Retail only', price: 600, prices: [{ name: 'Retail', price: 600 }] },
].map(product => ({ ...product, base_unit: 'Piece', cost: 400, stock: 50 }));
(async () => {
  const engine = process.env.SELL_BROWSER || 'chromium';
  const output = path.resolve(__dirname, `../artifacts/sell-price-selection/${engine}`);
  await fs.mkdir(output, { recursive: true });
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 362, height: 817 }, reducedMotion: 'reduce' });
  const calls = [], errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  try {
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4);
      calls.push({ endpoint, method: req.method(), body: req.method() === 'POST' ? req.postDataJSON() : null });
      let body = { items: [], total: 0 };
      if (endpoint === '/auth/me') body = session;
      else if (endpoint === '/app-config') body = { enabled_modules: ['sell', 'products', 'shop'], permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') body = { price_types: 'Retail,Wholesale,Credit', payment_methods: 'Cash', currency: 'Ks' };
      else if (endpoint === '/categories') body = [];
      else if (endpoint === '/products') body = { items: products, total: products.length };
      else if (/^\/products\/\d+$/.test(endpoint)) body = products.find(product => product.id === Number(endpoint.split('/').pop()));
      else if (endpoint === '/shop-admin/owner-location') body = { submitted: true };
      else if (endpoint === '/shop-admin/chat/notifications') body = { enabled: true, unread_count: 0, items: [] };
      else if (endpoint === '/sales' && req.method() === 'POST') body = { id: 77, receipt_no: 'FIXTURE-77' };
      else if (endpoint === '/sales/77/receipt') body = { sale: { id: 77, receipt_no: 'FIXTURE-77', total: 2100 }, html: '<p>Fixture receipt</p>' };
      else assert.ok(req.method() === 'GET' || endpoint === '/shop-admin/chat/presence', `Unexpected mutation: ${endpoint}`);
      await route.fulfill({ json: body });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    const selector = page.getByRole('combobox', { name: 'Price type', exact: true });
    const draft = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1:111:111')));
    for (const width of [320, 362, 375, 768].filter(width => !process.env.SELL_WIDTH || width === Number(process.env.SELL_WIDTH))) {
      await page.setViewportSize({ width, height: width === 375 ? 667 : 817 });
      await page.goto(`${origin}/sell`); await page.waitForLoadState('networkidle');
      await page.evaluate(() => sessionStorage.clear()); await page.reload();
      await selector.waitFor();
      const spacing = await page.evaluate(() => {
        const toolbar = document.querySelector('.retail-results-toolbar').getBoundingClientRect();
        const status = document.querySelector('.retail-connection-status').getBoundingClientRect();
        const product = document.querySelector('.sale-mobile-product').getBoundingClientRect();
        const field = document.querySelector('.retail-results-toolbar select').getBoundingClientRect();
        const count = document.querySelector('.retail-results-toolbar > span').getBoundingClientRect();
        return { above: toolbar.top - status.bottom, below: product.top - toolbar.bottom, left: count.left - product.left, right: field.right - product.right, aligned: Math.abs((count.top + count.bottom) / 2 - (field.top + field.bottom) / 2) };
      });
      assert.ok(spacing.above >= 8 && spacing.below >= 12 && Math.abs(spacing.left) < 1 && Math.abs(spacing.right) < 1 && spacing.aligned < 1, `Price selector spacing: ${JSON.stringify(spacing)}`);
      await page.screenshot({ path: path.join(output, `retail-selector-${width}.png`), animations: 'disabled' });
      await page.locator('.sale-mobile-product').first().click();
      await selector.selectOption('Wholesale');
      await page.locator('.retail-price-alert:visible').waitFor();
      assert.equal((await draft()).cart[0].unit_price, 800);
      await page.locator('.sale-mobile-product').nth(2).click();
      await page.getByText('Retail only has no usable Wholesale price.', { exact: true }).waitFor();
      assert.equal((await draft()).cart.length, 1);
      await page.getByRole('button', { name: 'Dismiss message', exact: true }).click();
      await page.locator('.sale-mobile-product').nth(1).click();
      await page.screenshot({ path: path.join(output, `products-${width}.png`), animations: 'disabled' });
      const source = await page.locator('.sale-product-grid').elementHandle();
      const reads = calls.filter(call => call.endpoint === '/products').length;
      await page.getByRole('button', { name: 'View cart', exact: true }).click();
      await page.getByRole('textbox', { name: 'Rice quantity', exact: true }).fill('2');
      await page.getByRole('textbox', { name: 'Rice free quantity', exact: true }).fill('1');
      assert.ok((await page.locator('.sale-cart-card').first().innerText()).includes('Wholesale'));
      await page.screenshot({ path: path.join(output, `cart-${width}.png`), animations: 'disabled' });
      await page.getByRole('button', { name: 'Back to products', exact: true }).click();
      await selector.waitFor();
      assert.equal(await selector.inputValue(), 'Wholesale');
      assert.ok(await source.evaluate(node => node.isConnected));
      assert.equal(calls.filter(call => call.endpoint === '/products').length, reads);
      await selector.selectOption('Retail');
      await page.waitForFunction(() => ![...document.querySelectorAll('.retail-price-alert')].some(node => node.getClientRects().length));
      assert.deepEqual((await draft()).cart.map(item => item.unit_price), [1000, 700]);
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByRole('radio', { name: 'Wholesale', exact: true }).check();
      await page.keyboard.press('Escape');
      assert.equal(await selector.inputValue(), 'Retail');
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByRole('radio', { name: 'Wholesale', exact: true }).check();
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.locator('.retail-price-alert:visible').waitFor();
      await selector.selectOption('Credit');
      await page.getByText(/Cannot use Credit/).waitFor();
      assert.equal(await selector.inputValue(), 'Wholesale');
      assert.deepEqual((await draft()).cart.map(item => item.unit_price), [800, 500]);
      await page.reload(); await selector.waitFor();
      assert.equal(await selector.inputValue(), 'Wholesale');
      await page.getByRole('button', { name: 'View cart', exact: true }).click();
      await page.getByRole('button', { name: 'Continue to checkout', exact: true }).click();
      await page.getByRole('button', { name: 'Pay full', exact: true }).click();
      await page.screenshot({ path: path.join(output, `checkout-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('textbox', { name: 'Paid amount', exact: true }).focus();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.screenshot({ path: path.join(output, `checkout-bottom-${width}.png`), animations: 'disabled' });
      const balance = await page.locator('.retail-checkout-balance:visible').first().boundingBox();
      const action = await page.locator('.retail-checkout-actions:visible').boundingBox();
      assert.ok(balance.y + balance.height <= action.y + 1, 'Final balance scrolls above the checkout action');
      assert.equal(await page.locator('.retail-price-alert:visible').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Complete sale (2,100 Ks)', exact: true }).click();
      await page.getByRole('heading', { name: 'Sale complete', exact: true }).waitFor();
      assert.equal(await page.locator('.sale-checkout-complete .mobile-notice').count(), 0, 'Successful checkout has no duplicate success alert');
      await page.screenshot({ path: path.join(output, `sale-complete-${width}.png`), animations: 'disabled' });
      const sale = calls.filter(call => call.endpoint === '/sales' && call.method === 'POST').at(-1).body;
      assert.deepEqual(sale.items.map(({ product_id, price_type, unit_price, quantity, foc_quantity }) => ({ product_id, price_type, unit_price, quantity, foc_quantity })), [
        { product_id: 1, price_type: 'Wholesale', unit_price: 800, quantity: 2, foc_quantity: 1 },
        { product_id: 2, price_type: 'Wholesale', unit_price: 500, quantity: 1, foc_quantity: 0 },
      ]);
    }
    await page.goto(`${origin}/sell`); await selector.waitFor();
    await selector.selectOption('Wholesale'); await page.locator('.sale-mobile-product').first().click();
    await page.setViewportSize({ width: 320, height: 667 });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, 'products-myanmar-320.png'), animations: 'disabled' });
    await page.locator('.retail-sale-summary button').click();
    await page.screenshot({ path: path.join(output, 'cart-myanmar-320.png'), animations: 'disabled' });
    await page.locator('.retail-cart-summary button').click();
    await page.screenshot({ path: path.join(output, 'checkout-myanmar-320.png'), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log(`Sell price selection ${engine}: repricing, warnings, Back, draft restore, missing prices, filter drafts and checkout payload passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
