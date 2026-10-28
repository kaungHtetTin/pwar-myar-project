const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const calls = [];
    let mode = 'waiting_owner', version = 1;
    page.on('pageerror', error => console.error(error.message));
    const waiting = () => ({ uuid, customer_name: 'Aye Aye', customer_active: true, unread: 0, sales_ai: { enabled: true, name: 'Mia', mode, version }, last_message: { id: 1, sender: 'customer', body: 'Please let me speak to a person.', created_at: '2026-10-26T01:00:00Z' } });
    const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 10, name: 'Demo shop', currency: 'Ks', timezone: 'Asia/Yangon' }, subscription: { is_valid: true }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_process', 'ecommerce_settings'] };
    await page.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.startsWith('/api/')) return route.continue();
      const path = pathname.slice(4); calls.push(path);
      let json = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false };
      if (path === '/auth/me') json = session;
      else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: session.permissions, language: 'en' };
      else if (path === '/shop-admin/owner-location') json = { submitted: true };
      else if (path === '/shop-admin/chat/config') json = { enabled: true, sales_ai_enabled: true, realtime_enabled: false, channel: 'private-shop.chat.business.10' };
      else if (path === '/shop-admin/chat') json = { items: [waiting(), { ...waiting(), uuid: '12345678-1234-1234-1234-123456789ab1', customer_name: 'Min Min', sales_ai: { enabled: true, mode: 'human', version: 1 } }, { ...waiting(), uuid: '12345678-1234-1234-1234-123456789ab2', customer_name: 'Ko Ko', sales_ai: { enabled: true, mode: 'ai', version: 1 } }], total: 3, has_more: false };
      else if (path.endsWith('/handoff-all')) { mode = 'ai'; version++; json = { updated_count: 2 }; }
      else if (path.endsWith('/handoff')) { mode = route.request().postDataJSON().mode; version++; json = { thread: waiting() }; }
      else if (path.endsWith('/messages')) json = { thread: waiting(), items: [waiting().last_message], has_more: false };
      await route.fulfill({ json });
    });
    await page.goto('http://127.0.0.1:5176/shop/chat');
    try { await page.getByText('Needs human', { exact: true }).waitFor({ timeout: 8000 }); } catch (e) { await page.screenshot({ path: 'artifacts/mobile-needs-human-debug.png' }); console.error(JSON.stringify({ url: page.url(), calls, text: (await page.locator('body').innerText()).slice(0, 600) })); throw e; }
    assert.equal(await page.getByText('Needs human', { exact: true }).count(), 1);
    const row = page.getByRole('button', { name: /Aye Aye/ });
    const original = await row.elementHandle();
    await fs.mkdir('artifacts/mobile-needs-human', { recursive: true });
    await page.screenshot({ path: 'artifacts/mobile-needs-human/inbox.png' });
    assert.equal(await page.getByRole('button', { name: 'PwarMyar AI assistant' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Shop chat/ }).count(), 0);
    const bulk = page.getByRole('button', { name: 'Hand over all to AI' });
    assert.equal(await page.locator('.shop-chat-inbox-header').getByRole('button', { name: 'Hand over all to AI' }).count(), 1);
    if (process.argv.includes('--bulk')) {
      await bulk.click();
      await page.getByText('2 conversations handed over to AI.').waitFor();
      assert.equal(await page.getByText('Needs human', { exact: true }).count(), 0);
      assert.ok(await original.evaluate(node => node.isConnected));
      await page.screenshot({ path: 'artifacts/mobile-needs-human/bulk-handover.png' });
      console.log('PASS mobile app bar shortcuts removed, bulk handover icon and retained list');
      return;
    }
    assert.ok(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth));
    await row.click();
    const toggle = page.getByRole('switch', { name: 'AI replies' });
    await toggle.waitFor();
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[role=switch]')?.checked === true, null, { timeout: 8000 });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByText('Aye Aye', { exact: true }).waitFor();
    assert.equal(await page.getByText('Needs human', { exact: true }).count(), 0);
    assert.ok(await original.evaluate(node => node.isConnected && !node.closest('[hidden]')));
    await page.setViewportSize({ width: 768, height: 900 });
    assert.ok(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth));
    console.log('PASS mobile badge, handler reconciliation, retained source row and responsive widths');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
