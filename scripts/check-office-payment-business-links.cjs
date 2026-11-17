// Intercepted API fixtures only; exercises navigation without approving or changing payments.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.OFFICE_ORIGIN || 'http://127.0.0.1:5175';
(async () => {
  await fs.mkdir('artifacts/office-payment-business-links', { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const view of ['pending', 'history']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      let sourceReads = 0, writes = 0;
      const row = { id: 91, business_id: 11, business_name: 'Linked Payment Shop', plan_name: 'Monthly plan', duration_days: 30, status: 'pending', price: 1000, amount: 1000, currency: 'Ks', type: 'renewal', created_at: '2026-10-25T10:00:00Z', paid_at: '2026-10-25T10:00:00Z' };
      await page.route('**/api/**', route => {
        const url = new URL(route.request().url()), path = url.pathname.slice(4);
        if (route.request().method() !== 'GET') writes++;
        let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
        if (path === '/branding') data = { primary_color: '#006bdc' };
        if (path === '/office/auth/me') data = { admin: { id: 1, name: 'Fixture admin', role: 'admin' } };
        if (path === '/office/financial-report') data = {};
        if (path === '/office/subscription-requests') { sourceReads++; data = { items: [row] }; }
        if (path === '/office/subscription-payments') { sourceReads++; data = { items: [row], total: 30, page: Number(url.searchParams.get('page')), per_page: Number(url.searchParams.get('per_page')), last_page: 3, currencies: ['Ks'] }; }
        if (path === '/office/businesses/11') data = { business: { id: 11, name: row.business_name, status: 'active', currency: 'Ks' }, billing: { is_valid: false, subscription: null }, billing_history: [], business_summary: {} };
        return route.fulfill({ json: data });
      });
      await page.goto(`${origin}/#/payments`);
      await page.getByRole('link', { name: row.business_name, exact: true }).waitFor();
      await page.getByRole('searchbox', { name: 'Search payments' }).fill('Linked');
      await page.getByRole('searchbox', { name: 'Search payments' }).press('Enter');
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByLabel('From date').fill('2026-10-01'); await page.getByLabel('To date').fill('2026-10-31');
      if (view === 'history') await page.getByRole('dialog').getByLabel('Show').selectOption('history');
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      const link = page.getByRole('link', { name: row.business_name, exact: true });
      await link.waitFor();
      if (view === 'history') {
        await page.getByLabel('Rows per page').selectOption('10'); await link.waitFor();
        await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Page 2 of 3', { exact: true }).waitFor();
      }
      assert.equal(await link.getAttribute('href'), '#/businesses/11');
      await link.scrollIntoViewIfNeeded();
      const before = sourceReads;
      const position = await page.locator('.office-content').evaluate(node => node.scrollTop);
      await page.evaluate(() => { window.paymentLinkNode = document.querySelector('.office-request-table .office-business-link'); });
      if (view === 'pending') await link.click(); else { await link.focus(); await link.press('Enter'); }
      await page.waitForURL('**/#/businesses/11'); await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to Payment', exact: true }).click(); await page.waitForURL('**/#/payments');
      await link.waitFor();
      assert.equal(sourceReads, before);
      assert.equal(await page.getByRole('searchbox', { name: 'Search payments' }).inputValue(), 'Linked');
      assert.ok(await page.evaluate(() => document.querySelector('.office-request-table .office-business-link') === window.paymentLinkNode));
      assert.equal(await page.locator('.office-content').evaluate(node => node.scrollTop), position);
      if (view === 'history') assert.equal(await page.getByLabel('Rows per page').inputValue(), '10');
      await page.goForward(); await page.waitForURL('**/#/businesses/11'); await page.goBack(); await link.waitFor();
      assert.equal(sourceReads, before);
      await page.screenshot({ path: `artifacts/office-payment-business-links/${view}.png` });
      await page.getByRole('button', { name: `Actions for ${view === 'pending' ? 'request' : 'payment'} 91`, exact: true }).click();
      await page.getByRole('menuitem', { name: 'View business', exact: true }).click();
      await page.waitForURL('**/#/businesses/11'); await page.getByRole('button', { name: 'Back to Payment', exact: true }).click(); await link.waitFor();
      assert.equal(sourceReads, before);
      await page.getByRole('button', { name: /Filters/ }).click();
      assert.equal(await page.getByLabel('From date').inputValue(), '2026-10-01'); assert.equal(await page.getByLabel('To date').inputValue(), '2026-10-31');
      assert.equal(await page.getByRole('dialog').getByLabel('Show').inputValue(), view);
      assert.equal(writes, 0, 'Navigation must not mutate a payment');
      console.log(`${view}: business link, row-menu action, keyboard/mouse, Back/Forward and retained payment state passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
