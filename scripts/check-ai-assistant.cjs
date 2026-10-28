const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require('../shop/node_modules/playwright');
(async()=>{
 await fs.mkdir('artifacts/ai-assistant',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try {
  for (const mobile of process.env.AI_WEB_ONLY ? [false] : process.env.AI_MOBILE_ONLY ? [true] : [false,true]) {
   const context=await browser.newContext({viewport:mobile?{width:393,height:852}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
   const session={user:{id:1,name:'Owner',role:'owner'},business:{id:1,name:'Fixture shop',currency:'Ks',timezone:'Asia/Rangoon'},permissions:['products','sell','settings'],subscription:{is_valid:true,can_mutate:true,access_type:'paid'}};
   page.setDefaultTimeout(12000);
   const conversations=new Map();let nextId=1,holdReply=false,releaseReply;
   await page.addInitScript(()=>localStorage.setItem('mkpos.activeModule','products'));
   await page.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
   await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.pathname.startsWith('/src/'))return route.continue();const path=url.pathname.split('/api')[1],method=req.method();calls.push({path,method,query:url.search});
    let data={items:[],total:0,has_more:false,enabled:false,unread_count:0};let status=200;
    if(path==='/auth/me')data=session;
    if(path==='/app-config')data={enabled_modules:['products','sell','settings'],permissions:session.permissions,language:'en',business:session.business};
    if(path==='/subscription')data=session.subscription;
    if(path==='/categories'||path==='/price-types')data=[];
    if(path==='/settings')data={shop_name:'Fixture shop',currency:'Ks',language:'en'};
    if(path==='/products/summary')data={total_products:0,low_stock:0,out_of_stock:0};
    if(path==='/branding')data={primary_color:'#0e684e'};
    if(path==='/ai-assistant/config')data={enabled:true,configured:true,storage_ready:true,weekly_limit:50};
    if(path==='/ai-assistant/conversations'&&method==='POST'){const {id}=req.postDataJSON();if(!conversations.has(id))conversations.set(id,{id,title:'New conversation',messages:[]});data={conversation:{id}};}
    if(path==='/ai-assistant/conversations'&&method==='GET')data={items:[...conversations.values()].map(({id,title})=>({id,title,updated_at:'2026-10-25 07:30:00'})),has_more:false};
    if(/^\/ai-assistant\/conversations\/[^/]+\/messages$/.test(path)){
     const id=path.split('/')[3],thread=conversations.get(id)||{id,title:'Conversation',messages:[]};conversations.set(id,thread);
     if(method==='POST'){
      const body=req.postDataJSON();let message=thread.messages.find(m=>m.client_id===body.client_id);
      if(!message){message={id:nextId++,client_id:body.client_id,role:'user',body:body.body,status:'pending',created_at:new Date().toISOString()};thread.messages.push(message);}
      thread.title=body.body;
      if(holdReply) await new Promise(resolve=>{releaseReply=resolve;});
      if(body.body==='Retry example'&&message.status==='pending'){message.status='failed';data={message:'AI could not reply. Your message is saved; retry it shortly.'};status=503;}
      else {
       message.status='completed';let answer=thread.messages.find(m=>m.reply_to_id===message.id);
       if(!answer){answer={id:nextId++,role:'assistant',body:'မင်္ဂလာပါ။ Product CSV ကို စစ်ဆေးပြီးမှ Products စာမျက်နှာတွင် Import လုပ်နိုင်ပါတယ်။ ဈေးနှုန်းများကို ကိန်းပြည့်ဖြင့် ဖြည့်ပါ။',status:'completed',reply_to_id:message.id,created_at:new Date().toISOString()};thread.messages.push(answer);}
       data={items:[message,answer]};
      }
     }else data={items:thread.messages,has_more:false,conversation:{id}};
    }
    if(path.endsWith('/delivery')){
     const parts=path.split('/'),thread=conversations.get(parts[3]),message=thread?.messages.find(item=>item.client_id===parts[5]);
     data={message:message||null,sent:!!message,seen:!!message&&message.status==='pending'};
    }
    if(path==='/ai-assistant/product-template')data={filename:'mkpos-product-import-template.csv',csv:'Name,SKU,Retail\r\n'};
    await route.fulfill({status,json:data});
   });
   await page.goto(mobile?'http://127.0.0.1:5176/products':'http://127.0.0.1:5173/');
   await page.getByRole('button',{name:'PwarMyar AI assistant',exact:true}).first().waitFor().catch(async e=>{console.log('Initial fixture state',mobile,page.url(),calls.slice(-18),errors,await page.locator('body').innerText());await page.screenshot({path:'artifacts/ai-assistant/debug-mobile.png',fullPage:true});throw e;});
   const sourceReads=()=>calls.filter(c=>c.path==='/products'&&c.method==='GET'&&!c.query.includes('limit=500')).length;
   for(let attempt=0;!sourceReads()&&attempt<50;attempt++)await page.waitForTimeout(20);
   assert.ok(sourceReads()>0);
   const sourceNode=mobile?await page.locator('main.products-page').elementHandle():null;
   const before=sourceReads();
   await page.getByRole('button',{name:'PwarMyar AI assistant',exact:true}).last().click().catch(async e=>{console.log('Browser fixture state',mobile,page.url(),calls.slice(-18),errors);await page.screenshot({path:'artifacts/ai-assistant/debug.png',fullPage:true});await fs.writeFile('artifacts/ai-assistant/debug.html',await page.content());throw e;});
   const editor=page.getByRole('textbox',{name:'AI message'});await editor.waitFor();
   if(mobile){
    assert.equal(await page.locator('.shared-app-bar').getByRole('button',{name:'PwarMyar AI assistant',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'History',exact:true}).count(),1);
    assert.equal(await page.locator('.shared-app-bar').getByRole('button',{name:/^Shop chat/}).count(),0);
    for(const width of [393,320,768]){
     await page.setViewportSize({width,height:852});
     const layout=await page.locator('.ai-mobile-page .shop-chat-compose-row').evaluate(row=>{
      const [attach,input,send]=[...row.children].map(node=>node.getBoundingClientRect());
      const gap=parseFloat(getComputedStyle(row).columnGap);
      return {leftGap:input.left-attach.right,rightGap:send.left-input.right,gap,inputWidth:input.width,attachWidth:attach.width,sendWidth:send.width};
     });
     assert.ok(Math.abs(layout.leftGap-layout.gap)<1&&Math.abs(layout.rightGap-layout.gap)<1,JSON.stringify(layout));
     assert.ok(layout.inputWidth>150&&layout.attachWidth>=44&&layout.sendWidth>=44,JSON.stringify(layout));
    }
    await page.setViewportSize({width:393,height:852});
    await editor.fill('A longer message that wraps across multiple lines while keeping all available width.');
    await page.locator('.ai-mobile-page').screenshot({path:'artifacts/ai-assistant/mobile-composer.png'});
   }
   await editor.fill('Product CSV ဘယ်လို import လုပ်ရမလဲ');
   holdReply=true;
   await page.getByRole('button',{name:mobile?'Send AI message':'Send',exact:true}).click();
   if(!mobile){
    await page.getByLabel('Outgoing message',{exact:true}).waitFor();
    await page.getByText('PwarMyar AI is preparing a reply...', {exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Send',exact:true}).isDisabled(),true);
    assert.equal(await editor.inputValue(),'');
    await page.getByLabel('Seen',{exact:true}).waitFor();
    assert.equal(await page.getByText('Sending...', {exact:true}).count(),0);
    assert.equal(await page.locator('.ai-chat-typing-dots i').first().evaluate(node=>getComputedStyle(node).animationName),'ai-typing-dot');
    await page.locator('.ai-assistant-window').screenshot({path:'artifacts/ai-assistant/web-waiting.png'});
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.ai-chat-typing-dots i').first().evaluate(node=>getComputedStyle(node).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    for(let attempt=0;!releaseReply&&attempt<50;attempt++)await page.waitForTimeout(20);
    assert.equal(typeof releaseReply,'function');holdReply=false;releaseReply();
   }
   if(mobile){
    await page.getByText('Sending...', {exact:true}).waitFor();
    await page.getByLabel('Seen', {exact:true}).waitFor();
    assert.equal(await page.locator('.ai-mobile-page article:not(.is-mine)').count(),0);
    await page.screenshot({path:'artifacts/ai-assistant/mobile-delivery.png',fullPage:true});
    holdReply=false;releaseReply();
   }
   await page.getByText(/^မင်္ဂလာပါ။ Product CSV/).waitFor();
   await editor.fill('Draft retained');
   if(mobile){
    await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL('**/products');
    await page.goForward();await editor.waitFor();assert.equal(await editor.inputValue(),'Draft retained');
    assert.equal(await page.getByRole('dialog').count(),0);
   }else{
    await page.getByRole('button',{name:'Minimize chat',exact:true}).click();await page.getByRole('button',{name:'Expand AI chat'}).click();assert.equal(await editor.inputValue(),'Draft retained');
    await page.getByRole('button',{name:'Close AI chat'}).click();await page.getByRole('button',{name:'PwarMyar AI assistant',exact:true}).last().click().catch(async e=>{console.log('Browser fixture state',mobile,page.url(),calls.slice(-18),errors);await page.screenshot({path:'artifacts/ai-assistant/debug.png',fullPage:true});await fs.writeFile('artifacts/ai-assistant/debug.html',await page.content());throw e;});assert.equal(await editor.inputValue(),'Draft retained');
   }
   assert.equal(sourceReads(),before);
   if(mobile)assert.equal(await page.locator('main.products-page').evaluate((node,old)=>node===old,sourceNode),true);
   await editor.fill('Retry example');await page.getByRole('button',{name:mobile?'Send AI message':'Send',exact:true}).click();
   await page.getByRole('button',{name:'Retry message',exact:true}).waitFor();
   if(mobile){
    await page.waitForFunction(()=>!document.querySelector('textarea[aria-label="AI message"]').disabled);
    assert.equal(await editor.inputValue(),'');
    assert.equal(await page.getByRole('button',{name:'Refresh chat',exact:true}).count(),0);
    assert.equal((await page.getByRole('button',{name:'Retry message',exact:true}).innerText()).trim(),'');
    await page.getByText('Reply unavailable',{exact:true}).waitFor();
    await page.screenshot({path:'artifacts/ai-assistant/mobile-reply-unavailable.png',fullPage:true});
    await page.setViewportSize({width:320,height:852});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const retrySize=await page.getByRole('button',{name:'Retry message',exact:true}).boundingBox();
    assert.ok(retrySize.width>=44&&retrySize.height>=44);
    await page.screenshot({path:'artifacts/ai-assistant/mobile-reply-unavailable-320.png',fullPage:true});
    await page.setViewportSize({width:393,height:852});
   }
   await page.getByRole('button',{name:'Retry message',exact:true}).click();await page.getByRole('button',{name:'Retry message',exact:true}).waitFor({state:'hidden'});
   const messages=[...conversations.values()].flatMap(t=>t.messages);assert.equal(messages.filter(m=>m.body==='Retry example').length,1);
   await page.screenshot({path:`artifacts/ai-assistant/${mobile?'mobile':'web'}-chat.png`,fullPage:true});
   await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Retry example',exact:true}).waitFor();
   if(mobile){
    const drawer=page.getByRole('dialog',{name:'Conversations'});
    await drawer.waitFor();
    assert.equal(await drawer.getByRole('button',{name:'New chat',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Download CSV template'}).count(),0);
    await page.getByRole('list',{name:'Saved AI conversations'}).screenshot({path:'artifacts/ai-assistant/mobile-conversations.png'});
    await page.screenshot({path:'artifacts/ai-assistant/mobile-history.png',fullPage:true});
   }
   await page.getByRole('button',{name:'Retry example',exact:true}).click();await editor.waitFor();
   if(mobile){
    const currentMessages=page.locator('.ai-mobile-page .shop-mobile-messages');
    const mounted=await currentMessages.elementHandle();
    await editor.fill('Drawer retained draft');
    const prior=calls.filter(c=>c.path.includes('/messages')).length;
    await page.getByRole('button',{name:'History',exact:true}).click();
    await page.getByRole('button',{name:'Close Conversations'}).click();
    assert.equal(await editor.inputValue(),'Drawer retained draft');
    assert.equal(await currentMessages.evaluate((node,old)=>node===old,mounted),true);
    assert.equal(calls.filter(c=>c.path.includes('/messages')).length,prior);
    await page.getByRole('button',{name:'History',exact:true}).click();
   }
   await page.getByRole('button',{name:'New chat',exact:true}).click();assert.equal(await editor.inputValue(),'');
   assert.deepEqual(errors,[]);console.log(`${mobile?'Mobile':'Web'} AI chat passed: send, failed retry without duplicates, retained draft, history, New chat and source state. No live API or model calls.`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
