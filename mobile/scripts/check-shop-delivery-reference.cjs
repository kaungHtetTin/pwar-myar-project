const { setDrawerLanguage } = require('./drawer-language.cjs');
// Intercepted fixture APIs; no live fees or delivery options are changed.
const {chromium,firefox}=require('../../shop/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const origin='http://127.0.0.1:5176',output=path.resolve('artifacts/shop-delivery-reference'),engine=process.env.DELIVERY_BROWSER||'chromium';
const session={user:{id:301,role:'owner',name:'Owner'},business:{id:301,name:'Evergreen Market',currency:'MMK'},permissions:['shop','sell','products','sales','ecommerce_settings'],subscription:{is_valid:true}};
let zones=[{id:'city',name:'Yangon Standard Delivery',fee:3000},{id:'pickup',name:'Store Pickup',fee:0}];
(async()=>{
 await fs.mkdir(output,{recursive:true});const browser=await(engine==='firefox'?firefox:chromium).launch();const context=await browser.newContext({viewport:{width:393,height:817},hasTouch:true});await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('mkpos.language','en');});
 const calls=[],errors=[];let failSave=true,failDelete=true;
 await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
 await context.route(`${origin}/api/**`,async r=>{
  const endpoint=new URL(r.request().url()).pathname.slice(4),method=r.request().method();calls.push({endpoint,method});let data={items:[],total:0};
  if(endpoint==='/auth/me')data=session;
  else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if(endpoint==='/settings')data={currency:'MMK',language:'en'};
  else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
  else if(endpoint.startsWith('/shop-admin/delivery-zones')){
   if(method==='POST'||method==='PUT'){
    if(failSave){failSave=false;return r.fulfill({status:422,json:{message:'Delivery could not be saved.',errors:{fee:['Please review the delivery fee.']}}});}
    const input=r.request().postDataJSON();assert.equal(typeof input.fee,'number');assert.ok(input.fee>=0);assert.deepEqual(Object.keys(input).sort(),['fee','name']);
    if(method==='POST')zones.push({...input,id:'new'});else zones=zones.map(z=>z.id===endpoint.split('/').at(-1)?{...z,...input}:z);
   }else if(method==='DELETE'){
    if(failDelete){failDelete=false;return r.fulfill({status:503,json:{message:'Delivery could not be deleted. Retry.'}});}zones=zones.filter(z=>z.id!==endpoint.split('/').at(-1));
   }data={items:zones};
  }
  await r.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const reads=()=>calls.filter(c=>c.endpoint==='/shop-admin/delivery-zones'&&c.method==='GET').length;
 async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 async function responsive(name){await shot(name);for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${width} overflow`);await shot(`${name}-${width}`);}await page.setViewportSize({width:393,height:817});}
 try{
  await page.goto(`${origin}/shop/delivery`);await page.getByRole('button',{name:'Edit Yangon Standard Delivery',exact:true}).waitFor();await responsive('095');
  await page.getByRole('button',{name:'Dismiss delivery information',exact:true}).click();const source=page.locator('.shop-delivery-list');await source.evaluate(n=>n.dataset.retention='kept');
  await page.getByRole('button',{name:'Add delivery',exact:true}).click();await page.getByRole('textbox',{name:'Option name',exact:true}).waitFor();await responsive('096');
  await page.getByRole('textbox',{name:'Option name',exact:true}).fill('Retained zero-fee option');await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).fill('0');const before=reads();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await source.waitFor();assert.equal(reads(),before);assert.equal(await source.getAttribute('data-retention'),'kept');assert.equal(await page.getByRole('button',{name:'Dismiss delivery information',exact:true}).count(),0);
  await page.goForward();assert.equal(await page.getByRole('textbox',{name:'Option name',exact:true}).inputValue(),'Retained zero-fee option');
  await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).fill('-1');assert.equal(await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).evaluate(n=>n.checkValidity()),false);await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).fill('0');
  await page.getByRole('button',{name:'Save delivery',exact:true}).click();await page.getByText('Please review the delivery fee.',{exact:true}).last().waitFor();assert.equal(await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).inputValue(),'0');await shot('save-error');await page.getByRole('button',{name:'Save delivery',exact:true}).click();await page.getByRole('button',{name:'Edit Retained zero-fee option',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit Yangon Standard Delivery',exact:true}).click();await page.getByRole('textbox',{name:'Option name',exact:true}).waitFor();assert.equal(await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).inputValue(),'3000');await responsive('097');
  await page.getByRole('spinbutton',{name:'Fee (MMK)',exact:true}).fill('4500');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText('4,500 MMK',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Delete Store Pickup',exact:true}).click();await page.getByRole('dialog',{name:'Delete delivery zone',exact:true}).waitFor();await shot('delete-confirmation');await page.getByRole('dialog',{name:'Delete delivery zone',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.method==='DELETE').length,0);
  await page.getByRole('button',{name:'Delete Store Pickup',exact:true}).click();await page.getByRole('dialog',{name:'Delete delivery zone',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();await page.getByText('Delivery could not be deleted. Retry.',{exact:true}).waitFor();await page.getByRole('dialog',{name:'Delete delivery zone',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Delete Store Pickup',exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await shot('myanmar');
  await page.goto(`${origin}/shop/delivery/city/edit`);await page.getByRole('textbox',{name:'Option name',exact:true}).waitFor();await page.getByRole('textbox',{name:'Option name',exact:true}).fill('A delivery option with a long name covering several areas across Yangon');await page.setViewportSize({width:320,height:817});await shot('long-name-320');await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL('**/shop/delivery');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,widths:[320,393,768],references:['095','096','097'],zeroFee:true,nativeNegativeValidation:true,saveRetry:true,deleteCancelRetry:true,retainedBack:true,errors},null,2));console.log(`Shop delivery ${engine}: 3 references, fees, retries and retained Back passed.`);
 }catch(e){await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
