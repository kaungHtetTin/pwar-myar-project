// Isolated Office diagnostics fixture. All APIs are intercepted; no live settings or messages change.
const {chromium}=require('../shop/node_modules/playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const output='artifacts/server-health';await fs.mkdir(output,{recursive:true});
 const snapshot=JSON.parse(await fs.readFile(`${output}/fixture.json`,'utf8'));
 const browser=await chromium.launch();
 try{
  for(const [mode,width,height,role] of [['light',1440,900,'super_admin'],['dark',1280,720,'super_admin'],['light',1024,900,'super_admin'],['light',390,844,'super_admin'],['light',1440,900,'admin']]){
   const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});let reads=0;const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    assert.equal(request.method(),'GET');const path=url.pathname.slice(4);
    let json={items:[],total:0,has_more:false,realtime_enabled:false,enabled:false};
    if(path==='/office/auth/me')json={admin:{id:1,name:'Health fixture',role}};
    else if(path==='/branding')json={theme_mode:mode,primary_color:'#087f74',theme_version:1};
    else if(path==='/office/health/system'){reads++;json=snapshot;}
    else if(path==='/office/ai-balance-book/summary')json={balance:'5.000000000',can_use_ai:true};
    return route.fulfill({json});
   });
   await page.goto('http://127.0.0.1:5175/#/system/server-health');
   if(role==='admin'){
    await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
    assert.equal(reads,0);assert.equal(await page.getByRole('button',{name:'Server health',exact:true}).count(),0);
    await page.close();continue;
   }
   await page.getByRole('list',{name:'Runtime',exact:true}).waitFor();
   assert.equal(await page.getByRole('listitem').count(),snapshot.checks.length);
   const row=page.getByRole('list',{name:'Runtime',exact:true}).getByRole('listitem').first();
   const rowHeight=await row.evaluate(el=>el.getBoundingClientRect().height);
   assert.ok(rowHeight<=42,`Compact runtime row is ${rowHeight}px`);
   const search=page.getByRole('searchbox',{name:'Search server health'});
   await search.fill('database');
   assert.equal(await page.getByText('Realtime socket server',{exact:true}).count(),0);
   if(width>=1024){
    await page.getByRole('button',{name:'Overview',exact:true}).click();await page.goBack();
    await search.waitFor();assert.equal(await search.inputValue(),'database');assert.equal(reads,1);
   }
   await page.getByRole('button',{name:'Clear search server health',exact:true}).click();
   await page.getByRole('button',{name:'Filters',exact:true}).click();
   await page.getByRole('dialog').getByRole('combobox').selectOption('attention');
   await page.getByRole('dialog').getByRole('button',{name:'Apply filters',exact:true}).click();
   assert.equal(await page.getByRole('listitem').count(),snapshot.checks.filter(c=>['warning','unhealthy','unknown'].includes(c.status)).length);
   await page.getByRole('button',{name:/Filters/}).click();await page.getByRole('dialog').getByRole('button',{name:'Clear',exact:true}).click();
   await page.getByRole('button',{name:/Runtime.*checks/}).click();assert.equal(await row.isVisible(),false);
   await page.getByRole('button',{name:/Runtime.*checks/}).click();assert.equal(await row.isVisible(),true);
   assert.equal(reads,1);
   await page.getByRole('button',{name:'Check now',exact:true}).click();
   await page.getByRole('button',{name:'Check now',exact:true}).waitFor();assert.equal(reads,2);
   await page.locator('.office-content').evaluate(el=>{el.scrollTop=0;});
   await page.screenshot({path:`${output}/${mode}-${width}.png`,fullPage:true});
   assert.deepEqual(errors,[]);console.log(JSON.stringify({mode,width,rowHeight,checks:snapshot.checks.length,search_filters_back:true,errors:errors.length}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
