const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(root, 'office/node_modules/vite/dist/node/index.js')));
  const fixture = path.join(root, 'artifacts/launch-fix-browser/main.jsx').replaceAll('\\', '/');
  const server = await createServer({ root: path.join(root, 'office'), configFile: path.join(root, 'office/vite.config.js'),
    resolve: { alias: { 'react-dom': path.join(root, 'office/node_modules/react-dom'), react: path.join(root, 'office/node_modules/react') } },
    optimizeDeps: { include: ['react', 'react-dom/client'] },
    server: { host: '127.0.0.1', port: 5188, strictPort: true, fs: { allow: [root] } },
    plugins: [{ name: 'launch-review-fixture', configureServer(vite) {
      vite.middlewares.use('/__launch_review__', async (_req, res) => {
        const html = await vite.transformIndexHtml('/__launch_review__', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="qa-root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
        res.setHeader('Content-Type', 'text/html'); res.end(html);
      });
    } }],
  });
  await server.listen();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  let pending = true, failApproval = false;
  const proposal = { id: 9, label: 'Approve subscription payment', subject_id: 3, business_id: 11, business_name: 'Review fixture shop', proposer_name: 'Review administrator', amount: 30000, currency: 'MMK', note: 'Confirm the bank receipt before approving.', expires_at: '2026-10-27T23:59:00Z', funds_verification_required: true };
  const business = { id: 11, name: 'Review fixture shop', owner_id: 21, owner_name: 'Fixture owner', owner_email: 'owner@example.test', owner_is_active: true, status: 'active', currency: 'MMK', timezone: 'Asia/Yangon', subscription: null };
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!url.pathname.startsWith('/api/') && !url.pathname.includes('/sanctum/')) return route.continue();
    requests.push({ path: url.pathname, method: req.method() });
    let data = { items: [], total: 0, page: 1, last_page: 1, per_page: 25 };
    if (url.pathname === '/api/office/assistant-approvals') data = { ...data, items: pending ? [proposal] : [], total: pending ? 1 : 0 };
    else if (url.pathname === '/api/office/assistant-approvals/9/approve') {
      if (failApproval) return route.fulfill({ status: 409, json: { message: 'Action details changed. Prepare a new action.' } });
      assert.deepEqual(req.postDataJSON(), { confirmed: true, funds_verified: true }); pending = false; data = { status: 'approved', result: { status: 'approved' } };
    } else if (url.pathname === '/api/office/assistant-approvals/9/reject') { pending = false; data = { status: 'rejected' }; }
    else if (url.pathname === '/api/office/businesses/11') data = { business, billing: { subscription: null, is_valid: false }, billing_history: [], business_summary: {} };
    else if (url.pathname === '/api/office/businesses') data = { ...data, items: [business], total: 1, summary: { total: 1, access_counts: {} } };
    else if (url.pathname === '/api/office/financial-report') data = {};
    else if (url.pathname.includes('activity-alerts')) data = { items: [], cursor: 0, has_more: false, enabled: false, realtime_enabled: false };
    await route.fulfill({ json: data });
  });
  const output = path.join(root, 'artifacts/launch-fix-browser');
  try {
    await page.goto('http://127.0.0.1:5188/__launch_review__#/payments');
    await page.getByRole('table', { name: 'Assistant actions awaiting approval' }).waitFor();
    const open = async () => {
      await page.getByRole('button', { name: 'Actions for assistant action 9' }).click();
      await page.getByRole('menuitem', { name: 'Review action' }).click();
    };
    await open();
    assert.equal(await page.getByRole('button', { name: 'Approve action' }).isEnabled(), false);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(requests.filter(r => r.method === 'POST').length, 0);
    await open();
    await page.getByRole('checkbox', { name: /independently verified/ }).check();
    await page.screenshot({ path: path.join(output, 'approval-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'approval-phone.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const loads = requests.filter(r => r.path === '/api/office/assistant-approvals').length;
    await page.getByRole('button', { name: 'View business', exact: true }).click();
    await page.getByRole('button', { name: 'Email owner' }).waitFor();
    await page.goBack();
    await page.getByRole('dialog', { name: 'Review assistant action' }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: /independently verified/ }).isChecked(), true);
    assert.equal(requests.filter(r => r.path === '/api/office/assistant-approvals').length, loads);
    failApproval = true;
    await page.getByRole('button', { name: 'Approve action' }).click();
    await page.getByRole('alert').filter({ hasText: 'Action details changed' }).waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Review assistant action' }).isVisible(), true);
    await page.screenshot({ path: path.join(output, 'approval-error.png'), fullPage: true });
    failApproval = false;
    await page.getByRole('button', { name: 'Approve action' }).click();
    await page.getByText('No assistant actions are waiting for approval.').waitFor();
    pending = true;
    await page.getByRole('button', { name: 'Refresh actions' }).click();
    await open();
    await page.getByRole('button', { name: 'Reject proposal' }).click();
    await page.getByText('No assistant actions are waiting for approval.').waitFor();
    assert.deepEqual(errors, []);
    const evidence = { mocked_requests_only: true, human_confirmation_required: true, cancel_without_mutation: true,
      view_business_and_browser_back_preserve_review: true, back_does_not_refetch_source: true,
      failed_approval_keeps_review: true, approve_and_reject_verified: true, page_errors: errors };
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
