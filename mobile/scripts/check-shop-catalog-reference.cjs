const { setDrawerLanguage } = require('./drawer-language.cjs');
// All API traffic intercepted; no live product or publication changes.
const {chromium,firefox}=require('../../shop/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('artifacts/shop-catalog-reference'),origin='http://127.0.0.1:5176',engine=process.env.CATALOG_BROWSER||'chromium';
let session={user:{id:301,name:'Owner',role:'owner'},business:{id:301,name:'Evergreen Market'},permissions:['shop','sell','products','sales','ecommerce_catalog','ecommerce_settings'],subscription:{is_valid:true}};
let products=Array.from({length:24},(_,i)=>({id:i+1,name:['Premium Jasmine Rice','Sunflower Cooking Oil','Green Tea Original','Natural Hand Soap'][i%4]+(i>3?` ${i+1}`:''),category:i%4===3?'Household':'Groceries',stock:i===2?0:48+i,base_unit:'bag',purchase_unit:'box',purchase_conversion_factor:12,base_price:18500+i*500,purchase_price:(18500+i*500)*12,currency:'MMK',price_type:'Retail',unit:'base',published:i%3===0,description:'Fresh stock, ready for your shop.'}));
(async()=>{
 await fs.mkdir(output,{recursive:true});const browser=await(engine==='firefox'?firefox:chromium).launch();
 const context=await browser.newContext({viewport:{width:393,height:817},hasTouch:true});await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('mkpos.language','en');});
 const calls=[],errors=[];let failBulk=true,failSave=true;
 await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
 await context.route(`${origin}/api/**`,async r=>{
  const url=new URL(r.request().url()),endpoint=url.pathname.slice(4),method=r.request().method();calls.push({endpoint,method,query:url.search});let data={items:[],total:0};
  if(endpoint==='/auth/me')data=session;
  else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if(endpoint==='/settings')data={language:'en',currency:'MMK'};
  else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
  else if(endpoint==='/shop-admin/publications/filters')data={categories:['Groceries','Household']};
  else if(endpoint==='/shop-admin/publications/bulk'){
   if(failBulk){failBulk=false;return r.fulfill({status:503,json:{message:'Could not update publications. Retry.'}});}
   const body=r.request().postDataJSON();assert.equal(typeof body.published,'boolean');products=products.map(p=>({...p,published:body.published}));data={updated:24};
  }else if(endpoint==='/shop-admin/publications'){
   let rows=products.filter(p=>p.name.toLowerCase().includes((url.searchParams.get('q')||'').toLowerCase()));
   if(url.searchParams.get('category'))rows=rows.filter(p=>p.category===url.searchParams.get('category'));
   if(url.searchParams.get('publication_status')==='published')rows=rows.filter(p=>p.published);
   if(url.searchParams.get('publication_status')==='unpublished')rows=rows.filter(p=>!p.published);
   const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||20);data={items:rows.slice(offset,offset+limit),total:rows.length,published_count:rows.filter(p=>p.published).length};
  }else if(/^\/shop-admin\/publications\/\d+$/.test(endpoint)){
   const id=Number(endpoint.split('/').at(-1));
   if(method==='PUT'){if(failSave){failSave=false;return r.fulfill({status:422,json:{message:'Description could not be saved.',errors:{description:['Please review the description.']}}});}products=products.map(p=>p.id===id?{...p,...r.request().postDataJSON()}:p);}
   data=products.find(p=>p.id===id);
  }
  await r.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const listCalls=()=>calls.filter(c=>c.endpoint==='/shop-admin/publications').length;
 async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 async function responsive(name){await capture(name);for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${width} overflow`);await capture(name+'-'+width);}await page.setViewportSize({width:393,height:817});}
 try{
  await page.goto(`${origin}/shop/catalog`);await page.locator('.publication-row').first().waitFor();await responsive('077');
  await page.getByRole('button',{name:'Filters',exact:true}).click();await responsive('121');
  const count=listCalls();await page.getByLabel('Category',{exact:true}).selectOption('Groceries');assert.equal(listCalls(),count);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Filters',exact:true}).click();assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'');
  await page.getByLabel('Category',{exact:true}).selectOption('Groceries');await Promise.all([page.waitForResponse(r=>r.url().includes('/publications?')&&r.url().includes('category=Groceries')),page.getByRole('button',{name:'Apply filters',exact:true}).click()]);
  const filtered=listCalls();await page.getByRole('button',{name:/Filters, 1 active filters/}).click();await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(listCalls(),filtered);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Publish all filtered',exact:true}).click();await responsive('139');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.endpoint.endsWith('/bulk')).length,0);
  await page.getByRole('button',{name:'Publish all filtered',exact:true}).click();await page.getByRole('button',{name:'Publish all',exact:true}).click();await page.getByText('Could not update publications. Retry.',{exact:true}).waitFor();await page.getByRole('button',{name:'Publish all',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(calls.filter(c=>c.endpoint.endsWith('/bulk')).length,2);
  await page.getByRole('searchbox',{name:'Search publication',exact:true}).fill('Rice');await page.waitForResponse(r=>r.url().includes('/publications?')&&r.url().includes('q=Rice'));
  const before=listCalls(),source=page.locator('.publication-list');await source.evaluate(n=>n.dataset.retention='kept');
  await page.locator('.publication-row').first().click();await page.getByRole('heading',{name:'Public product information',exact:true}).waitFor();await responsive('078'); await page.locator('.publication-preview').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'})); await capture('editor-preview'); await page.screenshot({path:path.join(output,'editor-full.png'),fullPage:true}); await page.evaluate(()=>scrollTo(0,0));
  await page.getByLabel('Online description',{exact:true}).fill('Retained catalog draft');await page.getByLabel('Online selling unit',{exact:true}).selectOption('purchase');
  await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.getByRole('searchbox',{name:'Search publication',exact:true}).inputValue(),'Rice');assert.equal(listCalls(),before);assert.equal(await source.getAttribute('data-retention'),'kept');
  await page.goForward();assert.equal(await page.getByLabel('Online description',{exact:true}).inputValue(),'Retained catalog draft');
  await page.getByRole('button',{name:'Save publication',exact:true}).click();await page.getByText('Please review the description.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Online description',{exact:true}).inputValue(),'Retained catalog draft');await capture('editor-error');
  await page.getByRole('button',{name:'Save publication',exact:true}).click();await page.getByRole('searchbox',{name:'Search publication',exact:true}).waitFor();assert.equal(await page.getByRole('searchbox',{name:'Search publication',exact:true}).inputValue(),'Rice');
  await page.getByRole('searchbox',{name:'Search publication',exact:true}).fill('nothing-matches');await page.getByText('No matching products.',{exact:true}).waitFor();await capture('empty');await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();await page.locator('.publication-row').first().waitFor();
  await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await capture('myanmar');
  session={...session,subscription:{is_valid:false}};await page.goto(`${origin}/shop/catalog`);await page.getByRole('heading',{name:'Subscription expired',exact:true}).waitFor();await responsive('150');
  const gateRequests=listCalls();await page.getByRole('button',{name:'View subscription',exact:true}).click();await page.waitForURL('**/billing');await page.goBack();await page.getByRole('button',{name:'Back to My Shop',exact:true}).click();await page.waitForURL('**/shop');assert.equal(listCalls(),gateRequests);
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,widths:[320,393,768],draftFilters:true,bulkRetry:true,editorRetry:true,retainedBack:true,expiredGate:true,errors},null,2));console.log(`Shop catalog ${engine}: all 5 references, drafts, retry, Back and subscription gate passed.`);
 }catch(e){console.log('Page errors:',errors);await page.screenshot({path:path.join(output,'failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
