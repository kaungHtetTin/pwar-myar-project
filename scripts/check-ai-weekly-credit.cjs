const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');
(async () => {
  await fs.mkdir('artifacts/ai-weekly-credit', { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      let remaining = 50, thread = null, items = [], id = 0, messageReads = 0;
      const colors = {}, errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const usage = () => ({ limit: 50, used: 50 - remaining, remaining, remaining_percent: remaining * 2, resets_at: '2026-10-26T00:00:00+06:30', timezone: 'Asia/Yangon' });
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['products', 'sell', 'settings'], subscription: { is_valid: true, can_mutate: true } };
      await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule', 'products'); localStorage.setItem('mkpos.language', 'en'); });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.route('**/api/**', route => {
        const req = route.request(), pathname = new URL(req.url()).pathname;
        if (pathname.startsWith('/src/') || !pathname.includes('/api/')) return route.continue();
        const path = pathname.slice(pathname.indexOf('/api/') + 4);
        let data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
        if (path === '/auth/me') data = session;
        if (path === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, language: 'en', business: session.business };
        if (path === '/subscription') data = session.subscription;
        if (path === '/categories' || path === '/price-types') data = [];
        if (path === '/branding') data = { primary_color: '#0e684e', theme_mode: 'light' };
        if (path === '/ai-assistant/config') data = { enabled: true, configured: true, storage_ready: true, weekly_limit: 50, weekly_usage: usage() };
        if (path === '/ai-assistant/conversations' && req.method() === 'POST') { thread = req.postDataJSON().id; data = { conversation: { id: thread } }; }
        if (/\/messages$/.test(path)) {
          if (req.method() === 'POST') {
            remaining--;
            items = [{ id: ++id, role: 'user', body: req.postDataJSON().body, status: 'completed', created_at: new Date().toISOString() }, { id: ++id, role: 'assistant', body: 'How can I help?', status: 'completed', created_at: new Date().toISOString() }];
          } else messageReads++;
          data = { items, has_more: false, weekly_usage: usage() };
        }
        return route.fulfill({ json: data });
      });
      await page.goto(mobile ? 'http://127.0.0.1:5176/assistant' : 'http://127.0.0.1:5174/');
      if (!mobile) await page.getByRole('button', { name: 'PwarMyar AI assistant', exact: true }).first().click();
      const ring = page.getByRole('progressbar', { name: 'Weekly AI requests remaining' });
      await ring.waitFor().catch(async error => {
        await page.screenshot({ path: `artifacts/ai-weekly-credit/${mobile ? 'mobile' : 'desktop'}-failure.png` });
        console.error({ mobile, errors, text: (await page.locator('body').innerText()).slice(0, 1800) });
        throw error;
      });
      const editor = page.getByRole('textbox', { name: 'AI message', exact: true }); await editor.fill('Unsent draft'); const original = await editor.elementHandle();
      assert.equal(await page.getByText('Resets Mon, Oct 26', { exact: true }).isVisible(), true);
      for (const percent of [100, 75, 50, 25, 0]) {
        remaining = percent / 2;
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(percent => document.querySelector('.ai-weekly-avatar')?.getAttribute('aria-valuenow') === String(percent), percent);
        await page.screenshot({ path: `artifacts/ai-weekly-credit/${mobile ? 'mobile' : 'desktop-dialog'}-${percent}.png`, animations: 'disabled' });
        colors[percent] = await page.locator('.ai-weekly-fill').evaluate(node => getComputedStyle(node).stroke);
        assert.equal(await editor.inputValue(), 'Unsent draft'); assert.equal(await original.evaluate(node => node.isConnected), true);
      }
      assert.equal(new Set(Object.values(colors)).size, 5);
      assert.equal(messageReads, 0);
      remaining = 50;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => document.querySelector('.ai-weekly-avatar')?.getAttribute('aria-valuenow') === '100');
      await page.getByRole('button', { name: mobile ? 'Send AI message' : 'Send', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.ai-weekly-avatar')?.getAttribute('aria-valuenow') === '98');
      if (!mobile) {
        await page.getByRole('button', { name: 'Maximize AI chat', exact: true }).click();
        await page.getByText('Resets Mon, Oct 26', { exact: true }).waitFor({ state: 'visible' });
        await page.screenshot({ path: 'artifacts/ai-weekly-credit/desktop-page-98.png', animations: 'disabled' });
        assert.equal(await ring.getAttribute('aria-valuenow'), '98');
      } else {
        await page.getByRole('button', { name: 'History', exact: true }).click();
        await page.getByRole('button', { name: 'Close Conversations', exact: true }).click();
        assert.equal(await ring.getAttribute('aria-valuenow'), '98');
      }
      assert.deepEqual(errors, []);
      await fs.writeFile(`artifacts/ai-weekly-credit/${mobile ? 'mobile' : 'desktop'}-colors.json`, JSON.stringify(colors, null, 2));
      await context.close();
    }
    console.log('Desktop dialog/full page and mobile: weekly ring percentages, five distinct gradient colors, focus refresh without message reload/draft loss, post-send update and history/maximize passed. API writes mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
