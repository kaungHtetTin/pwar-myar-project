const {chromium}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch();await fs.mkdir('artifacts/sell-scroll',{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('mkpos.activeModule','sell'));
  const calls=[],errors=[];
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());if(!url.pathname.startsWith('/api/'))return route.continue();
   const path=url.pathname.slice(4);calls.push(path);let data={items:[],total:0};
   if(path==='/auth/me')data={user:{id:1,name:'Demo Owner',role:'owner'},business:{id:42,name:'Demo shop'},permissions:['sell','products','billing'],subscription:{is_valid:true}};
   if(path==='/app-config')data={enabled_modules:['sell','products','billing'],language:'en'};
   if(path==='/settings')data={price_types:'Retail',payment_methods:'Cash',currency:'Ks'};
   if(path==='/categories')data=[];
   if(path==='/products')data={items:Array.from({length:60},(_,i)=>({id:i+1,name:'Product '+(i+1),stock:100,price:1000,base_unit:'Unit',prices:[{name:'Retail',price:1000}]})),total:60};
   if(path==='/subscription/alerts')data={cursor:0,items:[]};
   await route.fulfill({status:200,json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5174/');
  const grid=page.locator('.sale-product-grid'),cart=page.locator('.sale-cart-items');await page.locator('.sale-product-card').first().waitFor();
  for(let i=0;i<18;i++)await page.locator('.sale-product-card').nth(i).click();
  for(const size of [{width:1366,height:768},{width:1280,height:600},{width:1920,height:1080}]){
   await page.setViewportSize(size);
   for(const panel of [grid,cart]){
    await panel.evaluate(e=>e.scrollTop=0);const dims=await panel.evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,bottom:e.getBoundingClientRect().bottom}));
    assert.ok(dims.height>0&&dims.scroll>dims.height,JSON.stringify(dims));assert.ok(dims.bottom<=size.height);
    await panel.hover();await page.mouse.wheel(0,550);await page.waitForTimeout(180);assert.ok(await panel.evaluate(e=>e.scrollTop)>0,'Wheel scrolls panel');
    await panel.evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await panel.evaluate(e=>Math.abs(e.scrollHeight-e.scrollTop-e.clientHeight))<=1,'Panel reaches its last item');
   }
   const checkout=await page.getByRole('button',{name:'Checkout',exact:true}).boundingBox();assert.ok(checkout.y>=0&&checkout.y+checkout.height<=size.height,'Checkout remains visible');
   assert.equal(await page.evaluate(()=>window.scrollY),0,'POS canvas stays fixed');
   await page.screenshot({path:`artifacts/sell-scroll/${size.width}-${size.height}.png`,animations:'disabled'});
  }
  const source=await grid.elementHandle();const position=await grid.evaluate(e=>e.scrollTop);const reads=calls.filter(p=>p==='/products').length;
  await page.getByRole('button',{name:'Checkout',exact:true}).click();await page.getByRole('dialog',{name:'Checkout',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await grid.evaluate(e=>e.scrollTop),position);assert.equal(await grid.evaluate((e,old)=>e===old,source),true);
  await page.getByRole('button',{name:'Products',exact:true}).click();await page.goBack();await grid.waitFor();
  await page.waitForTimeout(100);assert.equal(await grid.evaluate((e,old)=>e===old,source),true);assert.equal(await grid.evaluate(e=>e.scrollTop),position);assert.equal(calls.filter(p=>p==='/products').length,reads+1,'Only Products module loads, returning to Sell does not refetch');
  assert.equal(calls.some(p=>p==='/sales'),false);assert.deepEqual(errors,[]);
  console.log('Product/cart wheel scrolling reaches last items at 1366x768, 1280x600 and 1920x1080. Checkout visible; Cancel and module Back retain scroll/cart without Sell refetch. No sales submitted.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
