// Isolated dev-server APIs; never resets or restores real business data.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176', output = path.resolve('artifacts/settings-reference');
const engine = process.env.SETTINGS_BROWSER || 'chromium';
const session = { user: { id: 301, role: 'owner', name: 'Olivia Martin', email: 'olivia@example.com' }, business: { id: 301, name: 'Evergreen Market' }, permissions: ['sell','products','settings','shop'], subscription: { is_valid: true, access_type: 'paid' } };
let settings = { shop_name:'Evergreen Market',shop_title:'Evergreen Market',shop_address:'24 Market Street Yangon',shop_phone:'09123456789',currency:'MMK',payment_methods:'Cash,Bank transfer,Mobile payment',language:'en',admin_pin_set:'1' };
const routes = [['055',''],['056','account'],['057','shop'],['058','receipt'],['059','barcode'],['060','printer'],['061','payments'],['062','prices'],['063','prices/new'],['064','prices/Wholesale/edit'],['065','security'],['066','data'],['067','data/restore'],['068','data/reset'],['069','language'],['070','about']];
(async () => {
 await fs.mkdir(output,{recursive:true});
 const browser = await (engine === 'firefox' ? firefox : chromium).launch();
 const context = await browser.newContext({viewport:{width:393,height:817},hasTouch:true});
 await context.addInitScript(() => {
  if (window === window.top && !localStorage.getItem('mkpos.language')) localStorage.setItem('mkpos.language','en');
  if (location.search.includes('native-printer-fixture')) {
   window.androidBridge = {};
   const config = { connection:'system',paper:'80mm',host:'',port:9100,address:'',copies:1,cut:false,color:true,landscape:false };
   window.__printerCalls = [];
   window.Capacitor = {
    PluginHeaders:[{name:'MkposPrinter',methods:['getConfig','saveConfig','checkConnection','listPaired','openBluetoothSettings','print'].map(name=>({name,rtype:'promise'}))},{name:'App',methods:['addListener','removeListener','minimizeApp'].map(name=>({name,rtype:'promise'}))}],
    nativePromise: async (plugin,method,args) => {
     window.__printerCalls.push({ plugin, method, args });
     if (method==='getConfig') return config;
     if (method==='saveConfig') { Object.assign(config,args.config); return config; }
     if (method==='listPaired') return {items:[{name:'Fixture thermal printer',address:'00:11:22:33:44:55'}],total:1};
     if (method==='checkConnection') return { message:'Fixture connection successful.' };
     return { success:true };
    },
   };
  }
 });
 let mutations = [], errors = [], reads = [];
 await context.route(`${origin}/api/**`,async r => {
  const endpoint = new URL(r.request().url()).pathname.slice(4), method = r.request().method();
  let data = {items:[],total:0};
  if (method !== 'GET') mutations.push(endpoint);
  else reads.push(endpoint);
  if (endpoint === '/auth/me') data = session;
  else if (endpoint === '/app-config') data = {enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if (endpoint === '/auth/profile') { await new Promise(resolve=>setTimeout(resolve,900)); return r.fulfill({status:422,json:{message:'Profile was not saved.',errors:{current_password:['Current password is incorrect.']}}}); }
  else if (endpoint === '/settings') { if (method === 'PUT') settings = {...settings,...r.request().postDataJSON()}; data = settings; }
  else if (endpoint === '/price-types') data = {items:['Retail','Wholesale','VIP'],usage:{Retail:124,Wholesale:80,VIP:24},rules:[{name:'Wholesale',pricing_mode:'automatic',markup_percent:20,rounding:100,minimum_profit:500}]};
  else if (endpoint === '/data/status') data = {ok:true,total_records:286,schema_version:9};
  else if (endpoint === '/settings/receipt-preview') data = {text:'Evergreen Market\n24 Market Street Yangon\nSALE\nApple          5,000\nRice           6,000\nTotal         11,000\nThank you for shopping'};
  await r.fulfill({json:data});
 });
 await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
 const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 async function capture(id) { await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:path.join(output,`screen-${id}.png`),animations:'disabled'}); }
 try {
  if (!process.argv.includes('--localized-only')) {
  for (const [id,route] of routes) {
   await page.goto(`${origin}/settings${route?'/'+route:''}`);
   await page.locator('.shared-app-bar .settings-reference-header h1').waitFor();
   if (route === 'receipt') await page.getByTitle('Receipt preview document').waitFor();
   await capture(id); await page.screenshot({path:path.join(output,`full-${id}.png`),fullPage:true});
   for (const width of [320,362,768]) {
    await page.setViewportSize({width,height:817});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`${id} overflow ${width}`);
    const menu = page.getByRole('button',{name:'Open app menu',exact:true});
    assert.equal(await menu.evaluate(button=>button.parentElement.lastElementChild===button),true);
    const fields = page.locator('main:visible .ui-field');
    assert.ok(await fields.evaluateAll(nodes=>nodes.every(n=>{ const label=n.querySelector(':scope > label'),input=n.querySelector('input:not([type=hidden]),select,textarea');if(!label||!input)return true;const a=label.getBoundingClientRect(),b=input.getBoundingClientRect();return a.bottom<=b.top+1||a.right<=b.left+1; })),`${id}: field labels do not overlap controls`);
    await capture(`${id}-${width}`);
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    const last = page.locator('main:visible form > .mobile-form-section, main:visible form > section.mobile-form-section').last();
    if (await last.count()) assert.ok(await last.evaluate(section=>section.getBoundingClientRect().bottom <= (document.querySelector('main:not([hidden]) form > .mobile-form-actions')?.getBoundingClientRect().top || innerHeight-60)),`${id}: last section scrolls above fixed actions`);
    await page.screenshot({path:path.join(output,`bottom-${id}-${width}.png`),animations:'disabled'});
    await page.evaluate(()=>window.scrollTo(0,0));
   }
   await page.setViewportSize({width:393,height:817});
  }
  await page.goto(`${origin}/settings/data/reset`); await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByLabel('Admin PIN',{exact:true}).fill('2468'); await page.getByRole('button',{name:'Clear business data',exact:true}).click(); await page.getByRole('dialog').waitFor(); await capture('142');
  await page.keyboard.press('Escape'); assert.ok(!mutations.includes('/data/reset'));
  await page.goto(`${origin}/settings`); await page.getByRole('button',{name:'Open Account',exact:true}).click(); await page.getByLabel('Owner name',{exact:true}).fill('Draft owner');
  await page.waitForLoadState('networkidle'); const beforeBack = reads.length;
  await page.getByLabel('Owner name',{exact:true}).evaluate(input=>input.dataset.retention='same-draft');
  await page.getByRole('button',{name:'Back to settings',exact:true}).click(); await page.goForward();
  assert.equal(await page.getByLabel('Owner name',{exact:true}).inputValue(),'Draft owner');
  assert.equal(await page.getByLabel('Owner name',{exact:true}).getAttribute('data-retention'),'same-draft');
  assert.equal(reads.length,beforeBack,'Back/Forward retains the existing Settings page without refetch');
  await page.getByLabel('Current password',{exact:true}).fill('fixture-secret');
  await page.getByRole('button',{name:'Show password',exact:true}).first().click();
  assert.equal(await page.getByLabel('Current password',{exact:true}).getAttribute('type'),'text');
  await page.getByRole('button',{name:'Hide password',exact:true}).click();
  assert.equal(await page.getByLabel('Current password',{exact:true}).getAttribute('type'),'password');
  await page.getByLabel('Current password',{exact:true}).fill('wrong-password'); await page.getByRole('button',{name:'Save account',exact:true}).click(); await capture('152'); await page.getByText('Current password is incorrect.',{exact:true}).waitFor(); assert.equal(await page.getByLabel('Owner name',{exact:true}).inputValue(),'Draft owner');
  await page.goto(`${origin}/settings/receipt`); await page.getByTitle('Receipt preview document').waitFor();
  await page.getByRole('heading',{name:'Layout',exact:true}).evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'})); await page.waitForTimeout(300); await capture('163');
  await page.goto(`${origin}/settings`); await page.getByRole('button',{name:'Open app menu',exact:true}).click(); await capture('167'); await page.keyboard.press('Escape');
  }
  await page.goto(`${origin}/settings/language`); await page.getByRole('radio',{name:'မြန်မာ',exact:true}).check(); await page.getByRole('button',{name:'Save language',exact:true}).click(); await page.waitForFunction(()=>document.documentElement.lang === 'my'); await capture('myanmar');
  for (const [id,route] of routes) {
   await page.goto(`${origin}/settings${route?'/'+route:''}`);
   await page.locator('.shared-app-bar .settings-reference-header h1').waitFor();
   if(route==='receipt') await page.getByTitle('Receipt preview document').waitFor();
   await page.setViewportSize({width:320,height:700});
   await page.waitForLoadState('networkidle');
   assert.equal(await page.locator('.shared-app-bar button.app-bar-menu:visible').count(),1,`${id}: app menu is visible`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`${id}: Myanmar overflow`);
   await capture(`myanmar-${id}`);
   await page.screenshot({path:path.join(output,`full-myanmar-${id}.png`),fullPage:true});
  }
  if (process.argv.includes('--localized-only')) { assert.deepEqual(errors,[]); console.log(`Settings ${engine}: all 16 Myanmar pages passed at 320px.`); return; }
  await page.evaluate(()=>localStorage.setItem('mkpos.language','en'));
  await page.goto(`${origin}/settings/printer?native-printer-fixture`);
  await page.getByRole('radio',{name:'Android print dialog / PDF',exact:true}).waitFor();
  await capture('native-060'); await page.screenshot({path:path.join(output,'full-native-060.png'),fullPage:true});
  await page.getByRole('radio',{name:'Network thermal / emulator',exact:true}).check();
  await page.getByLabel('Printer IP / hostname',{exact:true}).fill('192.168.1.100');
  await page.evaluate(()=>window.scrollTo(0,0)); await capture('native-network'); await page.screenshot({path:path.join(output,'full-native-network.png'),fullPage:true});
  await page.getByRole('button',{name:'Check connection',exact:true}).click();
  await page.getByText('Fixture connection successful.',{exact:true}).waitFor();
  await page.getByRole('radio',{name:'Bluetooth Classic thermal',exact:true}).check();
  await page.getByRole('button',{name:'Refresh paired devices',exact:true}).click();
  await page.getByRole('radio',{name:/Fixture thermal printer/}).check();
  await page.evaluate(()=>window.scrollTo(0,0)); await capture('native-170'); await page.screenshot({path:path.join(output,'full-native-170.png'),fullPage:true});
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByText('Printer settings saved on this device only.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__printerCalls.filter(call=>call.method==='saveConfig').length),1);
  assert.deepEqual(errors,[]); await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,routes:routes.length,widths:[320,362,393,768],draftBack:true,noBackRefetch:true,myanmarRoutes:routes.length,nativePrinterFixtures:true,noDestructiveMutation:true,errors},null,2));
  console.log(`Settings ${engine}: 16 routes, 4 widths, Myanmar, native printer fixtures, retained Back and reset cancellation passed.`);
 } catch(e) { await page.screenshot({path:path.join(output,'failure.png')}); console.log(await page.locator('.shared-app-bar h1').evaluateAll(ns=>ns.map(n=>({html:n.parentElement.outerHTML, ancestors:[n,n.parentElement,n.parentElement.parentElement].map(x=>({tag:x.tagName,display:getComputedStyle(x).display,visibility:getComputedStyle(x).visibility}))})))); throw e; } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
