const {chromium}=require('../shop/node_modules/playwright');
const {createHmac}=require('node:crypto');const {once}=require('node:events');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const {createChatServer}=await import('../realtime-server/server.js');const secret='customer-order-browser-secret-at-least-thirty-two-characters';
 const service=createChatServer({secret,origins:['http://127.0.0.1:5177']});service.http.listen(0,'127.0.0.1');await once(service.http,'listening');const port=service.http.address().port;
 const browser=await chromium.launch();await fs.mkdir('artifacts/customer-order-alerts',{recursive:true});
 try{
  for(const signedIn of [true,false]){
   const name=signedIn?'account':'guest';const reference='O-1234567890ABCDEF';const channel=signedIn?'private-shop.orders.customer.101':`private-shop.orders.tracking.${reference}`;
   const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
   await context.addInitScript(({signedIn,reference})=>{if(!localStorage.getItem('fixture-ready')){localStorage.clear();sessionStorage.clear();localStorage.setItem('fixture-ready','1');if(signedIn)localStorage.setItem('mkpos.shop.customerToken','demo-customer');else{sessionStorage.setItem('mkpos.shop.tracking',JSON.stringify({reference,credential:'private-credential'}));sessionStorage.setItem('mkpos.shop.tracking.customer','null');}}},{signedIn,reference});
   const events=[],calls=[],errors=[];let status='pending',holdRead=null;
   const order=(orderReference=reference)=>({reference:orderReference,status,payment_status:'unpaid',fulfillment:'pickup',currency:'Ks',subtotal:1000,delivery_fee:0,total:1000,items:[],payment_reviews:[],customer_requests:[],payment_method:{name:'Cash',type:'cash'}});
   await context.route('**/api/ecommerce/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname.split('/api/ecommerce')[1];const body=route.request().postDataJSON();calls.push({endpoint,body});let data={items:[],has_more:false,enabled:false,unread_count:0};
    if(endpoint==='/customer/me')data={customer:{id:101,name:'Demo buyer',email:'buyer@example.test'}};
    if(endpoint==='/order-alerts/config')data={enabled:true,realtime_enabled:true,scheme:'http',host:'127.0.0.1',port,channel};
    if(endpoint==='/order-alerts/auth'){const payload=Buffer.from(JSON.stringify({channel,role:'customer',...(signedIn?{customer_id:101}:{business_id:42}),exp:Math.floor(Date.now()/1000)+300})).toString('base64url');data={token:payload+'.'+createHmac('sha256',secret).update(payload).digest('hex')};}
    if(endpoint==='/order-alerts/feed'){if(!signedIn)assert.equal(body.credential,'private-credential');data={cursor:events.at(-1)?.id||0,items:body.after_id===undefined?[]:events.filter(e=>e.id>body.after_id),has_more:false};}
    if(endpoint==='/customer/notifications')data={items:[],has_more:false,unread_count:events.length};
    if(endpoint.startsWith('/customer/orders/O-')||endpoint==='/tracking'){if(holdRead)await holdRead;data=order(endpoint==='/tracking'?body.reference:endpoint.split('/').at(-1));}
    await route.fulfill({status:200,json:data});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5177/#/marketplace');
   const search=page.getByPlaceholder('Search products or categories');await search.waitFor();await search.fill('Rice');
   await page.waitForFunction(()=>localStorage.getItem('mkpos.order-alert-cursor:customer:101')!==null||localStorage.getItem('mkpos.order-alert-cursor:tracking:O-1234567890ABCDEF')!==null);
   for(let tries=0;tries<30&&!Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel);tries++)await new Promise(r=>setTimeout(r,100));
   assert.ok(Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel),'Live order socket connected');
   const publish=async()=>{const body=JSON.stringify({channels:[channel],event:'order.updated',data:{event_id:events.at(-1).id,reference:events.at(-1).reference}}),timestamp=String(Math.floor(Date.now()/1000));const response=await fetch(`http://127.0.0.1:${port}/events`,{method:'POST',headers:{'X-Chat-Timestamp':timestamp,'X-Chat-Signature':createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex')},body});assert.equal(response.status,200);};
   events.push({id:1,event:'accepted',reference,store_name:'Demo shop'},{id:2,event:'packing',reference,store_name:'Demo shop'});status='packing';await publish();
   const notice=page.locator('.customer-order-alert');await notice.waitFor();assert.match(await notice.innerText(),/Order accepted/);assert.equal(await search.evaluate(e=>e===document.activeElement),true);
   for(const width of [320,375,768,1366]){await page.setViewportSize({width,height:812});const rect=await notice.boundingBox();assert.ok(rect.x>=11&&rect.x+rect.width<=width-11);await page.screenshot({path:`artifacts/customer-order-alerts/${name}-${width}.png`,animations:'disabled'});}
   await notice.getByRole('button',{name:'Dismiss order notification'}).click();assert.match(await notice.innerText(),/Your order is being packed/);
   await notice.getByRole('button',{name:'View order'}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:reference}).waitFor();await notice.waitFor({state:'hidden'});
   const overview=await page.locator('.order-overview').elementHandle();let release;holdRead=new Promise(r=>{release=r;});status='ready_for_pickup';events.push({id:3,event:'ready_for_pickup',reference,store_name:'Demo shop'});await publish();await notice.waitFor();
   assert.equal(await page.locator('.order-overview').evaluate((node,previous)=>node===previous,overview),true);assert.equal(await page.locator('[data-page-loading]:visible').count(),0);
   release();holdRead=null;await page.locator('.order-overview').getByText(/^ready for pickup$/i).waitFor();
   await notice.getByRole('button',{name:'Dismiss order notification'}).click();await publish();await page.waitForTimeout(150);assert.equal(await notice.count(),0,'Duplicate event must not replay');
   if(signedIn){
    const secondReference='O-AAAAAAAAAAAAAAAA';const reads=calls.filter(call=>call.endpoint===`/customer/orders/${reference}`).length;
    events.push({id:4,event:'accepted',reference:secondReference,store_name:'Another shop'});await publish();await notice.waitFor();await notice.getByRole('button',{name:'View order'}).click();await page.getByRole('heading',{name:secondReference}).waitFor();
    await page.goBack();await page.getByRole('heading',{name:reference}).waitFor();
    assert.equal(await page.locator('.order-overview:visible').evaluate((node,previous)=>node===previous,overview),true,'Back restores the source order');
    assert.equal(calls.filter(call=>call.endpoint===`/customer/orders/${reference}`).length,reads,'Back retains the loaded source order');
   }
   await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Rice');
   const resumed=page.waitForResponse(response=>response.url().endsWith('/order-alerts/feed'));await page.reload();await resumed;await search.waitFor();assert.equal(await notice.count(),0,'Reload must not replay old statuses');
   events.push({id:events.at(-1).id+1,event:'completed',reference,store_name:'Demo shop'});status='completed';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await notice.waitFor();assert.match(await notice.innerText(),/Order completed/);
   await notice.getByRole('button',{name:'Dismiss order notification'}).click();
   assert.deepEqual(errors,[]);console.log(`${name}: signed socket delivery, queued status alerts, responsive card, keyboard View order, retained Back, background order refresh, deduplication and reload passed.`);
   await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>service.io.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
