const { setDrawerLanguage } = require('./drawer-language.cjs');
// Fixture-only verification: intercept all API reads and mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const engine=process.env.ORDERS_BROWSER || 'chromium', output=path.resolve(__dirname,'../artifacts/shop-orders-reference',engine);
  await fs.mkdir(output,{recursive:true});
  const browser=await ({chromium,firefox})[engine].launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:393,height:817}}), errors=[], calls=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{delete window.IntersectionObserver;});
    const session={user:{id:1,name:'Owner',role:'owner'},business:{id:1,name:'Demo Shop',currency:'Ks',timezone:'Asia/Rangoon'},permissions:['sell','sales','products','customers','shop','ecommerce_orders','ecommerce_process','ecommerce_payments','ecommerce_refunds','ecommerce_settings'],subscription:{is_valid:true}};
    const items=[{product_id:1,name:'Jasmine Rice (5 kg)',quantity:2,unit_name:'bag',unit_price:12000,line_total:24000},{product_id:2,name:'Cooking Oil (1 L)',quantity:1,unit_name:'bottle',unit_price:8500,line_total:8500},{product_id:3,name:'Green Tea (50 g)',quantity:1,unit_name:'pack',unit_price:16500,line_total:16500}];
    let order={id:8,reference:'ORD1048',customer_name:'Emma Wilson',customer_key:'account:3',phone:'09 123 4567',address:'24 Market Street, Yangon',status:'packing',fulfillment:'delivery',payment_status:'paid',total:49000,currency:'Ks',created_at:'2026-10-15 10:24:00',item_count:3,items,item_previews:items,payment_method:{name:'AYA Bank',bank:'AYA Bank',account_name:'PwarMyar Co. Ltd.',account_no:'1842'},payments:[{id:1,type:'confirm',amount:49000,reference:'TXN024',created_at:'2026-10-15 10:30:00',actor_id:1}],events:[{id:1,event:'created',created_at:'2026-10-15 10:24:00'},{id:2,event:'accepted',created_at:'2026-10-15 10:25:00'},{id:3,event:'packing',created_at:'2026-10-15 10:31:00'}],customer_requests:[]};
    let loadFailure=true;
    await page.route('http://127.0.0.1:5176/api/**',async route=>{
      const r=route.request(),u=new URL(r.url()),endpoint=u.pathname.replace(/^.*\/api/,'');
      calls.push({endpoint,method:r.method(),query:u.search,body:r.method()==='POST'?r.postDataJSON():null});
      let json={items:[],total:0};
      if(endpoint==='/auth/me') json=session;
      else if(endpoint==='/app-config') json={enabled_modules:['sell','products','sales','customers','shop'],permissions:session.permissions,language:'en',business:{}};
      else if(endpoint==='/shop-admin/owner-location') json={submitted:true};
      else if(endpoint==='/shop-admin/orders') {
        const offset=Number(u.searchParams.get('offset')||0);
        if(offset>0 && loadFailure && !u.searchParams.has('export')) {loadFailure=false;return route.fulfill({status:503,json:{message:'Could not load more orders. Please try again.'}});}
        json={items:offset? [{...order,id:11,reference:'ORD1045'}]:[order,{...order,id:9,reference:'ORD1047',customer_name:'Daniel Lee',status:'pending',payment_status:'proof_submitted',fulfillment:'pickup',total:22000},{...order,id:10,reference:'ORD1046',customer_name:'Olivia Martin',status:'completed',total:18500}],total:4};
      }
      else if(endpoint==='/shop-admin/orders/999') return route.fulfill({status:404,json:{message:'Order not found.'}});
      else if(endpoint==='/shop-admin/orders/8') json=order;
      else if(endpoint.endsWith('/transition')) {order={...order,status:r.postDataJSON().status};json=order;}
      else if(endpoint.endsWith('/payments/confirm')) {assert.equal(r.postDataJSON().amount,49000);assert.equal(r.postDataJSON().verified,true);order={...order,payment_status:'paid'};json=order;}
      else if(endpoint.endsWith('/payments/refund')) {assert.equal(r.postDataJSON().amount,49000);json={...order,payment_status:'refunded'};}
      else if(endpoint.endsWith('/requests/4')) {assert.ok(r.postDataJSON().staff_note.length>=5);json=order;}
      else if(endpoint.includes('/customers/')) json={customer:{customer_key:'account:3',customer_name:'Emma Wilson',account_type:'account'},report:{currencies:[]}};
      return route.fulfill({status:200,json});
    });
    await page.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
    async function capture(id,full=false) {
      await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
      await page.screenshot({path:path.join(output,id+'.png'),fullPage:full,animations:'disabled'});
      for(const width of [320,768]) {await page.setViewportSize({width,height:817});if(id==='sorting-draft'){await page.getByRole('combobox',{name:'Sort orders',exact:true}).scrollIntoViewIfNeeded();const field=await page.getByRole('combobox',{name:'Sort orders',exact:true}).boundingBox(),body=await page.locator('.mobile-filter-drawer-body:visible').boundingBox();assert.ok(field.y>=body.y&&field.y+field.height<=body.y+body.height+1,'Sorting remains reachable above drawer actions');}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' overflow '+width);await page.screenshot({path:path.join(output,`${id}-${width}.png`),animations:'disabled'});}
      await page.setViewportSize({width:393,height:817});
    }
    const go=async route=>{await page.goto('http://127.0.0.1:5176'+route);try {await page.getByRole('heading',{level:1}).waitFor({timeout:10000});} catch(e) {await page.screenshot({path:path.join(output,'failure.png')});console.log(await page.locator('body').innerText(),calls,errors);throw e;}};
    await go('/shop/orders');await page.getByRole('button',{name:'View order ORD1048',exact:true}).waitFor();await capture('073');
    await page.getByRole('button',{name:'Filters',exact:true}).click();await page.waitForTimeout(300);await capture('120');
    await page.getByLabel('Order status',{exact:true}).selectOption('packing');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Filters',exact:true}).click();assert.equal(await page.getByLabel('Order status',{exact:true}).inputValue(),'');
    await page.getByLabel('Order status',{exact:true}).selectOption('packing');await Promise.all([page.waitForResponse(r=>r.url().includes('status=packing')),page.getByRole('button',{name:'Apply filters',exact:true}).click()]);
    await page.getByRole('button',{name:'Filters, 1 active filters',exact:true}).click();
    await page.getByRole('combobox',{name:'Sort orders',exact:true}).selectOption('oldest');
    await page.getByRole('combobox',{name:'Sort orders',exact:true}).scrollIntoViewIfNeeded();
    await capture('sorting-draft');
    for(const width of [320,375]) {
      await page.setViewportSize({width,height:667});
      const toggle=page.getByRole('switch',{name:/Pending customer requests only/});
      await page.locator('.shop-order-request-filter:visible').scrollIntoViewIfNeeded();
      const bounds=await page.locator('.shop-order-request-filter:visible').evaluate(row=>{const frame=row.getBoundingClientRect(),text=row.firstElementChild.getBoundingClientRect(),control=row.querySelector('.ui-switch').getBoundingClientRect();return {left:text.left-frame.left,right:frame.right-control.right,gap:control.left-text.right,width:control.width};});
      assert.ok(bounds.left>=12&&bounds.right>=12&&bounds.gap>=12&&bounds.width>=44,JSON.stringify(bounds));
      await toggle.check();assert.ok(await toggle.isChecked());await toggle.uncheck();
      await page.screenshot({path:path.join(output,`request-toggle-${width}.png`),animations:'disabled'});
    }
    await page.setViewportSize({width:393,height:817});
    await Promise.all([page.waitForResponse(r=>r.url().includes('sort=oldest')),page.getByRole('button',{name:'Apply filters',exact:true}).click()]);
    const before=calls.filter(c=>c.endpoint==='/shop-admin/orders').length;
    await page.getByRole('button',{name:'View order ORD1048',exact:true}).click();await page.getByRole('button',{name:'Dispatch order',exact:true}).waitFor().catch(()=>{});
    await capture('074',true);
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'View order ORD1048',exact:true}).waitFor();assert.equal(calls.filter(c=>c.endpoint==='/shop-admin/orders').length,before);
    await page.getByRole('button',{name:'Filters, 2 active filters',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Sort orders',exact:true}).inputValue(),'oldest');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Load more',exact:true}).click();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();await capture('158');await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'View order ORD1045',exact:true}).waitFor();
    await go('/shop/orders/8/action/dispatched');await page.getByRole('dialog',{name:'Mark as dispatched',exact:true}).waitFor();await capture('075');await page.getByRole('button',{name:'Cancel',exact:true}).click();
    order={...order,status:'accepted',payment_status:'unpaid'};
    await go('/shop/orders/8/action/cancelled');await page.getByRole('dialog',{name:'Cancel order?',exact:true}).waitFor();await page.getByLabel('Reason for cancellation',{exact:true}).fill('Buyer requested cancellation.');await capture('136');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Approve full payment',exact:true}).waitFor();
    assert.deepEqual(await page.locator('.shop-order-primary-actions:visible button').allTextContents(),['Start packing','Cancel order','Approve full payment']);
    assert.equal(await page.getByRole('button',{name:'More order actions',exact:true}).count(),0);
    assert.equal(await page.locator('.shared-app-bar').getByRole('button',{name:'Print order',exact:true}).count(),1);
    await page.setViewportSize({width:375,height:667});await capture('accepted-unpaid-actions');
    await go('/shop/orders/8/action/confirm');await page.getByRole('dialog',{name:'Confirm payment',exact:true}).waitFor();await capture('137');assert.ok(await page.getByRole('button',{name:'Confirm paid',exact:true}).isDisabled());await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm paid',exact:true}).click();await page.waitForURL('**/shop/orders/8');
    order={...order,status:'cancelled',payment_status:'refund_pending',sale_id:1048,sale_voided:true};
    await go('/shop/orders/8/action/refund');await page.getByRole('dialog',{name:'Refund review',exact:true}).waitFor();await capture('138');await page.getByRole('button',{name:'Cancel',exact:true}).click();
    order={...order,status:'completed',payment_status:'paid',customer_requests:[{id:4,type:'return',status:'pending',created_at:'2026-10-15 14:15:00',reason:'Damaged packaging. The rice bag arrived with torn packaging.'}]};
    await go('/shop/orders/8/requests/4/review');await page.getByRole('heading',{name:'Review decision',exact:true}).waitFor();await capture('076',true);await page.getByRole('radio',{name:'Reject return',exact:true}).check();await page.getByLabel('Review note',{exact:true}).fill('Please provide a photo of the packaging.');await page.getByRole('button',{name:'Save decision',exact:true}).click();await page.waitForURL('**/shop/orders/8');
    await page.getByRole('heading',{name:'Payment',exact:true}).scrollIntoViewIfNeeded();await page.evaluate(()=>{const el=[...document.querySelectorAll('.shop-order-payment-panel')].find(e=>e.offsetParent);if(el)window.scrollBy(0,el.getBoundingClientRect().top-65);});await capture('164');
    const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'Print order',exact:true}).click();const popup=await popupEvent;await popup.waitForLoadState();assert.match(await popup.locator('body').innerText(),/Order ORD1048/);await popup.close();
    await go('/shop/orders/999');await page.getByRole('heading',{name:'Order unavailable',exact:true}).waitFor();await capture('155');await page.getByRole('button',{name:'Back to orders',exact:true}).click();await page.waitForURL('**/shop/orders');
    await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await capture('myanmar-list');
    order={...order,customer_name:'ဒေါ်ခင်သီတာမင်း အောင်မြင်သောဆိုင်ရှင်',address:'အမှတ် ၂၄ ဗိုလ်ချုပ်လမ်း၊ ရန်ကုန်မြို့၊ မြန်မာနိုင်ငံ'};
    await page.locator('.shop-order-reference-card:visible').first().click();await page.locator('.shop-order-detail:visible').waitFor();await capture('myanmar-detail',true);
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({engine,errors,calls},null,2));console.log(engine+': orders visual and interaction checks passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
