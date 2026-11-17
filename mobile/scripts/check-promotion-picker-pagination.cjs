// All data is synthetic; no live products or promotions are modified.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = 'http://127.0.0.1:5176';
(async () => {
  const engine = process.env.PICKER_BROWSER || 'chromium', manual = process.env.PICKER_MANUAL === '1';
  const output = path.resolve(__dirname, `../artifacts/promotion-picker-pagination/${engine}-${manual ? 'manual' : 'auto'}`);
  await fs.mkdir(output, { recursive: true });
  const browser = await ({ chromium, firefox })[engine].launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
    if (manual) await page.addInitScript(() => { delete window.IntersectionObserver; });
    const products = Array.from({ length: 45 }, (_, index) => ({ id: index + 1, name: `Product ${String(index + 1).padStart(2, '0')}`, base_unit: 'Piece', base_price: 1500 }));
    const reads = [], errors = [];
    let failNextPage = true;
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/api/**`, async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4);
      assert.equal(req.method(), 'GET', `Unexpected mutation: ${endpoint}`);
      let json = { items: [], total: 0 };
      if (endpoint === '/auth/me') json = { user: { id: 111, name: 'Owner', role: 'owner' }, business: { id: 111 }, permissions: ['shop', 'ecommerce_catalog'], subscription: { is_valid: true } };
      else if (endpoint === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop', 'ecommerce_catalog'] };
      else if (endpoint === '/shop-admin/owner-location') json = { submitted: true };
      else if (endpoint === '/shop-admin/publications/filters') json = { categories: ['Food'] };
      else if (endpoint === '/shop-admin/publications') {
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
        reads.push({ offset, limit, q: url.searchParams.get('q') });
        if (offset === 20 && failNextPage) { failNextPage = false; return route.fulfill({ status: 503, json: { message: 'Fixture next page unavailable.' } }); }
        const ids = url.searchParams.getAll('flash_sale_product_ids[]').map(Number);
        const matching = products.filter(product => (!ids.length || ids.includes(product.id)) && product.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
        json = { items: matching.slice(offset, offset + limit).map(product => ({ ...product, flash_sale_conflict: [2, 23].includes(product.id) ? { id: 9, name: 'Weekend sale' } : null })), total: matching.length };
      }
      await route.fulfill({ json });
    });
    await page.goto(`${origin}/shop/promotions/new/flash_sale`);
    await page.getByLabel('Promotion name', { exact: true }).fill('Retained draft');
    await page.getByRole('button', { name: 'Choose products', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Select products', exact: true });
    await drawer.getByRole('checkbox', { name: 'Select Product 01', exact: true }).waitFor();
    assert.ok(await drawer.getByRole('checkbox', { name: 'Select Product 02', exact: true }).isDisabled());
    const geometry = await drawer.evaluate(node => { const body = node.querySelector('.promotion-product-picker'), list = node.querySelector('.promotion-picker-products'); return { display: getComputedStyle(body).display, bodyHeight: body.clientHeight, bodyScroll: body.scrollHeight, listHeight: list.clientHeight, listScroll: list.scrollHeight }; });
    console.log(JSON.stringify(geometry));
    if (process.env.PICKER_PROBE === '1') { await page.screenshot({ path: path.join(output, 'before.png') }); return; }
    assert.equal(geometry.display, 'flex');
    assert.ok(geometry.listScroll > geometry.listHeight && geometry.listHeight > 0, 'Products need an actual scrollable viewport');
    await drawer.getByRole('checkbox', { name: 'Select Product 01', exact: true }).check();
    const list = drawer.locator('.promotion-picker-products');
    async function scrollToEnd() {
      await list.hover();
      for (let step = 0; step < 15; step++) {
        await page.mouse.wheel(0, 2500); await page.waitForTimeout(80);
        if (await list.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 1)) return;
      }
      throw new Error('Wheel scrolling could not reach the end of the product list');
    }
    await scrollToEnd();
    await page.waitForFunction(() => document.querySelector('.promotion-picker-products').scrollTop > 0);
    if (manual) await drawer.getByRole('button', { name: 'Load more', exact: true }).click();
    await drawer.getByText('Fixture next page unavailable.', { exact: true }).waitFor();
    await drawer.getByRole('button', { name: 'Try again', exact: true }).click();
    await drawer.getByRole('checkbox', { name: 'Select Product 40', exact: true }).waitFor({ state: 'attached' });
    await scrollToEnd();
    if (manual) await drawer.getByRole('button', { name: 'Load more', exact: true }).click();
    await drawer.getByRole('checkbox', { name: 'Select Product 45', exact: true }).waitFor({ state: 'attached' });
    assert.ok(await drawer.getByRole('checkbox', { name: 'Select Product 23', exact: true }).isDisabled());
    await drawer.getByRole('checkbox', { name: 'Select Product 45', exact: true }).check();
    await page.screenshot({ path: path.join(output, 'loaded-bottom-375.png'), animations: 'disabled' });
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 667 });
      const bounds = await drawer.locator('.promotion-picker-products').boundingBox(), footer = await drawer.locator('.mobile-filter-drawer-footer').boundingBox();
      assert.ok(bounds.height > 0 && bounds.y + bounds.height <= footer.y + 1, 'Products must stop above footer');
      await list.hover();
      for (let step = 0; step < 15; step++) {
        await page.mouse.wheel(0, -5000); await page.waitForTimeout(80);
        if (await list.evaluate(node => node.scrollTop === 0)) break;
      }
      await page.waitForFunction(() => document.querySelector('.promotion-picker-products').scrollTop === 0);
      await drawer.getByRole('checkbox', { name: 'Select Product 01', exact: true }).waitFor();
      assert.ok(await drawer.getByRole('checkbox', { name: 'Select Product 01', exact: true }).isChecked());
      assert.ok(await drawer.getByRole('searchbox', { name: 'Search flash sale products', exact: true }).isVisible());
      await page.screenshot({ path: path.join(output, `loaded-top-${width}.png`), animations: 'disabled' });
    }
    await drawer.getByRole('searchbox', { name: 'Search flash sale products', exact: true }).fill('Product 45');
    await page.waitForFunction(() => document.querySelectorAll('.promotion-picker-product').length === 1);
    assert.ok(await drawer.getByRole('checkbox', { name: 'Select Product 45', exact: true }).isChecked());
    await drawer.getByRole('button', { name: 'Add 2 products', exact: true }).click();
    assert.equal(await page.getByLabel('Promotion name', { exact: true }).inputValue(), 'Retained draft');
    assert.equal(await page.locator('.promotion-selected-product').count(), 2);
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, engine, manual, reads, wheelScroll: true, retry: true, selectionAcrossPagesAndSearch: true, sourceDraftRetained: true }, null, 2));
    console.log(`${engine} ${manual ? 'manual' : 'auto'}: picker scroll, pagination and retry passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
