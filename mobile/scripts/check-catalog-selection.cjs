// Fixture-only: no live publication changes.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const { setDrawerLanguage } = require('./drawer-language.cjs');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176';
const engine = process.env.CATALOG_BROWSER || 'chromium';
(async () => {
  const output = 'artifacts/catalog-selection'; await fs.mkdir(output, { recursive: true });
  const browser = await (engine === 'firefox' ? firefox : chromium).launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
  const permissions = ['shop', 'sell', 'products', 'sales', 'ecommerce_catalog', 'ecommerce_settings'];
  let products = ['Premium Jasmine Rice', 'Sunflower Cooking Oil', 'Green Tea Original'].map((name, i) => ({ id: i + 1, name, category: 'Groceries', stock: 48, base_unit: 'Piece', unit: 'base', base_price: 9500, price_type: 'Retail', currency: 'MMK', published: false }));
  const writes = [], errors = []; let fail = true;
  await context.route('**/sanctum/csrf-cookie', r => r.fulfill({ status: 204 }));
  await context.route(`${origin}/api/**`, async r => {
    const url = new URL(r.request().url()), endpoint = url.pathname.slice(4); let data = { items: [], total: 0 };
    if (endpoint === '/auth/me') data = { user: { id: 301, name: 'Owner', role: 'owner' }, business: { id: 301, name: 'Market' }, permissions, subscription: { is_valid: true } };
    else if (endpoint === '/app-config') data = { enabled_modules: permissions, permissions, business: {} };
    else if (endpoint === '/settings') data = { language: 'en', currency: 'MMK' };
    else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
    else if (endpoint === '/shop-admin/publications/filters') data = { categories: ['Groceries'] };
    else if (endpoint === '/shop-admin/publications/bulk') {
      assert.equal(url.search, ''); const body = r.request().postDataJSON(); writes.push(body);
      if (fail) { fail = false; return r.fulfill({ status: 503, json: { message: 'Publication update failed. Please retry.' } }); }
      products = products.map(p => body.product_ids.includes(p.id) ? { ...p, published: body.published } : p); data = { updated: body.product_ids.length };
    } else if (endpoint === '/shop-admin/publications') {
      const rows = products.filter(p => p.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
      data = { items: rows, total: rows.length, published_count: rows.filter(p => p.published).length };
    } else if (/\/publications\/\d+$/.test(endpoint)) data = products.find(p => p.id === Number(endpoint.split('/').at(-1)));
    await r.fulfill({ json: data });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${origin}/shop/catalog`);
    await page.getByRole('checkbox', { name: 'Select Premium Jasmine Rice', exact: true }).check();
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(writes.length, 0);
    await page.getByRole('searchbox', { name: 'Search publication', exact: true }).fill('Tea');
    await page.getByRole('checkbox', { name: 'Select Premium Jasmine Rice', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('checkbox', { name: 'Select loaded products', exact: true }).check();
    await page.getByRole('button', { name: 'Publish selected', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish selected', exact: true }).click();
    await page.getByText('Publication update failed. Please retry.', { exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish selected', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(writes, [{ published: true, product_ids: [1, 3] }, { published: true, product_ids: [1, 3] }]);
    assert.deepEqual(products.map(p => p.published), [true, false, true]);
    await page.getByRole('searchbox', { name: 'Search publication', exact: true }).fill('');
    await page.getByRole('checkbox', { name: 'Select Premium Jasmine Rice', exact: true }).check();
    await page.getByRole('button', { name: 'Edit publication for Premium Jasmine Rice', exact: true }).click();
    await page.getByRole('heading', { name: 'Public product information', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Select Premium Jasmine Rice', exact: true }).isChecked(), true);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 667 }); await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/${engine}-${width}.png` });
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.documentElement.lang === 'my'); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${engine}-myanmar.png` });
    assert.deepEqual(errors, []); console.log(`${engine}: exact selected IDs, cancel, retry, hidden selection, edit/Back, narrow and Myanmar passed.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
