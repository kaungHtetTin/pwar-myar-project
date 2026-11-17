const { chromium } = require('../shop/node_modules/playwright');
const { createHmac } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const { createChatServer } = await import('../realtime-server/server.js');
  const secret = 'order-alert-browser-test-secret-more-than-32-characters';
  const service = createChatServer({ secret, origins: ['http://127.0.0.1:5174', 'http://127.0.0.1:5176'] });
  service.http.listen(0, '127.0.0.1'); await once(service.http, 'listening');
  const port = service.http.address().port;
  const browser = await chromium.launch();
  const output = path.resolve('artifacts/order-notifications'); await fs.mkdir(output, { recursive: true });
  try {
    for (const mobile of [true, false]) {
      const name = mobile ? 'mobile' : 'web', origin = `http://127.0.0.1:${mobile ? 5176 : 5174}`;
      const context = await browser.newContext({ viewport: { width: mobile ? 375 : 1366, height: mobile ? 812 : 900 }, serviceWorkers: 'block' });
      const permissions = ['sell', 'products', 'shop', 'ecommerce_orders', 'ecommerce_process'];
      const session = { user: { id: 1, name: 'Demo Owner', role: 'owner' }, business: { id: 1, name: 'Demo shop', timezone: 'Asia/Rangoon' }, permissions, subscription: { is_valid: true } };
      const orders = [], calls = [], errors = [];
      const fixture = id => ({ id, reference: `O-SOCKET-${id}`, customer_name: 'Demo buyer', status: 'pending', fulfillment: 'pickup', payment_status: 'unpaid', total: 32000, currency: 'Ks', payment_method: { name: 'Cash', provider: 'manual' }, items: [], payments: [], events: [], customer_requests: [] });
      await context.addInitScript(() => localStorage.setItem('mkpos.activeModule', 'products'));
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname.slice(4); calls.push(endpoint);
        let data = { items: [], total: 0 };
        if (endpoint === '/auth/me') data = session;
        else if (endpoint === '/app-config') data = { enabled_modules: ['sell', 'products', 'shop'], permissions, language: 'en', business: {} };
        else if (endpoint === '/settings') data = { price_types: 'Retail', currency: 'Ks' };
        else if (endpoint === '/categories' || endpoint === '/price-types') data = [];
        else if (endpoint === '/shop-admin/order-notifications/config') data = { realtime_enabled: true, scheme: 'http', host: '127.0.0.1', port, channel: 'private-shop.orders.business.1' };
        else if (endpoint === '/shop-admin/order-notifications/auth') {
          const payload = Buffer.from(JSON.stringify({ channel: 'private-shop.orders.business.1', role: 'owner', business_id: 1, exp: Math.floor(Date.now()/1000)+300 })).toString('base64url');
          data = { token: payload + '.' + createHmac('sha256', secret).update(payload).digest('hex') };
        }
        else if (endpoint === '/shop-admin/order-notifications') {
          const after = url.searchParams.get('after_id');
          data = { cursor: orders.at(-1)?.id || 0, items: after === null ? [] : orders.filter(o => o.id > Number(after)), has_more: false };
        }
        else if (/\/orders\/\d+$/.test(endpoint)) data = fixture(Number(endpoint.split('/').at(-1)));
        else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
        else if (endpoint.endsWith('/chat/config')) data = { enabled: false, realtime_enabled: false };
        else if (endpoint.endsWith('/chat/notifications')) data = { enabled: false, cursor: 0, items: [], unread_count: 0 };
        await route.fulfill({ status: 200, json: data });
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + (mobile ? '/products' : '/'));
      const search = page.locator('main:visible input').first();
      await search.waitFor({ timeout: 10000 }).catch(async error => { console.log({ name, calls, errors, body: await page.locator('body').innerText() }); await page.screenshot({ path: path.join(output, `${name}-failure.png`) }); throw error; }); await search.fill('rice');
      await page.waitForFunction(() => document.querySelector('main input')?.value === 'rice');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const connected = [...service.io.sockets.sockets.values()].some(s => s.data.channel === 'private-shop.orders.business.1'); assert.ok(connected, name + ' connected to real socket');
      orders.push(fixture(1));
      service.io.to('private-shop.orders.business.1').emit('order.submitted', { order_id: 1 });
      const notice = page.locator('.order-app-alert'); await notice.waitFor({ timeout: 5000 });
      assert.match(await notice.innerText(), /O-SOCKET-1/);
      assert.equal(await search.evaluate(e => e === document.activeElement), true, 'Alert preserves typing focus');
      for (const width of mobile ? [320, 375, 768] : [1366]) {
        await page.setViewportSize({ width, height: mobile ? 812 : 900 });
        const rect = await notice.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width, 'No horizontal clipping');
        if (mobile) {
          const top = await notice.evaluate(element => parseFloat(getComputedStyle(element).top));
          assert.ok(top >= 12 && top < 30, 'Order alert uses the message alert top placement');
          const dismissHeight = await notice.getByRole('button', { name: 'Dismiss order notification' }).evaluate(element => element.offsetHeight);
          assert.ok(dismissHeight >= 44, `Dismiss target is ${dismissHeight}px`);
          assert.ok((await notice.getByRole('button', { name: 'Open order' }).boundingBox()).height >= 44);
        }
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: 'disabled' });
      }
      await notice.getByRole('button', { name: 'Dismiss order notification' }).click(); await notice.waitFor({ state: 'hidden' });
      service.io.to('private-shop.orders.business.1').emit('order.submitted', { order_id: 1 });
      await new Promise(resolve => setTimeout(resolve, 250)); assert.equal(await notice.count(), 0, 'Dismissed order not replayed');
      orders.push(fixture(2)); service.io.to('private-shop.orders.business.1').emit('order.submitted', { order_id: 2 });
      await notice.waitFor();
      const source = page.url(), before = calls.filter(p => p === '/products').length;
      await notice.getByRole('button', { name: 'Open order' }).focus(); await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: /O-SOCKET-2/ }).waitFor();
      assert.ok(mobile ? page.url().includes('/shop/orders/2') : page.url().includes('shopOrder=2'));
      await page.goBack(); await search.waitFor();
      assert.equal(page.url(), source); assert.equal(await search.inputValue(), 'rice');
      assert.equal(calls.filter(p => p === '/products').length, before, 'Back preserves source without refetch');
      await page.goForward(); await page.getByRole('heading', { name: /O-SOCKET-2/ }).waitFor();
      const back = page.getByRole('button', { name: mobile ? 'Back' : 'Back to Products', exact: true }).first();
      await back.click(); await search.waitFor(); assert.equal(await search.inputValue(), 'rice');
      assert.equal(calls.filter(p => p === '/products').length, before, 'App-bar Back preserves source without refetch');
      assert.deepEqual(errors, []);
      console.log(`${name}: real socket arrival, layout, focus, dismiss, keyboard Open order, app-bar Back and browser Back/Forward passed`);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => service.io.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
