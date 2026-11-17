const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/owner-payment-validation', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      let submits = 0, release;
      const plan = { id: 1, name: 'Standard', price: 30000, currency: 'MMK', duration_days: 30, features: [] };
      const subscription = { is_valid: true, can_mutate: true, access_type: 'trial', pending_request: null };
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK' }, permissions: ['billing', 'settings', 'products'], subscription };
      await page.addInitScript(() => localStorage.setItem('mkpos.activeModule', 'billing'));
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith('/src/')) return route.continue();
        const path = pathname.split('/api')[1];
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: ['billing', 'settings', 'products'], permissions: session.permissions, language: 'en', business: session.business };
        if (path === '/subscription') data = subscription;
        if (path === '/subscription/plans') data = { items: [plan] };
        if (path === '/subscription/payment-methods') data = { items: [{ id: 2, bank: 'KBZPay', account_name: 'PwarMyar', account_no: '09123456789' }] };
        if (path === '/branding') data = { primary_color: '#0e684e' };
        if (path === '/subscription/requests') {
          submits++;
          if (submits === 1) {
            await new Promise(resolve => { release = resolve; });
            return route.fulfill({ status: 422, json: { message: 'Please check the transfer amount in your screenshot.', errors: { payment_screenshot: ['Please check the transfer amount in your screenshot.'] } } });
          }
          subscription.pending_request = { ...plan, subscription_plan_id: 1, plan_name: 'Standard', transaction_id: 'TXN-123456', payment_bank: 'KBZPay', payment_account_name: 'PwarMyar', payment_account_no: '09123456789', payment_screenshot_uploaded: true, message: 'Keep this note' };
          data = { request_id: 1, subscription };
        }
        return route.fulfill({ json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/billing/request/1' : 'http://127.0.0.1:5173/');
      if (!mobile) await page.getByRole('button', { name: 'Request package', exact: true }).click();
      await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64') }).catch(async error => { console.log({ mobile, errors, body: await page.locator('body').innerText() }); throw error; });
      const note = mobile ? page.getByLabel('Message to office (optional)') : page.getByRole('dialog').getByRole('textbox');
      await note.fill('Keep this note');
      const submit = page.getByRole('button', { name: mobile ? 'Submit request' : 'Submit payment request', exact: true });
      await submit.click();
      await page.getByRole('button', { name: 'Checking payment proof...' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Checking payment proof...' }).isDisabled(), true);
      while (!release) await page.waitForTimeout(20);
      release();
      await page.getByText('Please check the transfer amount in your screenshot.', { exact: true }).waitFor();
      assert.equal(await note.inputValue(), 'Keep this note');
      assert.equal(await submit.isEnabled(), true);
      await page.screenshot({ path: `artifacts/owner-payment-validation/${mobile ? 'mobile' : 'desktop'}-correction.png`, fullPage: true });
      await submit.click();
      await page.getByText(mobile ? 'Payment request submitted' : 'Standard request is awaiting approval', { exact: true }).waitFor();
      assert.equal(submits, 2);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Desktop and mobile owner proof validation: checking state, correction, preserved form, and pending approval passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
