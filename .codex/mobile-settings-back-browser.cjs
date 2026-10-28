const { chromium, expect } = require('../shop/node_modules/playwright/test');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1100]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const requests = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        requests.push(path);
        let body = {};
        if (path === '/auth/me') body = { user: { id: 1, name: 'Settings Owner', role: 'owner' }, business: { id: 8, name: 'Demo' }, permissions: ['settings'] };
        else if (path === '/app-config') body = { enabled_modules: ['settings'], permissions: ['settings'], language: 'en' };
        else if (path === '/settings') body = { shop_name: 'Demo shop', payment_methods: 'Cash' };
        else if (path === '/price-types') body = { items: ['Retail'], rules: [] };
        else if (path === '/settings/receipt-preview') body = { html: '<p>Demo preview</p>' };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto('http://127.0.0.1:5176/settings');
      for (const section of ['Account', 'Shop', 'Receipt', 'Barcode', 'Printer', 'Payments', 'Price types', 'Security', 'Data', 'Language', 'About']) {
        const source = page.getByRole('button', { name: `Open ${section}`, exact: true });
        const original = await source.elementHandle();
        const previewCount = requests.filter(path => path === '/settings/receipt-preview').length;
        await source.click();
        const content = page.locator('main.settings-page').filter({ visible: true }).filter({ hasNot: page.getByText('Loading settings…', { exact: true }) });
        await expect(content).toBeVisible();
        if (section === 'Receipt') await expect.poll(() => requests.filter(path => path === '/settings/receipt-preview').length).toBeGreaterThan(previewCount);
        const destination = await content.elementHandle(), count = requests.length;
        await page.getByRole('button', { name: 'Back to settings', exact: true }).click();
        await expect(source).toBeVisible();
        assert.equal(await source.evaluate((node, retained) => node === retained, original), true);
        await page.goForward();
        await expect(content).toBeVisible();
        assert.equal(await content.evaluate((node, retained) => node === retained, destination), true);
        await page.goBack();
        await expect(source).toBeVisible();
        assert.equal(requests.length, count);
      }
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, sections: 11, appBarBack: true, browserBackForward: true, sameSourceAndDestinationNodes: true, noReturnRequests: true, pageErrors: 0 }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
