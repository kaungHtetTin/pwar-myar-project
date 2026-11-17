// Synthetic APIs; no real payment records are changed.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.OFFICE_ORIGIN || 'http://127.0.0.1:5175';
(async () => {
  await fs.mkdir('artifacts/office-financial-business-links', { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let reportReads = 0, writes = 0;
    const sale = { id: 77, business_id: 12, business_name: 'Report Shop', plan_name: 'Monthly plan', duration_days: 30, type: 'renewal', amount: 1000, currency: 'Ks', paid_at: '2026-11-13T10:00:00Z' };
    const report = { currency: 'Ks', current_year: 2026, summary: { this_month: 1000, this_year: 1000, all_time: 1000, all_time_sales: 1, previous_year: 0, year_over_year_percent: null },
      monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, label: String(index + 1), amount: index === 10 ? 1000 : 0, sales: index === 10 ? 1 : 0 })), yearly: [{ year: 2026, amount: 1000, sales: 1 }], recent_sales: [sale] };
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname.slice(4);
      if (route.request().method() !== 'GET') writes++;
      let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
      if (path === '/branding') data = { primary_color: '#006bdc' };
      if (path === '/office/auth/me') data = { admin: { id: 1, name: 'Fixture admin', role: 'admin' } };
      if (path === '/office/financial-report') { reportReads++; data = report; }
      if (path === '/office/businesses/12') data = { business: { id: 12, name: sale.business_name, status: 'active', currency: 'Ks' }, billing: { is_valid: false, subscription: null }, billing_history: [], business_summary: {} };
      return route.fulfill({ json: data });
    });
    await page.goto(`${origin}/#/financial-report`);
    const link = page.getByRole('link', { name: 'Report Shop', exact: true });
    await link.waitFor(); await link.scrollIntoViewIfNeeded();
    assert.equal(await link.getAttribute('href'), '#/businesses/12');
    const position = await page.locator('.office-content').evaluate(node => node.scrollTop);
    const before = reportReads;
    await page.evaluate(() => { window.reportNode = document.querySelector('.office-financial-report'); });
    await link.focus(); await link.press('Enter');
    await page.waitForURL('**/#/businesses/12'); await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to Financial report', exact: true }).click(); await link.waitFor();
    assert.equal(reportReads, before);
    assert.equal(await page.locator('.office-content').evaluate(node => node.scrollTop), position);
    assert.ok(await page.evaluate(() => document.querySelector('.office-financial-report') === window.reportNode));
    await page.goForward(); await page.waitForURL('**/#/businesses/12'); await page.goBack(); await link.waitFor();
    assert.equal(reportReads, before);
    await page.screenshot({ path: 'artifacts/office-financial-business-links/report.png' });
    await page.getByRole('button', { name: 'Actions for financial record 77', exact: true }).click();
    await page.getByRole('menuitem', { name: 'View business', exact: true }).click();
    await page.waitForURL('**/#/businesses/12'); await page.getByRole('button', { name: 'Back to Financial report', exact: true }).click(); await link.waitFor();
    assert.equal(reportReads, before);
    assert.equal(writes, 0);
    console.log('Financial report business link/menu, keyboard, app-bar/browser Back and retained report/scroll passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
