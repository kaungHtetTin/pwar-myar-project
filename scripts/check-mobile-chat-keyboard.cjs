// Local fixtures only. Simulate iOS visual viewport resize without shrinking layout viewport.
const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const output = 'artifacts/mobile-chat-keyboard';
  await fs.mkdir(output, { recursive: true });
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const uuid = '12345678-1234-1234-1234-123456789abc';
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('mkpos.language', 'en');
        localStorage.setItem('mkpos.activeModule', 'shop');
        const viewport = visualViewport;
        let height = 852, top = 0;
        Object.defineProperty(viewport, 'height', { get: () => height });
        Object.defineProperty(viewport, 'offsetTop', { get: () => top });
        window.setKeyboardViewport = (nextHeight, nextTop = 0) => {
          height = nextHeight; top = nextTop;
          viewport.dispatchEvent(new Event('resize'));
          viewport.dispatchEvent(new Event('scroll'));
        };
      });
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (!pathname.startsWith('/api/')) return route.continue();
        const path = pathname.slice(4);
        let json = { items: [], total: 0, has_more: false, realtime_enabled: false, enabled: false };
        if (path === '/auth/me') json = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 10, name: 'Demo shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process'], subscription: { is_valid: true } };
        else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop', 'ecommerce_orders', 'ecommerce_process'], language: 'en' };
        else if (path === '/shop-admin/owner-location') json = { submitted: true };
        else if (path === '/shop-admin/chat/config') json = { enabled: true, realtime_enabled: false };
        else if (path === '/ai-assistant/config') json = { enabled: true, configured: true, storage_ready: true };
        else if (path === '/shop-admin/chat') json = { items: [{ uuid, customer_name: 'Fixture customer', last_message: { id: 1, body: 'Hello' } }], total: 1, has_more: false };
        else if (path.includes(uuid)) json = { thread: { uuid, customer_name: 'Fixture customer' }, items: [{ id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-27T00:18:00Z' }], has_more: false };
        await route.fulfill({ json });
      });
      await page.goto('http://127.0.0.1:5176/shop/chat');
      await page.getByRole('button', { name: /Fixture customer/ }).click();
      const input = page.getByLabel('Message', { exact: true });
      await input.fill('Keep my draft');
      assert.equal(await input.evaluate(node => getComputedStyle(node).fontSize), '16px');
      await page.evaluate(() => setKeyboardViewport(490, 24));
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-mobile-keyboard-open'));
      await page.waitForFunction(() => Math.abs(document.querySelector('.shop-mobile-composer').getBoundingClientRect().bottom - 514) < 1);
      assert.equal(await page.locator('.sale-bottom-navigation').isVisible(), false);
      assert.equal(await input.evaluate(node => node === document.activeElement), true);
      await page.screenshot({ path: `${output}/${name}-keyboard.png` });
      await page.evaluate(() => setKeyboardViewport(420, 12));
      await page.waitForFunction(() => Math.abs(document.querySelector('.shop-mobile-composer').getBoundingClientRect().bottom - 432) < 1);
      await input.blur();
      await page.evaluate(() => setKeyboardViewport(852));
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mobile-keyboard-open'));
      assert.equal(await input.inputValue(), 'Keep my draft');
      assert.equal(await page.locator('.sale-bottom-navigation').isVisible(), true);
      await page.goto('http://127.0.0.1:5176/assistant');
      const assistantInput = page.locator('.shop-mobile-composer textarea');
      await assistantInput.fill('Assistant draft');
      await page.evaluate(() => setKeyboardViewport(490, 24));
      await page.waitForFunction(() => Math.abs(document.querySelector('.shop-mobile-composer').getBoundingClientRect().bottom - 514) < 1);
      assert.equal(await page.locator('.sale-bottom-navigation').isVisible(), false);
      await page.screenshot({ path: `${output}/${name}-assistant-keyboard.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: shop chat and assistant composers meet viewport bottom, track pan, retain focus/draft, restore navigation.`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
