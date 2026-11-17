// Intercepted Office APIs only; does not access or change live accounts.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  await fs.mkdir('artifacts/office-drawer-footer', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [width, height] of [[1440, 900], [1152, 540], [1280, 400], [390, 640]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      let signOuts = 0;
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint.endsWith('/office/auth/logout')) signOuts++;
        return route.fulfill({ json: endpoint.endsWith('/office/auth/me')
          ? { admin: { id: 1, name: 'Fixture admin', email: 'admin@example.test', role: 'super_admin' } }
          : { items: [], total: 0, page: 1, per_page: 25, last_page: 1 } });
      });
      await page.goto('http://127.0.0.1:5189/#/settings/account');
      const footer = page.locator('.sidebar-account');
      await footer.waitFor({ state: 'attached' });
      if (width < 1024) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page.locator('.office-sidebar').evaluate(node => {
        for (const animation of node.getAnimations()) animation.finish();
      });
      const bounds = await page.evaluate(() => Object.fromEntries(['.office-shell', '.office-sidebar', '.office-sidebar nav', '.sidebar-account'].map(selector => {
        const node = document.querySelector(selector), rect = node.getBoundingClientRect();
        return [selector, { top: rect.top, bottom: rect.bottom, height: rect.height, scrollHeight: node.scrollHeight }];
      })));
      console.log(JSON.stringify({ width, height, bounds }));
      await page.screenshot({ path: `artifacts/office-drawer-footer/${width}-${height}.png` });
      assert.ok(bounds['.sidebar-account'].height > 0, 'Account footer is displayed');
      assert.ok(bounds['.sidebar-account'].bottom <= height, 'Account footer stays within viewport');
      const nav = page.locator('.office-sidebar nav');
      await nav.evaluate(node => { node.scrollTop = node.scrollHeight; });
      const after = await footer.boundingBox();
      assert.equal(after.y, bounds['.sidebar-account'].top, 'Navigation scroll does not move footer');
      if (width >= 1024) {
        await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.office-sidebar').getBoundingClientRect().width < 100);
        const collapsed = await footer.boundingBox();
        assert.ok(collapsed.y + collapsed.height <= height, 'Collapsed footer stays visible');
        await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
      }
      await footer.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.office-sidebar'));
      assert.equal(signOuts, 1, 'Sign out runs once');
      await page.close();
    }
    console.log('Office footer visibility, independent scrolling, collapse, and sign-out checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
