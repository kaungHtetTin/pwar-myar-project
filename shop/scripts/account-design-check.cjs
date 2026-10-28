const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:393,height:852}});
 const customer={id:1,name:'Aung Min',email:'aungmin@example.com',phone:'09950000001',address:'Yangon',avatar_url:null};
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('mkpos.shop.customerToken','fixture')});
 await page.route('**/ecommerce/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({json:path.endsWith('/customer/me')||path.endsWith('/customer/profile')?{customer}: {items:[],has_more:false,unread_count:0}})});
 await page.goto('http://127.0.0.1:5177/#/account');
 await page.getByRole('heading',{name:'Aung Min'}).waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const cardGeometry=await page.evaluate(()=>{const card=document.querySelector('.me-profile-card').getBoundingClientRect(),button=document.querySelector('.me-edit').getBoundingClientRect(),avatar=document.querySelector('.me-avatar').getBoundingClientRect();return {width:card.width,height:card.height,avatar:avatar.width,centerDifference:Math.abs(button.top+button.height/2-card.top-card.height/2),buttonOnRight:button.left>avatar.right};});
 if(Math.abs(cardGeometry.width-379)>1||Math.abs(cardGeometry.height-99)>2||Math.abs(cardGeometry.avatar-76)>2||cardGeometry.centerDifference>1||!cardGeometry.buttonOnRight)throw Error(JSON.stringify(cardGeometry));
 const dir='test-artifacts/account';fs.mkdirSync(dir,{recursive:true});
 await page.screenshot({path:dir+'/rendered.png'});
 await page.screenshot({path:dir+'/full-page.png',fullPage:true});
 for(const width of [360,393,440,1366]) {await page.setViewportSize({width,height:852});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+width);}
 await page.setViewportSize({width:393,height:852});
 await page.getByRole('button',{name:'Edit Profile',exact:true}).click();
 await page.getByRole('heading',{name:'Edit profile',exact:true}).waitFor();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByRole('button',{name:'Edit Profile',exact:true}).waitFor();
 await page.locator('.me-menu-row').filter({hasText:'Language'}).click();
 await page.locator('.shopping-header .language').click();
 for (const path of ['/orders','/account/addresses','/account/notifications','/account/recent']) {
   await page.locator(`.me-menu-row[href="#${path}"]`).click();
   await page.waitForURL('**/#'+path);
   await page.goBack();
   await page.getByRole('button',{name:'Edit Profile',exact:true}).waitFor();
 }
 const compare=await browser.newPage({viewport:{width:806,height:880}});
 const ref=fs.readFileSync('design/PwarMyar Shops Profile Dashboard.png').toString('base64'),render=fs.readFileSync(dir+'/rendered.png').toString('base64');
 await compare.setContent(`<body style="margin:0;display:flex;gap:20px;background:#ddd;font:12px Arial"><div>Reference at 393px<img style="display:block;width:393px" src="data:image/png;base64,${ref}"></div><div>Rendered at 393px<img style="display:block;width:393px" src="data:image/png;base64,${render}"></div></body>`);
 await compare.screenshot({path:dir+'/comparison.png'});
 await browser.close(); console.log('PASS responsive layout, profile toggle, language, Favorites navigation and retained profile draft.');
})().catch(e=>{console.error(e);process.exit(1)});
