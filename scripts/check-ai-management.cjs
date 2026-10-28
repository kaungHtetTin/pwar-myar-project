const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-management', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of process.env.AI_MOBILE_ONLY ? [true] : [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], calls = []; page.on('pageerror', e => errors.push(e.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
      let thread = null, sequence = 1, proposal = null, failPin = false;
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
            const kind=body.body,price=kind==='Price rules';
            const after=price?{pricing_mode:'automatic',markup_percent:15,apply_to_existing:true}:{items:[{product:'Soap / \u1006\u1015\u103a\u1015\u103c\u102c - Large refill pack',unit:'Unit',quantity:1,unit_price:100,line_total:100}],total:100,paid_amount:100,credit_amount:0};
            proposal={id:'review-'+sequence,operation:price?'manage_price_types':kind==='Sale'?'manage_sales':'manage_shop_orders',status:'pending',requires_pin:kind==='Sale',requires_payment_verification:kind==='Refund',requires_goods_verification:kind==='Return',preview_hash:'fixture-'+sequence,currency:'MMK',expires_at:'2099-01-01T00:00:00Z',preview:{items:price?[{name:'Wholesale',before:null,after},{name:'Retail',before:{markup_percent:0},after:{...after,markup_percent:20}}]:[{name:'Order ORDER-1',before:{total:90},after}],total:price?2:1,has_more:false}};
          }
          data = { items: thread?.messages || [], has_more: false, actions: summary() };
        }
        if (path.endsWith('/delivery')) data = { message: thread?.messages?.[0] || null, sent: !!thread?.messages?.length, seen: !!thread?.messages?.length };
        if (/\/actions\//.test(path)) {
          if (path.endsWith('/revise')) { const body = request.postDataJSON(); assert.equal(body.preview_hash, proposal.preview_hash); proposal = { ...proposal, id: 'revised-proposal', preview_hash: 'revised-hash', preview: { ...proposal.preview, items: [{ ...proposal.preview.items[0], after: body.values }] } }; }
          if (path.endsWith('/confirm')) {
            const body=request.postDataJSON();assert.equal(body.preview_hash,proposal.preview_hash);assert.equal(body.reviewed_count,proposal.preview.total);
            if(proposal.requires_pin){assert.equal(body.admin_pin,'4567');if(failPin){failPin=false;await route.fulfill({status:403,json:{message:'Incorrect admin PIN'}});return;}}
            if(proposal.requires_payment_verification)assert.equal(body.verified_payment,true);
            if(proposal.requires_goods_verification)assert.equal(body.verified_goods_return,true);
            proposal={...proposal,status:'completed',result:{saved:true,modules:['products','shop','sales']}};
          }
          if (path.endsWith('/cancel')) proposal = { ...proposal, status: 'cancelled' };
          data = proposal;
        }
        await route.fulfill({ status, json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/products' : 'http://127.0.0.1:5173/');
      const entry = page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }); await entry.last().waitFor().catch(async error => { await page.screenshot({path:'artifacts/ai-management/debug-mobile.png',fullPage:true}); console.log('Initial page', await page.locator('body').innerText(), calls.slice(-12), errors); throw error; });
      const sourceReads = () => calls.filter(c => c.path === '/products' && c.method === 'GET' && !c.query.includes('limit=500')).length;
      for (let attempt = 0; !sourceReads() && attempt < 50; attempt++) await page.waitForTimeout(20);
      assert.ok(sourceReads() > 0);
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading products"]'));
      const sourceNode = mobile ? await page.locator('main.products-page').elementHandle() : null;
      await entry.last().click();
      const editor = page.getByRole('textbox', { name: 'AI message' }); await editor.waitFor();
      for(const kind of ['Price rules','Sale','Refund','Return']) {
        await editor.fill(kind);await page.getByRole('button',{name:mobile?'Send AI message':'Send',exact:true}).click();
        const title=kind==='Price rules'?'Price types and rules':kind==='Sale'?'Sales':'Online order';await page.getByRole('button',{name:'Review '+title}).last().click();
        const article=page.getByRole('article',{name:'Review business changes'}),confirm=article.getByRole('button',{name:'Confirm changes',exact:true}),consent=article.getByRole('checkbox',{name:/I reviewed all/});await confirm.waitFor();assert.equal(await confirm.isDisabled(),true);
        if(kind==='Price rules')await article.getByText(/20/).last().waitFor();
        else {
          await article.getByRole('table',{name:'Proposed line items'}).waitFor();assert.equal(await consent.isDisabled(),true);
          if(kind==='Sale'){
            await article.getByLabel('Admin PIN',{exact:true}).fill('4567');
            if(!mobile){await editor.fill('Retained management draft');await page.getByRole('button',{name:'Maximize AI chat',exact:true}).click();await article.getByLabel('Admin PIN',{exact:true}).waitFor();assert.equal(await article.getByLabel('Admin PIN',{exact:true}).inputValue(),'');await article.getByLabel('Admin PIN',{exact:true}).fill('4567');}
          }
          if(kind==='Refund')await article.getByRole('checkbox',{name:'Verified actual payment'}).check();
          if(kind==='Return')await article.getByRole('checkbox',{name:'Confirmed goods returned'}).check();
        }
        await consent.check();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
        await page.screenshot({path:`artifacts/ai-management/${mobile?'mobile':'web'}-${kind.replaceAll(' ','-')}.png`,fullPage:true});
        if(kind==='Sale'){failPin=true;await confirm.click();await page.getByRole('alert').waitFor();assert.equal(await article.getByLabel('Admin PIN',{exact:true}).inputValue(),'');assert.equal(await confirm.isDisabled(),true);await article.getByLabel('Admin PIN',{exact:true}).fill('4567');await consent.check();}
        if(kind==='Return'){await article.getByRole('button',{name:'Cancel proposal'}).click();await page.getByText('Proposal cancelled. Ask the assistant for a new proposal if needed.').waitFor();}
        else {await confirm.click();await page.getByText('Changes saved.',{exact:true}).waitFor();}
        await article.getByRole('button',{name:'Close review'}).click();
      }
      await editor.fill('Retained management draft');const sourceBeforeBack=sourceReads();
      if(mobile){await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL('**/products');assert.equal(sourceReads(),sourceBeforeBack);assert.equal(await page.locator('main.products-page').evaluate((node,old)=>node===old,sourceNode),true);await page.goForward();await editor.waitFor();assert.equal(await editor.inputValue(),'Retained management draft');await page.goBack();await page.waitForURL('**/products');assert.equal(sourceReads(),sourceBeforeBack);await page.goForward();await editor.waitFor();}
      else {await page.getByRole('button',{name:/^Back/}).first().click();await entry.last().click();await editor.waitFor();assert.equal(await editor.inputValue(),'Retained management draft');}
      assert.equal(calls.filter(c=>c.path.endsWith('/confirm')).length,4);assert.equal(calls.filter(c=>c.path.endsWith('/cancel')).length,1);assert.deepEqual(errors,[]);
      console.log(`${mobile?'Mobile':'Web'} management passed: price markup, tables, PIN retry/privacy, funds/goods gates, approve/cancel and retained source. All API writes intercepted.`);await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
