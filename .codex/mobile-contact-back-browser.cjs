const { chromium, expect } = require('../shop/node_modules/playwright/test');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1100]) for (const [module, addLabel, fieldLabel] of [['customers', 'New customer', 'Customer name'], ['suppliers', 'New supplier', 'Supplier name'], ['expenses', 'New expense', 'Title']]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const requests = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        requests.push(path + url.search);
        let body = {};
        if (path === '/auth/me') body = { user: { id: 1, role: 'owner', name: 'Back Test' }, business: { id: 8, name: 'Demo' }, permissions: [module] };
        else if (path === '/app-config') body = { enabled_modules: [module], permissions: [module], language: 'en' };
        else if (path === `/${module}`) body = { items: [], total: 0, account_summary: {} };
        else if (path === '/settings') body = { payment_methods: 'Cash' };
        else if (path === '/expense-categories' || path === '/categories') body = [];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`http://127.0.0.1:5176/${module}`);
      const search = page.getByRole('textbox', { name: `Search ${module}`, exact: true });
      await search.fill('Retained source');
      await expect.poll(() => requests.some(path => path.includes('q=Retained'))).toBe(true);
      const sourceNode = await search.elementHandle();
      await page.getByRole('button', { name: addLabel, exact: true }).first().click();
      const draft = page.getByLabel(fieldLabel, { exact: true });
      await draft.fill('Unsubmitted demo draft');
      const draftNode = await draft.elementHandle(), count = requests.length;
      await page.goBack();
      await expect(search).toHaveValue('Retained source');
      await page.goForward();
      await expect(draft).toHaveValue('Unsubmitted demo draft');
      assert.equal(await draft.evaluate((node, original) => node === original, draftNode), true);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(search).toBeVisible();
      await page.goForward();
      await expect(draft).toBeVisible();
      await page.getByRole('button', { name: `Back to ${module}`, exact: true }).first().click();
      await expect(search).toHaveValue('Retained source');
      assert.equal(await search.evaluate((node, original) => node === original, sourceNode), true);
      assert.equal(requests.length, count);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, module, browserBack: true, cancel: true, appBarBack: true, forwardDraft: true, sameSourceNodes: true, requestsUnchanged: count }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
