// All API calls are fixtures. This never contacts Telegram or an AI provider.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const output = 'artifacts/sales-telegram';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [app, width, height, target] of [
      ['desktop', 1440, 1000, 'http://127.0.0.1:5174/?page=shop&shopTab=sales-ai-telegram'],
      ['mobile', 393, 852, 'http://127.0.0.1:5176/shop/sales-ai/telegram'],
      ['mobile', 393, 520, 'http://127.0.0.1:5176/shop/sales-ai/telegram'],
      ['mobile', 768, 900, 'http://127.0.0.1:5176/shop/sales-ai/telegram'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: 'block' });
      const errors = [], writes = [];
      let group = { id: 1, version: 1, chat_id: -100123, title: 'Shop customers', status: 'approved', is_member: true, reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('mkpos.language', 'en'); localStorage.setItem('mkpos.activeModule', 'shop'); });
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/sanctum/csrf-cookie') return route.fulfill({ status: 204 });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        const session = { user: { id: 1, business_id: 1, name: 'Fixture Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['shop', 'settings', 'ecommerce_settings', 'ecommerce_orders', 'ecommerce_catalog'], subscription: { is_valid: true, can_mutate: true } };
        const settings = { version: 2, enabled: true, groups_enabled: true, daily_limit: 200, per_user_limit: 20, token_configured: true, webhook_url: 'https://fixture.test/integrations/telegram/sales-ai/uuid', bot_username: 'fixture_shop_bot', registered_at: '2026-10-27' };

        let json = { items: [], total: 0, has_more: false, unread_count: 0, enabled: false };
        if (path === '/auth/me') json = session;
        if (path === '/app-config') json = { enabled_modules: ['shop','settings'], permissions: session.permissions, business: session.business, language: 'en' };
        if (path === '/subscription') json = session.subscription;
        if (path === '/branding') json = { primary_color: '#0e684e', theme_mode: 'light', theme_version: 1 };
        if (path === '/shop-admin/owner-location') json = { submitted: true, location: { latitude: 16.84, longitude: 96.17 } };
        if (path === '/shop-admin/settings') json = { slug: 'fixture-shop', storefront_enabled: true, owner_location_required: false, owner_location: { latitude: 16.84, longitude: 96.17 }, eligible: true };
        if (path === '/shop-admin/sales-ai') json = { settings: { enabled: true, name: 'Mia', instructions: '', soul: '', version: 1, tool_permissions: [] }, tools: [], wallet: { available: 500, reserved: 0 } };
        if (path === '/shop-admin/sales-ai/telegram') json = { settings };
        if (path === '/shop-admin/sales-ai/telegram/groups') json = { items: [group], total: 1 };
        if (path === '/shop-admin/sales-ai/telegram/groups/1') { if (req.method() === 'PUT') group = { ...group, ...req.postDataJSON(), version: group.version + 1 }; json = { group }; }
        if (path === '/categories' || path === '/price-types') json = [];
        if (req.method() !== 'GET') writes.push({ path, method: req.method() });
        return route.fulfill({ json });
      });
      await page.goto(target);
      try { await page.getByRole('button', { name: 'Save Telegram settings', exact: true }).waitFor({ timeout: 15000 }); } catch (error) { await page.screenshot({ path: `${output}/${app}-failed.png`, fullPage: true }); console.log((await page.locator('body').innerText()).slice(0,1800), errors); throw error; }
      await page.getByLabel('Bot token', { exact: true }).fill('unsaved-fixture-token');
      assert.equal(await page.getByRole('button', { name: 'Register webhook', exact: true }).isEnabled(), false);
      if (app === 'mobile') {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const scroll = await page.evaluate(() => {
          const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
          return { header: rect('.shared-app-bar'), nav: rect('.sale-bottom-navigation'), last: rect('.sales-telegram-page > section:last-child'), height: innerHeight, pageY: scrollY };
        });
        console.log('Telegram scroll geometry:', JSON.stringify(scroll));
        await page.screenshot({ path: `${output}/mobile-scroll-bottom-${width}x${height}.png` });
        assert.ok(scroll.last.bottom <= scroll.nav.top - 12, 'Telegram group list must scroll completely above bottom navigation');
        assert.ok(Math.abs(scroll.header.top) <= 1, 'App bar stays at the viewport top while scrolling');
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.screenshot({ path: `${output}/${app}-settings.png`, fullPage: true });
      if (app === 'mobile') {
        await page.getByRole('button', { name: /Shop customers/ }).click();
        await page.getByLabel('Group name', { exact: true }).waitFor();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const action = await page.getByRole('button', { name: 'Save group', exact: true }).boundingBox();
        const navigation = await page.locator('.sale-bottom-navigation').boundingBox();
        assert.ok(action.y + action.height <= navigation.y - 12, 'Save group must scroll above bottom navigation');
        await page.screenshot({ path: `${output}/mobile-group.png`, fullPage: true });
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await page.getByLabel('Bot token', { exact: true }).filter({ visible: true }).inputValue(), 'unsaved-fixture-token');
      } else {
        await page.getByRole('button', { name: 'Manage group', exact: true }).click();
        await page.getByRole('dialog', { name: 'Manage group', exact: true }).waitFor();
        await page.getByLabel('Group name', { exact: true }).waitFor();
        await page.screenshot({ path: `${output}/desktop-group.png`, fullPage: true });
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      if (app === 'mobile') await page.getByRole('button', { name: /Shop customers/ }).click();
      else await page.getByRole('button', { name: 'Manage group', exact: true }).click();
      await page.getByLabel('Group name', { exact: true }).filter({ visible: true }).fill('Updated customers');
      await page.getByRole('button', { name: 'Save group', exact: true }).click();
      if (app === 'mobile') await page.getByRole('button', { name: /Updated customers/ }).waitFor();
      else await page.getByText('Updated customers', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Bot token', { exact: true }).filter({ visible: true }).inputValue(), 'unsaved-fixture-token');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${app} page overflow`);
      assert.deepEqual(errors, []);
      assert.deepEqual(writes.filter(call => call.path.includes('/telegram')), [{ path: '/shop-admin/sales-ai/telegram/groups/1', method: 'PUT' }]);
      console.log(`${app}: rendered, draft retained, group save and cancel, no overflow, no external requests`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
