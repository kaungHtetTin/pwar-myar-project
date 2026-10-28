const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/office-refresh', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const business = { id: 11, name: 'Refresh Fixture Shop', owner_id: 21, owner_name: 'Fixture Owner', owner_email: 'fixture@example.test', owner_is_active: true, status: 'active', currency: 'Ks', timezone: 'Asia/Yangon', subscription: null };
    const counts = { book: 0, founders: 0 };
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url()), path = url.pathname;
      let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1, summary: { total: 0, access_counts: {} } };
      if (path.endsWith('/branding')) data = { primary_color: '#0e684e' };
      if (path.endsWith('/office/auth/me')) data = { admin: { id: 1, name: 'Office Admin', email: 'admin@example.test', role: 'super_admin' } };
      if (path.endsWith('/office/financial-report')) data = {};
      if (path.endsWith('/office/businesses')) data = { ...data, items: [business], total: 1 };
      if (path.endsWith('/office/businesses/11')) data = { business, billing: { subscription: null, is_valid: false }, billing_history: [], business_summary: {} };
      if (path.endsWith('/office/ai-balance-book')) { counts.book++; data = { ...data, balance: '0', total_top_ups: '0', total_usage: '0', can_use_ai: false }; }
      if (path.endsWith('/office/financial-book')) { counts.founders++; data = { founders: [{ id: 1, name: 'First Founder', share_bps: 5000 }, { id: 2, name: 'Second Founder', share_bps: 5000 }], settings_version: 1 }; }
      if (path.endsWith('/office/ai-assistant')) data = { settings: { enabled: false, configured: true, model: 'deepseek-flash', weekly_limit: 50, max_tokens: 1600 }, usage: { today_requests: 0, today_failures: 0, input_tokens: 0, output_tokens: 0 }, recent_runs: [] };
      return route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175');
    await page.getByRole('button', { name: 'Balance book', exact: true }).click();
    await page.getByRole('table', { name: 'AI balance entries' }).waitFor();
    const bookUrl = page.url();
    await page.reload();
    await page.getByRole('table', { name: 'AI balance entries' }).waitFor();
    assert.equal(page.url(), bookUrl);
    assert.ok(bookUrl.endsWith('#/ai/balance-book'));
    const reads = counts.book;
    await page.goBack();
    await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('table', { name: 'AI balance entries' }).waitFor();
    assert.equal(counts.book, reads);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: /AI assistant/ }).click();
    await page.getByLabel('DeepSeek model').waitFor();
    const settingsUrl = page.url();
    await page.reload();
    await page.getByLabel('DeepSeek model').waitFor();
    assert.equal(page.url(), settingsUrl);
    assert.ok(settingsUrl.endsWith('#/settings/ai-assistant'));
    await page.goBack();
    await page.getByLabel('Display name').waitFor();
    await page.goForward();
    await page.getByLabel('DeepSeek model').waitFor();

    await page.getByRole('button', { name: 'Businesses', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for Refresh Fixture Shop' }).click();
    await page.getByRole('menuitem', { name: 'View business', exact: true }).click();
    await page.getByRole('button', { name: 'Email owner', exact: true }).waitFor();
    const detailUrl = page.url();
    await page.reload();
    await page.getByRole('button', { name: 'Email owner', exact: true }).waitFor();
    assert.equal(page.url(), detailUrl);
    assert.ok(detailUrl.endsWith('#/businesses/11'));
    await page.getByRole('button', { name: 'Back to Businesses', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for Refresh Fixture Shop' }).waitFor();

    await page.getByRole('button', { name: 'Founders', exact: true }).click();
    await page.getByRole('table', { name: 'Founder profit shares' }).waitFor();
    await page.reload();
    await page.getByRole('table', { name: 'Founder profit shares' }).waitFor();
    assert.ok(page.url().endsWith('#/founders'));
    await page.screenshot({ path: 'artifacts/office-refresh/founders-after-reload.png', fullPage: true });

    const direct = await context.newPage();
    await direct.goto('http://127.0.0.1:5175/#/businesses/11');
    await direct.getByRole('button', { name: 'Email owner', exact: true }).waitFor();
    await direct.getByRole('button', { name: 'Back to Businesses', exact: true }).click();
    await direct.getByRole('button', { name: 'Actions for Refresh Fixture Shop' }).waitFor();
    assert.ok(direct.url().endsWith('#/businesses'));
    assert.equal(await page.locator('.office-page-error').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Office browser reload passed: balance book, Settings AI subtab, business detail, founders, Back/Forward after reload without repeat book fetch, and direct-link Back fallback. API calls intercepted.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
