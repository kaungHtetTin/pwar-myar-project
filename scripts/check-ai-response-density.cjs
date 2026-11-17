const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-response-density', { recursive: true });
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
            thread.messages = [{ id: sequence++, client_id: body.client_id, role: 'user', body: body.body, status: 'completed', created_at: new Date().toISOString() }, { id: sequence++, role: 'assistant', body: 'Review the shop name change below. Nothing has been saved yet.', status: 'completed', created_at: new Date().toISOString() }];
            proposal = { id: 'review-proposal', operation: 'manage_app_settings', status: 'pending', preview_hash: 'fixture-preview-hash', currency: 'MMK', expires_at: '2099-01-01T00:00:00Z', preview: { items: [{ name: 'Update app settings', before: { shop_name: 'Wyne' }, after: { shop_name: 'wyne business' }, editable: true, notice: 'Business name changes also update the business and online shop display name.', fields: [{ key: 'shop_name', label: 'Shop Name', type: 'text', maxLength: 255 }] }], total: 1, has_more: false } };
          }
          if (method === 'POST' && proposal) {
            const longText = '\u1006\u102d\u102f\u1004\u103a\u1021\u1019\u100a\u103a '.repeat(14);
            const item = proposal.preview.items[0];
            item.before = { ...item.before, shop_phone: '09123456789', currency: 'MMK', printer_name: 'Counter printer', language: 'my', receipt_margin_left: '3', receipt_footer: longText };
            item.after = { ...item.after, shop_phone: '09987654321', currency: 'Ks', printer_name: 'Counter_'+'X'.repeat(100), language: 'en', receipt_margin_left: '4', receipt_footer: longText+'Thank you.' };
            item.fields.push({ key:'shop_phone',label:'Shop Phone',type:'text',maxLength:255 },{ key:'currency',label:'Currency',type:'text',maxLength:20 },{ key:'printer_name',label:'Printer Name',type:'text' },{ key:'language',label:'Language',type:'select',options:['en','my'] },{ key:'receipt_margin_left',label:'Receipt Margin Left',type:'number',min:0,max:30,step:'any' },{ key:'receipt_footer',label:'Receipt Footer',type:'textarea',maxLength:2000 });
          }
          data = { items: thread?.messages || [], has_more: false, actions: summary() };
        }
        if (path.endsWith('/delivery')) data = { message: thread?.messages?.[0] || null, sent: !!thread?.messages?.length, seen: !!thread?.messages?.length };
        if (/\/actions\//.test(path)) {
          if (path.endsWith('/revise')) { const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); proposal = { ...proposal, id: 'revised-proposal', preview_hash: 'revised-hash', preview: { ...proposal.preview, items: [{ ...proposal.preview.items[0], after: body.values }] } }; }
          if (path.endsWith('/confirm')) {
            const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); assert.equal(body.reviewed_count, 1);
            if (holdConfirmation) await new Promise(resolve => { releaseConfirmation = resolve; });
            proposal = { ...proposal, status: 'completed', result: { settings: proposal.preview.items[0].after, modules: ['settings', 'products', 'reports', 'sell'] } };
          }
          if (path.endsWith('/cancel')) proposal = { ...proposal, status: 'cancelled' };
          data = proposal;
        }
        await route.fulfill({ status, json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/products' : 'http://127.0.0.1:5173/');
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-response-density/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      await editor.fill('Change shop name to wyne business.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Review App settings' }).waitFor();
      await editor.fill('Retained business draft');
      const before = sourceReads();
      await page.getByRole('button', { name: 'Review App settings' }).last().click();
      const confirm = page.getByRole('button', { name: 'Confirm changes', exact: true }); await confirm.waitFor();
      assert.equal(await confirm.isDisabled(), true);
      const checkLayout = async name => {
        const layout = await page.locator('.ai-settings-form').evaluate(form => {
          const root=form.closest('.ai-business-actions'), style=getComputedStyle(root), box=form.getBoundingClientRect();
          return { columns:getComputedStyle(form).gridTemplateColumns.split(' ').length, content:root.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight), page:document.documentElement.scrollWidth, viewport:window.innerWidth, rootWidth:root.clientWidth, rootScroll:root.scrollWidth,
            fields:[...form.querySelectorAll('input,select,textarea')].map(el=>({ height:el.getBoundingClientRect().height,left:el.getBoundingClientRect().left-box.left,right:el.getBoundingClientRect().right-box.right })), footer:form.querySelector('textarea').getBoundingClientRect().width, width:box.width };
        });
        assert.equal(layout.columns,layout.content>=480?2:1,JSON.stringify(layout));
        assert.ok(layout.page<=layout.viewport+1,JSON.stringify(layout));
        assert.ok(layout.rootScroll<=layout.rootWidth+1,JSON.stringify(layout));
        assert.ok(layout.fields.every(field=>field.height>=(mobile?44:34)-1&&field.left>=-1&&field.right<=1),JSON.stringify(layout));
        assert.ok(Math.abs(layout.footer-layout.width)<2,JSON.stringify(layout));
        await page.getByRole('textbox',{name:'Shop Name'}).scrollIntoViewIfNeeded();
        await page.screenshot({path:`artifacts/ai-response-density/${name}-form.png`,fullPage:true});
        await confirm.scrollIntoViewIfNeeded();
        await page.screenshot({path:`artifacts/ai-response-density/${name}-approval.png`,fullPage:true});
      };
      if(mobile) {
        for(const width of [320,393,768]) { await page.setViewportSize({width,height:852}); await checkLayout(`mobile-${width}`); }
        await page.setViewportSize({width:393,height:852});
      } else {
        await checkLayout('web-dialog');
        const previews=calls.filter(call=>call.method==='GET'&&call.path.includes('/actions/')).length;
        await page.getByRole('textbox',{name:'Shop Name'}).fill('Unsubmitted fullscreen draft');
        await page.getByRole('button',{name:'Maximize AI chat',exact:true}).click();
        assert.equal(await page.getByRole('textbox',{name:'Shop Name'}).inputValue(),'Unsubmitted fullscreen draft');
        assert.equal(calls.filter(call=>call.method==='GET'&&call.path.includes('/actions/')).length,previews);
        await page.getByRole('textbox',{name:'Shop Name'}).fill('wyne business');
        for(const width of [1440,1024]) { await page.setViewportSize({width,height:1000}); await checkLayout(`web-page-${width}`); }
        await page.setViewportSize({width:1440,height:1000});
      }
      assert.equal(await page.getByRole('textbox', { name: 'Shop Name' }).inputValue(), 'wyne business');
      await page.getByRole('article', { name: 'Review business changes' }).getByRole('checkbox').check();
      await page.getByRole('textbox', { name: 'Shop Name' }).fill('Revised shop');
      assert.equal(await confirm.isDisabled(), true);
      assert.equal(await page.getByRole('article', { name: 'Review business changes' }).getByRole('checkbox').isChecked(), false);
      await page.getByRole('button', { name: 'Refresh review' }).click();
      await page.getByRole('button', { name: 'Refresh review' }).waitFor({state:'visible'});
      await page.waitForFunction(() => document.querySelector('[aria-label="Shop Name"]')?.value === 'Revised shop' && document.querySelector('[aria-label="Review business changes"]')?.getAttribute('aria-busy') === 'false');
      assert.equal(await confirm.isDisabled(), true);
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 0);
      assert.equal(await page.getByRole('article', { name: 'Review business changes' }).getByText('Revised shop', { exact: false }).last().isVisible(), true);
      await page.screenshot({ path: `artifacts/ai-response-density/${mobile ? 'mobile' : 'web'}-review.png`, fullPage: true });
      await page.getByRole('button', { name: 'Close review' }).click();
      assert.equal(await editor.inputValue(), 'Retained business draft');
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 0);
      assert.equal(await editor.inputValue(), 'Retained business draft');
      await page.getByRole('button', { name: 'Review App settings' }).last().click();
      await page.getByRole('article', { name: 'Review business changes' }).getByRole('checkbox').check(); holdConfirmation = true;
      await confirm.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Review business changes"]')?.getAttribute('aria-busy') === 'true');
      assert.equal(await page.getByRole('button', { name: 'Processing…', exact: true }).isDisabled(), true);
      for (let attempt = 0; !releaseConfirmation && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.equal(typeof releaseConfirmation, 'function'); holdConfirmation = false; releaseConfirmation();
      await page.getByText('Changes saved.', { exact: true }).waitFor();
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
      assert.equal(await editor.inputValue(), 'Retained business draft');
      await page.screenshot({ path: `artifacts/ai-response-density/${mobile ? 'mobile' : 'web'}-saved.png`, fullPage: true });
      await page.getByRole('button', { name: 'Close review' }).click();
      // A second proposal is cancelled, never confirmed.
      await editor.fill('Prepare another settings change.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Review App settings' }).last().click();
      await page.getByRole('button', { name: 'Cancel proposal' }).click();
      await page.getByText('Proposal cancelled. Ask the assistant for a new proposal if needed.').waitFor();
      assert.equal(calls.filter(c => c.path.endsWith('/confirm')).length, 1);
      assert.equal(calls.filter(c => c.path.endsWith('/cancel')).length, 1);
      assert.deepEqual(errors, []);
      console.log(`${mobile ? 'Mobile' : 'Web'} Compact response forms passed: preview, explicit consent, one confirmation, cancel, retained draft/source, no live API/model writes.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
