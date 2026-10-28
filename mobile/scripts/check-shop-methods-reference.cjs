const { setDrawerLanguage } = require('./drawer-language.cjs');
// All APIs intercepted: no live receiving accounts or payment methods are changed.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176', engine = process.env.METHODS_BROWSER || 'chromium';
(async () => {
  const output = path.resolve('artifacts/shop-methods-reference'); await fs.mkdir(output, { recursive: true });
  const browser = await (engine === 'firefox' ? firefox : chromium).launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    const session = { user: { id: 301, role: 'owner', name: 'Owner' }, business: { id: 301, name: 'Evergreen Market' }, permissions: ['shop','sell','products','sales','ecommerce_settings'], subscription: { is_valid: true } };
    let methods = [{ id:'cash',name:'Cash',type:'cash',instructions:'Pay on pickup or delivery.',is_active:true,provider:'manual' },{ id:'bank',name:'KBZ Bank transfer',type:'transfer',bank:'KBZ Bank',account_name:'Evergreen Market',account_no:'00121842',instructions:'Upload transfer proof after payment.',is_active:true,provider:'manual' }];
    let failSave = true, failDelete = true; const calls = [], errors = [];
    await context.route('**/sanctum/csrf-cookie', r => r.fulfill({status:204}));
    await context.route(`${origin}/api/**`, async route => {
      const request=route.request(),endpoint=new URL(request.url()).pathname.slice(4),method=request.method(); calls.push({endpoint,method}); let data={items:[],total:0};
      if(endpoint==='/auth/me')data=session;
      else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
      else if(endpoint==='/settings')data={currency:'MMK',language:'en'};
      else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
      else if(endpoint.startsWith('/shop-admin/payment-methods')) {
        const id=endpoint.split('/')[3];
        if(method==='POST'||method==='PUT') {
          const input=request.postDataJSON();assert.equal(input.provider,'manual');assert.ok(!input.account_no.includes('••••'),'Never saves a masked account value');
          assert.deepEqual(Object.keys(input).sort(),['account_name','account_no','bank','instructions','is_active','name','provider','type']);
          if(failSave){failSave=false;return route.fulfill({status:422,json:{message:'Please review receiving details.',errors:{account_no:['Please review the account number.']}}});}
          if(method==='POST')methods.push({...input,id:'wallet'});else methods=methods.map(row=>row.id===id?{...row,...input}:row);
        } else if(method==='DELETE') {
          if(!methods.some(row=>row.id!==id&&row.is_active))return route.fulfill({status:422,json:{message:'Keep at least one active manual payment method.'}});
          if(failDelete){failDelete=false;return route.fulfill({status:503,json:{message:'Payment method could not be deleted. Retry.'}});}
          methods=methods.filter(row=>row.id!==id);
        }
        data={items:methods};
      }
      await route.fulfill({json:data});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const field=name=>page.getByRole('textbox',{name,exact:true});
    const count=(endpoint,method)=>calls.filter(call=>call.endpoint===endpoint&&call.method===method).length;
    async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
    async function responsive(name){await shot(name);for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${width} overflow`);await shot(`${name}-${width}`);}await page.setViewportSize({width:393,height:817});}
    async function menu(name){await page.getByRole('button',{name:`Actions for ${name}`,exact:true}).click();}
    await page.goto(`${origin}/shop/methods`);await page.getByRole('button',{name:'Actions for Cash',exact:true}).waitFor();await responsive('098');assert.equal(await page.getByText('00121842',{exact:true}).count(),0);
    const source=page.locator('.shop-methods-list');await source.evaluate(node=>node.dataset.retention='kept');
    await page.getByRole('button',{name:'Add payment method',exact:true}).click();await field('Method name').waitFor();
    await page.getByRole('button',{name:'Save method',exact:true}).click();assert.equal(await field('Method name').evaluate(node=>node.checkValidity()),false);assert.equal(count('/shop-admin/payment-methods','POST'),0);
    await field('Method name').fill('KBZ Bank transfer');await field('Bank / wallet').fill('KBZ Bank');await field('Account holder name').fill('Evergreen Market');await field('Account number / phone').fill('00121842');await field('Instructions for customers').fill('Upload transfer proof (e.g. screenshot of bank transfer receipt) after payment.');await responsive('099');
    await page.getByRole('radio',{name:/^Cash/}).check();await field('Bank / wallet').waitFor({state:'hidden'});await page.getByRole('radio',{name:/^Bank transfer/}).check();assert.equal(await field('Account number / phone').inputValue(),'00121842');
    const reads=count('/shop-admin/payment-methods','GET');await page.getByRole('button',{name:'Cancel',exact:true}).click();await source.waitFor();assert.equal(await source.getAttribute('data-retention'),'kept');assert.equal(count('/shop-admin/payment-methods','GET'),reads);await page.goForward();await field('Method name').waitFor();assert.equal(await field('Bank / wallet').inputValue(),'KBZ Bank');assert.equal(count('/shop-admin/payment-methods','GET'),reads);
    await field('Method name').fill('Wallet transfer');await page.getByRole('switch',{name:'Active',exact:true}).uncheck();await page.getByRole('button',{name:'Save method',exact:true}).click();await page.getByText('Please review the account number.',{exact:true}).last().waitFor();assert.equal(await field('Account number / phone').inputValue(),'00121842');assert.equal(await page.getByRole('switch',{name:'Active',exact:true}).isChecked(),false);await shot('save-error');await page.getByRole('button',{name:'Save method',exact:true}).click();await page.getByRole('button',{name:'Actions for Wallet transfer',exact:true}).waitFor();
    await menu('KBZ Bank transfer');await page.getByRole('button',{name:'Edit payment method',exact:true}).click();await field('Account number / phone').waitFor();assert.equal(await field('Account number / phone').inputValue(),'00121842');await responsive('100');
    const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));assert.equal(new Set(ids).size,ids.length,'Retained forms have unique IDs');
    await page.locator('.shop-method-active:visible').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));const active=await page.locator('.shop-method-active:visible').boundingBox(),footer=await page.locator('.shop-method-form:visible .shop-mobile-actions').boundingBox();assert.ok(active.y+active.height<=footer.y+1,'Last field scrolls above Save');await shot('active-status');
    await page.getByRole('switch',{name:'Active',exact:true}).uncheck();await page.getByRole('button',{name:'Save changes',exact:true}).click();await source.waitFor();
    await menu('Cash');await page.getByRole('button',{name:'Delete payment method',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete payment method',exact:true});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(call=>call.method==='DELETE').length,0);
    await menu('Cash');await page.getByRole('button',{name:'Delete payment method',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await page.getByText('Keep at least one active manual payment method.',{exact:true}).waitFor();await shot('last-active-error');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await menu('KBZ Bank transfer');await page.getByRole('button',{name:'Edit payment method',exact:true}).click();await page.getByRole('switch',{name:'Active',exact:true}).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();await source.waitFor();
    await menu('Wallet transfer');await page.getByRole('button',{name:'Delete payment method',exact:true}).click();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await page.getByText('Payment method could not be deleted. Retry.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Delete',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Actions for Wallet transfer',exact:true}).waitFor({state:'hidden'});
    methods[1].name='A long custom bank and mobile wallet payment method for the downtown branch';methods[1].account_name='A very long receiving account holder name at the downtown branch';await page.goto(`${origin}/shop/methods`);await page.getByRole('button',{name:`Actions for ${methods[1].name}`,exact:true}).waitFor();await page.setViewportSize({width:320,height:817});await shot('long-content-320');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await shot('myanmar');await page.locator('.shop-method-add').click();await page.locator('.shop-method-form:visible').waitFor();await shot('myanmar-form-320');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.shop-method-active:visible').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await shot('myanmar-status-320');
    methods=Array.from({length:20},(_,index)=>({...methods[0],id:`method-${index}`,name:`Cash ${index+1}`}));await page.goto(`${origin}/shop/methods`);await page.getByText('20 of 20',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Add payment method',exact:true}).isDisabled(),true);await page.goto(`${origin}/shop/methods/new`);await field('Method name').waitFor();assert.equal(await page.getByRole('button',{name:'Save method',exact:true}).isDisabled(),true);
    session.subscription.is_valid=false;await page.goto(`${origin}/shop/methods`);await page.getByRole('heading',{name:'Subscription required',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Add payment method',exact:true}).count(),0);
    session.subscription.is_valid=true;session.user.role='staff';session.permissions=['shop','ecommerce_orders'];await page.goto(`${origin}/shop/methods`);await page.getByRole('alert').filter({hasText:'unavailable'}).waitFor();assert.equal(await page.getByRole('button',{name:'Add payment method',exact:true}).count(),0);
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`verification-${engine}.json`),JSON.stringify({widths:[320,393,768],checks:['098/099/100 layouts','Masked list/full editable account','Cash and transfer drafts','Native name validation','Explicit manual payload','Save/delete retry','Last-active guard','Cancel/Back state retention','Unique retained field IDs','Footer clearance','Capacity','Myanmar/long names','Permission/subscription gates'],errors},null,2));console.log(`Shop methods ${engine}: reference and interaction checks passed.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
