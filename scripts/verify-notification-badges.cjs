// Locale badge regression: all application APIs are intercepted fixtures.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
 const output = 'artifacts/notification-badges';
 await fs.mkdir(output, { recursive: true });
 const browser = await chromium.launch();
 try {
  for (const language of ['en', 'my']) for (const count of [6, 99, 123]) {
   const width = 1440, height = 900;
      const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: 'block' });
      const errors = [], writes = [];
      let group = { id: 1, version: 1, chat_id: -100123, title: 'Shop customers', status: 'approved', is_member: true, reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(language => { localStorage.setItem('mkpos.language', language); localStorage.setItem('mkpos.activeModule', 'shop'); }, language);
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/sanctum/csrf-cookie') return route.fulfill({ status: 204 });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        const session = { user: { id: 1, business_id: 1, name: 'Fixture Owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'Ks' }, permissions: ['shop', 'settings', 'ecommerce_settings', 'ecommerce_orders', 'ecommerce_catalog'], subscription: { is_valid: true, can_mutate: true } };
        const settings = { version: 2, enabled: true, groups_enabled: true, daily_limit: 200, per_user_limit: 20, token_configured: true, webhook_url: 'https://fixture.test/integrations/telegram/sales-ai/uuid', bot_username: 'fixture_shop_bot', registered_at: '2026-10-27' };

        let json = { items: [], total: 0, has_more: false, unread_count: count, enabled: false, action_required_count: count };
        if (path === '/auth/me') json = session;
        if (path === '/settings') json = { language };
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

   await page.goto('http://127.0.0.1:5174/?page=shop&shopTab=sales-ai-telegram');
   await page.locator('.shop-order-action-badge').waitFor();
   await page.waitForFunction(language => document.documentElement.lang === language, language);
   const badges = await page.locator('.workspace-chat-badge, .shop-order-action-badge').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
    return { name: node.className, text: node.textContent, width: r.width, height: r.height, paddingTop: s.paddingTop, paddingBottom: s.paddingBottom };
   }));
   assert.ok(badges.length >= 2);
   for (const badge of badges) {
    assert.equal(badge.text, count > 99 ? '99+' : String(count));
    assert.equal(badge.height, badge.name === 'workspace-chat-badge' ? 17 : 20);
    assert.equal(badge.paddingTop, '0px'); assert.equal(badge.paddingBottom, '0px');
    if (count === 6) assert.ok(Math.abs(badge.width - badge.height) <= 1, JSON.stringify(badge));
   }
   assert.deepEqual(errors, []);
   if (count === 6) await page.screenshot({ path: `${output}/${language}-single-count.png` });
   console.log(language, count, JSON.stringify(badges));
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
