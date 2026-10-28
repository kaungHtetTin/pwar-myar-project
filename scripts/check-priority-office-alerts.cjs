const {chromium}=require('../shop/node_modules/playwright');
const {createHmac}=require('node:crypto');const {once}=require('node:events');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const {createChatServer}=await import('../realtime-server/server.js');const secret='office-activity-browser-secret-at-least-thirty-two-characters',channel='private-office.activity';
 const service=createChatServer({secret,origins:['http://127.0.0.1:5175']});service.http.listen(0,'127.0.0.1');await once(service.http,'listening');const port=service.http.address().port;
 const browser=await chromium.launch();await fs.mkdir('artifacts/priority-alerts',{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'}),events=[],calls=[],errors=[];let rejectionCalls=0;
  await context.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204}));
  const business={id:42,name:'Alert Shop',owner_name:'Owner',owner_email:'owner@example.test',status:'active',currency:'Ks',timezone:'Asia/Yangon'};
  const request={id:11,business_id:42,business_name:'Alert Shop',plan_name:'Pro',status:'pending',price:25000,currency:'Ks',duration_days:30,payment_bank:'Demo bank',payment_account_name:'PwarMyar',payment_account_no:'1234',payment_screenshot_available:true,payment_screenshot_url:'/api/office/subscription-requests/11/payment-screenshot',created_at:'2026-10-17 12:00:00'};
  const report={id:7,business_id:42,shop_name:'Alert Shop',shop_slug:'alert-shop',customer_name:'Buyer',customer_email:'buyer@example.test',reason:'payment_issue',details:'Please review the payment issue for this shop.',status:'open',version:1,created_at:'2026-10-17 12:00:00',updates:[]};
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());if(!url.pathname.startsWith('/api/'))return route.continue();const path=url.pathname.slice(4);calls.push({path,query:url.search});let data={items:[]};
   if(path==='/office/auth/me')data={admin:{id:8,name:'Office',email:'office@example.test'}};
   if(path==='/office/businesses')data={items:[business],page:1,per_page:25,last_page:1,total:1,summary:{total:1,access_counts:{}}};
   if(path==='/office/financial-report')data=null;
   if(path==='/office/subscription-requests')data={items:events.some(item=>item.target==='subscription-request')?[request]:[]};
   if(path==='/office/subscription-requests/11/reject'){
    assert.equal(route.request().postDataJSON().admin_note,'Proof is blurry. Please upload a readable image.');rejectionCalls++;
    if(rejectionCalls===1)return route.fulfill({status:503,json:{message:'Temporary rejection failure'}});
    request.status='rejected';data={ok:true};
   }
   if(path==='/office/ecommerce/reports')data={items:[report],page:1,per_page:25,last_page:1,total:1};
   if(path==='/office/ecommerce/reports/7')data=report;
   if(path==='/office/subscription-requests/11/payment-screenshot')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6xoAAAAASUVORK5CYII=','base64')});
   if(path==='/office/activity-alerts/config')data={realtime_enabled:true,scheme:'http',host:'127.0.0.1',port,channel};
   if(path==='/office/activity-alerts/auth'){const payload=Buffer.from(JSON.stringify({channel,role:'office',admin_id:8,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');data={token:payload+'.'+createHmac('sha256',secret).update(payload).digest('hex')};}
   if(path==='/office/activity-alerts'){const cursor=url.searchParams.get('after_id');data={cursor:events.at(-1)?.id||0,items:cursor===null?[]:events.filter(item=>item.id>Number(cursor)),has_more:false};}
   await route.fulfill({status:200,json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5175/');
  await page.getByRole('button',{name:'Businesses',exact:true}).click();const search=page.getByRole('searchbox',{name:'Search businesses',exact:true});await search.fill('Alert');
  await page.waitForTimeout(450);await page.getByRole('button',{name:'Actions for Alert Shop',exact:true}).waitFor();
  const sourcePanel=page.getByRole('table').locator('xpath=ancestor::section[1]');const source=await sourcePanel.elementHandle();const reads=()=>calls.filter(call=>call.path==='/office/businesses').length;
  for(let tries=0;tries<100&&!Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel);tries++)await new Promise(r=>setTimeout(r,100));assert.ok(Array.from(service.io.sockets.sockets.values()).some(s=>s.data.channel===channel));
  const publish=async()=>{const body=JSON.stringify({channels:[channel],event:'activity.changed',data:{event_id:events.at(-1).id}}),timestamp=String(Math.floor(Date.now()/1000));assert.equal((await fetch(`http://127.0.0.1:${port}/events`,{method:'POST',headers:{'X-Chat-Timestamp':timestamp,'X-Chat-Signature':createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex')},body})).status,200);};
  events.push({id:1,event:'subscription.requested',title:'New subscription request',message:'Alert Shop',target:'subscription-request',entity_id:11});await publish();const notice=page.locator('.office-activity-alert');await notice.waitFor();assert.equal(await search.evaluate(e=>e===document.activeElement),true);
  await page.screenshot({path:'artifacts/priority-alerts/office-subscription.png'});await notice.getByRole('button',{name:'Review request'}).focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog',{name:'Payment screenshot',exact:true}).waitFor();await page.getByRole('button',{name:'Close payment screenshot',exact:true}).click();
  const openRejection=async()=>{await page.getByRole('button',{name:'Actions for request 11',exact:true}).click();await page.getByRole('menuitem',{name:'Reject request',exact:true}).click();};
  await openRejection();await page.getByRole('dialog',{name:'Reject subscription request',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(rejectionCalls,0);
  await openRejection();const rejection=page.getByRole('dialog',{name:'Reject subscription request',exact:true});const reason=rejection.getByLabel('Reason sent to owner');await reason.fill('Proof is blurry. Please upload a readable image.');
  await rejection.getByRole('button',{name:'Reject request',exact:true}).click();await rejection.getByRole('alert').waitFor();assert.equal(await reason.inputValue(),'Proof is blurry. Please upload a readable image.');
  await rejection.getByRole('button',{name:'Reject request',exact:true}).click();await rejection.waitFor({state:'hidden'});assert.equal(rejectionCalls,2);
  await page.waitForTimeout(100);const readsBeforeBack=reads();await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Alert');assert.equal(await page.getByRole('table').locator('xpath=ancestor::section[1]').evaluate((node,old)=>node===old,source),true);assert.equal(reads(),readsBeforeBack);
  events.push({id:2,event:'shop.reported',title:'New shop report',message:'Alert Shop',target:'shop-report',entity_id:7});await publish();await notice.waitFor();await notice.getByRole('button',{name:'Review report'}).click();
  const readsAfterRejection=reads();await page.getByRole('dialog',{name:'Review report #7',exact:true}).waitFor();await page.getByRole('button',{name:'Close report review',exact:true}).click();await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Alert');assert.equal(reads(),readsAfterRejection);
  await publish();await page.waitForTimeout(150);assert.equal(await notice.count(),0);
  const resumed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/office/activity-alerts');await page.reload();await resumed;assert.equal(await notice.count(),0);
  events.push({id:3,event:'shop.reported',title:'New shop report',message:'Alert Shop',target:'shop-report',entity_id:7});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await notice.waitFor();await notice.getByRole('button',{name:'Dismiss activity notification'}).click();assert.equal(await notice.count(),0);
  assert.deepEqual(errors,[]);console.log('Office: live subscription/report alerts, exact review targets, keyboard opening, rejection reason/cancel/failure/retry, retained Businesses search/table/Back, reload deduplication and polling recovery passed. Mutations were intercepted fixtures only.');
 }finally{await browser.close();await new Promise(resolve=>service.io.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
