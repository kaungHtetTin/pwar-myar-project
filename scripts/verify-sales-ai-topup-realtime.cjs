// Isolated verification: all API/payment requests are intercepted. A private test socket server uses a temporary fixture key.
const { chromium } = require('../shop/node_modules/playwright');
const { createHmac, randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

const output = 'artifacts/sales-ai-topup-realtime';
const secret = randomBytes(32).toString('hex');
const account = { id: 1, bank: 'KPay', account_name: 'Fixture platform', account_no: '09123456789' };
const settings = { enabled: true, name: 'Mia', instructions: 'Help customers.', soul: 'Friendly and concise.', tool_permissions: [], sales_policies: {}, version: 1 };
const session = { user: { id: 1, name: 'Fixture owner', email: 'owner@example.test', role: 'owner' }, business: { id: 10, name: 'Fixture shop', currency: 'MMK', timezone: 'Asia/Yangon' }, subscription: { is_valid: true }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'] };
const proof = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64');
const sign = value => createHmac('sha256', secret).update(value).digest('hex');
let balance = 500, nextEvent = 0;
const rows = [], officeEvents = [], ownerEvents = [], calls = [], errors = [];
const pages = [];
const wallet = () => ({ balance: String(balance), available: String(balance), reserved: '0', currency: 'MMK' });
const amount = row => `${Number(row.amount).toLocaleString('en-US')} MMK`;

(async () => {
  await fs.mkdir(output, { recursive: true });
  const { createChatServer } = await import(pathToFileURL(path.resolve('realtime-server/server.js')));
  const socketServer = createChatServer({ secret, origins: [5174, 5175, 5176].map(port => `http://127.0.0.1:${port}`) });
  await new Promise(resolve => socketServer.http.listen(0, '127.0.0.1', resolve));
  const socketPort = socketServer.http.address().port;
  const browser = await chromium.launch();
  const publish = async (audience, event) => {
    const item = { id: ++nextEvent, ...event };
    (audience === 'office' ? officeEvents : ownerEvents).push(item);
    const body = JSON.stringify({ channels: [audience === 'office' ? 'private-office.activity' : 'private-shop.activity.business.10'], event: 'activity.changed', data: { event_id: item.id } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`http://127.0.0.1:${socketPort}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Chat-Timestamp': timestamp, 'X-Chat-Signature': sign(`${timestamp}.${body}`) }, body });
    assert.equal(response.status, 200);
  };
  async function prepare(app) {
    const page = await browser.newPage({ viewport: { width: app === 'mobile' ? 393 : 1440, height: 900 }, serviceWorkers: 'block' });
    pages.push({ app, page });
    page.on('pageerror', error => errors.push(`${app}: ${error.message}`));
    await page.addInitScript(() => { localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.activeModule', 'shop'); });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@fs/')) return route.continue();
      const endpoint = url.pathname.slice(url.pathname.indexOf('/api/') + 4);
      calls.push({ app, endpoint, method: request.method() });
      if (endpoint.endsWith('/screenshot')) return route.fulfill({ contentType: 'image/png', body: proof });
      let json = { items: [], total: 0, cursor: 0, has_more: false, enabled: false, realtime_enabled: false, page: 1, per_page: 25, last_page: 1 };
      if (endpoint === '/auth/me') json = session;
      else if (endpoint === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en' };
      else if (endpoint === '/office/auth/me') json = { admin: { id: 1, name: 'Fixture reviewer', email: 'reviewer@example.test', role: 'super_admin' } };
      else if (endpoint === '/settings') json = { language: 'en', currency: 'MMK', price_types: 'Retail' };
      else if (endpoint === '/shop-admin/owner-location') json = { submitted: true, latitude: 16.84, longitude: 96.17 };
      else if (endpoint.includes('/activity-alerts')) {
        const office = endpoint.startsWith('/office/'), channel = office ? 'private-office.activity' : 'private-shop.activity.business.10';
        if (endpoint.endsWith('/config')) json = { enabled: true, realtime_enabled: true, scheme: 'http', host: '127.0.0.1', port: socketPort, path: '/socket.io', channel };
        else if (endpoint.endsWith('/auth')) {
          const value = Buffer.from(JSON.stringify({ channel, exp: Math.floor(Date.now() / 1000) + 300, role: office ? 'office' : 'owner', ...(office ? { admin_id: 1 } : { business_id: 10 }) })).toString('base64url');
          json = { token: `${value}.${sign(value)}` };
        } else {
          const events = office ? officeEvents : ownerEvents, after = url.searchParams.get('after_id');
          const items = after === null ? [] : events.filter(item => item.id > Number(after));
          json = { items, cursor: events.at(-1)?.id || 0, has_more: false };
          if (!office && items.length) json.sales_ai = { wallet: wallet(), wallet_changed: items.some(item => item.event === 'sales_ai.topup.approved'), requests: rows.filter(row => items.some(item => item.entity_id === row.id)) };
        }
      } else if (endpoint === '/shop-admin/sales-ai') json = { settings, tools: [], wallet: wallet() };
      else if (endpoint === '/shop-admin/sales-ai/topups') {
        if (request.method() === 'POST') {
          const row = { id: rows.length + 3, business_id: 10, business_name: 'Fixture shop', amount: '1000', status: 'pending', transaction_reference: `FIXTURE-${rows.length + 3}`, payment_account: account, version: 1, created_at: '2026-10-26T08:00:00Z' };
          rows.unshift(row);
          await route.fulfill({ json: { request: row } });
          await publish('office', { event: 'sales_ai.topup.requested', title: 'New Sales AI top-up request', message: `Fixture shop · ${amount(row)}`, target: 'sales-ai-topup', entity_id: row.id });
          return;
        }
        json = { items: rows, has_more: false, payment_methods: [account] };
      } else if (endpoint === '/office/sales-ai/topups') {
        const status = url.searchParams.get('status'), items = rows.filter(row => !status || row.status === status);
        json = { items, total: items.length, page: 1, last_page: 1, per_page: 25 };
      } else if (/\/(?:shop-admin\/sales-ai|office\/sales-ai)\/topups\/\d+$/.test(endpoint)) json = { request: rows.find(row => row.id === Number(endpoint.split('/').at(-1))) };
      else if (/^\/office\/sales-ai\/topups\/\d+\/review$/.test(endpoint)) {
        const data = JSON.parse(request.postData()), row = rows.find(row => row.id === Number(endpoint.split('/').at(-2)));
        assert.equal(data.version, row.version);
        row.status = data.decision; row.review_note = data.admin_note; row.version++;
        if (row.status === 'approved') balance += Number(row.amount);
        await route.fulfill({ json: { request: row, wallet: wallet() } });
        await publish('office', { event: `sales_ai.topup.${row.status}`, title: `Sales AI top-up ${row.status}`, target: 'sales-ai-topup', entity_id: row.id, silent: true });
        await publish('owner', { event: `sales_ai.topup.${row.status}`, title: `Sales AI top-up ${row.status}`, message: row.status === 'approved' ? `${amount(row)} added to your Sales AI balance.` : row.review_note, target: 'sales-ai-topup', entity_id: row.id });
        return;
      }
      await route.fulfill({ json });
    });
    await page.goto(`http://127.0.0.1:${app === 'desktop' ? 5174 : app === 'mobile' ? 5176 : 5175}/${app === 'desktop' ? '?shopTab=sales-ai-topups' : app === 'mobile' ? 'shop/sales-ai' : '#/ai/sales-topups'}`);
    return page;
  }
  try {
    const office = await prepare('office'), desktop = await prepare('desktop'), mobile = await prepare('mobile');
    await desktop.getByRole('button', { name: 'Top up', exact: true }).waitFor();
    await mobile.getByText('500 MMK', { exact: true }).waitFor();
    await office.getByText('No records match these filters.', { exact: true }).waitFor();
    const connected = async () => {
      const started = Date.now();
      while ([...socketServer.io.sockets.sockets.values()].filter(socket => socket.data.channel?.includes('.activity')).length < 3) {
        if (Date.now() - started > 15000) throw new Error('Three activity sockets did not connect');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    await connected();
    async function submit() {
      await desktop.getByRole('button', { name: 'Top up', exact: true }).click();
      const dialog = desktop.getByRole('dialog', { name: 'Top up Sales AI' });
      await dialog.getByLabel('Amount (MMK)').fill('1000');
      await dialog.getByLabel('Payment proof', { exact: true }).setInputFiles({ name: 'fixture-proof.png', mimeType: 'image/png', buffer: proof });
      await dialog.getByRole('button', { name: 'Submit top-up' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await office.getByRole('status').filter({ hasText: 'New Sales AI top-up request' }).waitFor();
    }
    await submit();
    await office.screenshot({ path: `${output}/office-new-request.png` });
    await office.getByRole('button', { name: 'Review request', exact: true }).click();
    let review = office.getByRole('dialog', { name: 'Sales AI top-up #3' });
    await review.getByAltText('Top-up payment proof').waitFor();
    await review.getByRole('button', { name: 'Confirm review' }).click();
    await review.waitFor({ state: 'hidden' });
    await desktop.getByRole('status').filter({ hasText: 'Sales AI top-up approved' }).waitFor();
    await mobile.getByRole('status').filter({ hasText: 'Sales AI top-up approved' }).waitFor();
    await mobile.getByText('1,500 MMK', { exact: true }).waitFor();
    await desktop.screenshot({ path: `${output}/desktop-approved.png` });
    await mobile.screenshot({ path: `${output}/mobile-approved.png` });
    await mobile.getByRole('button', { name: 'View top-up' }).click();
    await mobile.getByText('Approved', { exact: true }).waitFor();
    assert.ok((await mobile.url()).endsWith('/shop/sales-ai/topups/3'));
    const mobileSourceReads = calls.filter(call => call.app === 'mobile' && call.endpoint === '/shop-admin/sales-ai').length;
    await mobile.getByRole('button', { name: 'Back', exact: true }).click();
    await mobile.waitForURL('**/shop/sales-ai');
    await mobile.getByText('1,500 MMK', { exact: true }).waitFor();
    assert.equal(calls.filter(call => call.app === 'mobile' && call.endpoint === '/shop-admin/sales-ai').length, mobileSourceReads);
    await desktop.getByRole('button', { name: 'Dismiss activity notification' }).click();
    await submit();
    await office.getByRole('button', { name: 'Review request', exact: true }).click();
    review = office.getByRole('dialog', { name: 'Sales AI top-up #4' });
    await review.getByAltText('Top-up payment proof').waitFor();
    await review.getByLabel('Decision').selectOption('rejected');
    await review.getByLabel('Rejection reason').fill('The transfer has not arrived.');
    await review.getByRole('button', { name: 'Confirm review' }).click();
    await review.waitFor({ state: 'hidden' });
    await desktop.getByRole('status').filter({ hasText: 'Sales AI top-up rejected' }).waitFor();
    await mobile.getByRole('status').filter({ hasText: 'The transfer has not arrived.' }).waitFor();
    await desktop.getByRole('button', { name: 'View top-up' }).click();
    const details = desktop.getByRole('dialog', { name: 'Top-up #4' });
    await details.getByText(/The transfer has not arrived/).waitFor();
    const table = await desktop.getByRole('table', { name: 'Sales AI top-up requests' }).elementHandle();
    const reads = calls.filter(call => call.app === 'desktop' && call.endpoint === '/shop-admin/sales-ai/topups').length;
    await desktop.screenshot({ path: `${output}/desktop-rejected-detail.png` });
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    assert.ok(await table.evaluate(element => element.isConnected));
    assert.equal(calls.filter(call => call.app === 'desktop' && call.endpoint === '/shop-admin/sales-ai/topups').length, reads);
    assert.equal(calls.filter(call => call.method === 'POST' && call.endpoint.endsWith('/review')).length, 2);
    assert.equal(balance, 1500);
    assert.deepEqual(errors, []);
    await fs.writeFile(`${output}/result.json`, JSON.stringify({ result: 'passed', real_fixture_socket_server: true, intercepted_payments: true, office_notifications: 2, owner_decisions: ['approved', 'rejected'], exact_request_navigation: true, detail_close_preserved_table: true, calls }, null, 2));
    console.log('PASS: Office request alerts, owner approval/rejection alerts, live balances, exact request navigation and retained source table (real isolated sockets, intercepted APIs).');
  } catch (error) {
    for (const { app, page } of pages) {
      await page.screenshot({ path: `${output}/${app}-failure.png` }).catch(() => {});
      await fs.writeFile(`${output}/${app}-failure.txt`, await page.locator('body').innerText().catch(() => 'Unavailable'));
    }
    await fs.writeFile(`${output}/failure.json`, JSON.stringify({ message: error.message, errors, calls }, null, 2));
    throw error;
  } finally {
    await browser.close();
    await new Promise(resolve => socketServer.io.close(resolve));
    if (socketServer.http.listening) await new Promise(resolve => socketServer.http.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
