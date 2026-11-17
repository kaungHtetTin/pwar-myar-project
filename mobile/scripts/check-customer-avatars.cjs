const { chromium, webkit } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const output = 'artifacts/customer-avatars';
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process', 'customers'], subscription: { is_valid: true } };
      const avatar = 'http://127.0.0.1:5176/fixture-avatar.svg';
      const customer = { customer_key: 'account:3', customer_name: 'Alice Morgan', account_type: 'account', avatar_url: avatar, phone: '0912345678', email: 'alice@example.test', address: 'Yangon' };
      const thread = { ...customer, uuid: '12345678-1234-1234-1234-123456789abc', customer_active: true, unread: 1, last_message: { body: 'Hello shop', created_at: '2026-10-18T01:00:00Z' } };
      await page.route('**/fixture-avatar.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><path fill="#d6e9f9" d="M0 0h160v200H0z"/><circle cx="80" cy="72" r="35" fill="#c28b65"/><path fill="#24494d" d="M20 200v-35a60 60 0 01120 0v35"/><path fill="#3a2e2c" d="M45 65a35 35 0 0170 0Q80 35 45 65"/></svg>' }));
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (!pathname.startsWith('/api/')) return route.continue();
        const endpoint = pathname.slice(4);
        let json = { items: [], total: 0, enabled: false };
        if (endpoint === '/auth/me') json = session;
        else if (endpoint === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en', business: {} };
        else if (endpoint === '/shop-admin/owner-location') json = { submitted: true };
        else if (endpoint === '/shop-admin/chat/config') json = { enabled: true, realtime_enabled: false };
        else if (endpoint === '/shop-admin/chat') json = { items: [thread], total: 1 };
        else if (endpoint.endsWith('/messages')) json = { thread, items: [], has_more: false };
        else if (endpoint.startsWith('/shop-admin/customers/') && !endpoint.endsWith('/history')) json = { customer, report: { total_orders: 0, currencies: [] } };
        await route.fulfill({ json });
      });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.goto('http://127.0.0.1:5176/shop/chat');
      async function verifyPhoto(selector, name) {
        const image = page.locator(`${selector} img`);
        await image.waitFor();
        await image.evaluate(node => node.decode());
        assert.equal(await image.getAttribute('src'), avatar);
        for (const width of [393, 320, 768]) {
          await page.setViewportSize({ width, height: 852 });
          assert.equal(await image.evaluate(node => getComputedStyle(node).objectFit), 'cover');
          const geometry = await image.evaluate(node => { const a = node.getBoundingClientRect(), b = node.parentElement.getBoundingClientRect(); return { width: a.width, height: a.height, parentWidth: b.width, parentHeight: b.height }; });
          assert.ok(Math.abs(geometry.width - geometry.parentWidth) < 3 && Math.abs(geometry.height - geometry.parentHeight) < 3, JSON.stringify(geometry));
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await page.screenshot({ path: `${output}/${engineName}-${name}-${width}.png` });
        }
        await page.setViewportSize({ width: 393, height: 852 });
      }
      await verifyPhoto('.shop-chat-thread .shop-chat-avatar', 'inbox');
      assert.equal(await page.locator('.shop-chat-avatar > i').count(), 1);
      await page.locator('.shop-chat-thread').click();
      await verifyPhoto('.shop-chat-header-profile .shop-chat-avatar', 'conversation');
      await page.getByLabel('Message', { exact: true }).fill('Retained customer draft');
      await page.getByRole('button', { name: 'View customer', exact: true }).click();
      await verifyPhoto('.shop-customer-avatar', 'profile');
      await page.locator('.shop-customer-avatar img').evaluate(node => node.dispatchEvent(new Event('error')));
      await page.waitForFunction(() => document.querySelector('.shop-customer-avatar')?.textContent === 'AM');
      assert.equal(await page.locator('.shop-customer-avatar').innerText(), 'AM');
      await page.getByRole('button', { name: 'Back to shop', exact: true }).click();
      await page.getByLabel('Message', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Retained customer draft');
      assert.deepEqual(errors, []);
      results.push({ engine: engineName, widths: [320, 393, 768], screens: ['inbox', 'conversation', 'profile'], photoLoaded: true, fallback: true, presencePreserved: true, draftRetained: true });
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  console.log('PASS customer avatars: Chromium/WebKit, three screens, three widths, fallback, presence and draft on return.');
})().catch(error => { console.error(error); process.exitCode = 1; });
