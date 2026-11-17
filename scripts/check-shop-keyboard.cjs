const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const output = 'artifacts/shop-keyboard';
  await fs.mkdir(output, { recursive: true });
  const checks = [];
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([{ slug: 'fixture', name: 'Shop', items: [{ id: 1, name: 'Rice', price: 9000, quantity: 1, unit_name: 'Bag', currency: 'Ks' }] }])));
      await page.route('**/api/**', async route => {
        if (!new URL(route.request().url()).pathname.includes('/api/ecommerce/')) return route.continue();
        assert.equal(route.request().method(), 'GET');
        await route.fulfill({ json: { slug: 'fixture', display_name: 'Shop', name: 'Shop', accepting_orders: true, payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash' }], delivery_zones: [], items: [], has_more: false } });
      });
      await page.goto('http://127.0.0.1:5177/#/cart/fixture');
      await page.getByText('Rice', { exact: true }).waitFor();
      const search = page.locator('.cart-search input');
      await search.fill('Rice');
      assert.equal(await search.evaluate(node => getComputedStyle(node).fontSize), '16px');
      const viewportBefore = await page.evaluate(() => ({ width: innerWidth, scale: visualViewport.scale, scroll: scrollY }));
      assert.equal(viewportBefore.width, 393); assert.equal(viewportBefore.scale, 1);
      // Model the reduced visible area. Headless engines do not display the OS keyboard.
      await page.setViewportSize({ width: 393, height: 500 });
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-shop-keyboard-open'));
      assert.equal(await page.locator('.mobile-navigation').isVisible(), false);
      assert.equal(await search.inputValue(), 'Rice');
      await page.screenshot({ path: `${output}/keyboard-${name}.png` });
      await page.setViewportSize({ width: 393, height: 852 });
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-shop-keyboard-open'));
      assert.equal(await page.locator('.mobile-navigation').isVisible(), true);
      await search.blur();
      await page.goto('http://127.0.0.1:5177/#/store/fixture/checkout');
      await page.getByLabel('Your name', { exact: true }).waitFor();
      await page.getByLabel('Your name', { exact: true }).fill('Buyer draft');
      assert.equal(await page.getByLabel('Your name', { exact: true }).evaluate(node => getComputedStyle(node).fontSize), '16px');
      await page.goto('http://127.0.0.1:5177/#/account/login');
      await page.locator('.auth-input input').first().waitFor();
      await page.locator('.auth-input input').first().focus();
      assert.equal(await page.locator('.auth-input input').first().evaluate(node => getComputedStyle(node).fontSize), '16px');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
      assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(viewportMeta));
      assert.deepEqual(errors, []);
      checks.push({ engine: name, inputFont: '16px', keyboardViewport: 'simulated', navRestored: true, pinchZoomAllowed: true, errors });
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/verification.json`, JSON.stringify(checks, null, 2));
  console.log('Chromium/WebKit: cart, checkout and auth input sizing passed; simulated keyboard hides/restores navigation, preserves values and permits zoom.');
})().catch(error => { console.error(error); process.exitCode = 1; });
