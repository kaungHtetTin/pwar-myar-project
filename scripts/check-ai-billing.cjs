const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-billing', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: Number(process.env.AI_WIDTH || 393), height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings', 'billing'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null, billing = null, validationAttempts = 0;
      const options = { plans:[{id:1,name:'Monthly business plan',price:30000,currency:'MMK'}],payment_methods:[{id:1,provider:'KBZPay',account_name:'Min Htet Kyaw',account_last_four:'3805'}],images:[{id:7,name:'receipt.png',type:'image'}] };
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
        if (path === '/app-config') data = { enabled_modules: ['products', 'sell', 'settings', 'billing'], permissions: session.permissions, language: 'en', business: session.business };
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
            billing = {id:'draft',revision:1,status:'draft',image_message_id:7,message:'',options};
          }
          data = {items:thread.messages,actions:summary(),billing_requests:billing?[billing]:[],has_more:false};
        }
        if(path.includes('/billing-requests/')) {
          if(path.endsWith('/validate')) billing={...billing,...request.postDataJSON(),revision:billing.revision+1,status:'validated',preview_hash:'a'.repeat(64),expires_at:'2099-01-01T00:00:00Z',review:{plan:options.plans[0],payment_method:options.payment_methods[0],observed:{amount:'30000',currency:'MMK',transaction_reference:'KBZ-123456'},checks:['recipient_name','recipient_account','amount','currency','provider','payment_status'].map(field=>({field,status:'match'})),pending_request_ids:[]}};
          if(path.endsWith('/validate') && ++validationAttempts === 1) billing={...billing,status:'draft',preview_hash:null,error:'Payment proof already submitted. Check your billing requests.',review:{...billing.review,checks:[{field:'duplicate_payment',status:'mismatch'}]}};
          else if(path.endsWith('/validate')) billing.error=null;
          if(path.endsWith('/submit')) {assert.equal(request.postDataJSON().preview_hash,billing.preview_hash);billing={...billing,status:'submitted',request_id:25,request_status:'pending'};}
          if(path.endsWith('/cancel')) billing={...billing,status:'cancelled'};
          data=billing;
        }
        await route.fulfill({ status, json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/products' : 'http://127.0.0.1:5173/');
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-billing/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      await editor.fill('Change shop name to wyne business.');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();

      const form=page.getByRole('article',{name:'Billing request form'});await form.waitFor();
      await editor.fill('Retained chat draft');
      await form.getByLabel('Subscription plan',{exact:true}).selectOption('1');
      await form.getByLabel('PwarMyar receiving account',{exact:true}).selectOption('1');
      await form.getByLabel('Billing request note',{exact:true}).fill('Retained billing note');
      const reads=calls.filter(c=>c.method==='GET'&&c.path.endsWith('/messages')).length;
      if(mobile){await page.goBack();await page.waitForURL('**/products');await page.goForward();await editor.waitFor();}
      else{await page.getByRole('button',{name:'Maximize AI chat',exact:true}).click();await editor.waitFor();}
      assert.equal(await form.getByLabel('Billing request note',{exact:true}).inputValue(),'Retained billing note');
      await page.screenshot({path:`artifacts/ai-billing/${mobile?'mobile':'web'}-form.png`,fullPage:true});
      const submit=form.getByRole('button',{name:'Submit billing request',exact:true});assert.equal(await submit.isDisabled(),true);
      await form.getByRole('button',{name:'Validate payment',exact:true}).click();
      if(validationAttempts===1){
        const alert=form.getByRole('alert');await alert.waitFor();
        for(const node of [alert,form.locator('[data-validation-status="mismatch"]')]){
          const rgb=await node.evaluate(n=>getComputedStyle(n).color.match(/\d+/g).map(Number));assert.ok(rgb[0]>rgb[1]*1.4 && rgb[0]>rgb[2]*1.4,`Expected red error text: ${rgb}`);
        }
        await alert.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/ai-billing/${mobile?'mobile':'web'}-validation-error.png`,fullPage:true});
        assert.equal(await submit.isDisabled(),true);
        await form.getByRole('button',{name:'Validate payment',exact:true}).click();
      }
      await form.getByText('Ready for owner review',{exact:true}).waitFor();
      assert.equal(await submit.isDisabled(),true);
      await form.getByLabel('Approve billing submission',{exact:true}).check();
      await form.getByLabel('Billing request note',{exact:true}).fill('Edited billing note');assert.equal(await submit.isDisabled(),true);
      assert.equal(await form.getByLabel('Approve billing submission',{exact:true}).isChecked(),false);
      await form.getByRole('button',{name:'Validate payment',exact:true}).click();await form.getByText('Ready for owner review',{exact:true}).waitFor();
      await form.getByRole('button',{name:'Check billing status',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[aria-label="Billing request form"]')?.getAttribute('aria-busy')==='false');
      if(!mobile){await page.goBack();await entry.last().click();await editor.waitFor();}
      await form.getByRole('region',{name:'Receipt checks',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:`artifacts/ai-billing/${mobile?'mobile':'web'}-review.png`,fullPage:true});
      assert.equal(await form.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
      await form.getByLabel('Approve billing submission',{exact:true}).check();await submit.click();
      await form.getByText(/Request #25: Pending Office approval/).waitFor();assert.equal(calls.filter(c=>c.path.endsWith('/submit')).length,1);
      await page.screenshot({path:`artifacts/ai-billing/${mobile?'mobile':'web'}-submitted.png`,fullPage:true});
      await form.getByRole('button',{name:'Open Billing',exact:true}).click();
      if(mobile) await page.waitForURL('**/billing');else await page.waitForFunction(()=>localStorage.getItem('mkpos.activeModule')==='billing');
      await page.goBack();await editor.waitFor();assert.equal(await editor.inputValue(),'Retained chat draft');
      assert.equal(calls.filter(c=>c.method==='GET'&&c.path.endsWith('/messages')).length,reads);
      await editor.fill('Another payment form');await page.getByRole('button',{name:mobile?'Send AI message':'Send',exact:true}).click();
      await form.getByRole('button',{name:'Cancel billing form',exact:true}).click();await form.getByText('Billing form cancelled. Nothing was submitted from this form.',{exact:true}).waitFor();
      assert.equal(calls.filter(c=>c.path.endsWith('/submit')).length,1);assert.equal(calls.filter(c=>c.path.endsWith('/cancel')).length,1);
      assert.equal(calls.filter(c=>c.method!=='GET'&&!c.path.startsWith('/ai-assistant/')).length,0);assert.deepEqual(errors,[]);
      console.log(`${mobile?'Mobile':'Desktop'} billing passed: validation, renewed consent, one submit, cancel, retained drafts, Billing button and Back. API writes intercepted.`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
