import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Intercept every API request; never send messages or change real records.
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const requests = [];
let unread = 2;
const thread = { uuid: 'test-inbox', shop_name: 'Demo Shop', slug: 'demo', preview: 'Is this product available?', updated_at: '2026-10-13 01:00:00', unread_count: 2 };
try {
  await page.addInitScript(() => { localStorage.setItem('mkpos.shop.customerToken', 'test-only'); localStorage.setItem('mkpos.shop.language', 'en'); });
  await page.route('**/ecommerce/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/ecommerce')[1];
    requests.push(path + url.search);
    let result = { items: [], has_more: false };
    if (path === '/customer/me') result = { customer: { id: 123, name: 'Test Buyer' } };
    else if (path === '/chat') result = { items: [{ ...thread, unread_count: unread }], has_more: false };
    else if (path === '/chat/config') result = { realtime_enabled: false };
    else if (path === '/chat/notifications') result = { enabled: true, unread_count: unread, cursor: 5, items: [] };
    else if (path === '/chat/test-inbox') result = { thread };
    else if (path === '/chat/test-inbox/read') { unread = 0; result = { ok: true }; }
    else if (path === '/chat/test-inbox/messages') result = { items: [{ id: 5, sender: 'owner', body: 'Is this product available?', created_at: '2026-10-13 01:00:00' }], has_more: false, thread: { owner_read_id: 0, owner_active: false } };
    await route.fulfill({ json: result });
  });
  await page.goto('http://127.0.0.1:5177/#/marketplace');
  const nav = page.locator('.mobile-navigation');
  assert.equal(await nav.locator('a').count(), 5);
  await nav.getByRole('link', { name: /Chats/ }).click();
  const row = page.locator('.customer-conversation-row');
  await row.waitFor();
  assert.equal(await nav.getByRole('link', { name: /Chats/ }).getAttribute('aria-current'), 'page');
  assert.equal(await page.getByLabel('2 Unread messages').count(), 1);
  await mkdir('test-artifacts/customer-chats', { recursive: true });
  await page.screenshot({ path: 'test-artifacts/customer-chats/list-mobile.png' });
  await row.click();
  const message = page.getByRole('textbox', { name: 'Message', exact: true });
  await message.fill('Keep this unsent draft');
  assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).isEnabled(), true);
  await page.screenshot({ path: 'test-artifacts/customer-chats/conversation-mobile.png' });
  const initialLists = () => requests.filter(path => path === '/chat?offset=0&limit=24').length;
  const loads = initialLists();
  await page.getByRole('button', { name: 'Back to chats' }).click();
  await row.waitFor();
  assert.equal(initialLists(), loads, 'Back must not reload the inbox');
  assert.equal(await page.getByLabel('2 Unread messages').count(), 0);
  await page.goForward();
  await message.waitFor();
  assert.equal(await message.inputValue(), 'Keep this unsent draft');
  await page.goBack();
  await row.waitFor();
  assert.equal(initialLists(), loads);
  await page.getByRole('button', { name: 'Refresh conversations' }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Refresh conversations"]').disabled);
  assert.equal(initialLists(), loads + 1);
  await page.setViewportSize({ width: 1366, height: 900 });
  assert.equal(await page.locator('.desktop-navigation').getByRole('link', { name: 'Chats', exact: true }).isVisible(), true);
  await page.screenshot({ path: 'test-artifacts/customer-chats/list-desktop.png' });
  console.log('PASS: five-tab navigation, conversation open, unread reconciliation, app Back, browser Back/Forward, retained draft, refresh, desktop tab. All API requests intercepted.');
} finally { await browser.close(); }
