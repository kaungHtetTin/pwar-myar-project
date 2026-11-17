const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-onboarding', { recursive: true });
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
            thread.messages = [{ id: sequence++, client_id: body.client_id, role: 'user', body: body.body, status: 'completed', created_at: new Date().toISOString() }, { id: sequence++, role: 'assistant', body: 'Your next step is to review payment methods.\n\n| Setup | Status |\n| --- | --- |\n| Business name | Saved |\n| Payment methods | Review defaults |\n| Products | Not started |\n\n[Open Settings](#mkpos-screen=settings)\n\n[Unavailable](#mkpos-screen=reports) [Unsafe](#mkpos-screen=security)', status: 'completed', created_at: new Date().toISOString() }];
            proposal = null;
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
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-onboarding/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      await editor.fill('I am new. Help me set up my business.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      const reply = page.locator('.ai-reply-content');
      const openSettings = reply.getByRole('button', { name: 'Open Settings', exact: true });
      await openSettings.waitFor();
      assert.equal(await reply.getByRole('button').count(), 1);
      assert.equal(await reply.getByRole('table').count(), 1);
      await editor.fill('Retained onboarding draft');
      const messageReads = () => calls.filter(c => /\/messages$/.test(c.path) && c.method === 'GET').length;
      const initialReads = messageReads();
      await openSettings.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/ai-onboarding/${mobile?'mobile':'web'}-guide.png`, fullPage: true });
      await openSettings.focus(); await page.keyboard.press('Enter');
      if (mobile) await page.waitForURL('**/settings');
      else await page.locator('[data-module="settings"]:visible').waitFor();
      assert.equal(await page.getByRole('textbox', { name: 'AI message' }).count(), mobile ? 0 : 0);
      await page.getByRole('button', { name: 'Back to PwarMyar AI', exact: true }).click();
      await editor.waitFor();
      assert.equal(await editor.inputValue(), 'Retained onboarding draft');
      assert.equal(messageReads(), initialReads);
      await reply.getByRole('button', { name: 'Open Settings' }).click();
      if (mobile) await page.waitForURL('**/settings');
      else await page.locator('[data-module="settings"]:visible').waitFor();
      await page.goBack(); await editor.waitFor();
      assert.equal(await editor.inputValue(), 'Retained onboarding draft');
      assert.equal(messageReads(), initialReads);
      await page.goForward();
      if (mobile) await page.waitForURL('**/settings');
      else await page.locator('[data-module="settings"]:visible').waitFor();
      await page.goBack(); await editor.waitFor();
      assert.equal(messageReads(), initialReads);
      assert.equal(await editor.inputValue(), 'Retained onboarding draft');
      await page.screenshot({ path: `artifacts/ai-onboarding/${mobile?'mobile':'web'}-returned.png`, fullPage: true });
      assert.deepEqual(errors, []);
      assert.equal(calls.filter(c => c.method !== 'GET' && !c.path.startsWith('/ai-assistant/')).length, 0);
      console.log(`${mobile?'Mobile':'Web'} onboarding passed: checklist, enabled screen button, keyboard navigation, retained chat/draft on Back/Forward, no business writes.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
