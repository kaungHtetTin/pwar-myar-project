const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const api = 'http://127.0.0.1:8000/api/ecommerce';
  const read = async path => { const response = await fetch(api + path); assert.equal(response.status, 200); return response.json(); };
  const first = await read('/marketplace/categories?limit=48'), last = await read('/marketplace/categories?offset=48&limit=48');
  const categories = [...first.items, ...last.items]; assert.equal(categories.length, 49);
  const roots = (await read('/marketplace/categories?level=root&limit=48')).items; assert.equal(roots.length, 14);
  const root = categories.find(category => category.slug === 'groceries-food'), child = categories.find(category => category.slug === 'rice-grains');
  const browser = await chromium.launch(); let page;
  await fs.mkdir('artifacts/shop-marketplace-categories', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
    const calls = [], errors = []; let failCategories = false;
    const product = { id: 101, name: 'Linked rice', category: 'Business grocery shelf', price: 2000, original_price: 2000, currency: 'Ks', unit_name: 'Bag', available_quantity: 5, photo_url: null, store_slug: 'demo-shop', store_name: 'Demo Shop', rating: { count: 0, average: null } };
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname, query = url.searchParams; calls.push({ path, query: url.search });
      let data = { items: [], has_more: false };
      if (path.endsWith('/marketplace/categories')) {
        if (failCategories && !query.has('level')) { failCategories = false; return route.fulfill({ status: 503, json: { message: 'Temporary category failure' } }); }
        const items = (query.get('level') === 'root' ? roots : categories).filter(category => `${category.path} ${category.path_my}`.toLowerCase().includes((query.get('q') || '').toLowerCase()));
        const offset = Number(query.get('offset') || 0), limit = Number(query.get('limit') || 24);
        data = { items: items.slice(offset, offset + limit), has_more: items.length > offset + limit };
      }
      if (path.endsWith('/marketplace/products')) data = { items: [product], has_more: false };
      if (path.endsWith('/chat/presence')) data = { enabled: false, unread_count: 0 };
      await route.fulfill({ status: 200, json: data });
    });
    page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5177/#/marketplace');
    await page.getByRole('button', { name: root.name_en, exact: true }).waitFor();
    assert.equal(await page.locator('.home-categories > button').count(), 6);
    await page.screenshot({ path: 'artifacts/shop-marketplace-categories/home-categories.png' });
    await page.getByRole('button', { name: root.name_en, exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).waitFor();
    assert.ok(calls.some(call => call.query.includes(`marketplace_category_id=${root.id}`)));
    const reads = () => calls.filter(call => call.path.endsWith('/marketplace/products')).length;
    const before = reads(); await page.locator('.mobile-navigation').getByRole('link', { name: 'Cart', exact: true }).click(); await page.goBack();
    await page.getByRole('button', { name: 'Filters', exact: true }).waitFor(); assert.equal(reads(), before);
    failCategories = true; await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Sort & filter', exact: true });
    assert.equal(await page.getByLabel('Sort by').count(), 1);
    await drawer.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('price_asc');
    await drawer.getByLabel('In stock only', { exact: true }).check();
    assert.equal(reads(), before);
    const panel = page.getByRole('region', { name: 'All categories' }); await panel.getByRole('button', { name: 'Try again', exact: true }).click();
    await panel.getByRole('button', { name: child.path, exact: true }).waitFor();
    for (let index = 0; index < 2; index++) { await panel.locator('.list-end').scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
    assert.ok(calls.some(call => call.path.endsWith('/marketplace/categories') && call.query.includes('offset=24')));
    await panel.getByRole('textbox', { name: 'Search categories', exact: true }).fill('Rice');
    await panel.getByRole('button', { name: 'Search categories', exact: true }).click();
    await panel.getByRole('button', { name: child.path, exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/shop-marketplace-categories/category-search.png' });
    await panel.getByRole('button', { name: child.path, exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: child.path, exact: true }).getAttribute('aria-pressed'), 'true');
    assert.ok(!calls.some(call => call.query.includes(`marketplace_category_id=${child.id}`)));
    await drawer.getByRole('button', { name: 'Apply filters', exact: true }).click(); await drawer.waitFor({ state: 'hidden' });
    assert.ok(calls.some(call => call.query.includes(`marketplace_category_id=${child.id}`) && call.query.includes('sort=price_asc') && call.query.includes('in_stock=1')));
    assert.equal(await page.getByLabel('Sort by').count(), 0);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('button', { name: 'Remove category filter', exact: true }).click();
    await drawer.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await drawer.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    assert.equal(await drawer.getByRole('button', { name: 'Browse categories', exact: true }).count(), 0);
    await page.locator('.catalog-drawer-body').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: 'artifacts/shop-marketplace-categories/right-filter-drawer.png' });
    await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await drawer.getByRole('button', { name: 'Reset', exact: true }).click(); await drawer.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.locator('.catalog-drawer-backdrop').click({ position: { x: 8, y: 100 } }); await drawer.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await drawer.getByRole('button', { name: 'Close filters', exact: true }).click(); await drawer.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Back to home', exact: true }).click();
    await page.getByRole('button', { name: 'Change language', exact: true }).click();
    await page.getByRole('button', { name: root.name_my, exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/shop-marketplace-categories/home-categories-myanmar.png' });
    await page.getByRole('button', { name: root.name_my, exact: true }).click(); await page.locator('.catalog-drawer-trigger').click(); await page.locator('.catalog-drawer-categories').getByText(root.path_my, { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(errors, []);
    console.log('Shop taxonomy: real seeded 14 roots/49 categories, quick shortcuts, global ID product filter, descendant choice, category search/endless pages/retry, close/focus, filter removal, Myanmar names and Cart/Back retention passed. Browser product data intercepted.');
  } catch (error) { if (page) await page.screenshot({ path: 'artifacts/shop-marketplace-categories/failure.png' }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
