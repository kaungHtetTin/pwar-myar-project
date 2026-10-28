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
  const events=[],calls=[],errors=[];const permissions=['sell','products','billing'];
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
  subscription={is_valid:true,can_mutate:true,subscription:{plan_name:'Pro',subscription_plan_id:5,ends_at:'2027-02-01'},pending_request:null};events.push({id:1,event:'subscription.rejected',title:'Subscription request rejected',message:'Pro proof is unreadable',target:'billing'});await publish();
  const notice=page.locator('.subscription-app-alert');await notice.waitFor();assert.match(await notice.innerText(),/Pro/);assert.equal(await search.evaluate(e=>e===document.activeElement),true);
  for(const width of mobile?[320,375,768]:[1366]){await page.setViewportSize({width,height:812});const rect=await notice.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width);await page.screenshot({path:`artifacts/priority-alerts/${name}-${width}.png`,animations:'disabled'});}
  await page.waitForTimeout(400);
  const retained=mobile?search:page.locator('.product-table-card');const source=await retained.elementHandle();const reads=calls.filter(p=>p==='/products').length;
  await notice.getByRole('button',{name:'View billing',exact:true}).focus();await page.keyboard.press('Enter');await notice.waitFor({state:'hidden'});
  await page.locator(mobile?'.billing-reference-page:visible':'.billing-screen:visible').waitFor();await page.getByText('Pro',{exact:true}).first().waitFor();
  await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Rice');assert.equal(await retained.evaluate((node,previous)=>node===previous,source),true);assert.equal(calls.filter(p=>p==='/products').length,reads,'Back must not refetch source products');
  await page.goForward();await page.locator(mobile?'.billing-reference-page:visible':'.billing-screen:visible').waitFor();
  await page.goBack();
  await search.waitFor();assert.equal(await search.inputValue(),'Rice');assert.equal(await retained.evaluate((node,previous)=>node===previous,source),true);assert.equal(calls.filter(p=>p==='/products').length,reads);
  await publish();await page.waitForTimeout(150);assert.equal(await notice.count(),0);
  const resumed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/activity-alerts');await page.reload();await resumed;await search.waitFor();assert.equal(await notice.count(),0,'Reload must not replay approval');
  events.push({id:2,event:'subscription.suspended',title:'Subscription suspended',message:'Annual access suspended',target:'billing'});await publish();await notice.waitFor();await notice.getByRole('button',{name:'Dismiss activity notification',exact:true}).click();await notice.waitFor({state:'hidden'});
  events.push({id:3,event:'subscription.restored',title:'Subscription restored',message:'Access restored',target:'billing'});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await notice.waitFor();assert.match(await notice.innerText(),/restored/);await notice.getByRole('button',{name:'Dismiss activity notification',exact:true}).click();
  assert.deepEqual(errors,[]);console.log(`${name}: signed activity delivery without Shop module, responsive card, keyboard View billing, source-preserving Back, dismiss and reload deduplication passed.`);await context.close();
 }}finally{await browser.close();await new Promise(resolve=>service.io.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
