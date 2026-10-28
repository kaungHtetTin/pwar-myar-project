// Actual owner clients with intercepted APIs; no provider call or settings update.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
 const browser = await chromium.launch(); await fs.mkdir('artifacts/sales-ai-help', { recursive: true });
 try { for (const mobile of [false, true]) {
  const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1440, height: 900 }, serviceWorkers: 'block' });
  const errors = [], reads = []; let conversation;
  const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Demo shop', timezone: 'Asia/Rangoon', currency: 'MMK' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'], subscription: { is_valid: true, can_mutate: true } };
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.language', 'en'); });
  await page.route('**/api/**', async route => {
   const req = route.request(), url = new URL(req.url()); if (!url.pathname.startsWith('/api/')) return route.continue();
   const path = url.pathname.slice(4), method = req.method();
   if (method === 'GET') reads.push(path);
   let json = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false };
   if (path === '/auth/me') json = session;
   else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en' };
   else if (path === '/shop-admin/owner-location') json = { submitted: true };
   else if (path === '/ai-assistant/config') json = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
   else if (path === '/ai-assistant/conversations') {
    if (method === 'POST') { conversation = { id: req.postDataJSON().id, title: 'Sales AI help', messages: [] }; json = { conversation: { id: conversation.id } }; }
    else json = { items: conversation ? [conversation] : [], has_more: false };
   } else if (/\/messages$/.test(path)) {
    if (method === 'POST') conversation.messages = [{ id: 1, role: 'user', body: req.postDataJSON().body, status: 'completed', created_at: new Date().toISOString() }, { id: 2, role: 'assistant', body: 'Sales AI helps customers in shop chat. Configure its name, tools and policies in My Shop. Customers confirm order forms; the shop verifies payments.\n\n[Open Sales AI Configuration](#mkpos-screen=sales_ai)', status: 'completed', created_at: new Date().toISOString() }];
    json = { items: conversation?.messages || [], has_more: false, actions: { items: [], has_more: false } };
   } else if (path === '/shop-admin/sales-ai') json = { settings: { enabled: false, name: 'Sales assistant', instructions: 'Help customers', soul: 'Friendly', tool_permissions: [], sales_policies: {}, version: 1 }, tools: [], wallet: { available: '500', reserved: '0' }, pricing: { usd_to_mmk_rate: '4000', markup_percent: '5' } };
   await route.fulfill({ json });
  });
  await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5174/?page=assistant');
  const editor = page.getByRole('textbox', { name: 'AI message', exact: true }); await editor.fill('How do I use Sale AI?');
  await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
  const link = page.getByRole('button', { name: 'Open Sales AI Configuration', exact: true }); await link.waitFor();
  await editor.fill('Keep my next question'); const before = reads.filter(p => p.endsWith('/messages')).length;
  await link.click();
  if (mobile) await page.waitForURL('**/shop/sales-ai/configure');
  else await page.waitForURL('**/*shopTab=sales-ai*');
  await page.getByLabel('Representative name', { exact: true }).waitFor();
  await page.screenshot({ path: `artifacts/sales-ai-help/${mobile ? 'mobile' : 'desktop'}-configuration.png` });
  await page.goBack(); await editor.waitFor();
  assert.equal(await editor.inputValue(), 'Keep my next question');
  assert.equal(reads.filter(p => p.endsWith('/messages')).length, before);
  assert.deepEqual(errors, []); console.log(`${mobile ? 'Mobile' : 'Desktop'}: Sales AI button opens actual configuration; Back preserves assistant draft/history`); await page.close();
 } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
