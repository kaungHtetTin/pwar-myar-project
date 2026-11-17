const {chromium} = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [timezoneId, width] of [['America/Los_Angeles',440], ['Asia/Tokyo',1440]]) {
      const context = await browser.newContext({timezoneId, viewport:{width,height:900}});
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5189/test-artifacts/chat-times/index.html');
      await page.getByText('Owner reply', {exact:true}).waitFor();
      const times = page.locator('article time');
      assert.equal(await times.count(), 3);
      assert.match(await times.nth(0).innerText(), /(?:12|00):15/);
      assert.match(await times.nth(1).innerText(), /(?:12|00):16/);
      assert.match(await times.nth(2).innerText(), /(?:12|00):17/);
      assert.equal(await times.nth(0).getAttribute('datetime'), '2026-10-28T17:45:00.000Z');
      assert.deepEqual(errors, []);
      await page.screenshot({path:path.join(__dirname, `../shop/test-artifacts/chat-times/verified-${width}.png`), fullPage:true});
      console.log(`PASS ${timezoneId} ${width}px: ${await times.allTextContents()}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
