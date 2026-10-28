const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');

(async () => {
  await fs.mkdir('artifacts/ai-assistant-page', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], calls = [], messages = [];
    const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['products', 'settings'], subscription: { is_valid: true, can_mutate: true } };
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'products'); localStorage.setItem('mkpos.language', 'en'); });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const req = route.request(), pathname = new URL(req.url()).pathname;
      if (pathname.startsWith('/src/')) return route.continue();
      const path = pathname.split('/api')[1]; calls.push({ path, method: req.method() });
      let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
      if (path === '/auth/me') data = session;
      if (path === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, business: session.business, language: 'en' };
      if (path === '/subscription') data = session.subscription;
      if (path === '/categories' || path === '/price-types') data = [];
      if (path === '/settings') data = { language: 'en', shop_name: 'Fixture shop' };
      if (path === '/branding') data = { primary_color: '#0e684e' };
      if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true };
      if (path === '/ai-assistant/conversations') data = req.method() === 'POST' ? { conversation: { id: req.postDataJSON().id } } : { items: [{ id: 'saved-chat', title: 'Sales questions', updated_at: '2026-10-25T08:00:00Z' }, { id: 'myanmar-chat', title: 'ဆိုင်အမည်ကို wyne business ပြောင်းလဲခြင်း', updated_at: '2026-10-24T08:00:00Z' }, { id: 'stock-chat', title: 'Product stock and pricing', updated_at: '2026-10-23T08:00:00Z' }], has_more: false };
      if (/\/ai-assistant\/conversations\/[^/]+\/messages/.test(path)) {
        if (req.method() === 'POST') {
          const body = req.postDataJSON();
          messages.push({ id: messages.length + 1, role: 'user', body: body.body, client_id: body.client_id, status: 'completed', created_at: new Date().toISOString() });
          messages.push({ id: messages.length + 1, role: 'assistant', body: 'Your daily report is ready.\n\nYou can view sales and expenses from Reports.\n\nဆိုင်အမည်ကို Settings စာမျက်နှာတွင် ပြောင်းလဲနိုင်ပါသည်။\n\n| Summary | Amount |\n| --- | ---: |\n| Sales | 125,000 Ks |\n| Expenses | 25,000 Ks |\n| Profit | 100,000 Ks |', status: 'completed', created_at: new Date().toISOString() });
        }
        data = { items: messages, has_more: false };
      }
      if (path === '/ai-assistant/product-template') data = { filename: 'products.csv', csv: 'Name,SKU\n' };
      await route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('[data-module="products"]:visible').waitFor();
    const source = await page.locator('[data-module="products"]').elementHandle();
    const sourceReads = () => calls.filter(call => call.path === '/products' && call.method === 'GET').length;
    await page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }).last().click();
    const dialog = page.getByRole('dialog', { name: 'PwarMyar AI assistant' });
    await dialog.waitFor();
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    assert.equal(await source.evaluate(node => !node.hidden), true);
    const input = page.getByRole('textbox', { name: 'AI message' });
    await input.fill('Show today report');
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    await dialog.getByText('Your daily report is ready.', { exact: false }).waitFor();
    await input.fill('Retained draft');
    await page.screenshot({ path: 'artifacts/ai-assistant-page/dialog-first.png' });
    await dialog.getByRole('button', { name: 'Maximize AI chat' }).click();
    const region = page.getByRole('region', { name: 'PwarMyar AI assistant' });
    await region.waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), 'assistant');
    assert.equal(await page.getByRole('dialog', { name: 'PwarMyar AI assistant' }).count(), 0);
    await region.getByText('Your daily report is ready.', { exact: false }).waitFor();
    assert.equal(await input.inputValue(), 'Retained draft');
    const reads = sourceReads();
    await page.getByRole('button', { name: 'Back to Products', exact: true }).click();
    await page.locator('[data-module="products"]:visible').waitFor();
    assert.equal(await source.evaluate(node => node.isConnected && !node.hidden), true);
    assert.equal(sourceReads(), reads);
    await page.goForward();
    await region.waitFor(); assert.equal(await input.inputValue(), 'Retained draft');
    await page.goBack();
    await page.locator('[data-module="products"]:visible').waitFor();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'PwarMyar AI assistant' }).click();
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Maximize AI chat' }).click();
    assert.equal(await input.inputValue(), 'Retained draft');
    assert.equal(sourceReads(), reads);
    const conversationList = region.getByRole('region', { name: 'AI conversations' });
    await region.getByRole('button', { name: 'Sales questions' }).click();
    await region.getByRole('textbox', { name: 'AI message' }).waitFor();
    const chatReads = () => calls.filter(call => /\/messages$/.test(call.path) && call.method === 'GET').length;
    const previousChatReads = chatReads();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="AI message"]')?.disabled === false);
    assert.ok(chatReads() > previousChatReads);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      const box = await region.boundingBox(), editor = await input.boundingBox();
      assert.ok(box.width > width * 0.65);
      assert.ok(box.height > 800);
      assert.ok(editor.y + editor.height <= 1000);
      const list = await region.getByRole('region', { name: 'AI conversations' }).boundingBox();
      assert.ok(list.x > editor.x + editor.width);
      assert.equal(await region.locator('.shop-chat-messages').evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
      assert.equal(await region.locator('.shop-customer-chat-window').evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
      assert.equal(await region.locator('.shop-chat-conversation').evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
      assert.equal(await region.locator('.shop-chat-conversation > .shop-customer-chat-heading').count(), 1);
      const room = await region.locator('.shop-chat-conversation').boundingBox();
      const heading = await region.locator('.shop-customer-chat-heading').boundingBox();
      assert.ok(Math.abs(heading.y - room.y - 1) < 2);
      assert.ok(Math.abs(list.y - room.y) < 2);
      assert.equal(await region.locator('.ai-conversation-list').evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
      assert.equal(await region.locator('.ai-reply-content p').first().evaluate(node => getComputedStyle(node).fontWeight), '400');
      assert.equal(await region.locator('.shop-chat-message-meta').first().evaluate(node => getComputedStyle(node).fontSize), '10px');
      assert.ok(await region.locator('.shop-chat-messages').evaluate(node => node.scrollWidth <= node.clientWidth));
      await page.screenshot({ path: `artifacts/ai-assistant-page/chat-${width}.png` });
    }
    assert.equal(await region.getByRole('button', { name: 'CSV template' }).count(), 0);
    await page.reload();
    await region.waitFor();
    await region.getByText('Your daily report is ready.', { exact: false }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('page'), 'assistant');
    await region.getByRole('button', { name: 'New chat' }).click();
    assert.equal(await input.inputValue(), '');
    assert.deepEqual(errors, []);
    console.log('AI dialog first, maximize with shared session, right conversation list, flat page sizing, send, history, new chat, no CSV download, refresh, draft retention, app Back and browser Back/Forward passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
