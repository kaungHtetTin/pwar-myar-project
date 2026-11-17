const {chromium}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch();await fs.mkdir('artifacts/shop-map',{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:393,height:852},serviceWorkers:'block',ignoreHTTPSErrors:true});
  const calls=[],errors=[];
  await context.route('**/api/ecommerce/**',async route=>{
   const path=new URL(route.request().url()).pathname.split('/api/ecommerce')[1];calls.push(path);let data={items:[],has_more:false,summary:null};
   if(path==='/stores/demo-shop-02')data={slug:'demo-shop-02',display_name:'Demo Shop 02',description:'Demo groceries and everyday essentials.',accepting_orders:true,currency:'Ks',categories:[],payment_methods:[],delivery_zones:[],pickup_instructions:'Collect at the demo shop counter.',address:'2 Demo Street, Yangon',phone:'09950000002',location:{latitude:16.8449,longitude:96.1775}};
   await route.fulfill({status:200,json:data});
  });
  await context.route('https://www.google.com/maps?**',route=>new URL(route.request().url()).searchParams.get('output') === 'embed' ? route.continue() : route.fulfill({status:200,contentType:'text/html',body:'<h1>External maps destination</h1>'}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5177/#/store/demo-shop-02?origin=marketplace');
  await page.getByRole('button',{name:'Location',exact:true}).click();
  const map=page.getByTitle('Shop location',{exact:true});await map.scrollIntoViewIfNeeded();
  assert.equal(await page.getByRole('tab',{name:'About',exact:true}).getAttribute('aria-selected'),'true');
  const url=new URL(await map.getAttribute('src'));assert.equal(url.hostname,'maps.google.com');assert.equal(url.searchParams.get('q'),'16.8449,96.1775');assert.equal(url.searchParams.get('output'),'embed');assert.equal(url.searchParams.has('key'),false);
  const frame=page.frameLocator('.store-location-map');await frame.getByText(/Map data ©/).first().waitFor({timeout:30000});
  for(const width of [320,393,1366]){await page.setViewportSize({width,height:852});await map.scrollIntoViewIfNeeded();const rect=await map.boundingBox();assert.ok(rect.width>200&&rect.x>=0&&rect.x+rect.width<=width);assert.ok(rect.height>=240);await page.waitForTimeout(1800);await page.screenshot({path:`artifacts/shop-map/${width}.png`,animations:'disabled'});}
  const original=await map.elementHandle();await page.getByRole('tab',{name:'Products',exact:true}).click();await page.getByRole('tab',{name:'About',exact:true}).click();assert.equal(await map.evaluate((node,old)=>node===old,original),true);
  const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Open in maps',exact:true}).click();const popup=await popupPromise;await popup.waitForURL('https://www.google.com/maps?q=16.8449,96.1775');await popup.close();
  const reads=calls.filter(path=>path==='/stores/demo-shop-02').length;await page.getByRole('link',{name:'Cart',exact:true}).first().click();await page.goBack();await map.waitFor();assert.equal(await map.evaluate((node,old)=>node===old,original),true);assert.equal(calls.filter(path=>path==='/stores/demo-shop-02').length,reads);
  assert.deepEqual(errors,[]);console.log('Google Maps iframe and coordinates, live map rendering, 320/393/1366 layouts, tab retention, external map action and browser Back without shop refetch passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
