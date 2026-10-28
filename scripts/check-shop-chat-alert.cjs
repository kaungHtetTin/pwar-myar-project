const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch(); await fs.mkdir('artifacts/shop-chat-alert', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { if (!localStorage.getItem('mkpos.shop.customerToken')) { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mkpos.shop.customerToken', 'demo-token'); } });
    let feed = { enabled: true, cursor: 0, unread_count: 0, items: [] };
    const uuid = '12345678-1234-1234-1234-123456789abc';
    await context.route('**/api/ecommerce/**', async route => {
      const endpoint = new URL(route.request().url()).pathname.split('/api/ecommerce')[1];
      let data = { items: [], has_more: false, unread_count: 0 };
      if (endpoint === '/customer/me') data = { customer: { id: 1, name: 'Demo buyer', email: 'buyer@example.test' } };
      if (endpoint === '/chat/notifications') data = feed;
      if (endpoint === '/chat/config') data = { enabled: true, realtime_enabled: false };
      if (endpoint === `/chat/${uuid}`) data = { thread: { uuid, shop_name: 'Demo Shop 01' } };
      if (endpoint === `/chat/${uuid}/messages`) data = { items: [], thread: { uuid, shop_name: 'Demo Shop 01' }, has_more: false };
      await route.fulfill({ status: 200, json: data });
    });
    const page = await context.newPage(), errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5177/#/marketplace');
    const search=page.getByPlaceholder('Search products or categories');await search.waitFor();await search.fill('Rice');
    feed={enabled:true,cursor:1,unread_count:1,items:[{id:1,uuid,name:'Demo Shop 01',preview:'Hello! Your order is ready to collect.'}]};
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    const notice=page.locator('.chat-app-alert');await notice.waitFor();
    assert.equal(await search.evaluate(element=>element===document.activeElement),true);
    for (const width of [320,375,768,1366]) {
      await page.setViewportSize({width,height:812});
      const dimensions=await notice.evaluate(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:parseFloat(getComputedStyle(element).top),height:rect.height};});
      assert.ok(dimensions.left>=11 && dimensions.right<=width-11);
      assert.ok(dimensions.top>=12 && dimensions.top<30);
      assert.ok(dimensions.height<160);
      for (const name of ['Open chat','Dismiss chat notification']) assert.ok(await notice.getByRole('button',{name,exact:true}).evaluate(button=>button.offsetHeight>=44));
      await page.screenshot({path:`artifacts/shop-chat-alert/arrival-${width}.png`,animations:'disabled'});
    }
    await notice.getByRole('button',{name:'Dismiss chat notification'}).click();await notice.waitFor({state:'hidden'});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await notice.count(),0);
    const restarted = page.waitForResponse(response=>response.url().includes('/chat/notifications'));
    await page.reload();await restarted;await page.getByPlaceholder('Search products or categories').waitFor();
    assert.equal(await notice.count(),0,'Reload must not repeat an unread message alert');
    await search.fill('Rice');
    feed={...feed,cursor:2,items:[{id:2,uuid,name:'Demo Shop 01',preview:'A second message'}]};
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await notice.waitFor();
    await notice.getByRole('button',{name:'Open chat'}).focus();await page.keyboard.press('Enter');
    await page.waitForURL(`**/#/chats/${uuid}`);await notice.waitFor({state:'hidden'});
    await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),'Rice');
    await page.getByRole('button',{name:'Change language'}).click();
    feed={...feed,cursor:3,items:[{id:3,uuid,name:'Demo Shop 01',preview:'Payment received. Thank you.'}]};
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await notice.waitFor();
    assert.equal(await notice.evaluate(element=>getComputedStyle(element).animationName),'none');
    await page.setViewportSize({width:375,height:812});await page.screenshot({path:'artifacts/shop-chat-alert/myanmar.png',animations:'disabled'});
    await notice.locator('.chat-app-alert-dismiss').click();await notice.waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    console.log('Shop chat alert: owner-style layout at 320/375/768/1366px, focus, dismiss, keyboard open, Back retention, Myanmar and reduced motion passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
