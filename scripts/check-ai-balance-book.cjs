const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-balance-book', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], writes = [];
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    page.on('pageerror', error => errors.push(error.message));
    const entries = Array.from({ length: 26 }, (_, index) => ({ id: index + 1, type: index % 2 ? 'usage' : 'top_up', amount: index % 2 ? '-0.000184800' : '0.000184800', balance_after: index % 2 ? '0.000000000' : '0.000184800', description: index % 2 ? 'Fixture estimated AI request cost' : 'Fixture budget allocation', reference: 'Fixture allocation', recorded_by: 'Office Admin', model: 'deepseek-flash', business_id: 12, user_id: 8, input_tokens: 1000, output_tokens: 100, cached_input_tokens: index % 2 ? 800 : null, run_id: `fixture-run-${index}`, created_at: '2026-10-25T06:00:00Z' }));
    let balance = '0.000000000', reads = 0, fail = true;
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      let data = { items: [], total: 0, summary: { total: 0, access_counts: {} }, unread_count: 0 };
      if (path.endsWith('/office/auth/me')) data = { admin: { id: 1, name: 'Office Admin', email: 'office@example.test', role: 'super_admin' } };
      if (path.endsWith('/branding')) data = { primary_color: '#0e684e' };
      if (path.endsWith('/office/financial-report')) data = {};
      if (path.endsWith('/office/ai-balance-book/top-ups')) {
        const body = request.postDataJSON(); writes.push(body);
        if (fail) { fail = false; return route.fulfill({ status: 503, json: { message: 'Fixture connection interrupted' } }); }
        balance = '5.250000000';
        entries.push({ ...entries[0], id: 27, amount: balance, balance_after: balance, description: body.description, reference: body.reference });
        data = { entry: entries.at(-1) };
      } else if (path.endsWith('/office/ai-balance-book')) {
        reads++;
        const filtered = entries.filter(entry => !url.searchParams.get('q') || entry.description.includes(url.searchParams.get('q')));
        const perPage = Number(url.searchParams.get('per_page') || 25), lastPage = Math.max(1, Math.ceil(filtered.length / perPage)), current = Math.min(lastPage, Number(url.searchParams.get('page') || 1));
        data = { currency: 'USD', balance, can_use_ai: Number(balance) > 0, total_top_ups: Number(balance) > 0 ? '5.252402400' : '0.002402400', total_usage: '0.002402400', total_requests: 13, average_cost_per_100_requests: '0.018480000', items: [...filtered].reverse().slice((current - 1) * perPage, current * perPage), total: filtered.length, page: current, per_page: perPage, last_page: lastPage };
      }
      await route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175');
    await page.getByRole('button', { name: 'Balance book', exact: true }).click();
    const table = page.getByRole('table', { name: 'AI balance entries' });
    await table.waitFor();
    await page.getByText('Average cost per 100 requests', {exact:true}).waitFor();
    assert.equal(await page.getByText('USD 0.01848', {exact:true}).count(),1);
    await page.getByText(/All time.*13 recorded requests/).waitFor();
    assert.equal(await page.locator('.office-page-error').count(), 0);
    await page.getByText('Paused', { exact: true }).waitFor();
    await page.getByLabel('Search AI balance entries', { exact: true }).fill('Fixture');
    await page.getByLabel('Search AI balance entries', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Page 2 of 2', { exact: true }).waitFor();
    assert.equal(await page.getByText('USD 0.01848', {exact:true}).count(),1);
    const before = reads;
    await page.getByRole('button', { name: 'Top up', exact: true }).click();
    await page.getByLabel('Amount (USD)').fill('5.25');
    await page.getByLabel('Description', { exact: true }).fill('Fixture AI budget');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(reads, before);
    await page.getByRole('button', { name: 'Top up', exact: true }).click();
    await page.getByLabel('Amount (USD)').fill('5.25');
    await page.getByLabel('Description', { exact: true }).fill('Fixture AI budget');
    await page.getByLabel('Reference (optional)').fill('ALLOC-1');
    await page.screenshot({ path: 'artifacts/ai-balance-book/top-up.png', fullPage: true });
    await page.getByRole('button', { name: 'Record top-up', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fixture connection interrupted' }).waitFor();
    assert.equal(await page.getByLabel('Amount (USD)').inputValue(), '5.25');
    await page.getByRole('button', { name: 'Record top-up', exact: true }).click();
    await page.getByText('Funded', { exact: true }).waitFor();
    assert.equal(writes.length, 2);
    assert.equal(writes[0].request_key, writes[1].request_key);
    assert.equal(await page.getByLabel('Search AI balance entries', { exact: true }).inputValue(), 'Fixture');
    await page.getByText('Page 2 of 2', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/ai-balance-book/book.png', fullPage: true });
    const fundedReads = reads;
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.goBack();
    await table.waitFor();
    assert.equal(reads, fundedReads);
    assert.equal(await page.getByLabel('Search AI balance entries', { exact: true }).inputValue(), 'Fixture');
    assert.deepEqual(errors, []);
    console.log('AI balance book: top-up cancel/retry/idempotency, search, pagination, Back retention, paused/funded states and visual fixtures passed. No live API or model calls.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
