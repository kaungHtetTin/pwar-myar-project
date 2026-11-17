const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch(); let page;
  await fs.mkdir('artifacts/marketplace-products', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 800 }, serviceWorkers: 'block' });
    const categories = [{ id: 7, path: 'Food', name_en: 'Food', effective_active: true }, { id: 8, parent_id: 7, path: 'Food / Rice', name_en: 'Rice', name_my: 'ဆန်', effective_active: true },
      { id: 9, path: 'Drinks / Tea', name_en: 'Tea', effective_active: true }, { id: 10, path: 'Inactive category', name_en: 'Inactive', effective_active: false },
      ...Array.from({ length: 52 }, (_, index) => ({ id: 20 + index, path: `Other ${index}`, name_en: `Other ${index}`, effective_active: true }))];
    let products = Array.from({ length: 32 }, (_, index) => ({ id: index + 1, business_id: index % 2 ? 20 : 10, shop_name: index % 2 ? 'Shop B' : 'Shop A', shop_slug: index % 2 ? 'shop-b' : 'shop-a',
      name: `Product ${String(index + 1).padStart(2, '0')}`, sku: `SKU-${index + 1}`, barcode: `BAR-${index + 1}`, business_category: 'Groceries', price: 2000, currency: 'Ks', stock: 10,
      is_active: true, published: index % 2 === 0, link_version: index === 31 ? 1 : 0, link_status: index === 31 ? 'needs_review' : 'unlinked', marketplace_category: index === 31 ? categories[3] : null }));
    const histories = new Map(), calls = [], errors = []; let writes = 0, failHistory = true, failRead = false, failOptions = false;
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4), query = url.searchParams;
      calls.push({ path, method: request.method(), query: url.search }); let data = { items: [] };
      if (path === '/office/auth/me') data = { admin: { id: 8, name: 'Office', email: 'office@example.test' } };
      if (path === '/office/businesses') data = { items: [], page: 1, per_page: 25, last_page: 1, total: 0, summary: { total: 0, access_counts: {} } };
      if (path === '/office/financial-report') data = null;
      if (path === '/office/activity-alerts/config') data = { realtime_enabled: false };
      if (path === '/office/activity-alerts') data = { items: [], cursor: 0, has_more: false };
      if (path === '/office/marketplace-categories/options') {
        if (failOptions) { failOptions = false; return route.fulfill({ status: 503, json: { message: 'Options temporarily unavailable' } }); }
        const items = categories.filter(category => category.path.toLowerCase().includes((query.get('q') || '').toLowerCase())), current = Number(query.get('page') || 1);
        data = { items: items.slice((current - 1) * 50, current * 50), has_more: items.length > current * 50 };
      }
      if (path === '/office/marketplace-products/shops') data = { items: [{ id: 10, path: 'Shop A' }, { id: 20, path: 'Shop B' }].filter(shop => shop.path.toLowerCase().includes((query.get('q') || '').toLowerCase())), has_more: false };
      if (/\/marketplace-products\/\d+$/.test(path)) {
        if (failHistory) { failHistory = false; return route.fulfill({ status: 503, json: { message: 'History temporarily unavailable' } }); }
        const id = Number(path.split('/').at(-1)); data = { ...products.find(product => product.id === id), history: histories.get(id) || [] };
      }
      if (path === '/office/marketplace-products/link') {
        const body = request.postDataJSON(); writes++;
        if (writes === 1) return route.fulfill({ status: 503, json: { message: 'Save temporarily unavailable' } });
        const chosen = categories.find(category => category.id === body.category_id) || null;
        assert.ok(!chosen || chosen.effective_active); const updated = [];
        for (const item of body.products) {
          const product = products.find(product => product.id === item.id); assert.equal(item.version, product.link_version);
          const before = product.marketplace_category; product.marketplace_category = chosen; product.link_version++; product.link_status = chosen ? 'linked' : 'unlinked'; updated.push(product);
          histories.set(product.id, [{ id: writes, before, after: chosen, admin_name: 'Office', created_at: '2026-10-18T01:00:00Z' }, ...(histories.get(product.id) || [])]);
        }
        data = { changed: updated.length, items: updated };
      }
      if (path === '/office/marketplace-products') {
        if (failRead) { failRead = false; return route.fulfill({ status: 503, json: { message: 'Products temporarily unavailable' } }); }
        let items = products.filter(product => `${product.name} ${product.sku} ${product.barcode} ${product.shop_name} ${product.business_category}`.toLowerCase().includes((query.get('q') || '').toLowerCase()));
        if (query.get('business_id')) items = items.filter(product => product.business_id === Number(query.get('business_id')));
        if (query.get('business_category')) items = items.filter(product => product.business_category === query.get('business_category'));
        if (query.get('category_id')) items = items.filter(product => product.marketplace_category?.id === Number(query.get('category_id')) || product.marketplace_category?.parent_id === Number(query.get('category_id')));
        if (query.get('publication') === 'published') items = items.filter(product => product.published);
        if (query.get('publication') === 'unpublished') items = items.filter(product => !product.published);
        if (query.get('status') === 'inactive') items = items.filter(product => !product.is_active);
        const summary = { total: items.length, linked: items.filter(product => product.link_status === 'linked').length, unlinked: items.filter(product => product.link_status === 'unlinked').length, needs_review: items.filter(product => product.link_status === 'needs_review').length };
        if (query.get('link_status') && query.get('link_status') !== 'all') items = items.filter(product => product.link_status === query.get('link_status'));
        const per_page = Number(query.get('per_page') || 25), last_page = Math.max(1, Math.ceil(items.length / per_page)), current = Math.min(Number(query.get('page') || 1), last_page);
        data = { items: items.slice((current - 1) * per_page, current * per_page), total: items.length, page: current, per_page, last_page, summary };
      }
      await route.fulfill({ status: 200, json: data });
    });
    page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5175/'); await page.getByRole('button', { name: 'Products', exact: true }).click();
    await page.getByRole('table').waitFor();
    await page.getByRole('button', { name: /Filters/ }).click();
    const initialFilters = page.getByRole('dialog');
    assert.equal(await initialFilters.getByRole('combobox', { name: 'Link status', exact: true }).inputValue(), 'unlinked');
    assert.equal(await initialFilters.getByRole('combobox', { name: 'Publication', exact: true }).inputValue(), 'published');
    await page.screenshot({ path: 'artifacts/marketplace-products/default-filters.png' });
    await initialFilters.getByRole('combobox', { name: 'Link status', exact: true }).selectOption('all');
    await initialFilters.getByRole('combobox', { name: 'Publication', exact: true }).selectOption('all');
    await initialFilters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('table').waitFor();
    const reads = () => calls.filter(call => call.path === '/office/marketplace-products' && call.method === 'GET').length;
    const dialog = page.getByRole('dialog'); const waitClosed = () => dialog.waitFor({ state: 'hidden' });
    await page.getByLabel('Rows per page').selectOption('10'); await page.getByText('Page 1 of 4', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 4', { exact: true }).waitFor();
    const search = page.getByRole('searchbox', { name: 'Search marketplace products' }); await search.fill('Product'); await search.press('Enter');
    await page.getByText('Page 1 of 4', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 4', { exact: true }).waitFor();
    const table = await page.getByRole('table').elementHandle(); await page.locator('.office-content').evaluate(node => { node.scrollTop = 100; }); await page.waitForTimeout(80);
    const scroll = await page.locator('.office-content').evaluate(node => node.scrollTop);
    const manage = async (id, action = 'Manage category') => { await page.getByRole('button', { name: `Actions for Product ${String(id).padStart(2, '0')} (#${id})`, exact: true }).click(); await page.getByRole('menuitem', { name: action, exact: true }).click(); };
    const beforeCancel = reads(); await manage(11); await dialog.getByText('Recent link history (latest 20)', { exact: true }).click(); await dialog.getByRole('button', { name: 'Retry link history', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await waitClosed();
    assert.equal(reads(), beforeCancel); assert.ok(await page.getByRole('table').evaluate((node, previous) => node === previous, table));
    assert.equal(await page.locator('.office-content').evaluate(node => node.scrollTop), scroll);
    await page.goForward(); await dialog.waitFor(); await page.goBack(); await waitClosed(); assert.equal(reads(), beforeCancel);
    await manage(11); await dialog.getByRole('button', { name: 'Close product category form', exact: true }).click(); await waitClosed();
    await manage(11); await page.keyboard.press('Escape'); await waitClosed();
    await manage(11); await page.locator('.office-modal-backdrop:visible').click({ position: { x: 8, y: 8 } }); await waitClosed();
    await page.getByRole('checkbox', { name: 'Select Product 11 (#11)', exact: true }).check(); await page.getByRole('checkbox', { name: 'Select Product 12 (#12)', exact: true }).check();
    failOptions = true; await page.getByRole('button', { name: 'Link selected (2)', exact: true }).click();
    assert.ok(await dialog.getByRole('button', { name: 'Save links', exact: true }).isDisabled());
    await dialog.getByRole('button', { name: 'Retry marketplace category options', exact: true }).click();
    const categorySelect = dialog.getByRole('combobox', { name: 'Marketplace category', exact: true });
    assert.ok(await categorySelect.locator('option[value="10"]').isDisabled());
    await dialog.getByRole('button', { name: 'Load more marketplace category options', exact: true }).click(); await categorySelect.locator('option[value="71"]').waitFor({ state: 'attached' });
    await dialog.getByRole('textbox', { name: 'Find marketplace category', exact: true }).fill('Rice'); await page.waitForTimeout(350); await categorySelect.selectOption('8');
    await dialog.getByRole('button', { name: 'Save links', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'Save temporarily unavailable' }).waitFor(); assert.equal(await categorySelect.inputValue(), '8');
    await page.screenshot({ path: 'artifacts/marketplace-products/bulk-link-modal.png' });
    await dialog.getByRole('button', { name: 'Save links', exact: true }).click(); await waitClosed(); assert.equal(writes, 2); await page.getByText('2 product links updated.', { exact: true }).waitFor();
    await page.getByText('Page 2 of 4', { exact: true }).waitFor(); assert.equal(await search.inputValue(), 'Product');
    await manage(11); await dialog.getByText('Recent link history (latest 20)', { exact: true }).click(); await dialog.getByText('Unlinked → Food / Rice', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/marketplace-products/single-link-history.png' });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await waitClosed();
    await manage(11, 'Remove link'); assert.equal(await dialog.getByRole('combobox', { name: 'Marketplace category', exact: true }).inputValue(), '');
    await dialog.getByRole('button', { name: 'Save links', exact: true }).click(); await waitClosed(); await page.getByText('1 product link updated.', { exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Select all products on this page', exact: true }).check(); await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await page.getByRole('button', { name: /^Linked:/ }).click();
    await page.getByRole('button', { name: 'Actions for Product 12 (#12)', exact: true }).waitFor();
    await page.getByRole('button', { name: /Unlinked/ }).click(); await page.getByText('Page 1 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Needs review/ }).click(); await page.getByRole('button', { name: 'Actions for Product 32 (#32)', exact: true }).waitFor();
    await page.getByRole('button', { name: /All products/ }).click(); await page.getByRole('table').waitFor();
    await page.getByRole('button', { name: /Filters/ }).click();
    await dialog.getByRole('textbox', { name: 'Find shop', exact: true }).fill('Shop A'); await page.waitForTimeout(350);
    await dialog.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('10');
    await dialog.getByRole('textbox', { name: 'Business category', exact: true }).fill('Groceries'); await dialog.getByRole('combobox', { name: 'Publication', exact: true }).selectOption('published');
    await dialog.getByRole('combobox', { name: 'Product status', exact: true }).selectOption('inactive');
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click(); await waitClosed(); await page.getByText('No products match these filters.', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Filters/ }).click(); await dialog.getByRole('combobox', { name: 'Product status', exact: true }).selectOption('active');
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click(); await waitClosed(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Filters/ }).click(); await dialog.getByRole('button', { name: 'Clear', exact: true }).click(); await waitClosed(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Filters/ }).click();
    assert.equal(await dialog.getByRole('combobox', { name: 'Link status', exact: true }).inputValue(), 'unlinked');
    assert.equal(await dialog.getByRole('combobox', { name: 'Publication', exact: true }).inputValue(), 'published');
    await dialog.getByRole('combobox', { name: 'Link status', exact: true }).selectOption('all');
    await dialog.getByRole('combobox', { name: 'Publication', exact: true }).selectOption('all');
    await dialog.getByRole('button', { name: 'Apply filters', exact: true }).click(); await waitClosed();
    await page.getByRole('button', { name: 'Clear search marketplace products', exact: true }).click();
    for (const [control, label] of [['Last', 'Page 4 of 4'], ['Previous', 'Page 3 of 4'], ['First', 'Page 1 of 4']]) { await page.getByRole('button', { name: control, exact: true }).click(); await page.getByText(label, { exact: true }).waitFor(); }
    failRead = true; await page.getByRole('button', { name: 'Refresh current page', exact: true }).click(); await page.getByRole('button', { name: 'Retry products', exact: true }).click();
    await page.screenshot({ path: 'artifacts/marketplace-products/product-directory.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await manage(1); await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/marketplace-products/product-modal-mobile.png' });
    assert.ok(await dialog.getByRole('button', { name: 'Save links', exact: true }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.deepEqual(errors, []);
    console.log('Office product linking: single/bulk category assignment, unlink, explicit choice, inactive-category guard, history, save/options/history/list retry, modal dismissal, source DOM/search/page/scroll retention, filters, selection, pagination and mobile layout passed. All writes intercepted.');
  } catch (error) { if (page) await page.screenshot({ path: 'artifacts/marketplace-products/failure.png' }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
