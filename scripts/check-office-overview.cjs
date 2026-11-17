const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/office-overview', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [];
    let balance = '5.250000000', summaryReads = 0, role = 'super_admin', unavailable = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route('**/api/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1, summary: { total: 100, access_counts: { paid: 70, trial: 20 } } };
      if (path.endsWith('/branding')) data = { primary_color: '#0e684e' };
      if (path.endsWith('/office/auth/me')) data = { admin: { id: 1, name: 'Office Admin', email: 'admin@example.test', role } };
      if (path.endsWith('/office/subscription-requests')) data = { items: [
        { id: 1, business_id: 11, business_name: 'Waiting Shop', plan_name: 'Business Monthly', price: 10000, currency: 'Ks', status: 'pending', created_at: '2026-10-25T03:00:00Z' },
        { id: 2, business_id: 12, business_name: 'Renewal Shop', plan_name: 'Business Yearly', price: 100000, currency: 'Ks', status: 'pending', created_at: '2026-10-25T02:00:00Z' },
        { id: 3, business_id: 13, business_name: 'Approved Shop', plan_name: 'Business Monthly', price: 10000, currency: 'Ks', status: 'approved', created_at: '2026-10-24T02:00:00Z' },
      ] };
      if (path.endsWith('/office/financial-report')) data = { currency: 'Ks', current_year: 2026, summary: { this_month: '150000' }, monthly: [], yearly: [], recent_sales: [], monthly_cash_flow: Array.from({ length: 12 }, (_, i) => {
        const income = i < 10 ? 75000 + i * 16000 : 0, outcome = i < 10 ? 40000 + i * 6000 + (i === 3 ? 120000 : 0) : 0;
        return { month: i + 1, label: new Date(2026, i, 1).toLocaleString('en', { month: 'short' }), income, outcome, profit: income - outcome };
      }) };
      if (path.endsWith('/office/ai-balance-book/summary')) {
        summaryReads++;
        if (unavailable) return route.fulfill({ status: 503, json: { message: 'Fixture summary unavailable' } });
        data = { currency: 'USD', balance, can_use_ai: Number(balance) > 0, total_requests: 10, total_usage: '0.003000000', average_cost_per_100_requests: '0.030000000' };
      }
      if (path.endsWith('/office/ai-balance-book')) data = { ...data, summary: undefined, balance, can_use_ai: Number(balance) > 0, total_top_ups: balance, total_usage: '0' };
      if (path.endsWith('/office/ai-balance-book/top-ups')) { balance = '10.500000000'; data = { entry: { id: 1 } }; }
      return route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175');
    await page.getByText('USD 5.25', { exact: true }).waitFor();
    const summary = page.getByRole('region', { name: 'Platform summary' });
    await summary.getByText('USD 0.03', { exact: true }).waitFor();
    assert.equal(await summary.locator('.office-stat-card').count(), 6);
    const cardRows = await summary.locator('.office-stat-card').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().top)));
    assert.equal(new Set(cardRows).size, 2);
    assert.equal(cardRows.filter(top => top === cardRows[0]).length, 3);
    assert.ok((await summary.innerText()).includes('150,000 Ks'));
    assert.ok((await summary.innerText()).includes('70 paid'));
    assert.equal(await page.getByRole('heading', { name: 'Plan catalog' }).count(), 0);
    assert.equal(await page.getByRole('table', { name: 'Pending payments' }).getByText('Approved Shop').count(), 0);
    await page.getByRole('img', { name: /Apr: Income/ }).focus();
    assert.ok((await page.locator('.office-income-detail').innerText()).includes('-55,000 Ks'));
    await page.screenshot({ path: 'artifacts/office-overview/overview.png', fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.screenshot({ path: 'artifacts/office-overview/overview-1100.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/office-overview/overview-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole('button', { name: /AI balance book Internal credit available/ }).click();
    await page.getByRole('table', { name: 'AI balance entries' }).waitFor();
    await page.getByRole('button', { name: 'Top up', exact: true }).click();
    await page.getByLabel('Amount (USD)').fill('5.25');
    await page.getByLabel('Description', { exact: true }).fill('Fixture budget');
    await page.getByRole('button', { name: 'Record top-up', exact: true }).click();
    await page.getByText('Internal AI top-up recorded.', { exact: true }).waitFor();
    await page.goBack();
    await summary.getByText('USD 10.50', { exact: true }).waitFor();
    const reads = summaryReads;
    await page.getByRole('button', { name: 'Review payments', exact: true }).click();
    await page.getByRole('heading', { name: 'Payment', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    assert.equal(summaryReads, reads);
    await page.getByRole('button', { name: /Manage businesses/ }).click();
    await page.getByRole('heading', { name: 'Businesses', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    assert.equal(summaryReads, reads);

    balance = '0.000000000';
    await page.getByRole('button', { name: 'Refresh current page', exact: true }).click();
    await summary.getByText('USD 0.00', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/office-overview/paused.png', fullPage: true });
    unavailable = true;
    await page.getByRole('button', { name: 'Refresh current page', exact: true }).click();
    await summary.getByText('Unavailable', { exact: true }).first().waitFor();
    assert.equal(await summary.getByText('USD 0.00', { exact: true }).count(), 0);
    role = 'admin';
    const beforeRegular = summaryReads;
    await page.reload();
    await page.getByRole('button', { name: 'Review payments', exact: true }).waitFor();
    assert.equal(await page.getByText('AI remaining balance', { exact: true }).count(), 0);
    assert.equal(await page.getByText('AI cost per 100 requests', { exact: true }).count(), 0);
    assert.equal(summaryReads, beforeRegular);
    assert.deepEqual(errors, []);
    console.log('Overview passed: useful totals, pending-only payments, internal AI balance, top-up reconciliation, management links, Back retention, Refresh, zero/error states, role restrictions and 1440/1100 layouts. All API calls intercepted.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
