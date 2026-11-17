// Intercepted fixtures only: no live chat messages or AI handovers.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const artifactPath = require('node:path').resolve(__dirname, '../artifacts/mobile-chat-header');
(async () => {
 const browser = await chromium.launch();
 await fs.mkdir(artifactPath, { recursive: true });
 try { for (const width of [320, 393, 768]) {
  const page = await browser.newPage({ viewport: { width, height: 852 }, serviceWorkers: 'block' });
  const uuid = '12345678-1234-1234-1234-123456789abc', errors = [], writes = [], reads = [];
  let mode = 'ai', version = 1, fail = true;
  const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 10, name: 'Demo shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process'], subscription: { is_valid: true } };
  const thread = () => ({ uuid, customer_name: 'Min Min / မင်းမင်း အမည်ရှည်', customer_key: 'account:1', customer_last_seen_at: '2026-10-26T00:18:00Z', sales_ai: { enabled: true, name: 'Kaung Kaung', mode, version }, last_message: { id: 1, body: 'Hello', created_at: '2026-10-26T00:18:00Z' } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.activeModule', 'shop'); });
  await page.route('**/api/**', async route => {
   const req = route.request(), url = new URL(req.url());
   if (!url.pathname.startsWith('/api/')) return route.continue();
   const path = url.pathname.slice(4);
   if (req.method() === 'GET') reads.push(path);
   let json = { items: [], total: 0, has_more: false, realtime_enabled: false, enabled: false };
   if (path === '/auth/me') json = session;
   else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en' };
   else if (path === '/shop-admin/owner-location') json = { submitted: true };
   else if (path === '/shop-admin/chat/config') json = { enabled: true, realtime_enabled: false };
   else if (path === '/shop-admin/chat') json = { items: [thread()], total: 1, has_more: false };
   else if (path.endsWith('/handoff')) {
    writes.push(req.postDataJSON());
    if (fail) { fail = false; return route.fulfill({ status: 503, json: { message: 'Handover failed. Try again.' } }); }
    assert.equal(req.postDataJSON().version, version); mode = req.postDataJSON().mode; version++; json = { thread: thread() };
   } else if (path.includes(uuid)) json = { thread: thread(), items: [{ id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-26T00:18:00Z' }], has_more: false };
   await route.fulfill({ json });
  });
  await page.goto('http://127.0.0.1:5176/shop/chat');
  try { await page.getByRole('button', { name: /Min Min/ }).click({ timeout: 10000 }); } catch(e) { console.log({ url: page.url(), reads, errors, headings: await page.getByRole('heading').allTextContents() }); await page.screenshot({ path: `${artifactPath}/setup-error.png` }); throw e; }
  const toggle = page.getByRole('switch', { name: 'AI replies', exact: true }); await toggle.waitFor();
  assert.equal(await page.locator('.shared-app-bar').count(), 1);
  assert.equal(await page.locator('.shop-chat-conversation-header').count(), 1);
  assert.equal(await page.locator('.sales-ai-mobile-chat-status').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Shop chat/ }).count(), 0);
  assert.equal(await page.locator('.shop-chat-conversation-header').getByRole('switch').count(), 1);
  await page.getByLabel('Message', { exact: true }).fill('Keep my conversation draft');
  await toggle.click(); await page.getByText('Handover failed. Try again.', { exact: true }).waitFor(); assert.ok(await toggle.isChecked());
  await toggle.press('Space'); await page.waitForFunction(() => !document.querySelector('[role=switch]').checked);
  await page.screenshot({ path: `${artifactPath}/human-${width}.png` });
  await toggle.click(); await page.waitForFunction(() => document.querySelector('[role=switch]').checked);
  assert.equal(writes.length, 3); assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my conversation draft');
  assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
  const box = await toggle.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
  await page.screenshot({ path: `${artifactPath}/ai-${width}.png` });
  await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const count = reads.filter(p => p.endsWith('/messages')).length;
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.waitForURL('**/shop/chat');
  await page.goForward(); await page.waitForURL(`**/shop/chat/${uuid}`);
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my conversation draft');
  assert.equal(reads.filter(p => p.endsWith('/messages')).length, count);
  assert.deepEqual(errors, []); console.log(`${width}px: one header, no shortcuts/status bar, switch/retry, menu and Back/Forward draft retention passed`); await page.close();
 } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
