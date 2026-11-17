const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const output = 'artifacts/shop-chat-keyboard';
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const errors = []; let sends = 0;
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('mkpos.shop.customerToken', 'fixture');
        // iOS shrinks/pans the visual viewport while the layout viewport stays tall.
        const viewport = window.visualViewport;
        let height, top = 0;
        const nativeHeight = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(viewport), 'height').get;
        Object.defineProperty(viewport, 'height', { get: () => height ?? nativeHeight.call(viewport) });
        Object.defineProperty(viewport, 'offsetTop', { get: () => top });
        window.setKeyboardViewport = (nextHeight, nextTop = 0) => {
          height = nextHeight; top = nextTop;
          viewport.dispatchEvent(new Event('resize'));
          viewport.dispatchEvent(new Event('scroll'));
        };
      });
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://fonts.gstatic.com/**', route => route.abort());
      const thread = { uuid: 'one', slug: 'fixture', shop_name: 'Fixture shop', updated_at: '2026-10-18 02:00:00' };
      const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, body: `Message ${index + 1}: conversation history`, sender: index % 2 ? 'customer' : 'owner', created_at: '2026-10-18 02:00:00' }));
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.includes('/api/ecommerce/')) return route.continue();
        let json = { thread, items: [], has_more: false, enabled: false, realtime_enabled: false };
        if (url.pathname.endsWith('/customer/me')) json = { customer: { id: 1, name: 'Buyer' } };
        if (url.pathname.endsWith('/chat')) json = { items: [thread], has_more: false };
        if (url.pathname.endsWith('/chat/one/messages')) {
          if (route.request().method() === 'POST') {
            sends++;
            json = { message: { id: 26, body: JSON.parse(route.request().postData()).body, sender: 'customer', created_at: '2026-10-18 02:01:00' } };
          } else json = { thread, items, has_more: false };
        }
        await route.fulfill({ json });
      });
      await page.goto('http://127.0.0.1:5177/#/chats');
      await page.getByRole('link', { name: /Fixture shop/ }).click();
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      const messages = page.locator('.shop-chat-messages');
      await input.waitFor();
      await page.locator('.shop-chat-message').last().waitFor();
      assert.equal(await input.evaluate(node => getComputedStyle(node).fontSize), '16px');
      assert.equal(await input.evaluate(node => getComputedStyle(node).scrollMarginTop), '0px');
      await input.fill('Unsent draft');
      await page.evaluate(() => setKeyboardViewport(490, 24));
      await page.waitForFunction(() => document.querySelector('main').getBoundingClientRect().height === 490);
      const geometry = await page.evaluate(() => ({ layout: innerHeight, main: document.querySelector('main').getBoundingClientRect().toJSON(), chat: document.querySelector('.customer-chat-page').getBoundingClientRect().toJSON(), composer: document.querySelector('.shop-chat-composer').getBoundingClientRect().toJSON(), scale: visualViewport.scale }));
      assert.equal(geometry.layout, 852);
      assert.equal(geometry.main.top, 24);
      assert.equal(geometry.chat.height, 490);
      assert.equal(geometry.composer.bottom, 514, 'Composer must meet the visual viewport bottom without a gap');
      assert.equal(await page.locator('.customer-chat-page-header').evaluate(node => node.getBoundingClientRect().height), 60);
      assert.equal(geometry.scale, 1);
      assert.equal(await input.inputValue(), 'Unsent draft');
      assert.equal(await input.evaluate(node => node === document.activeElement), true);
      await messages.evaluate(node => { node.scrollTop = node.scrollHeight; });
      await input.fill('Line one\nLine two\nLine three\nLine four');
      await page.waitForFunction(() => { const n = document.querySelector('.shop-chat-messages'); return n.scrollHeight - n.scrollTop - n.clientHeight < 2; });
      await page.screenshot({ path: `${output}/${name}-keyboard.png` });
      await messages.evaluate(node => { node.scrollTop = 0; });
      await page.waitForTimeout(100);
      await input.fill('Line one\nLine two\nLine three\nLine four\nLine five');
      await page.waitForTimeout(100);
      assert.equal(await messages.evaluate(node => node.scrollTop), 0, 'Typing must not drag a reader out of older history');
      await input.fill('Test send');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.locator('.shop-chat-message').getByText('Test send', { exact: true }).waitFor();
      assert.equal(sends, 1);
      await input.fill('Retained draft');
      await input.blur();
      await page.evaluate(() => setKeyboardViewport(undefined));
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-shop-keyboard-open'));
      await page.getByLabel('Conversation actions').click();
      await page.getByRole('link', { name: 'View shop', exact: true }).waitFor();
      await page.getByLabel('Conversation actions').click();
      await page.getByRole('button', { name: 'Back to chats' }).click();
      await page.getByRole('searchbox', { name: 'Search conversations' }).waitFor();
      await page.goForward();
      await input.waitFor();
      assert.equal(await input.inputValue(), 'Retained draft');
      assert.equal(await input.evaluate(node => node === document.activeElement), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      results.push({ engine: name, geometry, singleSend: sends, draftRetained: true, historyRetained: true, errors });
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  console.log('PASS Chromium and WebKit: chat input size, simulated iOS keyboard pan, multiline/history scrolling, send, menu and Back draft retention. Physical iPhone keyboard not available in headless tests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
