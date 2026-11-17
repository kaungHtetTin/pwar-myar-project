const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, serviceWorkers: 'block' });
    const uuid = '12345678-1234-1234-1234-123456789abc';
    let mode = process.argv.includes('--needs-human') ? 'waiting_owner' : 'ai', version = 1, changes = 0, bulkChanges = 0;
    const thread = () => ({ uuid, id: uuid, customer_key: 'account:1', customer_name: 'Min Min', unread: 0, updated_at: '2026-10-25T10:00:00Z', customer_last_seen_at: '2026-10-25T10:00:00Z', sales_ai: { enabled: true, name: 'Sales assistant', mode, version, responding: false }, last_message: { id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-25T10:00:00Z' } });
    const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Demo shop', timezone: 'Asia/Yangon', currency: 'Ks' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process', 'ecommerce_settings'], subscription: { is_valid: true } };
    await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.language', 'en'); });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname.slice(4);
      let json = { items: [], total: 0, has_more: false, next_cursor: null };
      if (path === '/auth/me') json = session;
      else if (path === '/app-config') json = { permissions: session.permissions, enabled_modules: ['shop'], language: 'en' };
      else if (path === '/shop-admin/owner-location') json = { submitted: true };
      else if (path === '/shop-admin/chat/config') json = { enabled: true, realtime_enabled: false, sales_ai_enabled: true };
      else if (path === '/shop-admin/chat') json = { items: [thread()], total: 1, has_more: false, next_cursor: null };
      else if (path.endsWith('/handoff-all')) { mode = 'ai'; version++; bulkChanges++; json = { updated_count: 3, thread: thread() }; }
      else if (path.endsWith('/handoff')) { const data = route.request().postDataJSON(); assert.equal(data.version, version); mode = data.mode; version++; changes++; json = { thread: thread() }; }
      else if (path.endsWith('/messages') && route.request().method() === 'POST') { mode = 'human'; version++; json = { thread: thread(), message: { id: 2, sender: 'owner', body: route.request().postDataJSON().body, created_at: '2026-10-26T01:00:00Z' } }; }
      else if (path.endsWith('/messages')) json = { thread: thread(), items: [{ id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-25T10:00:00Z' }], has_more: false };
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:5174/?shopTab=chat');
    await page.getByRole('button', { name: /Min Min/ }).first().click();
    const toggle = page.getByRole('switch', { name: 'AI replies' });
    await toggle.waitFor();
    if (process.argv.includes('--needs-human')) {
      await page.getByText('Needs human', { exact: true }).waitFor();
      await fs.mkdir('artifacts/owner-chat-handover', { recursive: true });
      await page.screenshot({ path: 'artifacts/owner-chat-handover/needs-human.png' });
      await page.getByLabel('Message', { exact: true }).fill('The owner is here to help.');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByText('The owner is here to help.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Needs human', { exact: true }).count(), 0);
      console.log('PASS human-request badge, retained on reading and cleared after owner reply');
      return;
    }
    assert.equal(await toggle.getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('.shop-chat-customer-heading').getByRole('switch').count(), 1);
    assert.equal(await page.locator('.shop-chat-ai-status').count(), 0);
    await page.getByLabel('Message', { exact: true }).fill('Keep my draft');
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false');
    assert.equal(changes, 1);
    assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my draft');
    assert.equal(await page.locator('#workspace-app-bar-actions').getByRole('button', { name: 'Hand over all to AI', exact: true }).count(), 1);
    assert.equal(await page.locator('.shop-chat-inbox').getByRole('button', { name: 'Hand over all to AI', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Hand over all to AI', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'true');
    assert.equal(bulkChanges, 1);
    await page.getByText('3 conversations handed over to AI.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my draft');
    await fs.mkdir('artifacts/owner-chat-handover', { recursive: true });
    await page.screenshot({ path: 'artifacts/owner-chat-handover/header-toggle.png' });
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Hand over all to AI', exact: true }).count(), 0);
    console.log('PASS one header, individual takeover, bulk AI handover and retained draft');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
