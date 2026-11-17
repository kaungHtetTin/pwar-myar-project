// Isolated settings navigation fixture. No live credentials, API writes or provider calls.
const {chromium}=require('../shop/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const output='artifacts/office-settings-menu';await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch();
 try{
  for(const [mode,width,height] of [['light',1440,900],['dark',1280,720],['light',1024,900],['light',390,844]]){
   const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});const calls=[],errors=[];
   let settings={enabled:false,configured:true,model:'deepseek-flash',weekly_limit:50,max_tokens:1600,usd_to_mmk_rate:'4200',sales_ai_markup_percent:'5.00'};
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
    if(url.pathname==='/sanctum/csrf-cookie')return route.fulfill({status:204});
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const path=url.pathname.slice(4);calls.push({path,method:request.method()});
    let json={items:[],total:0,has_more:false,realtime_enabled:false,enabled:false};
    if(path==='/office/auth/me')json={admin:{id:1,name:'Menu fixture',role:'super_admin'}};
    else if(path==='/branding')json={theme_mode:mode,primary_color:'#087f74',theme_version:1};
    else if(path==='/office/ai-assistant'){
     if(request.method()==='PUT'){
      const body=request.postDataJSON();
      assert.deepEqual(Object.keys(body).sort(),['sales_ai_markup_percent','usd_to_mmk_rate']);
      settings={...settings,...body};
     }json={settings};
    }else if(path==='/office/telegram-support')json={settings:{enabled:false,storage_ready:true,version:0,token_configured:false,webhook_url:'',daily_limit:200,per_chat_daily_limit:20}};
    else assert.equal(request.method(),'GET','Unexpected mutation');
    return route.fulfill({json});
   });
   await page.goto('http://127.0.0.1:5175/#/settings/ai-provider');
   const nav=page.getByRole('navigation',{name:'Settings sections'});
   await page.getByLabel('New API key').waitFor();
   assert.equal(await nav.getByRole('heading',{name:'General settings',exact:true}).count(),1);
   const group=nav.getByRole('region',{name:'AI settings',exact:true});
   assert.equal(await group.getByRole('button').count(),4);
   await page.screenshot({path:`${output}/${mode}-${width}-provider.png`,fullPage:true});
   await page.getByLabel('New API key').fill('sk-private-draft-fixture');
   await group.getByRole('button',{name:/Wyne Wyne AI assistant/}).click();
   await page.getByLabel('DeepSeek model').fill('');
   await group.getByRole('button',{name:/Sales AI pricing/}).click();
   assert.equal(await page.getByLabel('DeepSeek model').isDisabled(),true);
   await page.getByLabel('Platform markup (%)').fill('7.5');
   await page.getByRole('button',{name:'Save Sales AI pricing',exact:true}).click();
   await page.getByText('AI assistant settings saved.',{exact:true}).waitFor();
   await page.screenshot({path:`${output}/${mode}-${width}-pricing.png`,fullPage:true});
   await page.goBack();assert.equal(await page.getByLabel('DeepSeek model').inputValue(),'');
   await group.getByRole('button',{name:/AI provider/}).click();
   assert.equal(await page.getByLabel('New API key').inputValue(),'sk-private-draft-fixture');
   assert.equal(calls.filter(c=>c.path==='/office/ai-assistant'&&c.method==='GET').length,1);
   await group.getByRole('button',{name:/Telegram customer service/}).click();
   await page.getByLabel(/^Bot token/).waitFor();
   await page.locator('.office-content').evaluate(el=>{el.scrollTop=0;});
   await page.screenshot({path:`${output}/${mode}-${width}.png`,fullPage:true});
   assert.deepEqual(errors,[]);console.log(JSON.stringify({mode,width,groups:true,ai_items:4,scoped_save:true,back_retains_draft:true,errors:errors.length}));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
