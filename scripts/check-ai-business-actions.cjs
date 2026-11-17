const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-business-actions', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null, holdConfirmation = false, releaseConfirmation;
      const summary = () => ({ items: proposal ? [{ ...proposal, preview: { ...proposal.preview, items: [] } }] : [], has_more: false });
      await page.addInitScript(() => localStorage.setItem('mkpos.activeModule', 'products'));
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.startsWith('/src/')) return route.continue();
        const path = url.pathname.split('/api')[1], method = request.method();
        calls.push({ path, method, query: url.search, body: request.postData() });
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 }, status = 200;
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: ['products', 'sell', 'settings'], permissions: session.permissions, language: 'en', business: session.business };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories' || path === '/price-types') data = [];
        if (path === '/settings') data = { shop_name: 'Fixture shop', currency: 'MMK', language: 'en' };
        if (path === '/products/summary') data = { total_products: 0, low_stock: 0, out_of_stock: 0 };
        if (path === '/branding') data = { primary_color: '#0e684e' };
        if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
        if (path === '/ai-assistant/conversations' && method === 'POST') { thread = { id: request.postDataJSON().id, title: 'Price proposal', messages: [] }; data = { conversation: { id: thread.id } }; }
        if (path === '/ai-assistant/conversations' && method === 'GET') data = { items: thread ? [{ id: thread.id, title: thread.title, updated_at: new Date().toISOString() }] : [], has_more: false };
        if (/\/messages$/.test(path)) {
          if (method === 'POST') {
            const body = request.postDataJSON();
            thread.messages = [{ id: sequence++, client_id: body.client_id, role: 'user', body: body.body, status: 'completed', created_at: new Date().toISOString() }, { id: sequence++, role: 'assistant', body: 'Review the exact Retail price change below. Nothing has been saved yet.', status: 'completed', created_at: new Date().toISOString() }];
            proposal = { id: 'review-proposal', operation: 'update_product_prices', status: 'pending', preview_hash: 'fixture-preview-hash', currency: 'MMK', expires_at: '2099-01-01T00:00:00Z', preview: { items: [{ record_id: 1, name: 'Soap / ဆပ်ပြာ', before: { price_type: 'Retail', price: 100, is_manual: false }, after: { price_type: 'Retail', price: 105, is_manual: true } }], total: 1, has_more: false } };
          }
          data = { items: thread?.messages || [], has_more: false, actions: summary() };
        }
        if (path.endsWith('/delivery')) data = { message: thread?.messages?.[0] || null, sent: !!thread?.messages?.length, seen: !!thread?.messages?.length };
        if (/\/actions\//.test(path)) {
          if (path.endsWith('/confirm')) {
            const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); assert.equal(body.reviewed_count, 1);
            if (holdConfirmation) await new Promise(resolve => { releaseConfirmation = resolve; });
            proposal = { ...proposal, status: 'completed', result: { updated_products: 1, modules: ['products', 'reports', 'sell'] } };
          }
          if (path.endsWith('/cancel')) proposal = { ...proposal, status: 'cancelled' };
          data = proposal;
        }
        await route.fulfill({ status, json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/products' : 'http://127.0.0.1:5173/');
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-business-actions/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      await editor.fill('Increase Soap Retail price to 105.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Review Update product prices' }).waitFor();
      await editor.fill('Retained business draft');
      const before = sourceReads();
      await page.getByRole('button', { name: 'Review Update product prices' }).click();
      const confirm = page.getByRole('button', { name: 'Confirm changes', exact: true }); await confirm.waitFor();
      assert.equal(await confirm.isDisabled(), true);
      assert.equal(await page.getByText('100', { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('article', { name: 'Review business changes' }).getByText('105', { exact: false }).isVisible(), true);
      await page.screenshot({ path: `artifacts/ai-business-actions/${mobile ? 'mobile' : 'web'}-review.png`, fullPage: true });
      await page.getByRole('button', { name: 'Close review' }).click();
      assert.equal(await editor.inputValue(), 'Retained business draft');
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 0);
      // Review and source navigation are reversible and retain mounted data.
      if (mobile) {
        await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.waitForURL('**/products');
        assert.equal(await page.locator('main.products-page').evaluate((node, old) => node === old, sourceNode), true);
        assert.equal(sourceReads(), before);
        await page.goForward(); await editor.waitFor();
        await page.goBack(); await page.waitForURL('**/products');
        assert.equal(sourceReads(), before);
        assert.equal(await page.locator('main.products-page').evaluate((node, old) => node === old, sourceNode), true);
        await page.goForward(); await editor.waitFor();
      } else {
        await page.getByRole('button', { name: 'Minimize chat', exact: true }).click(); await page.getByRole('button', { name: 'Expand AI chat' }).click();
        await page.getByRole('button', { name: 'Close AI chat' }).click(); await entry.last().click();
      }
      assert.equal(await editor.inputValue(), 'Retained business draft');
      await page.getByRole('button', { name: 'Review Update product prices' }).click();
      await page.getByRole('article', { name: 'Review business changes' }).getByRole('checkbox').check(); holdConfirmation = true;
      await confirm.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Review business changes"]')?.getAttribute('aria-busy') === 'true');
      assert.equal(await page.getByRole('button', { name: 'Processing…', exact: true }).isDisabled(), true);
      for (let attempt = 0; !releaseConfirmation && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.equal(typeof releaseConfirmation, 'function'); holdConfirmation = false; releaseConfirmation();
      await page.getByText('Changes saved.', { exact: true }).waitFor();
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
      assert.equal(await editor.inputValue(), 'Retained business draft');
      await page.screenshot({ path: `artifacts/ai-business-actions/${mobile ? 'mobile' : 'web'}-saved.png`, fullPage: true });
      await page.getByRole('button', { name: 'Close review' }).click();
      // A second proposal is cancelled, never confirmed.
      await editor.fill('Prepare another price change.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Review Update product prices' }).click();
      await page.getByRole('button', { name: 'Cancel proposal' }).click();
      await page.getByText('Proposal cancelled. Ask the assistant for a new proposal if needed.').waitFor();
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
      assert.equal(calls.filter(c => c.path.endsWith('/cancel')).length, 1);
      assert.deepEqual(errors, []);
      console.log(`${mobile ? 'Mobile' : 'Web'} Phase 2 passed: preview, explicit consent, one confirmation, cancel, retained draft/source, no live API/model writes.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
