const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-invoice', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings', 'purchases'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null;
      const draftId='12345678-1234-4234-8234-123456789012';
      const product={id:1,name:'Invoice soap',base_unit:'Unit',purchase_unit:null,purchase_conversion_factor:1,stock:2,cost:100,price:150,is_active:true};
      const invoice={id:draftId,posted:false,form:{supplier_id:1,supplier_name:'Invoice supplier',paid_amount:0,payment_method:'Cash',note:'Invoice INV-001',items:[{product_id:1,product_name:product.name,product,source_name:'Soap',unit_name:'Unit',conversion_factor:1,quantity:3,foc_quantity:0,unit_cost:100,line_total:300}]}};
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
        if (path === '/app-config') data = { enabled_modules: ['products', 'sell', 'settings', 'purchases'], permissions: session.permissions, language: 'en', business: session.business };
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
            proposal={id:'invoice-proposal',operation:'create_purchase_draft',status:'pending',preview_hash:'fixture-preview-hash',currency:'MMK',expires_at:'2099-01-01T00:00:00Z',preview:{items:[{name:'Invoice soap',before:null,after:{quantity:3,unit:'Unit',unit_cost:100,line_total:300}}],total:1,has_more:false}};
          }
          data = { items: thread?.messages || [], has_more: false, actions: summary() };
        }
        if (path.endsWith('/delivery')) data = { message: thread?.messages?.[0] || null, sent: !!thread?.messages?.length, seen: !!thread?.messages?.length };
        if (/\/actions\//.test(path)) {
          if (path.endsWith('/revise')) { const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); proposal = { ...proposal, id: 'revised-proposal', preview_hash: 'revised-hash', preview: { ...proposal.preview, items: [{ ...proposal.preview.items[0], after: body.values }] } }; }
          if (path.endsWith('/confirm')) {
            const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); assert.equal(body.reviewed_count, 1);

            proposal = { ...proposal, status: 'completed', result: { purchase_draft_id:draftId,posted:false,modules:[] } };
          }
          if (path.endsWith('/cancel')) proposal = { ...proposal, status: 'cancelled' };
          data = proposal;
        }
        if(path.startsWith('/ai-assistant/purchase-drafts/'))data=invoice;
        if(path==='/products' && url.searchParams.get('ids'))data={items:[product],total:1};
        if(path==='/suppliers')data={items:[{id:1,name:'Invoice supplier'}],total:1};
        await route.fulfill({ status, json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/products' : 'http://127.0.0.1:5173/');
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-invoice/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      await editor.fill('Change shop name to wyne business.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();

      await page.getByRole('button',{name:'Review Invoice purchase draft',exact:true}).click();
      const review=page.getByRole('article',{name:'Review business changes'});await review.waitFor();
      assert.equal(await page.getByRole('button',{name:'Open purchase draft',exact:true}).count(),0);
      const confirm=review.getByRole('button',{name:'Confirm changes',exact:true});assert.equal(await confirm.isDisabled(),true);
      await review.getByRole('checkbox').check();await confirm.click();
      await review.getByText('Purchase draft saved. Stock and payments are unchanged.',{exact:true}).waitFor();
      await editor.fill('Retained invoice chat draft');
      const messageReads=()=>calls.filter(c=>c.method==='GET'&&c.path.endsWith('/messages')).length;
      const before=messageReads();await review.getByRole('button',{name:'Open purchase draft',exact:true}).click();
      if(mobile)await page.waitForURL('**/purchases/new');else await page.getByRole('dialog',{name:'New Purchase',exact:true}).waitFor();
      await page.getByText('Invoice draft loaded. Verify all lines and payment details before saving. Nothing has been posted.',{exact:true}).waitFor();
      const purchase=mobile?page.locator('main.purchase-reference-page'):page.getByRole('dialog',{name:'New Purchase',exact:true});
      if(mobile)assert.match(await purchase.innerText(),/Invoice supplier/);else assert.equal(await purchase.locator('input').first().inputValue(),'Invoice supplier');
      await page.screenshot({path:`artifacts/ai-invoice/${mobile?'mobile':'web'}-purchase-draft.png`,fullPage:true});
      const draftReads=calls.filter(c=>c.path.startsWith('/ai-assistant/purchase-drafts/')).length;
      const note=mobile?purchase.getByRole('textbox',{name:'Note',exact:true}):purchase.locator('textarea').first();
      if(await note.count())await note.fill('Retained native invoice draft');
      await page.goBack();await editor.waitFor();assert.equal(await editor.inputValue(),'Retained invoice chat draft');assert.equal(messageReads(),before);
      await page.goForward();if(mobile)await page.waitForURL('**/purchases/new');else await purchase.waitFor();
      assert.equal(calls.filter(c=>c.path.startsWith('/ai-assistant/purchase-drafts/')).length,draftReads);
      if(await note.count())assert.equal(await note.inputValue(),'Retained native invoice draft');
      for(let step=0;step<3;step++)await purchase.getByRole('button',{name:'Continue',exact:true}).click();
      await purchase.getByRole('button',{name:mobile?'Save purchase':'Submit Purchase',exact:true}).waitFor();
      assert.match(await purchase.innerText(),/Invoice soap/);
      await page.screenshot({path:`artifacts/ai-invoice/${mobile?'mobile':'web'}-review-before-posting.png`,fullPage:true});
      await page.goBack();await editor.waitFor();
      assert.equal(calls.filter(c=>c.path.endsWith('/confirm')).length,1);
      assert.equal(calls.filter(c=>c.method!=='GET'&&!c.path.startsWith('/ai-assistant/')).length,0);
      assert.deepEqual(errors,[]);console.log(`${mobile?'Mobile':'Desktop'} invoice passed: explicit draft review, native prefill, Back/Forward and retained chat/form, no purchase writes.`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
