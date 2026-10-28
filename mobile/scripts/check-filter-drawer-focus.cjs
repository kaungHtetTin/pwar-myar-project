// Isolated fixture requests; verifies the shared drawer in Chromium and WebKit.
const { chromium, webkit } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../artifacts/filter-drawer-focus');
const permissions = ['products', 'sell', 'sales', 'shop', 'settings'];
const categories = ['Adapter', 'Battery', 'Cable', 'Charger', 'Drink', 'Glass', 'Glass+OCA', 'Medicine', 'T+LCD', 'Touch'];

(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const width of [393, 320]) {
        const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true });
        await context.addInitScript(() => { if (!localStorage.getItem('mkpos.language')) localStorage.setItem('mkpos.language', 'en'); });
        await context.route(`${origin}/api/**`, async route => {
          const endpoint = new URL(route.request().url()).pathname.slice(4);
          let body = { items: [], total: 0 };
          if (endpoint === '/auth/me') body = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'MMK' }, permissions, subscription: { is_valid: true } };
          else if (endpoint === '/app-config') body = { enabled_modules: permissions, permissions, business: {} };
          else if (endpoint === '/settings') body = { currency: 'MMK', price_types: 'Retail', payment_methods: 'Cash' };
          else if (endpoint === '/categories') body = categories;
          else if (endpoint === '/products/summary') body = { total_products: 0, low_stock: 0, total_stock_units: 0, out_of_stock: 0 };
          else if (endpoint === '/shop-admin/chat/config') body = { enabled: false };
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
        });
        const page = await context.newPage();
        await page.goto(`${origin}/products`);
        const trigger = page.getByRole('button', { name: 'Filters', exact: true });
        await trigger.tap();
        const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
        const heading = dialog.getByRole('heading', { name: 'Filters', exact: true });
        const close = dialog.getByRole('button', { name: 'Close filters', exact: true });
        assert.ok(await heading.evaluate(node => node === document.activeElement));
        assert.ok(await close.evaluate(node => node !== document.activeElement));
        assert.equal(await heading.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
        await page.screenshot({ path: path.join(output, `${engine}-${width}-open.png`), animations: 'disabled' });
        await dialog.locator('.mobile-filter-drawer-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
        await page.screenshot({ path: path.join(output, `${engine}-${width}-bottom.png`), animations: 'disabled' });
        await dialog.locator('.mobile-filter-drawer-body').evaluate(node => { node.scrollTop = 0; });
        await page.keyboard.press('Tab');
        assert.ok(await close.evaluate(node => node === document.activeElement));
        assert.notEqual(await close.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
        await page.screenshot({ path: path.join(output, `${engine}-${width}-keyboard.png`), animations: 'disabled' });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.ok(await trigger.evaluate(node => node === document.activeElement));
        await trigger.tap();
        await page.keyboard.press('Shift+Tab');
        assert.ok(await dialog.getByRole('button', { name: 'Apply', exact: true }).evaluate(node => node === document.activeElement));
        await close.tap();
        await dialog.waitFor({ state: 'detached' });
        await trigger.tap();
        await dialog.getByRole('button', { name: 'Reset', exact: true }).tap();
        await dialog.waitFor({ state: 'detached' });
        await trigger.tap();
        await dialog.getByRole('button', { name: 'Apply', exact: true }).tap();
        await dialog.waitFor({ state: 'detached' });
        if (width === 320) {
          await page.evaluate(() => localStorage.setItem('mkpos.language', 'my'));
          await page.reload();
          await page.locator('.mobile-filter-toggle').tap();
          await page.locator('.mobile-filter-drawer-header h2').waitFor();
          assert.ok(await page.locator('.mobile-filter-drawer-header h2').evaluate(node => node === document.activeElement));
          await page.screenshot({ path: path.join(output, `${engine}-${width}-myanmar.png`), animations: 'disabled' });
        }
        console.log(`${engine} ${width}px: plain initial close button, keyboard focus, focus trap, Escape, close, Reset, Apply passed`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
