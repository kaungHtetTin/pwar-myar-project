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
        requests.push(url.pathname);
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthenticated' }) });
      });
      await page.goto('http://127.0.0.1:5176/login');
      const email = page.getByLabel('Email address', { exact: true }).filter({ visible: true });
      await email.fill('draft@example.test');
      await page.getByLabel('Password', { exact: true }).fill('Unsubmitted demo password');
      const emailNode = await email.elementHandle();
      await page.getByRole('link', { name: 'Create an account', exact: true }).press('Enter');
      const name = page.getByLabel('Business name', { exact: true });
      await name.fill('Unsubmitted business');
      const nameNode = await name.elementHandle(), count = requests.length;
      await page.goBack();
      await expect(email).toHaveValue('draft@example.test');
      assert.equal(await email.evaluate((node, original) => node === original, emailNode), true);
      await expect(page.getByLabel('Password', { exact: true }).filter({ visible: true })).toHaveValue('Unsubmitted demo password');
      await page.goForward();
      await expect(name).toHaveValue('Unsubmitted business');
      assert.equal(await name.evaluate((node, original) => node === original, nameNode), true);
      await page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await expect(email).toHaveValue('draft@example.test');
      await page.goBack();
      await expect(name).toHaveValue('Unsubmitted business');
      assert.equal(requests.length, count);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, loginDraftBack: true, signupDraftForward: true, signInLinkRetainsDraft: true, sameFormNodes: true, requestsUnchanged: count, pageErrors: 0 }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
