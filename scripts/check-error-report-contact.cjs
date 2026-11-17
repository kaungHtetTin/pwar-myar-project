const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/error-report-contact', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], writes = [];
      let messageReads = 0, saved = false;
      const id = '12345678-abcd-4123-9123-123456789012';
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['products', 'settings'], subscription: { is_valid: true, can_mutate: true } };
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(id => { localStorage.setItem('mkpos.activeModule', 'products'); localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.ai.conversation:1:1', id); }, id);
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const req = route.request(), pathname = new URL(req.url()).pathname;
        if (pathname.startsWith('/src/')) return route.continue();
        const path = pathname.split('/api')[1];
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, business: session.business, language: 'en' };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories' || path === '/price-types') data = [];
        if (path === '/branding') data = { primary_color: '#0e684e' };
        if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true };
        if (path === '/ai-assistant/conversations') data = { items: [{ id, title: 'Receipt printer error' }], has_more: false };
        if (path.endsWith('/messages')) {
          messageReads++;
          data = { items: [{ id: 1, role: 'user', body: 'My receipt printer shows control codes.', status: 'completed', created_at: new Date().toISOString(), error_report_request: { id: 7, report_id: saved ? 1 : null } }, { id: 2, role: 'assistant', body: 'How should admins contact you? Please use Contact and submit below.', status: 'completed', created_at: new Date().toISOString() }], has_more: false };
        }
        if (path === '/ai-assistant/error-report-requests/7') data = { id: 7, title: 'Receipt printer outputs control codes', description: 'The printout contains escape characters instead of readable text. Printer settings were checked; the issue persists.', report_id: saved ? 1 : null, reference: saved ? 'ERR-000001' : null };
        if (path.endsWith('/7/submit')) {
          const body = req.postDataJSON(); writes.push(body);
          if (body.contact_value === '123') return route.fulfill({ status: 422, json: { message: 'Enter a valid phone number.', errors: { contact_value: ['Enter a valid phone number.'] } } });
          saved = true; data = { id: 1, reference: 'ERR-000001', already_submitted: false };
        }
        await route.fulfill({ json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5173/');
      if (!mobile) await page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }).last().click();
      await page.getByRole('button', { name: 'Contact and submit', exact: true }).click();
      await page.getByRole('radio', { name: 'Phone', exact: true }).check();
      await page.getByLabel('Phone number', { exact: true }).fill('123');
      assert.equal(writes.length, 0);
      if (mobile) {
        assert.ok(page.url().endsWith('/assistant/error-reports/7'));
        const reads = messageReads;
        await page.getByRole('button', { name: 'Back to AI assistant' }).click();
        await page.getByRole('button', { name: 'Contact and submit', exact: true }).waitFor();
        assert.equal(messageReads, reads);
        await page.goForward();
        await page.getByLabel('Phone number', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Phone number', { exact: true }).inputValue(), '123');
      } else {
        await page.getByRole('button', { name: 'Maximize AI chat' }).click();
        await page.getByLabel('Phone number', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Phone number', { exact: true }).inputValue(), '123');
      }
      await page.screenshot({ path: `artifacts/error-report-contact/${mobile ? 'mobile' : 'desktop'}-form.png` });
      await page.getByRole('button', { name: 'Submit report', exact: true }).click();
      await page.getByText('Enter a valid phone number.', { exact: true }).first().waitFor();
      assert.equal(await page.getByLabel('Phone number', { exact: true }).inputValue(), '123');
      await page.getByLabel('Phone number', { exact: true }).fill('+959123456789');
      for (const width of mobile ? [320, 768, 393] : [1440]) {
        await page.setViewportSize({ width, height: mobile ? 852 : 1000 });
        const form = page.getByRole('form', { name: 'Error report contact' });
        assert.ok(await form.evaluate(node => node.scrollWidth <= node.clientWidth));
        await page.screenshot({ path: `artifacts/error-report-contact/${mobile ? `mobile-${width}` : 'desktop'}-filled.png` });
      }
      await page.getByRole('button', { name: 'Submit report', exact: true }).click();
      await page.locator('p:visible').filter({ hasText: 'ERR-000001' }).first().waitFor();
      assert.equal(writes.length, 2);
      assert.deepEqual(writes[1], { contact_choice: 'provided', contact_channel: 'phone', contact_value: '+959123456789' });
      if (mobile) {
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.locator('p:visible').filter({ hasText: 'ERR-000001' }).first().waitFor();
        await page.goto('http://127.0.0.1:5176/assistant/error-reports/7');
        await page.locator('p:visible').filter({ hasText: 'ERR-000001' }).first().waitFor();
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Contact forms: desktop maximize, mobile route/Back/Forward/deep link, retained draft/chat, validation/retry, saved reference and narrow layouts passed. All requests intercepted.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
