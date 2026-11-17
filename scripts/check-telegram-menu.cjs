const {chromium} = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [393, 1440]) {
      const context = await browser.newContext({viewport:{width,height:852}});
      const thread = {uuid:'linked',slug:'demo',shop_name:'KaungGyi Store',timezone:'Asia/Yangon',sales_ai:{enabled:true,mode:'ai',name:'Sales AI',telegram_bot:'fixture_bot'}};
      let posts = 0, messageReads = 0;
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        let data = {};
        if (url.pathname.endsWith('/telegram-link')) {
          posts++;
          await new Promise(resolve => setTimeout(resolve, 150));
          data = {url:`https://t.me/fixture_bot?start=link_${'a'.repeat(40)}`};
        } else if (url.pathname.endsWith('/customer/me')) data = {customer:{id:7,name:'Buyer'}};
        else if (url.pathname.endsWith('/messages')) { messageReads++; data = {thread,items:[{id:1,sender:'customer',body:'Hello, I would like to order.',created_at:'2026-10-28 06:00:00'}, {id:2,sender:'owner',body:'Welcome! How can we help?',created_at:'2026-10-28 06:01:00'}],has_more:false}; }
        else if (url.pathname.endsWith('/chat/linked')) data = {thread};
        else if (url.pathname.endsWith('/config')) data = {enabled:true,realtime_enabled:false};
        else if (url.pathname.endsWith('/stores/demo')) data = {name:'KaungGyi Store',slug:'demo'};
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await context.route('https://fonts.googleapis.com/**', route => route.abort());
      await context.route('https://t.me/**', route => route.fulfill({status:200,body:'Isolated Telegram link fixture'}));
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5189/test-artifacts/telegram-menu/index.html');
      await page.getByText('Welcome! How can we help?', {exact:true}).waitFor();
      await page.getByLabel('Message', {exact:true}).fill('Keep this draft');
      assert.equal(await page.getByRole('button', {name:'Link my Telegram account',exact:true}).isVisible(), false);
      await page.screenshot({path:path.join(__dirname,`../shop/test-artifacts/telegram-menu/closed-${width}.png`)});
      await page.getByLabel('Conversation actions', {exact:true}).click();
      const action = page.getByRole('button', {name:'Link my Telegram account',exact:true});
      assert.equal(await action.isVisible(), true);
      assert.equal(await action.locator('xpath=ancestor::header').count(), 1);
      await action.click();
      const link = page.getByRole('link', {name:'Open Telegram to link · expires in 10 minutes',exact:true});
      await link.waitFor();
      assert.equal(posts, 1);
      assert.equal(messageReads, 1);
      assert.equal(await page.getByLabel('Message', {exact:true}).inputValue(), 'Keep this draft');
      await page.screenshot({path:path.join(__dirname,`../shop/test-artifacts/telegram-menu/menu-${width}.png`)});
      await page.keyboard.press('Escape');
      assert.equal(await link.isVisible(), false);
      await page.getByLabel('Conversation actions', {exact:true}).click();
      const popupEvent = page.waitForEvent('popup');
      await link.click(); const popup = await popupEvent; await popup.waitForLoadState();
      assert.equal(popup.url(), `https://t.me/fixture_bot?start=link_${'a'.repeat(40)}`);
      await popup.close();
      assert.equal(await link.isVisible(), false);
      assert.equal(await page.getByLabel('Message', {exact:true}).inputValue(), 'Keep this draft');
      await context.close();
      console.log(`PASS ${width}px: app-bar menu, single link request, Escape, safe popup, draft and history retention`);
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
