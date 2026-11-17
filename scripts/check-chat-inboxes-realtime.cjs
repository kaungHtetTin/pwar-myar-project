const { chromium, webkit } = require('../shop/node_modules/playwright');
const { createHmac } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
  const { createChatServer } = await import(pathToFileURL(path.resolve('realtime-server/server.js')));
  const secret = 'fixture-only-realtime-secret-at-least-32-characters';
  const origins = [5174, 5176, 5177].map(port => `http://127.0.0.1:${port}`);
  const server = createChatServer({ secret, origins });
  await new Promise(resolve => server.http.listen(0, '127.0.0.1', resolve));
  const port = server.http.address().port;
  const output = 'artifacts/chat-inboxes-realtime';
  await fs.mkdir(output, { recursive: true });
  const results = [];
  const uuid = '12345678-1234-1234-1234-123456789abc';
  const sign = body => createHmac('sha256', secret).update(body).digest('hex');
  const ticket = (channel, customer) => {
    const payload = Buffer.from(JSON.stringify({ channel, exp: Math.floor(Date.now() / 1000) + 300, ...(customer ? { role: 'customer', customer_id: 1 } : { role: 'owner', business_id: 1 }) })).toString('base64url');
    return `${payload}.${sign(payload)}`;
  };
  try {
    for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch();
      try {
        for (const app of ['web', 'mobile', 'customer']) {
          const customer = app === 'customer', web = app === 'web';
          const page = await browser.newPage({ viewport: web ? { width: 1440, height: 950 } : { width: 393, height: 852 }, isMobile: !web, hasTouch: !web, serviceWorkers: 'block' });
          const errors = []; page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.shop.customerToken', 'fixture'); });
          let revision = 0, reads = 0;
          const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process', 'ecommerce_catalog', 'ecommerce_settings'], subscription: { is_valid: true } };
          const config = { enabled: true, realtime_enabled: true, scheme: 'http', host: '127.0.0.1', port, channel: customer ? 'private-shop.chat.customer.1' : 'private-shop.chat.business.1' };
          const ownerThread = () => ({ id: uuid, uuid, customer_key: 'account:1', customer_name: 'Live buyer', unread: revision, updated_at: '2026-10-18 01:00:00', last_message: { id: revision, sender: 'customer', body: `Socket preview ${revision}`, created_at: '2026-10-18 01:00:00' } });
          const customerThread = () => ({ uuid, slug: 'fixture', shop_name: 'Live shop', preview: `Socket preview ${revision}`, unread_count: revision, updated_at: '2026-10-18 01:00:00' });
          await page.route('**/api/**', async route => {
            const pathname = new URL(route.request().url()).pathname;
            if (!pathname.startsWith('/api/')) return route.continue();
            const endpoint = pathname.slice(4);
            let json = { items: [], total: 0, has_more: false, enabled: false };
            if (endpoint === '/auth/me') json = session;
            else if (endpoint === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en', business: session.business };
            else if (endpoint === '/shop-admin/owner-location') json = { submitted: true };
            else if (endpoint === '/ecommerce/customer/me') json = { customer: { id: 1, name: 'Buyer' } };
            else if (endpoint === '/shop-admin/chat/config' || endpoint === '/ecommerce/chat/inbox-config') json = config;
            else if (endpoint === '/shop-admin/chat/auth' || endpoint === '/ecommerce/chat/auth') json = { token: ticket(route.request().postDataJSON().channel_name, customer) };
            else if (endpoint === '/shop-admin/chat' || endpoint === '/ecommerce/chat') {
              reads++;
              json = { items: revision ? [customer ? customerThread() : ownerThread()] : [], total: revision ? 1 : 0, has_more: false, next_cursor: null };
            }
            await route.fulfill({ json });
          });
          await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
          const url = web ? 'http://127.0.0.1:5174/?shopTab=chat' : customer ? 'http://127.0.0.1:5177/#/chats' : 'http://127.0.0.1:5176/shop/chat';
          await page.goto(url);
          const empty = customer ? 'No conversations yet' : web ? 'No conversations found.' : 'No conversations found.';
          await page.getByText(empty, { exact: true }).waitFor();
          const deadline = Date.now() + 5000;
          while (![...server.io.sockets.sockets.values()].some(socket => socket.data.channel === config.channel)) {
            if (Date.now() > deadline) throw Error(`${app}: socket did not join inbox room`);
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          // Let the initial connection reconciliation settle before measuring events.
          await page.waitForTimeout(150);
          for (revision of [1, 2]) {
            const before = reads, start = Date.now();
            const data = JSON.stringify({ channels: ['private-shop.chat.business.1', `private-shop.chat.thread.${uuid}`, 'private-shop.chat.customer.1'], event: 'chat.changed', data: { thread: uuid, message_id: revision } });
            const timestamp = String(Math.floor(Date.now() / 1000));
            const response = await fetch(`http://127.0.0.1:${port}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-Timestamp': timestamp, 'X-Chat-Signature': sign(`${timestamp}.${data}`) }, body: data });
            assert.equal(response.status, 200);
            await page.getByText(`Socket preview ${revision}`, { exact: true }).waitFor({ timeout: 2500 });
            if (customer) await page.getByLabel(`${revision} Unread messages`, { exact: true }).waitFor({ timeout: 1000 });
            else if (web) await page.getByLabel(`${revision} unread messages`, { exact: true }).waitFor({ timeout: 1000 });
            else await page.getByText(`${revision} unread`, { exact: true }).waitFor({ timeout: 1000 });
            assert.ok(reads > before);
            results.push({ app, engine: engineName, revision, elapsedMs: Date.now() - start, source: 'actual signed Socket.IO publish' });
          }
          await page.screenshot({ path: `${output}/${app}-${engineName}.png` });
          assert.deepEqual(errors, []);
          await page.close();
        }
      } finally { await browser.close(); }
    }
    await fs.writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
    console.log('PASS all three inboxes in Chromium and WebKit: signed socket events create a row from empty state and update preview/unread immediately. API responses are intercepted fixtures.');
  } finally { await new Promise(resolve => server.io.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
