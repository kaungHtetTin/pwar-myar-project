// Intercepted data and Android bridge: no live mutations or device exits.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const engine = process.env.ROOT_BROWSER || 'chromium';
const origin = 'http://127.0.0.1:5176';
(async () => {
 const browser = await (engine === 'firefox' ? firefox : chromium).launch();
 try {
  for (const native of [false, true]) {
   const context = await browser.newContext({viewport:{width:362,height:874},hasTouch:true});
   await context.addInitScript(native => {
    localStorage.setItem('mkpos.language','en');
    if (!native) return;
    window.androidBridge = {};
    window.__exitCalls = 0; window.__nativeListeners = {};
    window.Capacitor = {
     PluginHeaders:[{name:'App',methods:['addListener','removeListener','exitApp','minimizeApp'].map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))}],
     nativeCallback: (plugin,method,options,callback) => { window.__nativeListeners[options.eventName]=callback; return 'fixture-listener'; },
     nativePromise: async (plugin,method) => { if(method==='exitApp')window.__exitCalls++; return {}; },
    };
   },native);
   const calls = [], errors = [];
   const product = {id:1,name:'Fixture Rice',category:'Food',stock:50,base_unit:'Bag',price:1500,cost:1000,sku:'R1',prices:[{name:'Retail',price:1500,is_manual:true}]};
   await context.route(`${origin}/api/**`,async route => {
    const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.slice(4);
    calls.push(endpoint+url.search); assert.equal(request.method(),'GET');
    let data={items:[],total:0};
    if(endpoint==='/auth/me')data={user:{id:1,name:'Fixture owner',role:'owner'},business:{id:1,name:'Fixture shop',currency:'Ks'},permissions:['sell','products','settings'],subscription:{is_valid:true}};
    else if(endpoint==='/app-config')data={enabled_modules:['sell','products','settings'],permissions:['sell','products','settings'],business:{}};
    else if(endpoint==='/products')data={items:[product],total:1};
    else if(endpoint==='/products/summary')data={total_products:1,low_stock:0,out_of_stock:0};
    else if(endpoint==='/categories')data=['Food'];
    else if(endpoint==='/price-types')data={items:['Retail'],rules:[]};
    else if(endpoint==='/settings')data={shop_name:'Fixture shop',currency:'Ks',payment_methods:'Cash'};
    await route.fulfill({json:data});
   });
   const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
   const bar=page.getByRole('navigation',{name:'Workspace modules',exact:true});
   const back=async()=> {
    if(native)await page.evaluate(()=>window.__nativeListeners.backButton({canGoBack:true}));
    else { await page.evaluate(()=>window.history.back()); }
    await page.waitForTimeout(80);
   };
   await page.goto(`${origin}/login`);
   await page.getByRole('heading',{name:'Sell',exact:true}).waitFor();
   const search=page.getByRole('textbox',{name:'Search sale products',exact:true});
   await search.fill('Fixture'); await page.waitForLoadState('networkidle');
   await search.evaluate(input=>input.dataset.retained='same-sell');
   await bar.getByRole('button',{name:'Products',exact:true}).click();
   await page.getByRole('button',{name:'Add product',exact:true}).click();
   const name=page.getByLabel('Product name',{exact:true}); await name.fill('Unsent draft');
   await page.getByRole('button',{name:'Back to products',exact:true}).click();
   await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
   await page.getByRole('button',{name:'Filters',exact:true}).click();
   await page.getByRole('dialog',{name:'Filters',exact:true}).waitFor();
   await back();
   await page.getByRole('dialog',{name:'Filters',exact:true}).waitFor({state:'hidden'});
   assert.equal(new URL(page.url()).pathname,'/products','A filter drawer consumes Back before leaving the page');
   const reads=calls.length;
   await back(); await page.getByRole('heading',{name:'Sell',exact:true}).waitFor();
   assert.equal(await search.inputValue(),'Fixture');
   assert.equal(await search.getAttribute('data-retained'),'same-sell');
   assert.equal(calls.length,reads,'Back to Sell does not reload retained data');
   // Overlay gets the first Back at the root.
   await page.getByRole('button',{name:'Open app menu',exact:true}).click();
   await back(); await page.getByRole('dialog',{name:'Main navigation',exact:true}).waitFor({state:'hidden'});
   if(native)assert.equal(await page.evaluate(()=>window.__exitCalls),0);
   await back(); assert.equal(new URL(page.url()).pathname,'/sell');
   if(native)assert.equal(await page.evaluate(()=>window.__exitCalls),1);
   else { await back(); assert.equal(new URL(page.url()).pathname,'/sell'); }
   // Explicitly returning to Sell cuts off older module visits.
   await bar.getByRole('button',{name:'Products',exact:true}).click();
   await page.getByRole('heading',{name:'Products',exact:true}).waitFor();
   await page.getByRole('button',{name:'Add product',exact:true}).click();
   assert.equal(await name.inputValue(),'Unsent draft');
   await page.getByRole('button',{name:'Back to products',exact:true}).click();
   await bar.getByRole('button',{name:'Sell',exact:true}).click();
   await back(); assert.equal(new URL(page.url()).pathname,'/sell');
   assert.equal(await search.inputValue(),'Fixture');
   // Direct-entry parents remain navigable before the Sell boundary.
   await page.goto(`${origin}/settings/prices/new`);
   await page.getByRole('heading',{name:'New price type',exact:true}).waitFor();
   await back(); await page.getByRole('heading',{name:'Price types',exact:true}).waitFor();
   await back(); await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await back(); await page.getByRole('heading',{name:'Sell',exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   await context.close();
  }
  await fs.mkdir('artifacts/root-back',{recursive:true});
  await fs.writeFile(`artifacts/root-back/${engine}.json`,JSON.stringify({engine,webRootBlocked:true,androidExitAtSell:true,overlaysFirst:true,retainedDraft:true,directParents:true},null,2));
  console.log(`${engine}: web boundary, Android exit, overlays, retained drafts/search and direct-link parents passed.`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
