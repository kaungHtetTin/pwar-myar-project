const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated dev-server fixture: no live cover upload/removal.
const {chromium,firefox}=require('../../shop/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const origin='http://127.0.0.1:5176',output=path.resolve('artifacts/shop-cover-reference'),engine=process.env.COVER_BROWSER||'chromium';
const session={user:{id:301,role:'owner',name:'Olivia Martin'},business:{id:301,name:'Evergreen Market'},permissions:['shop','sell','products','sales','ecommerce_settings'],subscription:{is_valid:true}};
(async()=>{
 await fs.mkdir(output,{recursive:true});
 execFileSync('python',['-c',"from PIL import Image; Image.open('docs/design/shop-cover/103-shop-cover-cover-default.png').crop((40,218,813,598)).save('artifacts/shop-cover-reference/fixture-cover.png')"]);
 let current='data:image/png;base64,'+(await fs.readFile(path.join(output,'fixture-cover.png'))).toString('base64'),failUpload=true,failRemove=true;
 const replacement={name:'new-cover.png',mimeType:'image/png',buffer:await fs.readFile(path.join(output,'fixture-cover.png'))};
 const browser=await(engine==='firefox'?firefox:chromium).launch();const context=await browser.newContext({viewport:{width:393,height:817},hasTouch:true});await context.addInitScript(()=>{if(window===window.top)localStorage.setItem('mkpos.language','en');});
 const calls=[],errors=[];await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
 await context.route(`${origin}/api/**`,async r=>{
  const endpoint=new URL(r.request().url()).pathname.slice(4),method=r.request().method();calls.push({endpoint,method});let data={items:[],total:0};
  if(endpoint==='/auth/me')data=session;
  else if(endpoint==='/app-config')data={enabled_modules:session.permissions,permissions:session.permissions,business:{}};
  else if(endpoint==='/settings')data={currency:'MMK',language:'en'};
  else if(endpoint==='/shop-admin/owner-location')data={submitted:true};
  else if(endpoint==='/shop-admin/settings')data={cover_data_url:current};
  else if(endpoint==='/shop-admin/cover'){
   if(method==='POST'){
    assert.match(r.request().headers()['content-type'],/multipart\/form-data/);
    if(failUpload){failUpload=false;return r.fulfill({status:422,json:{message:'Cover was not saved.',errors:{cover:['Please choose an image within the dimension limit.']}}});}
    data={cover_data_url:current};
   }else if(method==='DELETE'){
    if(failRemove){failRemove=false;return r.fulfill({status:503,json:{message:'Cover could not be removed. Retry.'}});}
    current='';data={cover_data_url:''};
   }
  }
  await r.fulfill({json:data});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
 async function responsive(name){await shot(name);for(const width of [320,768]){await page.setViewportSize({width,height:817});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(name+'-'+width);}await page.setViewportSize({width:393,height:817});}
 try{
  await page.goto(`${origin}/shop`);const source=page.locator('.shop-overview-page');await source.waitFor();await source.evaluate(n=>n.dataset.retention='kept');await page.getByRole('button',{name:/^Cover photo/}).scrollIntoViewIfNeeded();const position=await page.evaluate(()=>scrollY);
  await page.getByRole('button',{name:/^Cover photo/}).click();await page.getByAltText('Current shop cover',{exact:true}).waitFor();await responsive('103');
  assert.ok(await page.getByRole('button',{name:'Save changes',exact:true}).isDisabled());
  await page.getByLabel('Shop cover file',{exact:true}).setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await page.getByText('Choose a PNG, JPG or WebP up to 2 MB.',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Save changes',exact:true}).isDisabled());
  const chooserPromise=page.waitForEvent('filechooser'); await page.getByRole('button',{name:'Replace',exact:true}).click(); const chooser=await chooserPromise; await chooser.setFiles(replacement);await page.getByAltText('Selected shop cover preview',{exact:true}).waitFor();
  const count=calls.filter(c=>c.endpoint==='/shop-admin/settings').length;
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await source.waitFor();assert.equal(await source.getAttribute('data-retention'),'kept');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<3);assert.equal(calls.filter(c=>c.endpoint==='/shop-admin/settings').length,count);
  await page.goForward();await page.getByText('new-cover.png',{exact:true}).waitFor(); await page.getByRole('button',{name:'Back to My Shop',exact:true}).click(); await source.waitFor(); await page.goForward(); await page.getByText('new-cover.png',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText('Please choose an image within the dimension limit.',{exact:true}).waitFor();await shot('upload-error');await page.getByText('new-cover.png',{exact:true}).waitFor();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.waitForURL('**/shop');
  await page.getByRole('button',{name:/^Cover photo/}).click();await page.getByAltText('Current shop cover',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('dialog',{name:'Remove cover?',exact:true}).waitFor();await shot('remove-confirmation');await page.getByRole('dialog',{name:'Remove cover?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.method==='DELETE').length,0);
  await page.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:'Remove cover',exact:true}).click();await page.getByText('Cover will be removed',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.method==='DELETE').length,0);await shot('pending-removal');await page.getByRole('button',{name:'Undo removal',exact:true}).click();await page.getByAltText('Current shop cover',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:'Remove cover',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText('Cover could not be removed. Retry.',{exact:true}).waitFor();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.waitForURL('**/shop');
  await page.getByRole('button',{name:/^Cover photo/}).click();await page.getByText('No cover image yet',{exact:true}).waitFor();await responsive('empty');
  await page.getByRole('button',{name:'Open app menu',exact:true}).click();await setDrawerLanguage(page, 'my');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.documentElement.lang==='my');await shot('myanmar');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({engine,widths:[320,393,768],reference:'103',uploadRetry:true,stagedRemoval:true,undo:true,removeRetry:true,sourceRetained:true,errors},null,2));console.log(`Shop cover ${engine}: reference, validation/retry, staged removal and Back passed.`);
 }catch(e){await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
