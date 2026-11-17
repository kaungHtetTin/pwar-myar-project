const { chromium, expect } = require('../shop/node_modules/playwright/test');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1100]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      const requests = [], errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const products = Array.from({ length: 40 }, (_, index) => ({ id: index + 1, name: `Water ${index + 1}`, category: 'Drinks', base_unit: 'Bottle', stock: 10, cost: 700, price: 1000, prices: [{ name: 'Retail', price: 1000 }] }));
      const session = { user: { id: 1, name: 'Navigation Test', role: 'owner' }, business: { id: 8, name: 'Navigation Demo' }, permissions: ['products'] };
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.replace(/^.*\/api/, '');
        requests.push(path + url.search);
        let body = {};
        if (path === '/auth/me') body = session;
        else if (path === '/app-config') body = { enabled_modules: ['products'], permissions: ['products'], language: 'en' };
        else if (path === '/products') body = { items: products.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 20)), total: products.length };
        else if (path === '/products/summary') body = { total_products: 40, total_stock_units: 400, low_stock: 0, out_of_stock: 0 };
        else if (/^\/products\/\d+$/.test(path)) body = products[Number(path.split('/')[2]) - 1];
        else if (path === '/categories') body = ['Drinks'];
        else if (path === '/price-types') body = { items: ['Retail'], rules: [] };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto('http://127.0.0.1:5176/products');
      try { await expect(page.getByRole('textbox', { name: 'Search products', exact: true })).toBeVisible(); }
      catch (error) { console.log(JSON.stringify({ url: page.url(), requests, errors, body: (await page.locator('body').innerText()).slice(0,1600) })); throw error; }
      const search = page.getByRole('textbox', { name: 'Search products', exact: true });
      await search.fill('Water');
      await expect.poll(() => requests.some((path) => path.includes('q=Water'))).toBe(true);
      const sourceNode = await search.elementHandle();
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.locator('#product-filter-category').selectOption('Drinks');
      await expect.poll(() => requests.some((path) => path.includes('category=Drinks'))).toBe(true);
      await page.getByRole('button', { name: 'Add product', exact: true }).first().click();
      await expect(page.getByLabel('Product name', { exact: true })).toBeVisible();
      await page.getByLabel('Product name', { exact: true }).fill('Unsent browser draft');
      const formNode = await page.getByLabel('Product name', { exact: true }).elementHandle();
      const requestCount = requests.length;
      await page.getByRole('button', { name: 'Back to products', exact: true }).last().click();
      await expect(search).toBeVisible();
      await expect(search).toHaveValue('Water');
      await expect(page.locator('#product-filter-category')).toHaveValue('Drinks');
      assert.equal(await search.evaluate((node, original) => node === original, sourceNode), true);
      assert.equal(requests.length, requestCount);
      await page.goForward();
      await expect(page.getByLabel('Product name', { exact: true })).toHaveValue('Unsent browser draft');
      assert.equal(await page.getByLabel('Product name', { exact: true }).evaluate((node, original) => node === original, formNode), true);
      await page.getByRole('button', { name: 'Back to products', exact: true }).first().click();
      await expect(search).toBeVisible();
      assert.equal(requests.length, requestCount);
      await page.getByRole('button', { name: 'Actions for Water 20', exact: true }).scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 1500);
      await expect(page.getByRole('button', { name: 'Actions for Water 40', exact: true })).toBeAttached();
      await page.getByRole('button', { name: 'Actions for Water 40', exact: true }).scrollIntoViewIfNeeded();
      const sourceScroll = await page.evaluate(() => window.scrollY);
      assert.ok(sourceScroll > 0);
      await page.getByRole('button', { name: 'Actions for Water 40', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByLabel('Product name', { exact: true }).filter({ visible: true })).toHaveValue('Water 40');
      const detailRequests = requests.length;
      await page.goBack();
      await expect(page.getByRole('button', { name: 'Actions for Water 40', exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(sourceScroll);
      assert.equal(requests.length, detailRequests);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, sourceRetained: true, draftRetained: true, loadedPagesRetained: 2, sourceScroll, unchangedRequestCount: detailRequests, pageErrors: errors.length }));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
