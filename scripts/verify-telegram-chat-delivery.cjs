// Isolated chat fixtures: no real Telegram requests, messages or account changes.
const {chromium}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch();
 const output='artifacts/telegram-chat-delivery'; await fs.mkdir(output,{recursive:true});
 try { for(const width of (process.argv.includes('--mobile-only')?[320,393,768]:[1440,1920,320,393,768])) {
  const mobile=width<1000, label=mobile?'mobile':'web';
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[], writes=[];
  await page.clock.install();
  const uuid='12345678-1234-1234-1234-123456789abc';
  const product={id:10,name:'10PK 1110 - '+ '\u1006\u1014\u103a\u1021\u102d\u1010\u103a',price:70000,currency:'MMK',unit_name:'Unit',store_slug:'fixture-store',public_url:'https://shop.fixture.test/#/store/fixture-store/products/10'};
  const created_at=new Date().toISOString();
  const rows=[{id:1,sender:'customer',body:'Please send the product link',created_at},
   ...['sent','pending','sending','failed','delivery_unknown','not_sent'].map((status,index)=>({id:index+2,sender:'owner',body:['Product details','Queued message','Sending message','Failed message','Unconfirmed message','Old product message'][index],created_at,
     ...(index===0||index===5?{product}:{}),telegram_delivery:{status,can_retry:['failed','not_sent'].includes(status)}}))];
  const thread=()=>({uuid,id:uuid,customer_name:'Kaung (Telegram)',customer_active:true,customer_read_id:999,sales_ai_channel:'telegram',telegram_last_message_at:created_at,unread:0,updated_at:created_at,
    sales_ai:{enabled:true,name:'Sales assistant',mode:'human',version:1,responding:false},last_message:rows.at(-1)});
  const session={user:{id:1,name:'Owner',role:'owner'},business:{id:1,name:'Telegram fixture shop',timezone:'Asia/Yangon',currency:'MMK'},permissions:['shop','ecommerce_orders','ecommerce_process','ecommerce_settings'],subscription:{is_valid:true,can_mutate:true}};
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('mkpos.activeModule','shop');localStorage.setItem('mkpos.language','en');});
  await context.route('https://shop.fixture.test/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Public product fixture</h1>'}));
  await page.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204}));
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname.slice(4),method=request.method();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   let json={items:[],total:0,has_more:false,next_cursor:null,enabled:false,realtime_enabled:false};
   if(path==='/auth/me')json=session;
   else if(path==='/app-config')json={permissions:session.permissions,enabled_modules:['shop'],language:'en'};
   else if(path==='/shop-admin/owner-location')json={submitted:true};
   else if(path==='/shop-admin/chat/config')json={enabled:true,realtime_enabled:false,sales_ai_enabled:true};
   else if(path==='/shop-admin/chat')json={items:[thread()],total:1,next_cursor:null};
   else if(path.endsWith('/retry-telegram')){
    writes.push(path);const id=Number(path.split('/').at(-2)),row=rows.find(row=>row.id===id);
    row.telegram_delivery={status:'pending',can_retry:false};json={message:row};
   } else if(path.endsWith('/products'))json={items:[product],next_cursor:null};
   else if(path.endsWith('/messages')){
    if(method==='POST'){
     const data=request.postDataJSON();writes.push(data);const row={id:rows.at(-1).id+1,sender:'owner',body:data.body||'',created_at,...(data.product_id?{product}:{}),telegram_delivery:{status:'pending',can_retry:false}};
     rows.push(row);json={message:row,thread:thread()};
    }else{
     const ids=(url.searchParams.get('delivery_ids')||'').split(',').map(Number);
     json={thread:thread(),items:url.searchParams.has('after_id')?[]:rows,has_more:false,delivery_updates:rows.filter(row=>ids.includes(row.id)).map(row=>({id:row.id,telegram_delivery:row.telegram_delivery}))};
    }
   } else if(path.includes(uuid))json={thread:thread(),items:rows,has_more:false};
   await route.fulfill({json});
  });
  await page.goto(mobile?'http://127.0.0.1:5176/shop/chat':'http://127.0.0.1:5174/?shopTab=chat');
  try { await page.getByRole('button',{name:'Kaung (Telegram)',exact:!mobile}).click({timeout:10000}); } catch(error) { await page.screenshot({path:`${output}/${label}-${width}-error.png`,fullPage:true}); console.log({url:page.url(),headings:await page.getByRole('heading').allTextContents(),buttons:await page.getByRole('button').allTextContents(),errors}); throw error; }
  await page.getByLabel('Conversation messages',{exact:true}).waitFor();
  const messages=page.getByLabel('Conversation messages',{exact:true});
  await messages.getByLabel('Sent to Telegram',{exact:true}).waitFor();
  for(const name of ['Sent to Telegram','Queued for Telegram','Sending to Telegram','Telegram send failed','Telegram delivery unconfirmed','Not sent to Telegram']) assert.equal(await messages.getByLabel(name,{exact:true}).count(),1,name);
  assert.equal(await page.getByText('Offline',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Seen',{exact:true}).count(),0);
  assert.equal(await page.getByText('Active now',{exact:true}).count(),0);
  const editor=page.getByLabel('Message',{exact:true});await editor.fill('Keep this unsent draft');
  await messages.getByText('Failed message',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/${label}-${width}-statuses.png`,fullPage:true});
  const retry=messages.getByRole('button',{name:'Retry Telegram message 5'});await retry.click();
  await messages.getByText('Failed message',{exact:true}).waitFor();
  assert.equal(writes.filter(value=>typeof value==='string'&&value.endsWith('/5/retry-telegram')).length,1);
  assert.equal(await editor.inputValue(),'Keep this unsent draft');
  rows.find(row=>row.id===5).telegram_delivery={status:'sent',can_retry:false};
  await page.clock.fastForward(31000);
  await page.waitForFunction(()=>[...document.querySelectorAll('article')].some(row=>row.textContent.includes('Failed message')&&row.textContent.includes('Sent to Telegram')),{},{timeout:25000});
  const links=page.locator(`a[href="${product.public_url}"]`);assert.equal(await links.count(),2);
  const productPage=context.waitForEvent('page');await links.first().click();const opened=await productPage;await opened.waitForLoadState();assert.equal(opened.url(),product.public_url);await opened.close();
  assert.equal(await editor.inputValue(),'Keep this unsent draft');
  await editor.fill('');await page.getByRole('button',{name:'Share product',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('button',{name:new RegExp('10PK 1110')}).click();
  if(mobile)await dialog.getByRole('button',{name:'Attach product',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===8);
  assert.equal(writes.filter(value=>typeof value==='object'&&value.product_id===10&&value.body==='').length,1);
  assert.ok(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/${label}-${width}-product.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`${label} ${width}: accurate statuses, no fake presence/seen, one retry, retained draft, public product link and product-only send passed.`);
  await context.close();
 } }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
