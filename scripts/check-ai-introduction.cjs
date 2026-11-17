const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-introduction', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: Number(process.env.AI_WIDTH || 393), height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
      const session = { user: { id: 1, name: 'Owner', role: process.env.AI_ROLE || 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings', 'billing'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null, billing = null, validationAttempts = 0;
      const options = { plans:[{id:1,name:'Monthly business plan',price:30000,currency:'MMK'}],payment_methods:[{id:1,provider:'KBZPay',account_name:'Min Htet Kyaw',account_last_four:'3805'}],images:[{id:7,name:'receipt.png',type:'image'}] };
      const summary = () => ({ items: proposal ? [{ ...proposal, preview: { ...proposal.preview, items: [] } }] : [], has_more: false });
      await page.addInitScript(language => {localStorage.setItem('mkpos.activeModule', 'products');localStorage.setItem('mkpos.language',language);},process.env.AI_LANGUAGE || 'en');
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname.startsWith('/src/')) return route.continue();
        const path = url.pathname.split('/api')[1], method = request.method();
        calls.push({ path, method, query: url.search, body: request.postData() });
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 }, status = 200;
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: ['products', 'sell', 'settings', 'billing'], permissions: session.permissions, language: process.env.AI_LANGUAGE || 'en', business: session.business };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories' || path === '/price-types') data = [];
        if (path === '/settings') data = { shop_name: 'Fixture shop', currency: 'MMK', language: process.env.AI_LANGUAGE || 'en' };
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
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-introduction/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();

      const intro=page.getByRole('region',{name:'About your AI assistant'});await intro.waitFor();
      const staff=process.env.AI_ROLE==='staff',my=process.env.AI_LANGUAGE==='my';
      assert.equal(await intro.locator('li').count(),staff?3:6);
      await intro.getByRole('heading',{level:2}).waitFor();
      assert.equal(await intro.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
      const scroll=page.getByLabel('AI conversation messages');
      assert.equal(await scroll.evaluate(n=>n.scrollTop),0);
      const name=`${mobile?'mobile':'web'}-${staff?'staff':'owner'}-${my?'my':'en'}`;
      await page.screenshot({path:`artifacts/ai-introduction/${name}-top.png`,fullPage:true});
      await intro.locator('footer').scrollIntoViewIfNeeded();
      await page.screenshot({path:`artifacts/ai-introduction/${name}-bottom.png`,fullPage:true});
      await editor.fill('Retained introduction draft');
      if(!mobile){await page.getByRole('button',{name:'Close AI chat',exact:true}).click();await entry.last().click();}else{await page.goBack();await page.goForward();}
      await editor.waitFor();assert.equal(await editor.inputValue(),'Retained introduction draft');
      assert.deepEqual(errors,[]);
      assert.equal(calls.filter(c=>c.method!=='GET').length,0);
      console.log(`${name}: intro, capabilities, overflow, scrolling and draft retention passed. No API writes.`);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
