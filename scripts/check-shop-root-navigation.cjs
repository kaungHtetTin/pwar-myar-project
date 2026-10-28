const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async()=>{
  const browser=await chromium.launch();
  await fs.mkdir('artifacts/shop-root-navigation',{recursive:true});
  try {
    for(const width of [375,1366]) {
      const context=await browser.newContext({viewport:{width,height:812},serviceWorkers:'block'});
      const calls=[];
      await context.route('**/api/ecommerce/**',route=>{
        calls.push(new URL(route.request().url()).pathname);
        return route.fulfill({status:200,json:{items:[],has_more:false,enabled:false,unread_count:0}});
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:5177/#/marketplace');
      const search=page.getByPlaceholder('Search products or categories');await search.waitFor();await search.fill('Retained search');
      await page.evaluate(()=>window.scrollTo(0,150));
      const source=await search.elementHandle();
      const nav=page.locator(width<800?'.mobile-navigation':'.desktop-navigation');
      await nav.getByRole('link',{name:'Cart',exact:true}).click();await page.waitForURL('**/#/cart');
      await nav.getByRole('link',{name:'Me',exact:true}).click();await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      await page.getByLabel('Email',{exact:true}).fill('draft@example.test');
      await page.getByRole('link',{name:'Forgot password?',exact:true}).click();
      await page.getByRole('heading',{name:'Forgot password?',exact:true}).waitFor();
      await page.goBack();await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'draft@example.test');
      await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL('**/#/cart');
      const before=calls.length;
      await page.goBack();await search.waitFor();
      assert.equal(await search.inputValue(),'Retained search');
      assert.equal(await search.evaluate((element,old)=>element===old,source),true);
      assert.equal(calls.length,before,'Returning Home does not refetch its data');
      for(let count=0;count<3;count++) {
        await page.evaluate(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Back did not traverse the root boundary')),1500);window.addEventListener('popstate',()=>{clearTimeout(timer);resolve('pop');},{once:true});history.back();}));
        assert.equal(new URL(page.url()).hash,'#/marketplace');
      }
      await nav.getByRole('link',{name:'Cart',exact:true}).click();await page.waitForURL('**/#/cart');
      await nav.getByRole('link',{name:'Home',exact:true}).click();await search.waitFor();
      assert.equal(await page.evaluate(()=>history.state.mkposShopNavigation.index),0);
      await page.evaluate(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Back did not traverse the root boundary')),1500);window.addEventListener('popstate',()=>{clearTimeout(timer);resolve('pop');},{once:true});history.back();}));
      assert.equal(new URL(page.url()).hash,'#/marketplace');
      await page.screenshot({path:`artifacts/shop-root-navigation/home-${width}.png`});
      await page.goto('http://127.0.0.1:5177/#/account/login?next=%2Fchats');
      await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      await page.reload();await page.getByRole('heading',{name:'Welcome back',exact:true}).waitFor();
      await page.getByRole('button',{name:'Back',exact:true}).click();await search.waitFor();
      assert.equal(new URL(page.url()).hash,'#/marketplace');
      assert.deepEqual(errors,[]);
      console.log(`${width}px: nested browser/app-bar Back, retained drafts/Home DOM, no return refetch, repeated root Back, explicit Home reset and deep-link reload passed.`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
