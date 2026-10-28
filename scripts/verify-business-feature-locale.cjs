// Business app locale QA. Every API request uses fixtures; no bot or AI traffic.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
 const { translateText } = await import('../frontend/src/translations.js');
 const { REMAINING_PAGE_MESSAGES } = await import('../mobile/src/localization/remainingPagesLocale.js');
 const output = 'artifacts/business-feature-locale';
 await fs.mkdir(output, { recursive: true });
 const browser = await chromium.launch();
 try {
  for (const app of ['desktop','mobile']) for (const language of ['en','my']) {
   const width = app === 'desktop' ? 1440 : 393, height = app === 'desktop' ? 900 : 852;
   const text = value => translateText(value, language);
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

        let json = { items: [], total: 0, has_more: false, unread_count: 0, enabled: false };
        if (path === '/auth/me') json = session;
        if (path === '/settings') json = { language };
        if (path === '/app-config') json = { enabled_modules: ['shop','settings'], permissions: session.permissions, business: session.business, language };
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

   await page.goto(app === 'desktop' ? 'http://127.0.0.1:5174/?page=shop&shopTab=sales-ai-telegram' : 'http://127.0.0.1:5176/shop/sales-ai/telegram');
   await page.waitForFunction(language => document.documentElement.lang === language, language);
   const token = page.getByLabel(text('Bot token'), { exact: true });
   try { await token.waitFor({ timeout: 10000 }); } catch (error) { console.log(app,language,(await page.locator('body').innerText()).slice(0,1300)); await page.screenshot({ path: `${output}/${app}-${language}-failure.png` }); throw error; }
   assert.equal(await token.getAttribute('placeholder'), text('Leave blank to keep the saved token'));
   await token.fill('keep-this-token');
   await page.getByRole('button', { name: text('Test connection'), exact: true }).waitFor();
   await page.getByText(text('Connection and webhook'), { exact: true }).waitFor();
   await page.screenshot({ path: `${output}/${app}-${language}-settings.png`, fullPage: true });
   if (app === 'desktop') await page.getByRole('button', { name: text('Manage group'), exact: true }).click();
   else await page.getByRole('button', { name: /Shop customers/ }).click();
   const name = page.getByLabel(text('Group name'), { exact: true }).filter({ visible: true });
   await name.waitFor();
   assert.equal(await name.inputValue(), 'Shop customers');
   await name.fill('Keep group draft');
   await page.getByRole('button', { name: text('Save group'), exact: true }).waitFor();
   assert.equal(await page.getByLabel(text('Telegram group ID'), { exact: true }).filter({ visible: true }).inputValue(), '-100123');
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
   await page.screenshot({ path: `${output}/${app}-${language}-group.png`, fullPage: true });
   if (app === 'desktop') await page.getByRole('button', { name: text('Close Manage group'), exact: true }).click();
   else await page.getByRole('button', { name: language === 'my' ? REMAINING_PAGE_MESSAGES.Back : 'Back', exact: true }).click();
   assert.equal(await page.getByLabel(text('Bot token'), { exact: true }).filter({ visible: true }).inputValue(), 'keep-this-token');
   assert.deepEqual(writes.filter(call => call.path.includes('/telegram')), []);
   assert.deepEqual(errors, []);
   console.log(app, language, 'labels, placeholders, group form, raw IDs and retained draft passed');
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
