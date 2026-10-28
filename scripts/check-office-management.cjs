const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/office-management', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const calls = [], errors = [];
    let admins = Array.from({ length: 27 }, (_, i) => ({ id: i + 1, name: i ? `Admin ${String(i).padStart(2, '0')}` : 'Founder Owner', email: `admin${i}@example.test`, role: i ? 'admin' : 'super_admin', is_active: true }));
    let banks = [{ id: 1, name: 'Kaung Htet Tin', is_active: true }, { id: 2, name: 'Min Htet Kyaw', is_active: true }, { id: 3, name: 'VISA', is_active: true }], defaultBank = 2;
    let founders = [{ id: 1, name: 'Kaung Htet Tin', share_bps: 5000, is_active: true }, { id: 2, name: 'Min Htet Kyaw', share_bps: 5000, is_active: true }], version = 1;
    const bookEntries = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, source: 'manual', type: 'expense', entry_date: '2026-10-24', description: `October hosting ${i + 1}`, amount: '1.00', currency: 'Ks', account_id: 2, account_name: 'Min Htet Kyaw', created_by_name: 'Founder Owner' }));
    let aiSettings = { enabled: false, configured: true, storage_ready: true, model: 'deepseek-flash', weekly_limit: 50, max_tokens: 1600 };
    let brand = { primary_color: '#0e684e', logo_url: null, icon_url: null, favicon_url: null };
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xoAAAAASUVORK5CYII=', 'base64');
    const paginate = (items, url) => {
      const per_page = Number(url.searchParams.get('per_page') || 25), last_page = Math.max(1, Math.ceil(items.length / per_page)), page = Math.min(last_page, Number(url.searchParams.get('page') || 1));
      return { items: items.slice((page - 1) * per_page, page * per_page), total: items.length, per_page, last_page, page };
    };
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4), method = req.method();
      calls.push({ path, method, query: url.search });
      let data = { items: [] };
      if (path === '/office/auth/me') data = { admin: admins[0], timezone: 'Asia/Yangon' };
      if (path === '/office/businesses') data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1, summary: { total: 0, access_counts: {} } };
      if (path === '/office/financial-report') data = {};
      if (path === '/office/activity-alerts/config') data = { realtime_enabled: false };
      if (path === '/office/activity-alerts') data = { items: [], cursor: 0, has_more: false };
      if (path === '/branding') data = brand;
      if (path === '/office/ai-assistant') { if (method === 'PUT') aiSettings = { ...aiSettings, ...req.postDataJSON() }; data = { settings: aiSettings, usage: { today_requests: 0, today_failures: 0, input_tokens: 0, output_tokens: 0 }, recent_runs: [] }; }
      if (path === '/office/branding') { brand = { ...brand, ...req.postDataJSON() }; data = brand; }
      if (/^\/office\/branding\//.test(path)) {
        const asset = path.split('/').pop(); brand = { ...brand, [`${asset}_url`]: method === 'DELETE' ? null : `data:image/png;base64,${image.toString('base64')}` }; data = brand;
      }
      if (path === '/office/admins') {
        if (method === 'POST') { const value = req.postDataJSON(); assert.equal(value.password, value.password_confirmation); admins.push({ ...value, id: 100 }); }
        let items = admins.filter(a => a.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
        if (url.searchParams.get('status') === 'inactive') items = items.filter(a => !a.is_active);
        data = paginate(items, url);
      }
      if (/^\/office\/admins\/\d+$/.test(path)) {
        const id = Number(path.split('/').pop()); admins = admins.map(a => a.id === id ? { ...a, ...(method === 'DELETE' ? { is_active: false } : req.postDataJSON()) } : a); data = { ok: true };
      }
      if (path === '/office/bank-books') {
        if (method === 'POST') banks.push({ ...req.postDataJSON(), id: Math.max(...banks.map(b => b.id)) + 1 });
        const items = banks.filter(b => b.name.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase()));
        data = { ...(url.searchParams.has('per_page') ? paginate(items, url) : { items }), subscription_account_id: defaultBank };
      }
      if (/^\/office\/bank-books\/\d+$/.test(path)) {
        const id = Number(path.split('/').pop());
        banks = method === 'DELETE' ? banks.filter(b => b.id !== id) : banks.map(b => b.id === id ? { ...b, ...req.postDataJSON() } : b); data = { ok: true };
      }
      if (path === '/office/subscription-bank-book') { defaultBank = req.postDataJSON().subscription_account_id; data = { ok: true }; }
      if (path === '/office/financial-book/founders') { const body = req.postDataJSON(); assert.equal(body.version, version); assert.equal(body.founders.reduce((sum, f) => sum + f.share_bps, 0), 10000); founders = body.founders.map((f, i) => ({ ...f, id: f.id || i + 1, is_active: true })); version++; data = { ok: true }; }
      if (path === '/office/financial-book') data = { ...paginate(bookEntries, url), currency: 'Ks', currencies: ['Ks'], founders: founders.map(f => ({ ...f, allocated: '0.00', paid: '0.00', balance: '0.00', contributed: '0.00' })), bank_books: banks.map(b => ({ ...b, balance: '100.00', is_subscription_default: b.id === defaultBank, opening_count: 0, opening_adjustments: '0.00' })), summary: { income: '300.00', expenses: '0.00', profit: '300.00', cash: '300.00', allocated: '0.00', unallocated: '300.00' }, settings_version: version, subscription_account_id: defaultBank, unassigned_bank_count: 0 };
      if (path === '/office/activity-log') data = { ...paginate([{ id: 1, admin_name: 'Payment Admin', admin_email: 'payment@example.test', action: 'BusinessSubscriptionController@approve', method: 'POST', path: 'api/office/subscription-requests/42/approve', created_at: '2026-10-24T03:30:00Z', details: { account_id: 4 } }], url), admins };
      await route.fulfill({ status: 200, json: data });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5175/');
    await page.getByRole('button', { name: 'Administrators', exact: true }).click();
    const table = await page.getByRole('table', { name: 'Administrators' }).elementHandle();
    await page.getByRole('button', { name: 'New administrator', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('New Office Admin'); await dialog.getByLabel('Email', { exact: true }).fill('new@example.test');
    await dialog.getByLabel('Password', { exact: true }).fill('demo-password'); await dialog.getByLabel('Confirm password', { exact: true }).fill('demo-password');
    await dialog.getByRole('button', { name: 'Save changes' }).click(); await dialog.waitFor({ state: 'hidden' }); assert.ok(admins.some(a => a.name === 'New Office Admin'));
    const search = page.getByRole('searchbox', { name: 'Search administrators' }); await search.fill('Admin 01'); await search.press('Enter');
    await page.getByRole('button', { name: 'Actions for administrator Admin 01' }).click(); await page.getByRole('menuitem', { name: 'Edit administrator' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    const count = calls.filter(c => c.path === '/office/admins' && c.method === 'GET').length;
    await page.getByRole('button', { name: 'Bank books', exact: true }).click(); await page.getByRole('table', { name: 'Bank books' }).waitFor(); await page.goBack();
    await search.waitFor(); assert.equal(await search.inputValue(), 'Admin 01'); assert.equal(await page.getByRole('table', { name: 'Administrators' }).evaluate((node, old) => node === old, table), true); assert.equal(calls.filter(c => c.path === '/office/admins' && c.method === 'GET').length, count);
    await page.getByRole('button', { name: 'Clear search administrators' }).click(); await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('dialog', { name: 'Administrator filters' }).getByLabel('Status').selectOption('inactive'); await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.getByText('No administrators match.').waitFor(); await page.getByRole('button', { name: /^Filters/ }).click(); await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByText('Admin 01', { exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10');
    await page.getByText('Page 1 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Last', exact: true }).click(); await page.getByText('Page 3 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Previous', exact: true }).click(); await page.getByText('Page 2 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'First', exact: true }).click(); await page.getByText('Page 1 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'First', exact: true }).click(); await page.getByText('Admin 01', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Actions for administrator Admin 01' }).click(); await page.getByRole('menuitem', { name: 'Deactivate administrator' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate administrator' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(admins.find(a => a.id === 2).is_active, false);
    await page.screenshot({ path: 'artifacts/office-management/administrators.png' });
    await page.getByRole('button', { name: 'Bank books', exact: true }).click(); await page.getByRole('button', { name: 'New bank book' }).click();
    await page.getByLabel('Bank book name').fill('Fourth balance book'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByText('Fourth balance book', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Actions for bank book Fourth balance book' }).click(); await page.getByRole('menuitem', { name: 'Receive subscriptions here' }).click(); await page.getByRole('button', { name: 'Use this book' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(defaultBank, 4);
    await page.getByRole('button', { name: 'Actions for bank book VISA' }).click(); await page.getByRole('menuitem', { name: 'Edit bank book' }).click();
    await page.getByRole('dialog', { name: 'Edit bank book', exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/office-management/bank-edit.png' });
    await page.getByRole('dialog').getByRole('combobox').selectOption('false'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(banks.find(b => b.id === 3).is_active, false);
    await page.getByRole('button', { name: 'Actions for bank book VISA' }).click(); await page.getByRole('menuitem', { name: 'Delete unused book' }).click(); await page.getByRole('button', { name: 'Delete book', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(banks.some(b => b.id === 3), false);
    await page.screenshot({ path: 'artifacts/office-management/bank-books.png' });
    await page.getByRole('button', { name: 'Financial book', exact: true }).click();
    const bookSearch = page.getByRole('searchbox', { name: 'Search financial book' });
    await bookSearch.fill('October'); await bookSearch.press('Enter');
    await page.getByRole('button', { name: 'New entry', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10');
    await page.waitForResponse(r => r.url().includes('/office/financial-book?') && r.url().includes('per_page=10'));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Page 2 of 8', { exact: true }).waitFor();
    await page.locator('.office-content').evaluate(node => node.scrollTo(0, 180));
    await page.waitForTimeout(50);
    const sourceScroll = await page.locator('.office-content').evaluate(node => node.scrollTop);
    assert.ok(sourceScroll > 0);
    const bookTable = await page.getByRole('table', { name: 'Financial book entries' }).elementHandle();
    await page.getByRole('button', { name: 'Founder settings', exact: true }).click();
    await page.getByLabel('Founder 1 name').waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('search').count(), 0);
    const beforeBack = calls.filter(c => c.path === '/office/financial-book' && c.method === 'GET').length;
    await page.getByRole('button', { name: 'Back to Financial book' }).click();
    await bookSearch.waitFor(); assert.equal(await bookSearch.inputValue(), 'October');
    await page.getByText('Page 2 of 8', { exact: true }).waitFor();
    assert.equal(await page.locator('.office-content').evaluate(node => node.scrollTop), sourceScroll);
    assert.equal(await page.getByRole('combobox', { name: 'Rows per page' }).inputValue(), '10');
    assert.equal(await page.getByRole('table', { name: 'Financial book entries' }).evaluate((node, old) => node === old, bookTable), true);
    assert.equal(calls.filter(c => c.path === '/office/financial-book' && c.method === 'GET').length, beforeBack);
    await page.goForward(); await page.getByLabel('Founder 1 name').waitFor();
    assert.equal(calls.filter(c => c.path === '/office/financial-book' && c.method === 'GET').length, beforeBack);
    await page.getByRole('button', { name: 'Add founder', exact: true }).click();
    await page.getByLabel('Founder 3 name').fill('Third Founder');
    await page.getByLabel('Founder 3 share (%)').fill('25');
    await page.getByRole('button', { name: 'Save founders', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'totaling 100%' }).waitFor();
    await page.getByLabel('Founder 1 share (%)').fill('40'); await page.getByLabel('Founder 2 share (%)').fill('35');
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    assert.equal(await page.getByLabel('Founder 1 share (%)').inputValue(), '50');
    assert.equal(await page.getByLabel('Founder 3 name').count(), 0);
    await page.getByRole('button', { name: 'Add founder', exact: true }).click();
    await page.getByLabel('Founder 3 name').fill('Temporary Founder');
    await page.getByRole('button', { name: 'Actions for founder Temporary Founder' }).click();
    await page.getByRole('menuitem', { name: 'Remove founder', exact: true }).click();
    assert.equal(await page.getByLabel('Founder 3 name').count(), 0);
    await page.getByLabel('Founder 1 name').fill('Cancelled name');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await bookSearch.waitFor();
    await page.getByRole('button', { name: 'Founder settings', exact: true }).click();
    assert.equal(await page.getByLabel('Founder 1 name').inputValue(), 'Kaung Htet Tin');
    await page.getByRole('button', { name: 'Add founder', exact: true }).click();
    await page.getByLabel('Founder 1 share (%)').fill('40'); await page.getByLabel('Founder 2 share (%)').fill('35');
    await page.getByLabel('Founder 3 name').fill('Third Founder'); await page.getByLabel('Founder 3 share (%)').fill('25');
    await page.screenshot({ path: 'artifacts/office-management/founders.png' });
    await page.getByRole('button', { name: 'Save founders', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Founder settings saved' }).waitFor();
    assert.equal(founders.length, 3);
    await page.getByRole('button', { name: 'Add founder', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to Financial book' }).click();
    await page.getByRole('heading', { name: 'Third Founder', exact: true }).waitFor();
    assert.equal(await bookSearch.inputValue(), 'October');
    await page.getByRole('button', { name: 'Activity log', exact: true }).click(); await page.getByRole('button', { name: 'Actions for activity 1' }).click(); await page.getByRole('menuitem', { name: 'View action details' }).click();
    await page.screenshot({ path: 'artifacts/office-management/activity.png' }); assert.ok((await page.getByRole('dialog').innerText()).includes('"account_id": 4')); await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Branding', exact: true }).click(); await page.getByLabel('Primary theme color').fill('#4f46e5'); await page.getByRole('button', { name: 'Save theme color' }).click();
    await page.getByRole('status').filter({ hasText: 'Branding saved' }).waitFor(); assert.equal(brand.primary_color, '#4f46e5');
    assert.equal(await page.locator('.office-sidebar').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(59, 53, 172)');
    await page.getByLabel('Upload logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: image }); await page.getByAltText('Current logo', { exact: true }).waitFor();
    await page.getByLabel('Upload app icon').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: image }); await page.getByAltText('Current app icon').waitFor();
    await page.getByLabel('Upload favicon').setInputFiles({ name: 'favicon.png', mimeType: 'image/png', buffer: image }); await page.getByAltText('Current favicon').waitFor();
    await page.screenshot({ path: 'artifacts/office-management/branding.png' });
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await page.getByLabel('DeepSeek model').waitFor();
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('true');
    await page.getByLabel('Weekly requests per user').fill('25');
    await page.getByRole('button', { name: 'Save assistant settings' }).click();
    await page.getByRole('status').filter({ hasText: 'AI assistant settings saved.' }).waitFor();
    assert.equal(aiSettings.enabled, true); assert.equal(aiSettings.weekly_limit, 25);
    await page.screenshot({ path: 'artifacts/ai-assistant/office-settings.png' });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250); await page.screenshot({ path: 'artifacts/office-management/branding-narrow.png', fullPage: true });
    assert.equal(await page.locator('.feedback.error').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Office browser fixtures passed: admin create/edit/cancel/search/filter/clear, retained source table and browser Back without fetching; bank create/default; dedicated founder page, add/remove/reset/cancel, 100% validation and three-founder save; app-bar Back/browser Forward retain search, page 2, page size, scroll and the same source table without refetch; activity details; theme and logo/icon/favicon uploads. No live records changed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
