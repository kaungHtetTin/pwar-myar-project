// Every API is intercepted. This exercises queue acceptance and delivery receipts without model calls or real writes.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch();
  const output = 'artifacts/wyne-wyne-queue';
  await fs.mkdir(output, { recursive: true });
  try {
    for (const mobile of (process.argv.includes('--mobile-only') ? [true] : [false, true])) {
      const label = mobile ? 'mobile' : 'desktop';
      const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1440, height: 900 }, serviceWorkers: 'block' });
      const errors = [], posts = [];
      let conversation, nextId = 1, activeMessage, finish, onStart;
      let deliveryCalls = 0;
      const rows = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'shop'); localStorage.setItem('mkpos.language', 'en'); });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({status:204}));
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const method = request.method();
        let json = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false }, status = 200;
        if (path === '/auth/me') json = { user: { id: 1, name: 'Fixture owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', timezone: 'Asia/Rangoon', currency: 'MMK' }, permissions: ['shop', 'ecommerce_orders', 'ecommerce_settings', 'ecommerce_process'], subscription: { is_valid: true, can_mutate: true } };
        else if (path === '/app-config') json = { enabled_modules: ['shop'], permissions: ['shop'], language: 'en' };
        else if (path === '/shop-admin/owner-location') json = { submitted: true };
        else if (path === '/ai-assistant/config') json = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50, name: 'Wyne Wyne' };
        else if (path === '/ai-assistant/conversations' && method === 'POST') {
          conversation = request.postDataJSON().id; json = { conversation: { id: conversation } };
        } else if (path === '/ai-assistant/conversations') json = { items: conversation ? [{ id: conversation, title: 'Queue fixture question', updated_at: new Date().toISOString() }] : [], has_more: false };
        else if (path.endsWith('/delivery')) {
          deliveryCalls++;
          json = {status: activeMessage.status, pending: activeMessage.status === 'pending', items: rows};
        } else if (path.endsWith('/messages')) {
          if (method === 'POST') {
            const data = request.postDataJSON(); posts.push(data.client_id);
            activeMessage = rows.find(row => row.client_id === data.client_id);
            if (activeMessage) activeMessage.status = 'pending';
            else { activeMessage = { id: nextId++, client_id: data.client_id, role: 'user', status: 'pending', body: data.body, created_at: new Date().toISOString() }; rows.push(activeMessage); }
            finish = success => {
              activeMessage.status = success ? 'completed' : 'failed';
              if (success) rows.push({id:nextId++,role:'assistant',status:'completed',body:`Queued reply ${posts.length}`,reply_to_id:activeMessage.id,created_at:new Date().toISOString()});
            };
            status = 202;
            json = {items:rows.filter(row=>row.id===activeMessage.id || row.reply_to_id===activeMessage.id),pending:true,status:'pending'};
            onStart();
          } else json = { items: rows, has_more: false, actions: { items: [], has_more: false }, billing_requests: [] };
        } else if (method !== 'GET' && !path.includes('/activity-alerts/') && !path.includes('/subscription/') && !path.includes('/presence')) {
          assert.fail(`Unexpected mutation: ${method} ${path}`);
        }
        await route.fulfill({ status, json });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5174/?page=assistant');
      const editor = page.getByRole('textbox', { name: 'AI message', exact: true });
      await editor.waitFor({timeout:15000}).catch(async error => {
        await page.screenshot({path:`${output}/${label}-startup-error.png`,fullPage:true});
        console.error(JSON.stringify({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1200)}));
        throw error;
      });
      const send = page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true });
      const submit = async control => {
        finish = null;
        const started = new Promise(resolve => { onStart = resolve; });
        await control.click();
        await started;
        await page.waitForFunction(() => document.querySelector('[aria-label="AI message"]')?.disabled);
        assert.equal(typeof finish, 'function');
      };
      await editor.fill('Queue fixture question'); await submit(send);
      await page.getByLabel('AI conversation messages', {exact:true}).getByText('Queue fixture question', { exact: true }).waitFor();
      assert.equal(posts.length, 1);
      // Accepted requests return before the fixture worker completes.
      await page.screenshot({ path: `${output}/${label}-pending.png`, fullPage: true });
      finish(true);
      await page.getByText('Queued reply 1', {exact:true}).waitFor();
      assert.equal(await editor.isDisabled(), false);
      await editor.fill('Retry fixture question'); await submit(send);
      finish(false);
      const retry = page.getByRole('button', { name: 'Retry message', exact: true });
      await retry.waitFor();
      assert.equal(posts.length, 2);
      await submit(retry);
      finish(true);
      await page.getByText('Queued reply 3', {exact:true}).waitFor();
      assert.equal(posts.length, 3);
      assert.equal(posts[1], posts[2], 'Explicit retry must reuse the saved message key.');
      assert.ok(deliveryCalls > 0, 'Queued replies must reconcile delivery without resubmitting messages.');
      await editor.fill('Keep this unsent draft');
      assert.ok(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/${label}-completed.png`, fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`${label}: queue acceptance, pending state, worker delivery, failed reply, explicit retry and stable message keys passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
