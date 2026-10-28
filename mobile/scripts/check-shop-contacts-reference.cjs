const { setDrawerLanguage } = require('./drawer-language.cjs');
// Intercepted demo contacts only; no live edits or deletes.
const {chromium,firefox}=require('../../shop/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const origin='http://127.0.0.1:5176',output=path.resolve('artifacts/shop-contacts-reference'),engine=process.env.CONTACTS_BROWSER||'chromium';
const session={user:{id:301,name:'Olivia Martin',role:'owner'},business:{id:301,name:'Evergreen Market'},permissions:['shop','sell','products','sales','ecommerce_settings'],subscription:{is_valid:true}};
let contacts=[{id:'phone',platform:'phone',label:'Main shop',value:'09 1234 5678'},{id:'email',platform:'email',label:'Support',value:'hello@example.com'},{id:'facebook',platform:'facebook',label:'Evergreen Market',value:'https://facebook.com/evergreenmarket'}];
(async()=>{
 await fs.mkdir(output,{recursive:true});const browser=await(engine==='firefox'?firefox:chromium).launch();
 const context=await browser.newContext({viewport:{width:393,height:817},hasTouch:true});await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('mkpos.language','en');});
 const calls=[],errors=[];let failSave=true,failDelete=true;
 await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
 await context.route(`${origin}/api/**`,async r=>{
  const endpoint=new URL(r.request().url()).pathname.slice(4),method=r.request().method();calls.push({endpoint,method});let data={items:[],total:0};
  if(endpoint==='/auth/me')data=session;
  else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if(endpoint==='/settings')data={language:'en',currency:'MMK'};
  else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
  else if(endpoint.startsWith('/shop-admin/contacts')){
   if(method==='POST'||method==='PUT'){
    if(failSave){failSave=false;return r.fulfill({status:422,json:{message:'Contact was not saved.',errors:{value:['Please review this contact value.']}}});}
    const input=r.request().postDataJSON();if(method==='POST')contacts.push({...input,id:'new'});else contacts=contacts.map(c=>c.id===endpoint.split('/').at(-1)?{...c,...input}:c);
   }else if(method==='DELETE'){
    if(failDelete){failDelete=false;return r.fulfill({status:503,json:{message:'Contact could not be deleted. Retry.'}});}
    contacts=contacts.filter(c=>c.id!==endpoint.split('/').at(-1));
   }data={items:contacts};
  }
  await r.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const getCount=()=>calls.filter(c=>c.endpoint==='/shop-admin/contacts'&&c.method==='GET').length;
 async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 async function responsive(name){await shot(name);for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${width} overflow`);await shot(name+'-'+width);}await page.setViewportSize({width:393,height:817});}
 try{
  await page.goto(`${origin}/shop/contacts`);await page.getByRole('button',{name:'Edit Main shop',exact:true}).waitFor();await responsive('092');
  const source=page.locator('.shop-contacts-list');await source.evaluate(n=>n.dataset.retention='retained');
  await page.getByRole('button',{name:'Add contact',exact:true}).click();await page.getByLabel('Platform',{exact:true}).waitFor();await responsive('093');
  await page.getByLabel('Label (optional)',{exact:true}).fill('Retained new contact');await page.getByLabel('Phone number',{exact:true}).fill('+959123456789');
  const before=getCount();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Edit Main shop',exact:true}).waitFor();assert.equal(getCount(),before);assert.equal(await source.getAttribute('data-retention'),'retained');
  await page.goForward();assert.equal(await page.getByLabel('Label (optional)',{exact:true}).inputValue(),'Retained new contact');
  await page.getByLabel('Platform',{exact:true}).selectOption('email');assert.equal(await page.getByLabel('Email address',{exact:true}).inputValue(),'');await page.getByLabel('Email address',{exact:true}).fill('new@example.com');
  await page.getByRole('button',{name:'Save contact',exact:true}).click();await page.getByText('Please review this contact value.',{exact:true}).last().waitFor();assert.equal(await page.getByLabel('Email address',{exact:true}).inputValue(),'new@example.com');await shot('save-error');
  await page.getByRole('button',{name:'Save contact',exact:true}).click();await page.getByRole('button',{name:'Edit Retained new contact',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit Main shop',exact:true}).click();await page.getByLabel('Phone number',{exact:true}).waitFor();await responsive('094');
  await page.getByLabel('Phone number',{exact:true}).fill('+959999888777');await page.getByRole('button',{name:'Save contact',exact:true}).click();await page.getByText('+959999888777',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Delete Support',exact:true}).click();await page.getByRole('dialog',{name:'Delete contact',exact:true}).waitFor();await shot('delete-confirmation');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.method==='DELETE').length,0);
  await page.getByRole('button',{name:'Delete Support',exact:true}).click();await page.getByRole('dialog',{name:'Delete contact',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();await page.getByText('Contact could not be deleted. Retry.',{exact:true}).waitFor();await page.getByRole('dialog',{name:'Delete contact',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Delete Support',exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await shot('myanmar');
  await page.goto(`${origin}/shop/contacts/facebook/edit`);await page.getByLabel('Contact link',{exact:true}).waitFor();await page.getByLabel('Contact link',{exact:true}).fill('https://example.com/'+ 'very-long-public-contact-link-'.repeat(9));await page.setViewportSize({width:320,height:817});await shot('long-link-320');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL('**/shop/contacts');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,widths:[320,393,768],saveRetry:true,deleteCancelAndRetry:true,platformTypes:true,retainedBack:true,errors},null,2));console.log(`Shop contacts ${engine}: 3 references, drafts, save/delete retry and Back passed.`);
 }catch(e){await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
