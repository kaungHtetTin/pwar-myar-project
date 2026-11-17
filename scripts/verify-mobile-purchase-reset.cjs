// Browser regression with intercepted APIs: no purchase or stock writes reach Laravel.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  const output = 'artifacts/mobile-purchase-reset';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [393, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 852 }, serviceWorkers: 'block' });
      const posts = [], errors = [];
      const product = { id: 4, name: 'Drinking Water', sku: 'WATER-1', category: 'Drinks', stock: 12, base_unit: 'Bottle', purchase_unit: 'Carton', purchase_conversion_factor: 24, cost: 800, price: 1200, prices: [{ name: 'Retail', price: 1200, is_manual: true }] };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.activeModule', 'purchases'); });
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/sanctum/csrf-cookie') return route.fulfill({ status: 204 });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        let json = { items: [], total: 0, has_more: false, enabled: false };
        if (path === '/auth/me') json = { user: { id: 1, role: 'owner', name: 'Fixture owner' }, business: { id: 1, name: 'Fixture business', currency: 'Ks' }, permissions: ['purchases'], subscription: { is_valid: true, can_mutate: true } };
        if (path === '/app-config') json = { enabled_modules: ['purchases'], language: 'en' };
        if (path === '/settings') json = { language: 'en', admin_pin_set: '0' };
        if (path === '/categories') json = ['Drinks'];
        if (path === '/products') json = { items: [product], total: 1 };
        if (path === '/purchases' && request.method() === 'POST') {
          posts.push(request.postDataJSON());
          json = { id: 100 + posts.length, price_changes: [] };
        }
        return route.fulfill({ json });
      });
      await page.goto('http://127.0.0.1:5176/purchases');
      await page.getByRole('button', { name: 'New purchase', exact: true }).click();
      await page.getByLabel('Note', { exact: true }).fill('First purchase only');
      await page.getByLabel('Reference number', { exact: true }).fill('FIRST-ONLY');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('textbox', { name: 'Search purchase products' }).fill('Water');
      await page.getByRole('button', { name: 'Select Drinking Water', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('FOC for Drinking Water', { exact: true }).fill('2');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('combobox').filter({ has: page.locator('option', { hasText: /^KPay$/ }) }).selectOption('KPay');
      await page.getByRole('button', { name: 'Save purchase', exact: true }).click();
      await page.getByRole('heading', { name: 'Purchases', exact: true }).waitFor();
      await page.getByRole('button', { name: 'New purchase', exact: true }).click();
      assert.equal(await page.getByLabel('Note', { exact: true }).filter({ visible: true }).inputValue(), '');
      assert.equal(await page.getByLabel('Reference number', { exact: true }).filter({ visible: true }).inputValue(), '');
      assert.equal(await page.getByRole('button', { name: 'Basic information', exact: true }).getAttribute('aria-current'), 'step');
      await page.screenshot({ path: `${output}/fresh-purchase-${width}.png` });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Search purchase products' }).inputValue(), '');
      await page.getByRole('button', { name: 'Select Drinking Water', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal(await page.getByLabel('FOC for Drinking Water', { exact: true }).inputValue(), '0');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal(await page.getByRole('combobox').filter({ has: page.locator('option', { hasText: /^KPay$/ }) }).inputValue(), 'Cash');
      await page.getByRole('button', { name: 'Save purchase', exact: true }).click();
      await page.getByRole('heading', { name: 'Purchases', exact: true }).waitFor();
      assert.equal(posts.length, 2);
      assert.equal(posts[1].note, ''); assert.equal(posts[1].reference_no, null); assert.equal(posts[1].payment_method, 'Cash');
      assert.equal(posts[1].items[0].foc_quantity, 0);
      assert.deepEqual(errors, []);
      console.log(`${width}px: successful submit clears retained form; next purchase has fresh data; exactly two intercepted POSTs.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
