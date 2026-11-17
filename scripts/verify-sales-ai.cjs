// Isolated UI verification: every API call is intercepted; no paid AI or live payments.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const settings = { enabled: true, name: 'Mia', instructions: 'Help customers choose suitable products. Verify prices and availability.', soul: 'Friendly, honest and concise.', tool_permissions: ['search_products', 'shop_information', 'customer_orders'], version: 1 };
const response = { settings, tools: [{ name: 'search_products', description: 'Published products, prices and availability' }, { name: 'shop_information', description: 'Public shop contact, delivery and payment instructions' }, { name: 'customer_orders', description: 'Only orders belonging to this customer' }], wallet: { balance: '500.000000', available: '500.000000', reserved: '0' }, pricing: { usd_to_mmk_rate: '4000', markup_percent: '5' } };
const topup = { prevalidation: { verdict: 'looks_consistent', funds_verified: false, checks: ['recipient_name', 'recipient_account', 'amount', 'currency', 'provider', 'payment_status', 'transaction_reference'].map(field => ({ field, status: 'match' })) }, id: 3, business_id: 10, business_name: 'Demo shop', amount: '1000', status: 'pending', transaction_reference: 'TX123', payment_account: { bank: 'KBZPay', account_no: '09123456', account_name: 'Platform' }, version: 1, created_at: '2026-10-25T10:00:00Z' };
let proof = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64');
(async () => {
  const browser = await chromium.launch(); await fs.mkdir('artifacts/sales-ai-ui', { recursive: true });
  const receipt = await browser.newPage({ viewport: { width: 260, height: 340 } });
  await receipt.setContent('<body style="font:16px sans-serif;padding:20px;color:#123"><h2>KBZPay</h2><p>TEST RECEIPT</p><hr><h2>1,000 MMK</h2><p>To: Platform</p><p>09123456</p><p>Reference: TX123</p><p>Successful transfer</p><small>Demo fixture only</small></body>');
  proof = await receipt.screenshot(); await receipt.close();
  try {
    for (const app of (process.argv.length > 2 ? process.argv.slice(2) : ['desktop', 'mobile', 'office', 'chat'])) {
      const page = await browser.newPage({ viewport: { width: ['mobile', 'chat'].includes(app) ? 393 : 1440, height: 900 }, serviceWorkers: 'block' });
      if (app === 'chat') await page.clock.install();
      let aiResponding = false, replyReady = false;
      const chatMessages = [{ id: 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: 'How can I help?', created_at: '2026-10-25T10:00:00Z' }];
      let mode = 'ai'; const chatUuid = '12345678-1234-1234-1234-123456789abc'; const chatThread = () => ({ uuid: chatUuid, shop_name: 'Demo shop', slug: 'demo', sales_ai: { enabled: true, name: 'Mia', mode, version: mode === 'ai' ? 1 : 2, responding: aiResponding } });
      const errors = [], calls = []; page.on('pageerror', error => { errors.push(error.message); console.error(app, error.message); });
      await page.addInitScript(() => { localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.shop.customerToken', 'fixture'); localStorage.setItem('mkpos.shop.language', 'en'); });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        calls.push({ path, method: req.method() });
        if (path.endsWith('/screenshot') || path.endsWith('/payment-screenshot')) return route.fulfill({ contentType: 'image/png', body: proof });
        let json = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false, page: 1, per_page: 25, last_page: 1 };
        if (path === '/ecommerce/customer/me') json = { customer: { id: 1, name: 'Buyer', email: 'buyer@example.test' } };
        else if (path.startsWith(`/ecommerce/chat/${chatUuid}`)) {
          if (path.endsWith('/handoff')) mode = 'waiting_owner';
          if (path.endsWith('/messages') && req.method() === 'POST') {
            aiResponding = true;
            const message = { id: chatMessages.length + 1, sender: 'customer', body: JSON.parse(req.postData()).body, created_at: '2026-10-25T10:01:00Z' };
            chatMessages.push(message); json = { thread: chatThread(), message };
          } else {
            if (replyReady) { replyReady = false; aiResponding = false; chatMessages.push({ id: chatMessages.length + 1, sender: 'owner', is_ai: true, ai_name: 'Mia', body: `AI reply ${chatMessages.length + 1}`, created_at: '2026-10-25T10:02:00Z' }); }
            json = { thread: chatThread(), items: chatMessages, has_more: false };
          }
        }
        else if (path === '/ecommerce/chat/config') json = { enabled: true, realtime_enabled: false };
        else if (path === '/ecommerce/stores/demo') json = { name: 'Demo shop' };
        else if (path === '/auth/me') json = { user: { id: 1, name: 'Owner', email: 'owner@example.test', role: 'owner' }, business: { id: 10, name: 'Demo shop', currency: 'Ks', timezone: 'Asia/Yangon' }, subscription: { is_valid: true }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'] };
        else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'], language: 'en' };
        else if (path === '/shop-admin/owner-location') json = { submitted: true, latitude: 16.84, longitude: 96.17 };
        else if (path === '/shop-admin/sales-ai') json = req.method() === 'PUT' ? { ...response, settings: JSON.parse(req.postData()) } : response;
        else if (path === '/shop-admin/sales-ai/topups') json = req.method() === 'POST' ? { request: topup } : { items: [topup], has_more: false, payment_methods: [{ id: 1, ...topup.payment_account }] };
        else if (path === '/shop-admin/sales-ai/wallet') {
          const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 25);
          const rows = Array.from({ length: 60 }, (_, i) => ({ id: 60 - i, amount: i === 0 ? '500' : '-1.234567', balance_after: '475.803576', description: i === 0 ? 'New business free Sales AI credit' : `Sales AI response #${i + 1}`, created_at: topup.created_at }));
          const daily = Array.from({ length: 30 }, (_, i) => ({ key: `day-${i}`, label: `Oct ${i + 1}`, cost: String(i % 5 * .456789) }));
          const monthly = Array.from({ length: 12 }, (_, i) => ({ key: `month-${i}`, label: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i], cost: String(i * 1.234567) }));
          json = { items: rows.slice(offset, offset + limit), total: 60, wallet: response.wallet, has_more: offset + limit < 60, ...(url.searchParams.get('include_usage') === '1' ? { usage: { timezone: 'Asia/Yangon', currency: 'MMK', daily: { items: daily, total: '27.40734' }, monthly: { items: monthly, total: '81.481422' } } } : {}) };
        }
        else if (path === '/shop-admin/sales-ai/topups/3') json = { request: topup };
        else if (path === '/office/auth/me') json = { admin: { id: 1, name: 'Reviewer', email: 'reviewer@example.test', role: 'super_admin' } };
        else if (path === '/office/businesses/10') json = { business: { id: 10, name: 'Demo shop', owner_name: 'Owner', owner_email: 'owner@example.test', owner_is_active: true, status: 'active', currency: 'Ks', timezone: 'Asia/Yangon' }, billing: { is_valid: true, subscription: null, reason: 'active' }, billing_history: [{ id: 12, payment_proofs: [{ id: 31, url: '/office/subscription-requests/31/payment-screenshot' }], plan_name: 'Professional', access_type: 'paid', status: 'active', price_paid: 30000, currency: 'Ks', duration_days: 30, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z' }], sales_ai_wallet: response.wallet, sales_ai_topups: [topup] };
        else if (path === '/office/businesses/10/sales-ai/wallet' && req.method() === 'PATCH') { const data = JSON.parse(req.postData()); assert.equal(data.expected_balance, '500.000000'); json = { wallet: { balance: data.balance, available: data.balance, reserved: '0', currency: 'MMK' } }; }
        else if (path === '/office/businesses/10/sales-ai/wallet') json = { ...json, items: [{ id: 1, amount: '500', balance_after: '500', description: 'New business free Sales AI credit', created_at: topup.created_at }], total: 1, wallet: response.wallet };
        else if (path === '/office/sales-ai/topups') json = { ...json, items: [topup], total: 1 };
        else if (path === '/office/sales-ai/topups/3/review') json = { request: { ...topup, status: 'approved', version: 2 }, wallet: { balance: '1500', available: '1500', reserved: '0' } };
        else if (path === '/settings') json = { language: 'en', currency: 'Ks', price_types: 'Retail' };
        await route.fulfill({ json });
      });
      await page.goto(`http://127.0.0.1:${app === 'desktop' ? 5174 : app === 'mobile' ? 5176 : app === 'chat' ? 5177 : 5175}/${app === 'desktop' ? '?shopTab=sales-ai' : app === 'mobile' ? 'shop/sales-ai' : app === 'chat' ? `#/chats/${chatUuid}` : '#/ai/sales-topups'}`);
      await fs.writeFile(`artifacts/sales-ai-ui/${app}-requests.json`, JSON.stringify(calls));
      if (app === 'office') {
        const sourceTable = await page.getByRole('table').elementHandle();
        await page.getByRole('button', { name: 'Actions for top-up 3' }).click();
        await page.getByRole('menuitem', { name: 'View business' }).click();
        await page.getByText('Sales AI balance', { exact: true }).waitFor();
        const adjustment = page.locator('.office-sales-ai-balance-form');
        await adjustment.getByLabel('New balance (MMK)').fill('1250');
        await adjustment.getByLabel('Reason', { exact: true }).fill('Opening balance correction');
        await adjustment.getByRole('button', { name: 'Update balance', exact: true }).click();
        await adjustment.getByText('AI balance updated.', { exact: true }).waitFor();
        await page.getByRole('region', { name: 'Current billing summary' }).getByText('1,250 MMK', { exact: true }).waitFor();
        await adjustment.screenshot({ path: 'artifacts/sales-ai-ui/business-ai-balance-form.png' });
        assert.equal(calls.filter(call => call.path === '/office/businesses/10/sales-ai/wallet' && call.method === 'PATCH').length, 1);

        assert.equal(await page.getByRole('region', { name: 'Sales AI top-up management' }).count(), 0);
        const billing = page.getByRole('table', { name: 'Billing history' });
        await billing.getByText('Professional', { exact: true }).waitFor();
        await billing.getByText('Sales AI top-up', { exact: true }).waitFor();
        assert.equal(await page.getByRole('table').count(), 1);
        await billing.scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/sales-ai-ui/office-business-combined-billing.png', fullPage: true });
        const beforeBackReads = calls.filter(call => call.path === '/office/sales-ai/topups').length;
        assert.equal(await billing.getByRole('columnheader', { name: 'Proof', exact: true }).count(), 0);
        for (const [kind, id, name] of [['subscription', 12, 'Professional'], ['top-up', 3, 'Sales AI top-up #3']]) {
          await billing.getByRole('button', { name: `Actions for ${kind} ${id}` }).click();
          await page.getByRole('menuitem', { name: 'View details', exact: true }).click();
          const modal = page.getByRole('dialog', { name: 'Billing details', exact: true });
          await modal.getByAltText(`Payment screenshot for ${name}`).waitFor();
          await modal.screenshot({ path: `artifacts/sales-ai-ui/billing-details-${kind}.png` });
          await modal.getByRole('button', { name: 'Close', exact: true }).click();
          await modal.waitFor({ state: 'hidden' });
        }

        await billing.getByRole('button', { name: 'Actions for subscription 12' }).click();
        await page.getByRole('menuitem', { name: 'Edit billing period' }).click();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await billing.getByRole('button', { name: 'Actions for top-up 3' }).click();
        await page.getByRole('menuitem', { name: 'Review top-up' }).click();
        await page.getByAltText('Top-up payment proof').waitFor();
        await page.screenshot({ path: 'artifacts/sales-ai-ui/office-review.png' });
        await page.getByRole('button', { name: 'Confirm review' }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.getByRole('region', { name: 'Current billing summary' }).getByText('1,500 MMK', { exact: true }).waitFor();
        assert.equal(calls.filter(call => call.path.endsWith('/review') && call.method === 'POST').length, 1);
        await page.getByRole('button', { name: 'Back to Sales AI top-ups' }).click();
        await page.getByText('No records match these filters.', { exact: true }).waitFor();
        assert.ok(await sourceTable.evaluate(el => el.isConnected && !el.closest('[hidden]')));
        assert.equal(calls.filter(call => call.path === '/office/sales-ai/topups').length, beforeBackReads);
      } else if (app === 'desktop') {
        const nav = page.getByRole('navigation', { name: 'Shop management sections' });
        await page.getByLabel('Representative name').fill('Shop helper');
        const reads = calls.filter(call => call.path === '/shop-admin/sales-ai').length;
        await nav.getByRole('button', { name: 'Sales policies', exact: true }).click();
        await page.getByLabel('Return policy', { exact: true }).fill('Contact us within seven days.');
        assert.equal(await page.getByLabel('Representative name').count(), 0);
        await page.goBack();
        await page.getByLabel('Representative name').waitFor();
        assert.equal(await page.getByLabel('Representative name').inputValue(), 'Shop helper');
        await page.goForward();
        await page.getByLabel('Return policy', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Return policy', { exact: true }).inputValue(), 'Contact us within seven days.');
        const policyStyle = await page.locator('.sales-ai-policies').evaluate(el => { const style = getComputedStyle(el); return [style.borderWidth, style.borderStyle, style.borderColor, style.borderRadius, style.padding]; });
        await page.locator('.sales-ai-policies').screenshot({ path: 'artifacts/sales-ai-ui/desktop-policies.png' });
        await nav.getByRole('button', { name: 'Tool permissions', exact: true }).click();
        const toolsStyle = await page.locator('.sales-ai-tools').evaluate(el => { const style = getComputedStyle(el); return [style.borderWidth, style.borderStyle, style.borderColor, style.borderRadius, style.padding]; });
        assert.deepEqual(policyStyle, toolsStyle);
        await nav.getByRole('button', { name: 'Balance book', exact: true }).click();
        await page.getByText('New business free Sales AI credit').waitFor();
        const book = page.locator('.sales-ai-balance-book');
        await book.getByRole('heading', { name: 'Daily usage', exact: true }).waitFor();
        await book.getByRole('button', { name: 'Next', exact: true }).click();
        await book.getByText('Sales AI response #26', { exact: true }).waitFor();
        assert.equal(await book.getByText('26-50 of 60', { exact: true }).count(), 1);
        await book.getByRole('button', { name: 'Prev', exact: true }).click();
        await book.getByText('New business free Sales AI credit').waitFor();
        await book.getByLabel('Balance rows per page').selectOption('50');
        await book.getByText('Sales AI response #50', { exact: true }).waitFor();
        assert.ok(await book.locator('.table-wrap').evaluate(el => el.scrollWidth <= el.clientWidth));
        await page.locator('.sales-ai-heading').scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/sales-ai-ui/desktop-balance-charts.png' });
        await book.locator('.sales-ai-usage-charts').screenshot({ path: 'artifacts/sales-ai-ui/desktop-usage-charts.png' });
        const walletReads = calls.filter(call => call.path === '/shop-admin/sales-ai/wallet').length;
        await nav.getByRole('button', { name: 'Configuration', exact: true }).click();
        assert.equal(await page.getByLabel('Representative name').inputValue(), 'Shop helper');
        assert.equal(calls.filter(call => call.path === '/shop-admin/sales-ai').length, reads);
        await page.screenshot({ path: 'artifacts/sales-ai-ui/desktop-configuration.png' });
        await nav.getByRole('button', { name: 'Balance book', exact: true }).click();
        assert.equal(calls.filter(call => call.path === '/shop-admin/sales-ai/wallet').length, walletReads);
        await nav.getByRole('button', { name: 'Top-up requests', exact: true }).click();
        await page.getByRole('button', { name: 'Top up', exact: true }).click();
        await page.getByLabel('Amount (MMK)').fill('1000');
        await page.getByLabel('Payment proof', { exact: true }).setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: proof });
        await page.getByAltText('Selected payment proof').waitFor();
        await page.screenshot({ path: 'artifacts/sales-ai-ui/desktop-topup.png' });
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await nav.getByRole('button', { name: 'Sales policies', exact: true }).click();
        await page.reload();
        await page.getByLabel('Delivery policy').waitFor();
        assert.equal(await nav.getByRole('button', { name: 'Sales policies', exact: true }).getAttribute('aria-current'), 'page');
      } else if (app === 'mobile') {
        await page.getByRole('button', { name: 'Configuration', exact: true }).click();
        await page.getByLabel('Representative name').fill('Shop helper');
        await page.getByLabel('Return policy', { exact: true }).fill('Contact us within seven days.');
        await page.screenshot({ path: 'artifacts/sales-ai-ui/mobile-configuration.png' });
        const configReads = calls.filter(call => call.path === '/shop-admin/sales-ai').length;
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await page.getByRole('button', { name: 'Configuration', exact: true }).click();
        assert.equal(calls.filter(call => call.path === '/shop-admin/sales-ai').length, configReads);
        assert.equal(await page.getByLabel('Representative name').inputValue(), 'Shop helper');
        assert.equal(await page.getByLabel('Return policy', { exact: true }).inputValue(), 'Contact us within seven days.');
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await page.getByRole('button', { name: 'Top up', exact: true }).click();
        await page.getByLabel('Amount (MMK)').fill('1000');
        await page.getByLabel('Payment proof', { exact: true }).setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: proof });
        await page.getByAltText('Selected payment proof').waitFor();
        await page.screenshot({ path: 'artifacts/sales-ai-ui/mobile-topup.png', fullPage: true });
        assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
      }
      if (app === 'chat') {
        await page.locator('.conversation-ai-badge').waitFor();
        await page.getByLabel('Message', { exact: true }).fill('Keep my draft');
        assert.ok(await page.locator('.is-ai .conversation-bubble > small').isVisible());
        assert.equal(await page.locator('.customer-chat-page-header .conversation-ai-badge').count(), 1);
        assert.equal(await page.locator('.shop-chat-conversation > .shop-chat-ai-status').count(), 0);
        const bubbleStyles = await page.locator('.is-ai .conversation-bubble').evaluate(node => ({ background: getComputedStyle(node).backgroundColor, border: getComputedStyle(node).borderStyle, canvas: getComputedStyle(node.closest('.shop-chat-messages')).backgroundColor }));
        assert.notEqual(bubbleStyles.background, bubbleStyles.canvas);
        assert.equal(bubbleStyles.border, 'solid');
        await page.screenshot({ path: 'artifacts/sales-ai-ui/customer-chat.png' });
        for (const width of [360, 1366]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
        }
        await page.setViewportSize({ width: 393, height: 900 });
        await page.getByLabel('Conversation actions').click();
        const menuItems = page.locator('.conversation-menu-item');
        assert.equal(await menuItems.count(), 2);
        const menuStyle = await menuItems.evaluateAll(items => items.map(el => ({ height: el.getBoundingClientRect().height, font: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, icons: el.querySelectorAll('svg').length })));
        assert.equal(menuStyle[0].height, menuStyle[1].height);
        assert.equal(menuStyle[0].font, menuStyle[1].font);
        assert.equal(menuStyle[0].weight, menuStyle[1].weight);
        assert.ok(menuStyle.every(item => item.height >= 44 && item.icons === 1));
        await page.screenshot({ path: 'artifacts/sales-ai-ui/customer-chat-menu.png' });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.conversation-menu').getAttribute('open'), null);
        await page.getByLabel('Conversation actions').click();
        await page.getByRole('heading', { name: 'Demo shop', exact: true }).click();
        assert.equal(await page.locator('.conversation-menu').getAttribute('open'), null);
        assert.equal(await page.locator('.shop-chat-message.is-entering').count(), 0);
        for (const question of ['First question', 'Second question']) {
          await page.getByLabel('Message', { exact: true }).fill(question);
          await page.getByRole('button', { name: 'Send', exact: true }).click();
          await page.getByRole('status', { name: 'AI is preparing a reply' }).waitFor();
          assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), '');
          assert.ok(await page.getByText(question, { exact: true }).evaluate(el => el.closest('article').classList.contains('is-entering')));
          await page.screenshot({ path: 'artifacts/sales-ai-ui/customer-ai-typing.png' });
          assert.equal(await page.locator('.chat-reply-dots i').first().evaluate(el => getComputedStyle(el).animationName), 'chat-reply-pulse');
          await page.emulateMedia({ reducedMotion: 'reduce' });
          assert.equal(await page.locator('.chat-reply-dots i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          const nextReply = chatMessages.length + 1;
          replyReady = true; await page.clock.runFor(16000);
          await page.getByText(`AI reply ${nextReply}`, { exact: true }).waitFor();
          assert.equal(await page.getByRole('status', { name: 'AI is preparing a reply' }).count(), 0);
        }
        await page.getByLabel('Message', { exact: true }).fill('Keep my draft');
        await page.getByLabel('Conversation actions').click();
        await page.getByRole('button', { name: 'Talk to a person' }).click();
        await page.locator('.conversation-ai-badge').waitFor({ state: 'hidden' });
        assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my draft');
        assert.equal(calls.filter(call => call.path.endsWith('/handoff')).length, 1);
        await page.screenshot({ path: 'artifacts/sales-ai-ui/customer-chat-handoff.png' });
      }
      assert.deepEqual(errors, [], `${app} browser errors`); console.log(`${app}: passed`); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
