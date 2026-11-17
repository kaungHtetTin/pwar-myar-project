const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const output = 'artifacts/shop-safari-refresh';
  await fs.mkdir(output, { recursive: true });
  const evidence = [];
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const errors = []; let storeReads = 0, releaseRefresh;
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([{ slug: 'fixture', name: 'Kaung Gyi Store', items: [{ id: 1, name: 'O5 Series 120W miro cable', price: 9000, quantity: 1, unit_name: 'Price', currency: 'Ks' }] }])));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.includes('/api/ecommerce/')) return route.continue();
        assert.equal(route.request().method(), 'GET');
        const store = url.pathname.endsWith('/stores/fixture');
        if (store) {
          storeReads++;
          if (storeReads === 2) await new Promise(resolve => { releaseRefresh = resolve; });
        }
        await route.fulfill({ json: store ? { slug: 'fixture', name: 'Kaung Gyi Store', display_name: 'Kaung Gyi Store', accepting_orders: true } : { items: [], has_more: false, enabled: false } });
      });
      await page.goto('http://127.0.0.1:5177/#/cart/fixture');
      await page.getByText('O5 Series 120W miro cable', { exact: true }).waitFor();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, layout: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      assert.equal(dimensions.viewport, 393); assert.equal(dimensions.content, 393);
      const cart = await page.locator('.cart-workspace').elementHandle();
      const searchBefore = await page.locator('.app-bar-search-band').boundingBox();
      const before = await page.evaluate(() => localStorage.getItem('mkpos.shop.carts.v2'));
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        const target = document.querySelector('.cart-content h1');
        for (const [type, y] of [['touchstart', 50], ['touchmove', 230], ['touchend', null]]) {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'touches', { value: y === null ? [] : [{ clientX: 100, clientY: y }] });
          target.dispatchEvent(event);
        }
      });
      await page.getByRole('region', { name: 'Pull to refresh page' }).getByText('Refreshing…', { exact: true }).waitFor();
      const searchDuring = await page.locator('.app-bar-search-band').boundingBox();
      const indicator = await page.locator('.swipe-refresh-indicator').boundingBox();
      assert.ok(Math.abs(searchBefore.y - searchDuring.y) < 1, 'Search stays with the action bar');
      assert.ok(indicator.y >= searchDuring.y + searchDuring.height, 'Refresh is below the whole action bar');
      await page.screenshot({ path: `${output}/refresh-${name}.png` });
      assert.equal(storeReads, 2); releaseRefresh();
      await page.waitForFunction(() => document.querySelector('.swipe-refresh-shell')?.getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('.cart-workspace').evaluate((element, original) => element === original, cart), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('mkpos.shop.carts.v2')), before);
      await page.screenshot({ path: `${output}/cart-${name}.png`, fullPage: true });
      for (const width of [320, 430, 1024]) {
        await page.setViewportSize({ width, height: 852 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      }
      assert.deepEqual(errors, []);
      evidence.push({ engine: name, dimensions, storeReads, cartRetained: true, savedCartUnchanged: true, widths: [320, 393, 430, 1024], errors });
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/verification.json`, JSON.stringify(evidence, null, 2));
  console.log('Chromium and WebKit: no horizontal overflow, pull refresh awaits response, cart DOM/draft preserved. No live API writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
