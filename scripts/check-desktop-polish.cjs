// Mocked, read-only browser check: compare every visible element with the
// desktop paint stylesheet enabled/disabled. No live API requests or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');
const postcss = require('../frontend/node_modules/postcss');

(async () => {
  const css = await fs.readFile('frontend/src/styles/desktop-polish.css', 'utf8');
  const paint = new Set(['background', 'color', 'border-color', 'border-bottom-color',
    'box-shadow', 'outline', 'outline-color', 'outline-offset']);
  postcss.parse(css).walkDecls(decl => assert.ok(
    decl.prop.startsWith('--desktop-') || paint.has(decl.prop),
    `Geometry-affecting property: ${decl.prop}`,
  ));
  const { makeThemePalettes } = await import('../shared/theme/themeRuntime.js');
  const modules = ['products', 'customers', 'suppliers', 'settings', 'sell'];
  const browser = await chromium.launch({ headless: true });
  const errors = [], results = [];
  const out = 'artifacts/desktop-polish';
  await fs.mkdir(out, { recursive: true });
  try {
    for (const mode of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        localStorage.setItem('mkpos.activeModule', 'products');
        localStorage.setItem('mkpos.language', 'en');
      });
      await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await context.route('**/api/**', async route => {
        const p = new URL(route.request().url()).pathname.split('/api')[1];
        if (!p) return route.continue();
        assert.equal(route.request().method(), 'GET', `Unexpected write: ${p}`);
        let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1,
          has_more: false, enabled: false, unread_count: 0, summary: { total: 0, access_counts: {} } };
        const session = { user: { id: 1, name: 'Demo Owner', role: 'owner' },
          business: { id: 1, name: 'Modern Market', currency: 'Ks' }, permissions: modules,
          subscription: { is_valid: true, can_mutate: true } };
        if (p === '/branding') data = { primary_color: '#0e684e', theme_mode: mode, theme_version: 1, palettes: makeThemePalettes() };
        if (p === '/auth/me') data = session;
        if (p === '/app-config') data = { enabled_modules: modules, permissions: modules, business: session.business, language: 'en' };
        if (p === '/subscription') data = session.subscription;
        if (p === '/categories' || p === '/price-types') data = [];
        if (p === '/products') data = { ...data, total: 3, items: [1, 2, 3].map(id => ({
          id, name: ['Organic Green Tea', 'Premium Coffee Beans', 'Oat Milk'][id - 1],
          sku: `SKU-00${id}`, barcode: `10000${id}`, base_unit: 'Unit', category: 'Beverages',
          stock: 24 * id, cost: 2500, low_stock_threshold: 5,
          prices: [{ name: 'Retail', price: 3500 }, { name: 'Wholesale', price: 3000 }],
        })) };
        await route.fulfill({ json: data });
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.DESKTOP_POLISH_ORIGIN || 'http://127.0.0.1:5184/');
      await page.locator('.desktop-workspace').waitFor();
      await page.getByText('Organic Green Tea', { exact: true }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const compare = async label => {
        await page.locator('.skeleton-block:visible').waitFor({ state: 'hidden' });
        const capture = () => page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden')
          .map(n => {
            const r = n.getBoundingClientRect(), s = getComputedStyle(n);
            return { tag: n.tagName, cls: n.getAttribute('class'), rect: [r.x, r.y, r.width, r.height],
              type: [s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing] };
          }));
        await page.mouse.move(1439, 899);
        await page.waitForTimeout(220);
        const after = await capture();
        await page.evaluate(() => {
          const style = document.querySelector('style[data-vite-dev-id$="/desktop-polish.css"]');
          if (!style) throw new Error('Desktop polish stylesheet missing');
          style.sheet.disabled = true;
        });
        await page.waitForTimeout(220);
        const before = await capture();
        assert.deepEqual(after, before, `${label}: geometry or typography changed`);
        await page.screenshot({ path: `${out}/${label}-before.png`, animations: 'disabled' });
        await page.evaluate(() => { document.querySelector('style[data-vite-dev-id$="/desktop-polish.css"]').sheet.disabled = false; });
        await page.waitForTimeout(220);
        await page.screenshot({ path: `${out}/${label}-after.png`, animations: 'disabled' });
        results.push({ label, visibleElements: after.length, geometryChanges: 0 });
      };
      await compare(`products-${mode}-1440`);
      const row = page.locator('.product-data-table tbody tr').nth(1);
      await row.hover();
      const fills = await row.locator('td').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
      assert.equal(new Set(fills).size, 1, `Sticky action cell must match hovered row: ${JSON.stringify(fills)}`);
      await page.getByLabel('Page actions').getByRole('button', { name: 'Add Product', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await compare(`product-form-${mode}-1440`);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      for (const name of ['Customers', 'Suppliers', 'Settings', 'Sell']) {
        await page.locator('.sidebar nav').getByRole('button', { name, exact: true }).click();
        await page.waitForTimeout(350);
        await compare(`${name.toLowerCase()}-${mode}-1440`);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      await compare(`sell-${mode}-1280`);
      await page.setViewportSize({ width: 390, height: 844 });
      await compare(`sell-${mode}-390`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
    console.log(`Passed ${results.length} browser comparisons: zero geometry/type changes; light/dark, sticky hover, form, desktop and narrow-screen checks. Paint-only CSS contract passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
