const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:393,height:852}});
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('mkpos.shop.customerToken','fixture');localStorage.setItem('mkpos.shop.carts.v2',JSON.stringify([{slug:'demo',name:'Demo',items:[{id:1,name:'Apples',quantity:1,price:3000,currency:'K'}]}]));});
 await page.route('**/ecommerce/**',r=>{const url=r.request().url();return r.fulfill({json:url.endsWith('/customer/me')?{customer:{id:1,name:'Kaung Htet Tin',phone:'0912345678',email:'buyer@example.com'}}:url.endsWith('/customer/addresses')?{items:[]}:{slug:'demo',display_name:'Demo',accepting_orders:true,currency:'K',payment_methods:[{id:'cash',name:'Cash',type:'cash'}],delivery_zones:[]}});});
 await page.goto('http://127.0.0.1:5177/#/store/demo/checkout');
 await page.getByRole('button',{name:'Checkout account',exact:true}).click();
 await page.getByText('Use my account',{exact:true}).waitFor();
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'test-artifacts/checkout/account-modal.png'});
 await page.locator('dialog').screenshot({path:'test-artifacts/checkout/account-modal-detail.png'});
 await page.getByRole('button',{name:/Continue as guest/}).click();
 if(await page.getByRole('dialog').count()) throw Error('Selection did not close');
 await page.getByRole('button',{name:'Checkout account',exact:true}).click();
 if(await page.getByRole('button',{name:/Continue as guest/}).getAttribute('aria-pressed')!=='true')throw Error('Guest choice lost');
 await page.getByRole('button',{name:/Use my account/}).click();
 await page.getByRole('button',{name:'Edit delivery address'}).click();
 await page.getByText('Manage saved addresses').waitFor();
 await page.screenshot({path:'test-artifacts/checkout/address-modal.png'});
 await page.locator('dialog').screenshot({path:'test-artifacts/checkout/address-modal-detail.png'});
 await page.keyboard.press('Escape');
 const compare=await browser.newPage({viewport:{width:806,height:900}});
 for(const [kind,path] of [['account','C:/Users/Hp/Downloads/ChatGPT Image Oct 13, 2026, 06_48_11 PM-1.png'],['address','C:/Users/Hp/Downloads/ChatGPT Image Oct 13, 2026, 06_48_13 PM-2.png']]){
 const ref=fs.readFileSync(path).toString('base64'),actual=fs.readFileSync(`test-artifacts/checkout/${kind}-modal-detail.png`).toString('base64');
 await compare.setContent(`<body style="margin:0;display:flex;gap:20px;background:#ddd;font:14px Arial"><div style="width:393px">Reference, scaled to 393px<img style="width:393px;display:block" src="data:image/png;base64,${ref}"></div><div style="width:393px">Rendered modal, 393px viewport<img style="display:block;max-width:393px;margin:23px auto" src="data:image/png;base64,${actual}"></div></body>`);
 await compare.screenshot({path:`test-artifacts/checkout/${kind}-modal-comparison.png`});
 }
 await browser.close();console.log('PASS signed-in modal selection, reopening, address controls and Escape.');
})().catch(e=>{console.error(e);process.exit(1)});

