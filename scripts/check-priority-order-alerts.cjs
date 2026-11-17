const {chromium}=require('../shop/node_modules/playwright');
const {createHmac}=require('node:crypto');const {once}=require('node:events');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const {createChatServer}=await import('../realtime-server/server.js');const secret='activity-browser-secret-at-least-thirty-two-characters';
 const service=createChatServer({secret,origins:['http://127.0.0.1:5174','http://127.0.0.1:5176']});service.http.listen(0,'127.0.0.1');await once(service.http,'listening');const port=service.http.address().port;
 const browser=await chromium.launch();await fs.mkdir('artifacts/priority-alerts',{recursive:true});
 try{for(const mobile of [true,false]){
  const name=mobile?'mobile':'web', channel='private-shop.activity.business.42';
  const context=await browser.newContext({viewport:{width:mobile?375:1366,height:812},serviceWorkers:'block'});
  await context.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204}));
  await context.addInitScript(()=>{if(!localStorage.getItem('fixture-ready')){localStorage.clear();sessionStorage.clear();localStorage.setItem('fixture-ready','1');localStorage.setItem('mkpos.activeModule','products');}});
  const events=[],calls=[],errors=[];const permissions=['sell','products','billing','shop','ecommerce_orders','ecommerce_payments','ecommerce_process'];
  let subscription={is_valid:true,can_mutate:true,subscription:{plan_name:'Trial',ends_at:'2027-01-01'},pending_request:{id:1,plan_name:'Pro'}};
  await context.route('**/api/**',async route=>{
   if(!new URL(route.request().url()).pathname.startsWith('/api/'))return route.continue();
   const endpoint=new URL(route.request().url()).pathname.slice(4);calls.push(endpoint);let data={items:[],total:0};
   if(endpoint==='/auth/me')data={user:{id:1,name:'Owner',role:'owner'},business:{id:42,name:'Demo shop'},permissions,subscription};
   if(endpoint==='/app-config')data={enabled_modules:permissions,permissions,language:'en',business:{name:'Demo shop'}};
   if(endpoint==='/settings')data={currency:'Ks',price_types:'Retail',payment_methods:'Cash'};
   if(endpoint==='/categories')data=[];
   if(endpoint==='/products')data={items:[{id:7,name:'Rice',sku:'RICE-1',category:'Food',base_unit:'Bag',stock:20,price:1000,prices:[{name:'Retail',price:1000}]}],total:1};
   if(endpoint==='/products/summary')data={total_products:1,total_stock_units:20,low_stock:0,out_of_stock:0};
   if(endpoint==='/price-types')data={items:['Retail'],rules:[]};
   if(endpoint==='/subscription')data=subscription;
   if(endpoint==='/shop-admin/owner-location')data={submitted:true};
   if(endpoint==='/shop-admin/order-notifications')data={items:[],cursor:0};
   if(endpoint.endsWith('/chat/config'))data={enabled:false,realtime_enabled:false};
   if(endpoint.endsWith('/chat/notifications'))data={enabled:false,items:[],cursor:0,unread_count:0};
   if(endpoint==='/shop-admin/orders/42')data={id:42,reference:'O-1234567890ABCDEF',customer_name:'Buyer',status:'accepted',payment_status:'unpaid',fulfillment:'pickup',currency:'Ks',subtotal:1000,total:1000,delivery_fee:0,items:[],payments:[],events:[],customer_requests:[],payment_reviews:[],payment_method:{name:'Cash',type:'cash',provider:'manual'},created_at:'2026-10-17 12:00:00'};

   if(endpoint==='/subscription/plans')data={items:[{id:5,name:'Pro',slug:'pro',price:25000,currency:'Ks',duration_days:30,features:[]}]};
   if(endpoint==='/activity-alerts/config')data={realtime_enabled:true,scheme:'http',host:'127.0.0.1',port,channel};
   if(endpoint==='/activity-alerts/auth'){const payload=Buffer.from(JSON.stringify({channel,role:'owner',business_id:42,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');data={token:payload+'.'+createHmac('sha256',secret).update(payload).digest('hex')};}
   if(endpoint==='/activity-alerts'){const cursor=new URL(route.request().url()).searchParams.get('after_id');data={cursor:events.at(-1)?.id||0,items:cursor===null?[]:events.filter(e=>e.id>Number(cursor)),has_more:false,subscription};}
   await route.fulfill({status:200,json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${mobile?5176:5174}${mobile?'/products':'/'}`);
  const search=page.getByRole('textbox',{name:mobile?'Search products':'Search products or scan barcode',exact:true});await search.waitFor().catch(async error=>{console.log(await page.locator('body').innerText(),errors,calls.slice(-20));throw error;});await search.fill('Rice');
  await page.waitForFunction(()=>localStorage.getItem('mkpos.activity-alert-cursor:/activity-alerts:1:42')!==null);
  for(let tries=0;tries<50&&!Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel);tries++)await new Promise(r=>setTimeout(r,100));
  assert.ok(Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel),'Activity socket connected without Shop module: '+JSON.stringify(calls.filter(path=>path.includes('activity-alerts'))));
  const publish=async()=>{const body=JSON.stringify({channels:[channel],event:'activity.changed',data:{event_id:events.at(-1).id}}),timestamp=String(Math.floor(Date.now()/1000));assert.equal((await fetch(`http://127.0.0.1:${port}/events`,{method:'POST',headers:{'X-Chat-Timestamp':timestamp,'X-Chat-Signature':createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex')},body})).status,200);};
  events.push({id:1,event:'proof_submitted',title:'Payment proof submitted',message:'Order proof',target:'order',order_id:42},{id:2,event:'cancellation_requested',title:'Cancellation requested',message:'Order cancellation',target:'order',order_id:42},{id:3,event:'return_requested',title:'Return/refund requested',message:'Order return',target:'order',order_id:42});await publish();
  const notice=page.locator('.owner-activity-alert');await notice.waitFor();assert.match(await notice.innerText(),/Payment proof submitted/);
  await notice.getByRole('button',{name:'Dismiss activity notification'}).click();assert.match(await notice.innerText(),/Cancellation requested/);
  const retained=mobile?search:page.locator('.product-table-card');const source=await retained.elementHandle();
  await notice.getByRole('button',{name:'View order',exact:true}).focus();await page.keyboard.press('Enter');
  const detail=page.locator('.shop-order-detail:visible');await detail.waitFor();assert.match(await notice.innerText(),/Return.refund requested/);await notice.getByRole('button',{name:'Dismiss activity notification'}).click();
  const original=await detail.elementHandle();const orderReads=calls.filter(path=>path==='/shop-admin/orders/42').length;
  events.push({id:4,event:'proof_submitted',title:'Payment proof submitted',message:'New payment proof',target:'order',order_id:42});await publish();await notice.waitFor();
  for(let tries=0;tries<30&&calls.filter(path=>path==='/shop-admin/orders/42').length===orderReads;tries++)await page.waitForTimeout(50);
  assert.ok(calls.filter(path=>path==='/shop-admin/orders/42').length>orderReads);assert.equal(await detail.evaluate((node,old)=>node===old,original),true);
  await page.waitForTimeout(250);await page.screenshot({path:`artifacts/priority-alerts/${name}-order.png`});await notice.getByRole('button',{name:'Dismiss activity notification'}).click();
  await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Rice');assert.equal(await retained.evaluate((node,old)=>node===old,source),true);
  assert.deepEqual(errors,[]);console.log(`${name}: proof/cancellation/return alerts queue once, keyboard View order opens the correct order, background refresh preserves detail content, Back restores source search and dismissal passed.`);await context.close();
 }}finally{await browser.close();await new Promise(resolve=>service.io.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
