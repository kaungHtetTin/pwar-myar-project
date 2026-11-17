const {chromium,firefox} = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve('artifacts/shop-reference'), origin='http://127.0.0.1:5176', engine=process.env.SHOP_BROWSER || 'chromium';
let session={user:{id:301,role:'owner',name:'Olivia Martin'},business:{id:301,name:'EvergreenMarket'},permissions:['shop','sell','products','sales','ecommerce_orders','ecommerce_settings','ecommerce_catalog'],subscription:{is_valid:true}};
(async()=>{
 await fs.mkdir(output,{recursive:true}); const browser=await (engine==='firefox'?firefox:chromium).launch();
 const context=await browser.newContext({viewport:{width:393,height:817},hasTouch:true});
 await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('mkpos.language','en');});
 const calls=[],errors=[]; await context.route(`${origin}/api/**`,async r=>{
  const endpoint=new URL(r.request().url()).pathname.slice(4); calls.push(endpoint); let data={items:[],total:0};
  if(endpoint==='/auth/me')data=session;
  else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
  else if(endpoint==='/settings')data={currency:'MMK',language:'en'};
  else if(endpoint==='/shop-admin/orders')data={items:[],total:0};
  await r.fulfill({json:data});
 });
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 try{
  await page.goto(`${origin}/shop`);await page.getByRole('button',{name:'Manage storefront'}).waitFor();
  for(const width of [393,320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture(`shop-${width}`);await page.screenshot({path:path.join(output,`full-${width}.png`),fullPage:true});}
  await page.setViewportSize({width:393,height:817});
  const source=page.locator('.shop-overview-page');await source.evaluate(n=>n.dataset.retention='retained');
  await page.getByRole('button',{name:/^Shop location /}).scrollIntoViewIfNeeded();await capture('configuration-393');
  const position=await page.evaluate(()=>scrollY);
  await page.getByRole('button',{name:/^Shop location /}).click();await page.getByRole('button',{name:'Allow location and save'}).waitFor();
  const before=calls.filter(p=>p==='/shop-admin/owner-location').length; await page.goBack();await page.getByRole('button',{name:'Manage storefront'}).waitFor();
  assert.equal(await source.getAttribute('data-retention'),'retained');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<3);assert.equal(calls.filter(p=>p==='/shop-admin/owner-location').length,before);
  await page.goForward(); await page.getByRole('button',{name:'Back to My Shop',exact:true}).click(); await page.getByRole('button',{name:'Manage storefront'}).waitFor(); assert.equal(await source.getAttribute('data-retention'),'retained'); assert.equal(calls.filter(p=>p==='/shop-admin/owner-location').length,before);
  await page.goto(`${origin}/shop`); await page.getByRole('button',{name:'Open app menu',exact:true}).click();
  const language=page.getByRole('combobox',{name:'Language',exact:true}); await language.selectOption('my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await capture('myanmar');
  session={...session,user:{...session.user,role:'staff'},permissions:['shop','ecommerce_orders']};await page.goto(`${origin}/shop`);await page.getByRole('heading',{name:'Operations',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Configuration',exact:true}).count(),0);await capture('staff');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,widths:[320,393,768],retainedBack:true,staffPermissions:true,errors},null,2));console.log(`Shop ${engine}: responsive overview, retained Back, permissions passed.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
