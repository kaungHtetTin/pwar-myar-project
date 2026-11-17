// All endpoints are intercepted; no live business records are modified.
const {chromium,firefox}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');
const origin=process.env.SETUP_ORIGIN||'http://127.0.0.1:5174';
(async()=>{
 const browser=await (process.env.SETUP_BROWSER==='firefox'?firefox:chromium).launch({headless:true});const output='artifacts/business-setup';await fs.mkdir(output,{recursive:true});const results=[];
 try{
  for(const [width,height,mode,language,scenario = 'new'] of [[1366,650,'light','en'],[1280,600,'light','en'],[1440,900,'light','en'],[1280,720,'dark','en'],[1024,768,'light','en'],[1440,900,'light','my'],[390,844,'light','en'],[1440,900,'light','en','legacy'],[1440,900,'light','en','pending-return'],[1440,900,'light','en','staff'],[1280,800,'light','en','sell']]){
   if(process.env.SETUP_ONLY && process.env.SETUP_ONLY!==scenario)continue;
   if(process.env.SETUP_LANGUAGE && process.env.SETUP_LANGUAGE!==language)continue;
   const context=await browser.newContext({viewport:{width,height},reducedMotion:width===1024?'reduce':'no-preference',serviceWorkers:'block'});
   const page=await context.newPage();const errors=[],calls=[];let failCompletion=true;
   const data={progress:scenario==='legacy'?null:{version:1,step:1,status:'pending'},business:{id:101,name:'Corner Goods',currency:'Ks',timezone:'Asia/Yangon'},basics:{name:'Corner Goods',currency:'Ks',timezone:'Asia/Yangon'},payment_methods:['Cash'],product_count:0,can_products:true,can_sell:true,currency_locked:false,timezones:['Asia/Yangon','Asia/Bangkok','Asia/Singapore','UTC']};
   const session={user:{id:101,name:'Fixture Owner',role:scenario==='staff'?'staff':'owner'},business:data.business,permissions:['products','sell','settings'],subscription:{is_valid:true}};
   await context.addInitScript(({language,active})=>{localStorage.setItem('mkpos.activeModule',active);localStorage.setItem('mkpos.language',language);sessionStorage.setItem('mkpos.variant-recommendation.dismissed','1');},{language,active:scenario==='sell'?'sell':'products'});
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());if(!url.pathname.startsWith('/api/'))return route.continue();
    const endpoint=url.pathname.slice(4),method=req.method();calls.push({endpoint,method});let body={items:[],total:0,enabled:false,realtime_enabled:false};
    if(endpoint==='/auth/me')body=session;
    else if(endpoint==='/branding')body={primary_color:'#087f74',theme_mode:mode};
    else if(endpoint==='/app-config')body={enabled_modules:session.permissions,permissions:session.permissions,business:data.business,language};
    else if(endpoint==='/settings/logo'){data.receipt_logo_data_url=method==='DELETE'?'':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=';body={receipt_logo_data_url:data.receipt_logo_data_url};}
    else if(endpoint==='/settings')body={shop_name:data.business.name,currency:'Ks',payment_methods:'Cash',price_types:'Retail',language};
    else if(endpoint==='/price-types')body={items:['Retail'],rules:[]};
    else if(endpoint==='/categories')body=[];
    else if(endpoint==='/products' && ['legacy','pending-return'].includes(scenario)){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||50);body={items:Array.from({length:limit},(_,i)=>({id:offset+i+1,name:`Tea ${offset+i+1}`,base_unit:'Piece',cost:500,price:1000,stock:10,prices:[{name:'Retail',price:1000}]})),total:120};}
    else if(endpoint==='/business-setup'){
     if(method==='PUT'){
      const payload=req.postDataJSON();
      if(payload.action==='start'&&!data.progress)data.progress={version:1,step:1,status:'pending'};
      if(payload.action==='basics'){data.basics={name:payload.name,address:payload.address,phone:payload.phone,currency:payload.currency,timezone:payload.timezone};Object.assign(data.business,{name:payload.name,currency:payload.currency,timezone:payload.timezone});data.progress.step=2;}
      if(payload.action==='payments'){data.payment_methods=payload.payment_methods;data.progress.step=3;}
      if(payload.action==='finish'){
       if(failCompletion&&language==='en'&&width===1440&&scenario==='new'){failCompletion=false;return route.fulfill({status:422,json:{message:'Fixture completion failed. Retry is safe.'}});}
       data.progress={...data.progress,step:4,status:'complete'};
      }
     }
     body=data;
    }else if(endpoint==='/business-setup/product'){
     assert.equal(method,'POST');const product=req.postDataJSON();assert.equal(product.stock,24);assert.equal(product.cost,1000);
     data.product_count=1;data.progress.product_id=77;body=data;
    }
    return route.fulfill({status:200,json:body});
   });
   await context.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204}));
   await page.goto(origin);
   const wizard=page.locator('.business-setup-page');
   assert.equal(await page.locator('[data-business-setup-trigger]').count(),0,'The drawer has no setup launcher');
   if(scenario==='staff'){
    await page.locator('.app-shell').waitFor();assert.equal(calls.filter(call=>call.endpoint==='/business-setup').length,0);assert.equal(await wizard.count(),0);results.push({scenario,staffUninterrupted:true});await context.close();continue;
   }
   if(scenario==='legacy'){
    await page.locator('.app-shell').waitFor();assert.equal(await wizard.count(),0);
    assert.equal(await page.locator('.setup-reminder').count(),0);
    await page.goto(`${origin}/?setup=1&setupStep=1`);await page.locator('.app-shell').waitFor();
    assert.equal(await wizard.count(),0,'Old direct links do not onboard existing businesses');
    assert.ok(!calls.some(call=>call.endpoint==='/business-setup'&&call.method==='PUT'));
    results.push({scenario,noSetupNavigation:true,directLinkIgnored:true,onboardingNotStarted:true});await context.close();continue;
   }
   if(scenario==='pending-return'){
    await wizard.waitFor();await wizard.locator('.setup-exit').click();await wizard.waitFor({state:'hidden'});
    await page.locator('.app-shell').waitFor();await page.getByLabel('Search products or scan barcode',{exact:true}).fill('Tea');
    await page.waitForResponse(response=>response.url().includes('/products?')&&response.url().includes('q=Tea'));
    await Promise.all([page.waitForResponse(response=>response.url().includes('/products?')&&response.url().includes('offset=50')),page.getByRole('button',{name:'Next',exact:true}).click()]);
    await page.getByText('Tea 51',{exact:true}).waitFor();
    const sourceGrid=page.locator('.product-grid-wrap');
    await sourceGrid.evaluate(el=>{el.scrollLeft=200;el.scrollTop=150;});
    const scroll=await sourceGrid.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
    assert.equal(await wizard.count(),0);
    const reads=()=>calls.filter(call=>call.endpoint==='/products'&&call.method==='GET').length;
    const before=reads();
    await page.getByRole('button',{name:'Resume setup',exact:true}).click();await wizard.waitFor();
    await wizard.locator('.setup-exit').click();await wizard.waitFor({state:'hidden'});
    assert.equal(await page.getByLabel('Search products or scan barcode',{exact:true}).inputValue(),'Tea');assert.equal(reads(),before);
    await page.getByRole('button',{name:'Resume setup',exact:true}).click();await wizard.waitFor();
    await page.goBack();await wizard.waitFor({state:'hidden'});
    assert.equal(reads(),before);assert.equal(await page.getByLabel('Search products or scan barcode',{exact:true}).inputValue(),'Tea');
    assert.ok(await page.getByText('Tea 51',{exact:true}).isVisible());
    assert.deepEqual(await sourceGrid.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop})),scroll);
    results.push({scenario,pendingOnboardingResumes:true,finishLaterRetainsSource:true,browserBackRetainsSource:true,retainedPage:2,scroll,sourceRefetches:reads()-before});await context.close();continue;
   }
   await wizard.waitFor();
   assert.equal(await wizard.locator('.setup-brand strong').innerText(),'PwarMyar','The wizard keeps PwarMyar branding');
   const localeSwitch=wizard.getByRole('switch',{name:'English / မြန်မာ',exact:true});
   assert.equal(await localeSwitch.getAttribute('aria-checked'),String(language==='my'));
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await wizard.locator('.setup-topbar').count(),0,'Setup has no app bar');
   const surface=await wizard.locator('.setup-layout').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderWidth,shadow:s.boxShadow};});
   assert.notEqual(surface.background,'rgba(0, 0, 0, 0)','The form card has a solid surface');assert.equal(surface.border,'1px');assert.notEqual(surface.shadow,'none');
   const snap=async step=>{if(width>=1024){const fit=await wizard.evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));assert.ok(fit.scroll<=fit.height+1,`Setup must fit without scrolling at ${width}x${height}/${step}: ${JSON.stringify(fit)}`);const card=await wizard.locator('.setup-layout').boundingBox();assert.ok(card.y>=0&&card.y+card.height<=height+1,`All setup controls remain in view at ${width}x${height}/${step}`);}if(width===1024)assert.equal(await wizard.locator('.setup-slide').evaluate(el=>getComputedStyle(el).animationName),'none');await page.screenshot({path:`${output}/${width}-${mode}-${language}-${step}.png`,fullPage:true,animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}/${step}`);};
   const input=wizard.locator('.setup-field input').first();assert.equal(await input.inputValue(),'Corner Goods');
   const checkFocus=async control=>{
    await control.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    const style=await control.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,border:s.borderColor,shadow:s.boxShadow,focused:el===document.activeElement};});
    const brand=await wizard.locator('.setup-exit').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand').trim());
    const brandColor=await wizard.locator('.setup-brand > span:first-child').evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(style.outline,'none','Text controls must not add a second outline');
    assert.equal(style.focused,true,'The control must receive keyboard focus');
    assert.ok(brand,'An active brand color is available');
    assert.equal(style.border,brandColor,'Focus border follows the active theme');
    assert.notEqual(style.shadow,'none','A single focus ring remains visible');
   };
   await input.click();await checkFocus(input);
   await input.press('Tab');await checkFocus(wizard.locator('.setup-field input').nth(1));
   await wizard.locator('.setup-field input').nth(1).press('Tab');await checkFocus(wizard.locator('.setup-field textarea'));
   await wizard.locator('.setup-field textarea').press('Tab');await checkFocus(wizard.locator('.setup-field input').nth(2));
   await wizard.locator('.setup-field input').nth(2).press('Tab');await checkFocus(wizard.locator('.setup-field select'));
   await input.click();
   await wizard.locator('input[type=tel]').fill('09123456789');
   await wizard.locator('textarea').fill('No. 12, Market Road\nYangon');
   const nameBox=await input.boundingBox(),logoBox=await wizard.locator('.setup-logo-upload').boundingBox();
   assert.ok(logoBox.x>=nameBox.x+nameBox.width,'The logo occupies the space to the right of the business name');
   assert.ok(Math.abs(logoBox.y-nameBox.y)<10,'Logo aligns with the business name input');
   const progressLabels=await wizard.locator('.setup-steps button > span:last-child').evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,display:getComputedStyle(el).display})));
   assert.ok(progressLabels.every(label=>label.display!=='none'&&label.width>40),'Progress labels remain readable at every viewport');
   await snap('basics');
   if(width===1440&&language==='en'&&scenario==='new'){
    const logoFile={name:'logo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=','base64')};
    const choose=async label=>{const pending=page.waitForEvent('filechooser');await wizard.getByRole('button',{name:label,exact:true}).click();await (await pending).setFiles(logoFile);await wizard.getByAltText('Current business logo',{exact:true}).waitFor();await wizard.getByRole('button',{name:'Replace logo',exact:true}).waitFor();};
    await choose('Upload logo');await snap('logo');
    await page.reload();await wizard.getByAltText('Current business logo',{exact:true}).waitFor();
    await choose('Replace logo');await wizard.getByRole('button',{name:'Remove logo',exact:true}).click();
    await wizard.getByRole('button',{name:'Upload logo',exact:true}).waitFor();assert.equal(await wizard.getByAltText('Current business logo',{exact:true}).count(),0);
    assert.equal(calls.filter(call=>call.endpoint==='/settings/logo'&&call.method==='POST').length,2);
    assert.equal(calls.filter(call=>call.endpoint==='/settings/logo'&&call.method==='DELETE').length,1);
   }

   if(language==='my'){
    assert.ok((await wizard.locator('.setup-slide-heading h2').innerText()).includes('လုပ်ငန်း'));
    assert.equal(await wizard.getByLabel('လုပ်ငန်းအမည်',{exact:true}).inputValue(),'Corner Goods');
    assert.equal(await wizard.getByLabel('လုပ်ငန်းဖုန်းနံပါတ် (မဖြစ်မနေ မလိုပါ)',{exact:true}).inputValue(),'09123456789');
    assert.equal(await wizard.getByLabel('လုပ်ငန်းလိပ်စာ (မဖြစ်မနေ မလိုပါ)',{exact:true}).inputValue(),'No. 12, Market Road\nYangon');
    await wizard.getByRole('button',{name:'သိမ်းပြီး ဆက်သွားမည်',exact:true}).click();
    await wizard.getByRole('heading',{name:'ပေးချေမှုများ',exact:true}).waitFor();
    await wizard.getByText('အမည်များကို ကော်မာဖြင့် ခွဲပါ။',{exact:true}).waitFor();
    await wizard.getByRole('checkbox',{name:'ဘဏ်မှ ငွေလွှဲခြင်း',exact:true}).check();
    await wizard.getByRole('checkbox',{name:'KPay',exact:true}).check();
    await snap('payments');
    await wizard.getByRole('button',{name:'သိမ်းပြီး ဆက်သွားမည်',exact:true}).click();
    await wizard.getByRole('heading',{name:'ကုန်ပစ္စည်းတစ်ခု ထည့်မည်',exact:true}).waitFor();
    assert.equal(await wizard.getByLabel('ကုန်ပစ္စည်းအမည်',{exact:true}).getAttribute('placeholder'),'ဥပမာ - သောက်ရေသန့်');
    await wizard.getByText('ဝယ်ဈေးသည် မဖြစ်မနေ မလိုအပ်ပါ။ အမြတ်အစီရင်ခံစာများတွက်ရန် အသုံးပြုသည်။',{exact:true}).waitFor();
    await snap('products');
    await wizard.getByLabel('ကုန်ပစ္စည်းအမည်',{exact:true}).fill('Drinking Water');
    await wizard.getByLabel('Piece တစ်ယူနစ်ရောင်းဈေး (Ks)',{exact:true}).fill('1500');
    await wizard.getByRole('checkbox',{name:'မတူညီသောယူနစ်ဖြင့် ဝယ်ယူပါသလား။',exact:true}).check();
    await wizard.getByLabel('ဝယ်ယူသည့် ၁ ယူနစ်တွင် Piece မည်မျှ ပါဝင်သနည်း။',{exact:true}).waitFor();
    await snap('purchase-unit');
    await wizard.getByLabel('ဝယ်ယူသည့်ယူနစ်',{exact:true}).fill('Carton');
    await wizard.getByLabel('Carton တစ်ယူနစ်တွင် Piece မည်မျှ ပါဝင်သနည်း။',{exact:true}).fill('12');
    await wizard.getByLabel('လက်ကျန်ထည့်သွင်းမည့်ယူနစ်',{exact:true}).selectOption('purchase');
    await wizard.getByLabel('ဝယ်ဈေးထည့်သွင်းမည့်ယူနစ်',{exact:true}).selectOption('purchase');
    await wizard.getByLabel('အဖွင့်လက်ကျန် (Carton)',{exact:true}).fill('2');
    await wizard.getByLabel('Carton တစ်ယူနစ်ဝယ်ဈေး (Ks)',{exact:true}).fill('12000');
    await snap('product-filled');
    await wizard.getByRole('button',{name:'ပစ္စည်းသိမ်းပြီး အဆုံးသတ်မည်',exact:true}).click();
    await wizard.getByRole('heading',{name:'သင့်လုပ်ငန်း အဆင်သင့်ဖြစ်ပါပြီ',exact:true}).waitFor();
    await snap('complete');
    await wizard.getByRole('button',{name:'စတင်ရောင်းမည်',exact:true}).click();await wizard.waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);results.push({width,height,mode,language,translated:true,allSteps:true,preservedEnteredNames:true,finished:true,errors});await context.close();continue;
   }
   await input.fill('My Corner Store');
   // The logo scenario deliberately reloads before this save; re-enter its unsaved contact draft.
   await wizard.getByLabel('Business phone (optional)',{exact:true}).fill('09123456789');
   await wizard.getByLabel('Business address (optional)',{exact:true}).fill('No. 12, Market Road\nYangon');
   if(width===1440&&language==='en'&&scenario==='new'){
    const beforeLocale=new URL(page.url()).search;
    await localeSwitch.click();await wizard.getByRole('heading',{name:'လုပ်ငန်း အခြေခံအချက်အလက်',exact:true}).waitFor();
    assert.equal(await wizard.getByLabel('လုပ်ငန်းအမည်',{exact:true}).inputValue(),'My Corner Store');
    assert.equal(new URL(page.url()).search,beforeLocale,'Changing language retains the setup step');
    await wizard.getByRole('button',{name:'သိမ်းပြီး ဆက်သွားမည်',exact:true}).click();
    await wizard.getByRole('heading',{name:'ပေးချေမှုများ',exact:true}).waitFor();
    assert.equal(await localeSwitch.getAttribute('aria-checked'),'true','Saving basics preserves the chosen locale');
    assert.equal(await page.evaluate(()=>localStorage.getItem('mkpos.language')),'my');
    await localeSwitch.press('Space');
   }else await wizard.getByRole('button',{name:'Save & continue',exact:true}).click();
   await wizard.getByRole('heading',{name:'Payments'}).waitFor();
   const assertMotion=async direction=>{
    const slide=wizard.locator('form.setup-slide');
    assert.equal(await slide.getAttribute('data-direction'),direction);
    assert.equal(await slide.evaluate(el=>getComputedStyle(el).animationName),width===1024?'none':`setup-slide-${direction}`);
   };
   await assertMotion('forward');
   await page.goBack();await wizard.getByRole('heading',{name:'Business basics'}).waitFor();assert.equal(await wizard.getByLabel('Business name',{exact:true}).inputValue(),'My Corner Store');
   assert.equal(await wizard.getByLabel('Business phone (optional)',{exact:true}).inputValue(),'09123456789');
   assert.equal(await wizard.getByLabel('Business address (optional)',{exact:true}).inputValue(),'No. 12, Market Road\nYangon');
   await assertMotion('backward');
   await page.goForward();await wizard.getByRole('heading',{name:'Payments'}).waitFor();
   await assertMotion('forward');
   const paymentCards=await wizard.locator('.setup-payment-options label').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),check=node.querySelector('input').getBoundingClientRect();return {top:r.top,height:r.height,checkboxHeight:check.height};}));
   assert.equal(paymentCards.length,4);
   assert.ok(paymentCards.every(card=>card.checkboxHeight===16),'Checkboxes do not inherit the text-input minimum height');
   if(width>600){assert.ok(paymentCards.every(card=>card.height>=40&&card.height<=46),'Desktop payment cards stay compact');assert.equal(new Set(paymentCards.map(card=>card.top)).size,2,'Payment options use two balanced rows');}
   else assert.ok(paymentCards.every(card=>card.height>=44),'Narrow layouts retain touch-sized payment targets');
   await snap('payments');
   await wizard.getByRole('checkbox',{name:'KPay',exact:true}).check();
   await wizard.getByRole('button',{name:'Save & continue',exact:true}).click();
   await wizard.getByRole('heading',{name:'Add a product'}).waitFor();
   assert.equal(await wizard.getByRole('button',{name:/Import CSV|Do this later|Choose CSV/}).count(),0,'Product setup contains only the add form');
   await snap('products');
   // Reload resumes this slide from server progress.
   await page.reload();await page.getByRole('heading',{name:'Add a product'}).waitFor();
   await wizard.getByLabel('Product name',{exact:true}).fill('Drinking Water');
   await wizard.getByLabel('Selling price per Piece (Ks)',{exact:true}).fill('1500');
   if(width===1440&&language==='en'&&scenario==='new'){
    const beforeLocale=new URL(page.url()).search;
    await localeSwitch.click();await wizard.getByRole('heading',{name:'ကုန်ပစ္စည်းတစ်ခု ထည့်မည်',exact:true}).waitFor();
    assert.equal(await wizard.getByLabel('ကုန်ပစ္စည်းအမည်',{exact:true}).inputValue(),'Drinking Water');
    assert.equal(await wizard.getByLabel('Piece တစ်ယူနစ်ရောင်းဈေး (Ks)',{exact:true}).inputValue(),'1500');
    assert.equal(new URL(page.url()).search,beforeLocale);
    await snap('locale-switch');await localeSwitch.press('Space');
    await wizard.getByRole('heading',{name:'Add a product',exact:true}).waitFor();
    assert.equal(await wizard.getByLabel('Product name',{exact:true}).inputValue(),'Drinking Water');
   }
   const setupReads=calls.filter(call=>call.endpoint==='/business-setup'&&call.method==='GET').length;
   await wizard.getByRole('button',{name:'Back',exact:true}).click();
   await wizard.getByRole('heading',{name:'Payments',exact:true}).waitFor();
   assert.ok(await wizard.getByRole('checkbox',{name:'KPay',exact:true}).isChecked(),'Back retains selected payments');
   await wizard.locator('.setup-steps button').filter({hasText:'Business basics'}).click();
   await wizard.getByRole('heading',{name:'Business basics',exact:true}).waitFor();
   assert.equal(await wizard.getByLabel('Business name',{exact:true}).inputValue(),'My Corner Store');
   await wizard.locator('.setup-steps button').filter({hasText:'Add a product'}).click();
   await wizard.getByRole('heading',{name:'Add a product',exact:true}).waitFor();
   assert.equal(await wizard.getByLabel('Product name',{exact:true}).inputValue(),'Drinking Water');
   assert.equal(await wizard.getByLabel('Selling price per Piece (Ks)',{exact:true}).inputValue(),'1500');
   assert.equal(calls.filter(call=>call.endpoint==='/business-setup'&&call.method==='GET').length,setupReads,'Back and step navigation retain drafts without fetching setup again');
   await wizard.getByRole('checkbox',{name:'Buy in a different unit?'}).check();
   const checkUnitAlignment=async()=>{
    if(width<=600)return;
    const pairs=await wizard.locator('.setup-product-fields .product-unit-entry').evaluateAll(nodes=>nodes.map(node=>Array.from(node.children).filter(child=>child.classList.contains('product-unit-entry-field'))).filter(fields=>fields.length>=2).map(fields=>fields.slice(-2).map(field=>field.querySelector('input,select').getBoundingClientRect().top)));
    assert.ok(pairs.length>0,'Unit setup has paired controls');
    assert.ok(pairs.every(([left,right])=>Math.abs(left-right)<1),'Paired unit controls align even when a label wraps');
   };
   await checkUnitAlignment();await snap('purchase-unit');
   await wizard.getByLabel('Purchase unit',{exact:true}).fill('Carton');
   await wizard.getByLabel('How many Piece in 1 Carton?',{exact:true}).fill('12');
   await wizard.getByLabel('Stock entry unit',{exact:true}).selectOption('purchase');
   await wizard.getByLabel('Cost entry unit',{exact:true}).selectOption('purchase');
   await wizard.getByLabel('Opening stock (Carton)',{exact:true}).fill('2');
   await wizard.getByLabel('Purchase cost per Carton (Ks)',{exact:true}).fill('12000');
   await checkFocus(wizard.getByLabel('Purchase cost per Carton (Ks)',{exact:true}));
   await checkUnitAlignment();
   await snap('product-filled');
   await wizard.getByRole('button',{name:'Save product & finish',exact:true}).click();
   if(width===1440){await wizard.getByRole('alert').waitFor();await wizard.getByRole('button',{name:'Finish setup',exact:true}).click();}
   await wizard.getByRole('heading',{name:'Your business is ready'}).waitFor();
   assert.equal(calls.filter(call=>call.endpoint==='/business-setup/product').length,1);
   await snap('complete');
   await wizard.getByRole('button',{name:'Start selling',exact:true}).click();await wizard.waitFor({state:'hidden'});
   assert.ok(!new URL(page.url()).searchParams.has('setup'));
   await page.reload();await page.locator('.app-shell').waitFor();assert.equal(await page.locator('.business-setup-page').count(),0);
   assert.deepEqual(errors,[]);results.push({width,height,mode,language,reloadResumes:true,browserBackForward:true,productCreatedOnce:true,finished:true,errors});await context.close();
  }
  await fs.writeFile(`${output}/results${process.env.SETUP_LANGUAGE?`-${process.env.SETUP_LANGUAGE}`:''}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
