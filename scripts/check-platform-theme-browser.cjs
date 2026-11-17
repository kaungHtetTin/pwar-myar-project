const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('../shop/node_modules/playwright');
(async()=>{
 const code=await fs.readFile('shared/theme/themeRuntime.js','utf8');
 const {makeThemePalettes,themeRoles}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 let branding={primary_color:'#0e684e',theme_mode:'light',theme_version:1,palettes:makeThemePalettes('#0e684e'),logo_url:null,icon_url:null,favicon_url:null};
 const previews=new Map(),writes=[],errors=[];
 await fs.mkdir('artifacts/platform-theme',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const pages={};
  for(const app of ['office','frontend','mobile','shop','website']){
   const context=await browser.newContext({viewport:app==='mobile'||app==='shop'?{width:393,height:852}:{width:1440,height:1000},serviceWorkers:'block'});
   const page=await context.newPage();pages[app]=page;page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(`${app}: ${e.message}`));
   if(app==='mobile')await page.clock.install();
   await page.addInitScript(()=>{localStorage.setItem('mkpos.activeModule','products');localStorage.setItem('mkpos.language','en');});
   await page.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
   await page.route('**/api/**',async route=>{
    const req=route.request(),pathname=new URL(req.url()).pathname,p=pathname.split('/api')[1];if(!p||pathname.startsWith('/src/'))return route.continue();
    let data={items:[],total:0,page:1,per_page:25,last_page:1,has_more:false,enabled:false,unread_count:0,summary:{total:0,access_counts:{}}};
    const session={user:{id:1,name:'Demo Owner',role:'owner'},business:{id:1,name:'Demo business',currency:'Ks'},permissions:['products','settings'],subscription:{is_valid:true,can_mutate:true}};
    if(p==='/branding')data=branding;
    if(p==='/office/auth/me')data={admin:{id:1,name:'Theme admin',email:'admin@example.test',role:'super_admin'}};
    if(p==='/auth/me')data=session;
    if(p==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:session.business,language:'en'};
    if(p==='/subscription')data=session.subscription;
    if(p==='/categories'||p==='/price-types')data=[];
    if(p==='/office/branding/theme/preview'){
     const body=req.postDataJSON();writes.push({path:p,...body});const result={preview_id:body.request_key,primary_color:body.primary_color,palettes:makeThemePalettes(body.primary_color,{secondary:'#b96d26',neutral:'#6a6575'}),rationale:'Violet with a warm secondary and subtle neutral surfaces.',estimated_cost_usd:'0.00001'};previews.set(body.request_key,result);data=result;
    }
    if(p==='/office/branding'&&req.method()==='PUT'){
     const body=req.postDataJSON();writes.push({path:p,...body});const preview=previews.get(body.preview_id);branding={...branding,...body,palettes:preview?.palettes||branding.palettes,theme_version:branding.theme_version+1};data=branding;
    }
    if(p.includes('/customer/auth/me'))return route.fulfill({status:401,json:{message:'Guest'}});
    if(p==='/shop/categories'||p==='/shop/marketplace-categories')data={items:[],has_more:false};
    await route.fulfill({json:data});
   });
   const url={office:'http://127.0.0.1:5175/#/settings/theme',frontend:'http://127.0.0.1:5174/',mobile:'http://127.0.0.1:5176/products',shop:'http://127.0.0.1:5177/',website:'http://127.0.0.1:8000/'}[app];
   await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  }
  const office=pages.office;
  await office.getByLabel('Primary HEX').waitFor();
  await office.getByLabel('Primary HEX').fill('#4f46e5');await office.getByRole('radio',{name:'Dark',exact:true}).check();
  await office.getByRole('button',{name:'Generate with System Agent',exact:true}).click();
  await office.getByText('Violet with a warm secondary and subtle neutral surfaces.',{exact:false}).waitFor();
  assert.equal(await office.locator('html').getAttribute('data-theme'),'light');
  const themeInput=await office.getByLabel('Primary HEX').elementHandle();
  await office.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:/^Account /}).click();
  await office.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:/^Theme & branding /}).click();
  assert.equal(await themeInput.evaluate(node=>node.isConnected),true);
  assert.equal(await office.getByLabel('Primary HEX').inputValue(),'#4f46e5');
  assert.equal(await office.getByRole('radio',{name:'Dark',exact:true}).isChecked(),true);
  await office.screenshot({path:'artifacts/platform-theme/office-preview.png',fullPage:true,animations:'disabled'});
  await office.getByRole('button',{name:'Apply theme to all apps',exact:true}).click();
  await office.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  for(const [app,page]of Object.entries(pages)){
   // Same explicit refresh event used by the app's branding synchronization path.
   if(app==='mobile')await page.clock.runFor(30001);
   else await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.documentElement.style.getPropertyValue('--theme-primary')==='#4f46e5');
   const values=await page.evaluate(roles=>roles.map(role=>getComputedStyle(document.documentElement).getPropertyValue(`--theme-${role.replaceAll('_','-')}`).trim()),themeRoles);
   assert.deepEqual(values,themeRoles.map(role=>branding.palettes.dark[role]));
   await page.screenshot({path:`artifacts/platform-theme/${app}-dark.png`,fullPage:true,animations:'disabled'});
   await fs.writeFile(`artifacts/platform-theme/${app}-dark-contrast.json`,JSON.stringify(await page.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  }
  await pages.frontend.getByLabel('Page actions').getByRole('button',{name:'Add Product',exact:true}).click();
  await pages.frontend.getByRole('dialog').waitFor();
  await pages.frontend.getByRole('dialog').getByLabel('Name',{exact:true}).fill('Unsaved product');
  await pages.frontend.screenshot({path:'artifacts/platform-theme/desktop-form-dark.png',fullPage:true,animations:'disabled'});
  await fs.writeFile('artifacts/platform-theme/desktop-form-dark-contrast.json',JSON.stringify(await pages.frontend.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  await pages.mobile.getByRole('button',{name:'Add product',exact:true}).click();
  await pages.mobile.getByRole('heading',{name:'New product',exact:true}).waitFor();
  await pages.mobile.getByLabel('Product name',{exact:true}).fill('Unsaved mobile product');
  await pages.mobile.screenshot({path:'artifacts/platform-theme/mobile-form-dark.png',fullPage:true,animations:'disabled'});
  await fs.writeFile('artifacts/platform-theme/mobile-form-dark-contrast.json',JSON.stringify(await pages.mobile.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  // A mode-only change reuses the generated palette, with no second AI request.
  await office.getByRole('radio',{name:'Light',exact:true}).check();await office.getByRole('button',{name:'Apply theme to all apps',exact:true}).click();
  await office.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  for(const [app,page]of Object.entries(pages)){
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
   await page.screenshot({path:`artifacts/platform-theme/${app}-light.png`,fullPage:true,animations:'disabled'});
   await fs.writeFile(`artifacts/platform-theme/${app}-light-contrast.json`,JSON.stringify(await page.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  }
  assert.equal(await pages.frontend.getByRole('dialog').getByLabel('Name',{exact:true}).inputValue(),'Unsaved product');
  assert.equal(await pages.mobile.getByLabel('Product name',{exact:true}).inputValue(),'Unsaved mobile product');
  await pages.frontend.getByRole('button',{name:'Cancel',exact:true}).click();
  await pages.mobile.goBack();
  for(const [app,page]of Object.entries(pages)) {
   const buttons=await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>!n.disabled).slice(0,12).map(n=>({text:n.textContent.trim()||n.getAttribute('aria-label'),class:n.className,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor,image:getComputedStyle(n).backgroundImage})));
   await fs.writeFile(`artifacts/platform-theme/${app}-buttons.json`,JSON.stringify(buttons,null,2));
  }
  assert.equal(writes.filter(w=>w.path.endsWith('/preview')).length,1);
  assert.equal(writes.filter(w=>w.path==='/office/branding').length,2);
  // Bright primaries need dark button text, and readable derived links in either mode.
  await office.getByLabel('Primary HEX').fill('#ffff00');
  await office.getByRole('button',{name:'Generate with System Agent',exact:true}).click();
  await office.getByText('Violet with a warm secondary and subtle neutral surfaces.',{exact:false}).waitFor();
  await office.getByRole('radio',{name:'Dark',exact:true}).check();
  await office.getByRole('button',{name:'Apply theme to all apps',exact:true}).click();
  await office.waitForFunction(()=>document.documentElement.style.getPropertyValue('--theme-primary')==='#ffff00');
  for(const [app,page]of Object.entries(pages)){
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--theme-primary')==='#ffff00');
   await page.screenshot({path:`artifacts/platform-theme/${app}-bright-dark.png`,fullPage:true,animations:'disabled'});
   await fs.writeFile(`artifacts/platform-theme/${app}-bright-dark-contrast.json`,JSON.stringify(await page.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  }
  for(const path of ['/plans','/documentation/office','/tutorials']){
   await pages.website.goto(`http://127.0.0.1:8000${path}`);
   await pages.website.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await pages.website.waitForFunction(()=>document.documentElement.style.getPropertyValue('--theme-primary')==='#ffff00');
   await pages.website.screenshot({path:`artifacts/platform-theme/website${path.replaceAll('/','-')}-bright-dark.png`,fullPage:true,animations:'disabled'});
   await fs.writeFile(`artifacts/platform-theme/website${path.replaceAll('/','-')}-bright-dark-contrast.json`,JSON.stringify(await pages.website.evaluate(require('./theme-contrast-audit.cjs')),null,2));
  }
  await fs.writeFile('artifacts/platform-theme/browser-errors.json',JSON.stringify(errors,null,2));
  assert.deepEqual(errors,[]);
  const contrastReports=(await fs.readdir('artifacts/platform-theme')).filter(file=>file.endsWith('-contrast.json'));
  for(const file of contrastReports)assert.deepEqual(JSON.parse(await fs.readFile(`artifacts/platform-theme/${file}`,'utf8')),[],`${file}: visible text contrast`);
  console.log('Office generates/applies palettes; all four apps and Website receive all roles and switch light/dark. Automatic polling/focus, retained settings, dark forms, bright primaries and visible-text contrast passed. Writes mocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
