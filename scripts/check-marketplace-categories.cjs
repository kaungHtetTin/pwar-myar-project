const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch();
  let page;
  await fs.mkdir('artifacts/marketplace-categories', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
    const calls = [], errors = [];
    let writes = 0, deletes = 0;
    let failParents = false, failList = false;
    let categories = Array.from({ length: 58 }, (_, index) => ({ id: index + 1, name_en: `Food ${String(index + 1).padStart(2, '0')}`, name_my: 'အစားအစာ',
      slug: `food-${index + 1}`, parent_id: null, parent_name_en: null, path: `Food ${String(index + 1).padStart(2, '0')}`, children_count: 0,
      sort_order: index, is_active: true, effective_active: true, version: 1 }));
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4), method = request.method();
      calls.push({ path, method, query: url.search });
      let data = { items: [] };
      if (path === '/office/auth/me') data = { admin: { id: 8, name: 'Office', email: 'office@example.test' } };
      if (path === '/office/businesses') data = { items: [], page: 1, per_page: 25, last_page: 1, total: 0, summary: { total: 0, access_counts: {} } };
      if (path === '/office/financial-report') data = null;
      if (path === '/office/activity-alerts/config') data = { realtime_enabled: false };
      if (path === '/office/activity-alerts') data = { items: [], cursor: 0, has_more: false };
      if (path.startsWith('/office/marketplace-categories')) {
        const query = url.searchParams;
        if (method === 'GET') {
          let items = categories.filter(category => `${category.name_en} ${category.name_my} ${category.slug}`.toLowerCase().includes((query.get('q') || '').toLowerCase()));
          if (path.endsWith('/options')) {
            if (failParents) { failParents = false; return route.fulfill({ status: 503, json: { message: 'Parents temporarily unavailable' } }); }
            items = items.filter(category => category.id !== Number(query.get('exclude_id')));
            const page = Number(query.get('page') || 1);
            data = { items: items.slice((page - 1) * 50, page * 50), has_more: items.length > page * 50 };
          } else {
            if (failList) { failList = false; return route.fulfill({ status: 503, json: { message: 'List temporarily unavailable' } }); }
            if (query.get('status') === 'inactive') items = items.filter(category => !category.is_active);
            if (query.get('status') === 'active') items = items.filter(category => category.is_active);
            if (query.get('level') === 'child') items = items.filter(category => category.parent_id);
            const per_page = Number(query.get('per_page') || 25), last_page = Math.max(1, Math.ceil(items.length / per_page)), page = Math.min(Number(query.get('page') || 1), last_page);
            data = { items: items.slice((page - 1) * per_page, page * per_page), total: items.length, page, per_page, last_page };
          }
        } else if (method === 'DELETE') {
          deletes++;
          if (deletes === 1) return route.fulfill({ status: 503, json: { message: 'Delete temporarily unavailable' } });
          categories = categories.filter(category => category.id !== Number(path.split('/').at(-1))); data = { ok: true };
        } else {
          writes++;
          if (writes === 1) return route.fulfill({ status: 503, json: { message: 'Save temporarily unavailable' } });
          const body = request.postDataJSON(), id = method === 'POST' ? 100 : Number(path.split('/').at(-1));
          const existing = categories.find(category => category.id === id);
          if (existing) assert.equal(body.version, existing.version);
          data = { ...body, id, version: (existing?.version || 0) + 1, path: body.name_en, parent_name_en: categories.find(category => category.id === body.parent_id)?.name_en || null, effective_active: body.is_active, children_count: 0 };
          categories = [...categories.filter(category => category.id !== id), data].sort((a, b) => a.sort_order - b.sort_order);
        }
      }
      await route.fulfill({ status: 200, json: data });
    });
    page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5175/');
    await page.getByRole('button', { name: 'Marketplace categories', exact: true }).click();
    const table = page.getByRole('table'); await table.waitFor();
    const waitForList = async () => { await page.getByRole('dialog').waitFor({ state: 'hidden' }); await table.waitFor(); };
    const reads = () => calls.filter(call => call.path === '/office/marketplace-categories' && call.method === 'GET').length;
    const search = page.getByRole('searchbox', { name: 'Search marketplace categories' });
    await search.fill('Food'); await search.press('Enter'); await page.waitForTimeout(100);
    await page.getByLabel('Rows per page').selectOption('10'); await page.getByText('Page 1 of 6', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 6', { exact: true }).waitFor();
    const source = await table.elementHandle();
    await page.locator('.office-content').evaluate(node => { node.scrollTop = 100; }); await page.waitForTimeout(100);
    const sourceScroll = await page.locator('.office-content').evaluate(node => node.scrollTop);
    const openEdit = async name => { await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click(); await page.getByRole('menuitem', { name: 'Edit', exact: true }).click(); };
    await openEdit('Food 11'); await page.getByRole('textbox', { name: 'English name', exact: true }).fill('Retained draft');
    const initialReads = reads(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await waitForList();
    assert.equal(reads(), initialReads); assert.equal(await search.inputValue(), 'Food'); await page.getByText('Page 2 of 6', { exact: true }).waitFor();
    assert.ok(await table.evaluate((node, previous) => node === previous, source));
    await page.waitForTimeout(50); assert.equal(await page.locator('.office-content').evaluate(node => node.scrollTop), sourceScroll);
    await page.goForward(); assert.equal(await page.getByRole('textbox', { name: 'English name', exact: true }).inputValue(), 'Retained draft');
    await page.goBack(); await waitForList(); assert.equal(reads(), initialReads);
    await page.goForward(); await page.getByRole('heading', { name: 'Edit marketplace category', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close category form', exact: true }).click(); await waitForList();
    await page.getByRole('button', { name: 'Businesses', exact: true }).click(); await page.goBack();
    await page.getByText('Page 2 of 6', { exact: true }).waitFor(); assert.equal(reads(), initialReads); assert.equal(await search.inputValue(), 'Food');
    failParents = true;
    await openEdit('Food 11');
    await page.getByRole('button', { name: 'Retry parent categories', exact: true }).click();
    await page.getByRole('button', { name: 'Load more parent categories', exact: true }).click();
    await page.getByRole('combobox', { name: 'Parent category', exact: true }).locator('option', { hasText: 'Food 58' }).waitFor({ state: 'attached' });
    await page.getByRole('textbox', { name: 'Find parent category', exact: true }).fill('Food 57'); await page.waitForTimeout(400);
    await page.getByRole('combobox', { name: 'Parent category', exact: true }).selectOption('57');
    await page.getByRole('textbox', { name: 'English name', exact: true }).fill('Food renamed');
    await page.getByRole('button', { name: 'Save category', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Save temporarily unavailable' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'English name', exact: true }).inputValue(), 'Food renamed');
    await page.getByRole('button', { name: 'Save category', exact: true }).click(); await waitForList(); await page.getByRole('button', { name: 'Actions for Food renamed', exact: true }).waitFor();
    assert.equal(writes, 2); await page.getByText('Page 2 of 6', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive');
    await page.getByRole('button', { name: 'Close filters', exact: true }).click(); assert.equal(await page.getByRole('table').count(), 1);
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await page.getByText('No categories found.', { exact: false }).waitFor();
    await page.getByRole('button', { name: /Filters/ }).click(); await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Filters/ }).click(); await page.locator('.mkpos-filter-drawer-overlay').click({ position: { x: 10, y: 100 } });
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await waitForList();
    const openDelete = async () => { await page.getByRole('button', { name: 'Actions for Food 01', exact: true }).click(); await page.getByRole('menuitem', { name: 'Delete', exact: true }).click(); };
    await openDelete(); await page.keyboard.press('Escape'); assert.equal(deletes, 0);
    await openDelete(); await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); assert.equal(deletes, 0);
    await openDelete(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(deletes, 0);
    await openDelete(); await page.getByRole('button', { name: 'Delete category', exact: true }).click(); await page.getByText('Delete temporarily unavailable', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete category', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(deletes, 2);
    await page.getByRole('button', { name: 'Add category', exact: true }).click();
    const writesBeforeValidation = writes;
    await page.getByRole('button', { name: 'Save category', exact: true }).click(); assert.equal(writes, writesBeforeValidation);
    await page.getByRole('textbox', { name: 'English name', exact: true }).fill('Household'); assert.equal(await page.getByRole('textbox', { name: /^Slug/ }).inputValue(), 'household');
    await page.getByRole('textbox', { name: 'Myanmar name (optional)', exact: true }).fill('အိမ်သုံးပစ္စည်း');
    await page.getByRole('button', { name: 'Save category', exact: true }).click(); await waitForList();
    await page.getByRole('button', { name: 'Clear search marketplace categories', exact: true }).click(); await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Last', exact: true }).click(); await page.getByText('Page 6 of 6', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'First', exact: true }).click(); await page.getByText('Page 1 of 6', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 6', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Previous', exact: true }).click(); await page.getByText('Page 1 of 6', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/marketplace-categories/office-desktop.png', fullPage: true });
    failList = true;
    await page.getByRole('button', { name: 'Refresh current page', exact: true }).click();
    await page.getByRole('button', { name: 'Retry categories', exact: true }).click(); await page.waitForTimeout(150);
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Add category', exact: true }).click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: 'artifacts/marketplace-categories/office-form-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Save category', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/marketplace-categories/office-form-mobile-bottom.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Office categories: sidebar, CRUD/failure/retry, parent search/load more, filters, pagination, create/edit modals, retained list/draft Back/Forward, refresh and 390px layout passed. All writes intercepted.');
  } catch (error) { if (page) await page.screenshot({ path: 'artifacts/marketplace-categories/failure.png', fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
