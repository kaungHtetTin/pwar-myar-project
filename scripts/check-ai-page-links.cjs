const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-page-links', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.stack || e.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings', 'customers', 'suppliers', 'purchases', 'expenses'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null, holdConfirmation = false, releaseConfirmation;
      const summary = () => ({ items: proposal ? [{ ...proposal, preview: { ...proposal.preview, items: [] } }] : [], has_more: false });
      await page.addInitScript(() => { if (window.top === window) localStorage.setItem('mkpos.activeModule', 'products'); });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.startsWith('/src/')) return route.continue();
        const path = url.pathname.split('/api')[1], method = request.method();
        calls.push({ path, method, query: url.search, body: request.postData() });
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 }, status = 200;
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: ['products', 'sell', 'settings', 'customers', 'suppliers', 'purchases', 'expenses'], permissions: session.permissions, language: 'en', business: session.business };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories') data = [];
        if (path === '/price-types') data = { items: ['Retail'], rules: [{name:'Retail',pricing_mode:'manual',markup_percent:0,rounding:1,minimum_profit:0}] };
        if ((path === '/products' || path === '/suppliers' || path === '/customers') && url.searchParams.get('limit') === '500') data = [];
        if (path === '/products/next-sku') data = { sku:'P001' };
        if (path === '/products/price-types') data = ['Retail'];
        if (path === '/settings/receipt-preview') data = { html: '<div>Receipt preview</div>', text: 'Receipt preview', paper_size: '80mm', layout: {} };
        if (path === '/settings/printers') data = { items: [] };
        if (path === '/expenses' && !url.searchParams.has('with_total')) data = [];
        if (path === '/settings') data = { shop_name: 'Fixture shop', currency: 'MMK', language: 'en' };
        if (path === '/products/summary') data = { total_products: 0, low_stock: 0, out_of_stock: 0 };
        if (path === '/branding') data = { primary_color: '#0e684e' };
        if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
        if (path === '/ai-assistant/conversations' && method === 'POST') { thread = { id: request.postDataJSON().id, title: 'Price proposal', messages: [] }; data = { conversation: { id: thread.id } }; }
        if (path === '/ai-assistant/conversations' && method === 'GET') data = { items: thread ? [{ id: thread.id, title: thread.title, updated_at: new Date().toISOString() }] : [], has_more: false };
        if (/\/messages$/.test(path)) {
          if (method === 'POST') {
            const body = request.postDataJSON();
            const target = JSON.parse(await fs.readFile('laravel/resources/ai/app-pages.json', 'utf8'))[body.body];
            thread.messages = [{ id: sequence++, client_id: body.client_id, role: 'user', body: body.body, status: 'completed', created_at: new Date().toISOString() }, { id: sequence++, role: 'assistant', body: `Use this button.\n\n[${target.label}](#mkpos-screen=${body.body})`, status: 'completed', created_at: new Date().toISOString() }];
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
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-page-links/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      const catalog = JSON.parse(await fs.readFile('laravel/resources/ai/app-pages.json', 'utf8'));
      const ids = ['settings_receipt', 'customers_new', 'products_new', 'suppliers_new', 'purchases_new', 'expenses_new', 'settings_barcode', 'settings_printer', 'settings_payments', 'settings_prices', 'settings_language', 'settings_timezone', 'settings_shop', 'settings_account', 'settings_security'];
      const messageReads = () => calls.filter(c => /\/messages$/.test(c.path) && c.method === 'GET').length;
      for (const id of ids) {
        const target = catalog[id];
        await editor.fill(id);
        await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
        const button = page.locator('.ai-reply-content').getByRole('button', { name: target.label, exact: true }).last();
        await button.waitFor();
        await editor.fill('Retained page-link draft');
        const reads = messageReads();
        await button.click();
        if (mobile) await page.waitForURL(`**${target.mobile_path}`);
        else if (target.action === 'new') {
          await page.getByRole('dialog').last().waitFor().catch(async error=>{console.log('Failed destination',id,errors,await page.evaluate(()=>window.history.state),await page.locator('body').innerText(),calls.slice(-8));await page.screenshot({path:'artifacts/ai-page-links/failed.png',fullPage:true});throw error;});
          assert.match(await page.getByRole('dialog').last().innerText(), new RegExp(target.label, 'i'));
        } else {
          await page.locator('[data-module="settings"]:visible').waitFor();
          const selected = page.locator('.settings-side-tabs button.selected');
          await selected.waitFor();
          const label = { shop:'Shop',receipt:'Receipt',barcode:'Barcode',printer:'Printer',payments:'Payments',prices:'Prices',language:'Language',timezone:'Time zone',account:'Account',security:'Security' }[target.tab];
          await page.waitForFunction(label=>document.querySelector('.settings-side-tabs button.selected')?.getAttribute('aria-label')===label,label);
          assert.equal(await page.evaluate(() => window.history.state.mkposAiPageLink.id), id);
        }
        if (id === 'customers_new') {
          const name = mobile ? page.getByRole('textbox').first() : page.getByRole('dialog').last().getByRole('textbox').first();
          await name.fill('Unsaved customer draft');
          await page.goBack(); await editor.waitFor();
          assert.equal(await editor.inputValue(), 'Retained page-link draft');
          await page.goForward();
          if (mobile) await page.waitForURL(`**${target.mobile_path}`); else await page.getByRole('dialog').last().waitFor();
          assert.equal(await name.inputValue(), 'Unsaved customer draft');
        }
        if (id === 'settings_receipt' || id === 'customers_new') await page.screenshot({path:`artifacts/ai-page-links/${mobile?'mobile':'web'}-${id}.png`,fullPage:true});
        if (!mobile && target.action === 'new') {
          const cancel = page.getByRole('dialog').last().getByRole('button', {name:'Cancel',exact:true});
          if (await cancel.count()) await cancel.click();
          else await page.goBack();
        } else if (mobile && id === 'settings_receipt') await page.getByRole('button', {name:'Back to settings',exact:true}).click();
        else await page.goBack();
        await editor.waitFor();
        assert.equal(await editor.inputValue(), 'Retained page-link draft');
        assert.equal(messageReads(), reads);
      }
      assert.deepEqual(errors, []);
      assert.equal(calls.filter(c => c.method !== 'GET' && !c.path.startsWith('/ai-assistant/') && c.path !== '/settings/receipt-preview').length, 0);
      console.log(`${mobile?'Mobile':'Web'} specific page links passed: 10 settings sections, 5 native forms, cancellation/Back, draft retention, no business writes.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
