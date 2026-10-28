const {chromium}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{for(const automatic of [false,true]){
  const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
  if(!automatic)await context.addInitScript(()=>window.IntersectionObserver=undefined);
  const calls=[];
  await context.route('**/api/ecommerce/**',async route=>{
   const url=new URL(route.request().url()),kind=url.pathname.endsWith('/products')?'products':url.pathname.endsWith('/shops')?'shops':null;
   let data={items:[],has_more:false};
   if(kind){
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||24);calls.push({kind,offset,limit});
    const rows=Array.from({length:26},(_,i)=>kind==='products'?{id:i+1,name:'Rice '+(i+1),store_slug:'demo',store_name:'Demo',price:1000,currency:'Ks',available_quantity:10,unit_name:'Bag'}:{slug:'shop-'+(i+1),display_name:'Shop '+(i+1),currency:'Ks',accepting_orders:true});
    data={items:offset===24?[rows[23],...rows.slice(24)]:rows.slice(offset,offset+limit),has_more:offset+limit<26};
   }
   await route.fulfill({status:200,json:data});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5177/#/marketplace');
  await page.getByRole('button',{name:'Shop Now',exact:true}).click();
  for(const kind of ['products','shops']){
   if(kind==='shops')await page.getByRole('button',{name:'Shops',exact:true}).click();
   const selector=kind==='products'?'.home-product-tile':'.home-shop-card';
   await page.waitForFunction(selector=>document.querySelectorAll(selector).length===24,selector);
   const more=page.getByRole('button',{name:'Load more',exact:true});
   if(automatic)await more.scrollIntoViewIfNeeded();else await more.click();
   await page.waitForFunction(selector=>document.querySelectorAll(selector).length===26,selector);
   assert.equal(await page.locator(selector).count(),26);assert.equal(await more.count(),0);
  }
  assert.deepEqual(errors,[]);
  for(const kind of ['products','shops'])assert.ok(calls.some(c=>c.kind===kind&&c.offset===24&&c.limit===24));
  console.log((automatic?'Automatic':'Manual fallback')+' product/shop pagination, overlapping page deduplication and exhaustion passed.');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
