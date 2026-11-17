const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/error-reports', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], writes = [], reads = [];
    let failSave = true;
    let rows = [{ id: 1, reference: 'ERR-000001', business_id: 10, business_name: 'Demo shop', reporter_name: 'Business Owner', title: 'Checkout shows an unexpected error', description: 'The checkout screen reports an error after entering the payment. The sale was not retried to avoid a duplicate payment.', expected_result: 'Complete checkout once and show a receipt.', attempted_steps: 'Checked payment fields and reviewed the error screenshot. Requires administrator investigation.', app: 'business_mobile', source: 'assistant', status: 'open', priority: 'normal', resolution: '', internal_note: '', version: 'version-1', created_at: '2026-10-25T10:00:00Z', screenshots: [{ name: 'checkout-error.png', path: '/office/error-reports/1/images/0' }] }];
    page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname.split('/api')[1];
      if (!path || url.pathname.startsWith('/src/')) return route.continue();
      let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1, summary: { total: 0, access_counts: {} } };
      if (path === '/office/auth/me') data = { admin: { id: 1, name: 'Support admin', email: 'support@example.test', role: 'admin' } };
      if (path === '/branding') data = { primary_color: '#0e684e' };
      if (path === '/office/businesses/10') data = { business: { id: 10, name: 'Demo shop', currency: 'MMK', timezone: 'Asia/Yangon', status: 'active' }, billing: { is_valid: false, reason: 'no_subscription', subscription: null }, billing_history: [] };
      if (path === '/office/error-reports/businesses') data = { items: [{ id: 10, name: 'Demo shop' }], has_more: false };
      if (/\/office\/error-reports\/\d+\/images\/\d+$/.test(path)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220"><rect width="300" height="220" fill="#f4f8f6"/><text x="20" y="35" fill="#0e684e" font-size="18">PwarMyar checkout</text><rect x="15" y="65" width="270" height="65" rx="6" fill="#fff0ef"/><text x="25" y="100" fill="#a52c25" font-size="16">Unexpected error</text><text x="20" y="170" fill="#53655b" font-size="12">Screenshot fixture for support review</text></svg>' });
      const match = path.match(/^\/office\/error-reports\/(\d+)$/);
      if (path === '/office/error-reports' && req.method() === 'GET') {
        reads.push(url.search);
        let visible = rows.filter(row => (!url.searchParams.get('q') || `${row.title} ${row.business_name}`.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('status') || url.searchParams.get('status') === 'all' || row.status === url.searchParams.get('status')));
        data = { ...data, items: visible, total: visible.length, per_page: Number(url.searchParams.get('per_page') || 25) };
      }
      if (match) data = rows.find(row => row.id === Number(match[1]));
      if (req.method() !== 'GET' && path.startsWith('/office/error-reports')) {
        const body = req.postDataJSON(); writes.push({ path, method: req.method(), body });
        if (req.method() === 'PUT') {
          if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { message: 'Save temporarily unavailable' } }); }
          rows = rows.map(row => row.id === Number(match[1]) ? { ...row, ...body, version: 'version-2' } : row); data = rows.find(row => row.id === Number(match[1]));
        }
        if (req.method() === 'POST') { data = { ...rows[0], ...body, id: 2, reference: 'ERR-000002', source: 'office', reporter_name: null, screenshots: [] }; rows.push(data); }
        if (req.method() === 'DELETE') { rows = rows.filter(row => row.id !== Number(match[1])); data = { deleted: true }; }
      }
      await route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175/#/error-reports');
    await page.getByRole('table', { name: 'Error reports' }).waitFor();
    await page.reload();
    await page.getByRole('table', { name: 'Error reports' }).waitFor();
    assert.ok(page.url().endsWith('#/error-reports'));
    const table = await page.getByRole('table').elementHandle();
    const action = async name => { await page.getByRole('button', { name: 'Actions for error report 1' }).click(); await page.getByRole('menuitem', { name }).click(); };
    await page.screenshot({ path: 'artifacts/error-reports/list.png' });
    await page.getByRole('searchbox', { name: 'Search error reports' }).fill('Checkout');
    await page.getByRole('searchbox', { name: 'Search error reports' }).press('Enter');
    await page.waitForResponse(response => response.url().includes('/office/error-reports?q=Checkout'));
    await page.getByRole('button', { name: 'Actions for error report 1' }).waitFor({ state: 'visible' });
    const navigationReads = reads.length;
    await action('View business');
    await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
    assert.ok(page.url().endsWith('#/businesses/10'));
    await page.getByRole('button', { name: 'Back to Error reports' }).click();
    await page.getByRole('table', { name: 'Error reports' }).waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search error reports' }).inputValue(), 'Checkout');
    assert.equal(reads.length, navigationReads);
    assert.equal(await table.evaluate(node => node.isConnected), true);
    await action('View business');
    await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('table', { name: 'Error reports' }).waitFor();
    assert.equal(reads.length, navigationReads);
    assert.equal(await table.evaluate(node => node.isConnected), true);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await page.waitForResponse(response => response.url().includes('/office/error-reports?q=&'));
    const modalReads = reads.length;
    await action('View report');
    await page.getByRole('img', { name: 'checkout-error.png' }).waitFor();
    await page.screenshot({ path: 'artifacts/error-reports/details.png' });
    await page.getByRole('button', { name: 'Close error report' }).click();
    assert.equal(reads.length, modalReads); assert.equal(await table.evaluate(node => node.isConnected), true); assert.equal(writes.length, 0);
    await action('Edit report');
    const status = page.getByRole('dialog').getByRole('combobox', { name: 'Status', exact: true });
    await status.selectOption('resolved'); await page.getByLabel('Resolution (visible to owner)').fill('Corrected the checkout configuration. Please try the checkout again.');
    await page.getByLabel('Office note (private)').fill('Internal investigation notes.');
    await page.getByRole('button', { name: 'Save report' }).click(); await page.getByText('Save temporarily unavailable', { exact: true }).waitFor();
    assert.equal(await status.inputValue(), 'resolved');
    await page.screenshot({ path: 'artifacts/error-reports/edit-retry.png' });
    await page.getByRole('button', { name: 'Save report' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'New error report' }).click(); await page.getByRole('dialog').getByRole('combobox', { name: 'Business', exact: true }).selectOption('10');
    await page.getByLabel('Title', { exact: true }).fill('Printer unavailable'); await page.getByLabel('Problem', { exact: true }).fill('Printer is disconnected.');
    await page.getByRole('button', { name: 'Save report' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('dialog').getByRole('combobox', { name: 'Status', exact: true }).selectOption('resolved');
    const filtered = page.waitForResponse(response => response.url().includes('/office/error-reports?') && response.url().includes('status=resolved'));
    await page.getByRole('button', { name: 'Apply filters' }).click(); await filtered; await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.ok(reads.at(-1).includes('status=resolved'));
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Clear', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await action('Delete report'); await page.getByRole('button', { name: 'Delete report', exact: true }).waitFor();
    assert.equal(writes.filter(write => write.method === 'DELETE').length, 0);
    await page.getByRole('button', { name: 'Delete report', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(writes.filter(write => write.method === 'DELETE').length, 1);
    assert.deepEqual(errors, []);
    console.log('Office error reports: View business and app-bar/browser Back preserve search and mounted list without refetch; create, screenshots, edit retry, filters and confirmed delete passed. All writes intercepted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
