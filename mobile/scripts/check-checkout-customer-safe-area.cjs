// Isolated checkout fixtures; emulate native insets without touching live records.
const {chromium}=require('../../shop/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const origin=process.env.CHECKOUT_ORIGIN || 'http://127.0.0.1:5198';
(async()=>{
 const browser=await chromium.launch({headless:true});const results=[];
 const output=path.resolve(__dirname,'../artifacts/checkout-customer-safe-area');await fs.mkdir(output,{recursive:true});
 try {
  for(const [width,height,inset] of [[393,817,48],[320,640,48],[768,900,48],[393,817,24],[393,817,0],[393,430,0]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});
   const page=await context.newPage();const errors=[];let customerRequests=0;
   page.on('pageerror',e=>errors.push(e.message));
   const session={user:{id:101,name:'Fixture Owner',role:'owner'},business:{id:101,name:'Fixture Shop',currency:'Ks'},permissions:['sell','products','sales','shop'],subscription:{is_valid:true}};
   const draft={cart:[{product_id:1,product_name:'Water',quantity:1,foc_quantity:0,unit_price:1000,unit_cost:500,stock:20,base_unit:'Piece',price_type:'Retail'}],discount:0,paidAmount:'',paymentMethod:'Cash',customer:null};
   const customers=Array.from({length:35},(_,i)=>({id:i+1,name:`Fixture Customer ${i+1}`,phone:'091234567'}));
   await context.addInitScript(draft=>{sessionStorage.setItem('mkpos-mobile-sale-draft-v1:101:101',JSON.stringify(draft));localStorage.setItem('mkpos.language','en');},draft);
   await context.route(`${origin}/api/**`,async route=>{
    const u=new URL(route.request().url()),endpoint=u.pathname.slice(4);let body={items:[],total:0,enabled:false,realtime_enabled:false};
    if(endpoint==='/auth/me')body=session;
    else if(endpoint==='/app-config')body={enabled_modules:session.permissions,permissions:session.permissions,business:session.business,language:'en'};
    else if(endpoint==='/settings')body={currency:'Ks',price_types:'Retail',payment_methods:'Cash'};
    else if(endpoint==='/price-types'||endpoint==='/categories')body=[];
    else if(endpoint==='/customers') {customerRequests++;const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||20);body={items:customers.slice(offset,offset+limit),total:customers.length};}
    await route.fulfill({status:200,json:body});
   });
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
   await page.goto(`${origin}/sell/checkout`);
   await page.evaluate(inset=>document.documentElement.style.setProperty('--safe-area-inset-bottom',`${inset}px`),inset);
   await page.getByRole('button',{name:'Change',exact:true}).click();
   const sheet=page.getByRole('dialog',{name:'Choose customer'});
   await sheet.getByRole('button',{name:/Fixture Customer 1\b/}).waitFor();
   await sheet.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
   const confirm=sheet.getByRole('button',{name:'Confirm selection',exact:true});
   const check=async stage=>{
    const box=await confirm.boundingBox();assert.ok(box,stage+' button exists');
    assert.ok(box.y>=0 && box.y+box.height<=height-inset-10,`${stage}: button ${box.y+box.height} must be above navigation boundary ${height-inset}`);
    assert.ok(box.height>=44,stage+' touch target');
    assert.ok(await confirm.evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),stage+' button receives touches');
    return {stage,buttonBottom:box.y+box.height,safeBoundary:height-inset};
   };
   const metrics=[await check('initial')];
   // Reproduce the previous layout to prove the regression test detects the overlap.
   if(width===393&&height===817&&inset===48){
    const old=await page.addStyleTag({content:'.retail-picker-confirm { bottom:-16px; margin:8px -16px -16px; padding:12px 16px; } .retail-customer-sheet .mobile-sheet-body { padding-bottom:16px; }'});
    const box=await confirm.boundingBox();assert.ok(box.y+box.height>height-inset,'Previous CSS overlaps the simulated Android navigation bar');
    await old.evaluate(node=>node.remove());
   }
   await sheet.locator('.mobile-sheet-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   await sheet.getByRole('button',{name:/Fixture Customer 35\b/}).waitFor();
   await sheet.locator('.mobile-sheet-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   metrics.push(await check('after-scroll'));
   await sheet.getByRole('button',{name:/Fixture Customer 35\b/}).click();
   metrics.push(await check('after-selection'));
   await page.screenshot({path:path.join(output,`${width}-${height}-inset-${inset}.png`)});
   await confirm.click();await sheet.waitFor({state:'hidden'});
   assert.ok(await page.getByText('Fixture Customer 35',{exact:true}).isVisible());
   // Reopening and canceling must retain the confirmed checkout customer.
   await page.getByRole('button',{name:'Change',exact:true}).click();
   await page.getByRole('button',{name:'Close customer picker',exact:true}).last().click();
   assert.ok(await page.getByText('Fixture Customer 35',{exact:true}).isVisible());
   assert.deepEqual(errors,[]);results.push({width,height,inset,customerRequests,metrics,confirmedSelection:true,cancelPreservesSelection:true,errors});
   await context.close();
  }
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log('PASS: native insets 0/24/48px, narrow screen, reduced viewport, endless list scrolling, selection, confirm and cancel.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
