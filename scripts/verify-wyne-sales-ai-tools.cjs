// Owner approval UI only. All APIs are intercepted, including confirmations.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const samples = [
 ['manage_sales_ai_telegram_settings', 'Sales AI Telegram settings', { groups_enabled: false, daily_limit: 200 }, { groups_enabled: true, daily_limit: 300 }],
 ['manage_sales_ai_telegram_groups', 'Sales AI Telegram groups', { chat_id: -100111, status: 'pending' }, { chat_id: -100111, status: 'approved', daily_limit: 100 }],
 ['manage_sales_ai_settings', 'Sales AI configuration', { name: 'Sales assistant' }, { name: 'Kaung Kaung', enabled: true }],
 ['manage_sales_ai_tools', 'Sales AI tool permissions', { enabled: false }, { enabled: true }],
 ['manage_sales_ai_policies', 'Sales AI sales policies', { published_text: 'Contact the shop' }, { published_text: 'ပစ္စည်းရရှိပြီး ၇ ရက်အတွင်း ဆိုင်ကို ဆက်သွယ်ပါ။', effect: 'Owner published return policy.' }],
 ['manage_sales_ai_handover', 'Sales AI conversation handover', { handling: 'human' }, { handling: 'ai', effect: 'May generate replies using normal Sales AI credit.' }],
 ['manage_sales_ai_topups', 'Cancel Sales AI top-up', { status: 'pending', amount: '1000 MMK' }, { status: 'cancelled', effect: 'No wallet credit or refund.' }],
];
(async () => {
 const browser = await chromium.launch(); await fs.mkdir('artifacts/wyne-sales-ai-tools', { recursive: true });
 try { for (const mobile of [false, true]) {
  const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1440, height: 900 }, serviceWorkers: 'block' });
  const errors = [], writes = []; let conversation, proposal, sequence = 1;
  const settings = { enabled: false, name: 'Sales assistant', instructions: 'Help customers', soul: 'Friendly', tool_permissions: ['search_products'], sales_policies: {}, version: 1 };
  const native = { settings, tools: [], wallet: { available: '500', reserved: '0' }, pricing: { usd_to_mmk_rate: '4000', markup_percent: '5' } };
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.language', 'en'); });
  await page.route('**/api/**', async route => {
   const req = route.request(), url = new URL(req.url()); if (!url.pathname.startsWith('/api/')) return route.continue();
   const path = url.pathname.slice(4), method = req.method();
   let json = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false };
   if (path === '/auth/me') json = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Demo shop', timezone: 'Asia/Rangoon', currency: 'MMK' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'], subscription: { is_valid: true, can_mutate: true } };
   else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop'], language: 'en' };
   else if (path === '/shop-admin/sales-ai') { assert.equal(method, 'GET'); json = native; }
   else if (path === '/shop-admin/owner-location') json = { submitted: true };
   else if (path === '/ai-assistant/config') json = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
   else if (path === '/ai-assistant/conversations') {
    if (method === 'POST') { conversation = { id: req.postDataJSON().id, title: 'Sales AI management', messages: [] }; json = { conversation: { id: conversation.id } }; }
    else json = { items: conversation ? [conversation] : [], has_more: false };
   } else if (/\/messages$/.test(path)) {
    if (method === 'POST') {
     const [operation, title, before, after] = samples.find(([op]) => op === req.postDataJSON().body);
     conversation.messages = [{ id: sequence++, role: 'user', body: req.postDataJSON().body, status: 'completed', created_at: new Date().toISOString() }, { id: sequence++, role: 'assistant', body: 'Review the proposed Sales AI change below. It is not saved yet.', status: 'completed', created_at: new Date().toISOString() }];
     proposal = { id: `proposal-${sequence}`, operation, status: 'pending', target_names: [title], preview_hash: `hash-${sequence}`, currency: 'MMK', expires_at: '2099-01-01T00:00:00Z', preview: { items: [{ name: title, before, after }], total: 1, has_more: false } };
    }
    json = { items: conversation?.messages || [], has_more: false, actions: { items: proposal ? [{ ...proposal, preview: { ...proposal.preview, items: [] } }] : [], has_more: false } };
   } else if (path.includes('/actions/')) {
    if (method === 'POST') {
     writes.push(path); const data = req.postDataJSON();
     if (path.endsWith('/confirm')) { assert.equal(data.preview_hash, proposal.preview_hash); assert.equal(data.reviewed_count, 1); proposal = { ...proposal, status: 'completed', result: { saved: true, modules: ['shop'], ...(proposal.operation === 'manage_sales_ai_settings' ? { sales_ai: { ...native, settings: { ...settings, name: 'Kaung Kaung', version: 2 } } } : {}) } }; }
     else if (path.endsWith('/cancel')) proposal = { ...proposal, status: 'cancelled' };
    }
    json = proposal;
   }
   await route.fulfill({ json });
  });
  await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5174/?page=assistant');
  const editor = page.getByRole('textbox', { name: 'AI message', exact: true });
  for (const [operation, title] of samples) {
   await editor.fill(operation); await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
   await page.getByRole('button', { name: `Review ${title}`, exact: true }).click();
   const review = page.getByRole('article', { name: 'Review business changes', exact: true }); await review.waitFor();
   const confirm = review.getByRole('button', { name: 'Confirm changes', exact: true }); assert.ok(await confirm.isDisabled());
   await editor.fill('Keep this Sales AI management question');
   await review.screenshot({ path: `artifacts/wyne-sales-ai-tools/${mobile ? 'mobile' : 'desktop'}-${operation}.png` });
   if (operation === 'manage_sales_ai_policies') { await review.getByRole('button', { name: 'Cancel proposal', exact: true }).click(); await review.getByText('Proposal cancelled. Ask the assistant for a new proposal if needed.', { exact: true }).waitFor(); }
   else { await review.getByRole('checkbox').check(); await confirm.click(); await review.getByText('Changes saved.', { exact: true }).waitFor(); }
   await review.getByRole('button', { name: 'Close review', exact: true }).click();
   assert.equal(await editor.inputValue(), 'Keep this Sales AI management question');
   assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
  }
  assert.equal(writes.filter(path => path.endsWith('/confirm')).length, 6); assert.equal(writes.filter(path => path.endsWith('/cancel')).length, 1);
  assert.deepEqual(errors, []); console.log(`${mobile ? 'Mobile' : 'Desktop'}: seven Sales AI review forms, owner consent, approve/cancel, one POST and retained chat draft passed`); await page.close();
 } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
