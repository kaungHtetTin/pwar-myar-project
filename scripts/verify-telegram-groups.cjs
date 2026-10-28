// Isolated browser fixture. All API calls are intercepted; no Telegram or model traffic.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const output = 'artifacts/telegram-groups';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [theme, width, height] of [['light', 1440, 900], ['dark', 1280, 720], ['light', 1024, 900], ['light', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, serviceWorkers: 'block' });
      const errors = [], calls = [];
      let fail = true;
      let groups = Array.from({ length: 35 }, (_, i) => ({ id: i + 1, chat_id: String(-1009001 - i), title: i ? `Support group ${i + 1}` : 'PwarMyar users',
        version: 1, status: i % 2 ? 'approved' : 'pending', is_member: true, reply_mentions: true, reply_to_bot: true,
        requests_today: i % 10, daily_limit: 100, per_user_daily_limit: 20, last_seen_at: '2026-10-26 13:00:00', last_reply_at: null }));
      groups[1] = { ...groups[1], title: 'Support group 2 — အသုံးပြုသူများ', is_member: false };
      groups[0].last_update = { reason: 'bot_or_anonymous_sender', checked_at: '2026-10-27T00:00:00Z' };
      let settings = { enabled: true, groups_enabled: true, token_configured: true, webhook_secret_configured: true, storage_ready: true,
        webhook_url: 'https://example.test/integrations/telegram/customer-service', version: 1, bot_username: 'fixture_support_bot', daily_limit: 200, per_chat_daily_limit: 20 };
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/sanctum/csrf-cookie') return route.fulfill({ status: 204 });
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname.slice(4), method = req.method();
        calls.push({ endpoint, method });
        let json = { items: [], total: 0, has_more: false, realtime_enabled: false, enabled: false };
        if (endpoint === '/office/auth/me') json = { admin: { id: 1, name: 'Fixture reviewer', role: 'super_admin' } };
        else if (endpoint === '/branding') json = { theme_mode: theme, primary_color: '#087f74', theme_version: 1 };
        else if (endpoint === '/office/telegram-support') {
          if (method === 'PUT') settings = { ...settings, ...req.postDataJSON(), version: settings.version + 1 };
          json = { settings, message: 'Telegram settings saved.' };
        } else if (endpoint === '/office/telegram-support/groups') {
          if (method === 'POST') { groups.push({ ...groups[0], ...req.postDataJSON(), id: 99, status: 'pending' }); json = { message: 'Group added.' }; }
          else {
            const search = url.searchParams.get('search') || '', status = url.searchParams.get('status');
            const filtered = groups.filter(g => `${g.title} ${g.chat_id}`.toLowerCase().includes(search.toLowerCase()) && (!status || g.status === status));
            const per_page = Number(url.searchParams.get('per_page') || 25), last_page = Math.max(1, Math.ceil(filtered.length / per_page));
            const current = Math.min(Number(url.searchParams.get('page') || 1), last_page);
            json = { groups: filtered.slice((current - 1) * per_page, current * per_page), total: filtered.length, page: current, per_page, last_page };
          }
        } else if (endpoint.startsWith('/office/telegram-support/groups/')) {
          assert.equal(method, 'PUT');
          if (fail) { fail = false; return route.fulfill({ status: 422, json: { message: 'Fixture save failed. Retry.' } }); }
          const id = Number(endpoint.split('/').pop()), body = req.postDataJSON();
          groups = groups.map(g => g.id === id ? { ...g, ...body, version: g.version + 1 } : g);
          json = { message: 'Group settings saved.' };
        } else assert.equal(method, 'GET', `Unexpected mutation ${endpoint}`);
        return route.fulfill({ json });
      });
      await page.goto('http://127.0.0.1:5175/#/settings/telegram-support');
      await page.getByRole('heading', { name: 'Telegram groups', exact: true }).waitFor();
      await page.getByText('PwarMyar users', { exact: true }).waitFor();
      const section = page.getByRole('region', { name: 'Telegram groups', exact: true });
      await section.evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText('Page 2 of 2', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'First', exact: true }).click();
      await page.getByText('Page 1 of 2', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Last', exact: true }).click();
      await page.getByText('Page 2 of 2', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await page.getByText('Page 1 of 2', { exact: true }).waitFor();
      await page.getByLabel('Rows per page').selectOption('50');
      await page.getByText('Page 1 of 1', { exact: true }).waitFor();
      await page.getByRole('searchbox', { name: 'Search Telegram groups' }).fill('PwarMyar');
      await page.getByRole('searchbox').press('Enter');
      await page.getByText('1–1 of 1 groups').waitFor();
      const before = calls.filter(c => c.endpoint === '/office/telegram-support/groups').length;
      const navigation = page.getByRole('navigation', { name: 'Settings sections' });
      await navigation.getByRole('button', { name: /Account/ }).click();
      await page.goBack();
      assert.equal(await page.getByRole('searchbox').inputValue(), 'PwarMyar');
      assert.equal(calls.filter(c => c.endpoint === '/office/telegram-support/groups').length, before);
      await page.mouse.move(0, 0);
      await page.getByRole('button', { name: 'Actions for PwarMyar users', exact: true }).scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.getByRole('button', { name: 'Actions for PwarMyar users', exact: true }).focus();
      await page.getByRole('button', { name: 'Actions for PwarMyar users', exact: true }).press('Enter');
      await page.getByRole('menuitem', { name: 'Manage group' }).click();
      await page.getByRole('dialog').waitFor();
      await page.screenshot({ path: `${output}/${theme}-${width}-edit.png`, fullPage: true });
      await page.getByRole('dialog').getByRole('combobox').selectOption('approved');
      await page.getByLabel('Daily AI requests', { exact: true }).fill('70');
      await page.getByRole('button', { name: 'Save group', exact: true }).click();
      await page.getByText('Fixture save failed. Retry.').waitFor();
      assert.equal(await page.getByLabel('Daily AI requests', { exact: true }).inputValue(), '70');
      await page.getByRole('button', { name: 'Save group', exact: true }).click();
      await page.getByText('Group settings saved.', { exact: true }).waitFor();
      await page.getByText('Group settings saved.', { exact: true }).evaluate(element => element.scrollIntoView({ block: 'center' }));
      const inset = await section.evaluate(element => {
        const notice = element.querySelector('.office-telegram-groups-message');
        return notice.getBoundingClientRect().left - element.getBoundingClientRect().left;
      });
      assert.ok(inset >= 9 && inset <= 12, 'Group feedback should use the panel inset.');
      await page.screenshot({ path: `${output}/${theme}-${width}-notice.png`, fullPage: true });
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByRole('dialog').getByRole('combobox').selectOption('pending');
      await page.getByRole('button', { name: 'Apply filters' }).click();
      await page.getByText('No groups found.', { exact: false }).waitFor();
      await page.getByRole('button', { name: /Filters/ }).click();
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await page.getByRole('button', { name: 'Clear search telegram groups' }).click();
      await page.getByRole('button', { name: 'Add group', exact: true }).click();
      await page.getByLabel('Group ID', { exact: true }).fill('-1009999');
      await page.getByLabel('Group name', { exact: true }).fill('Second PwarMyar community');
      await page.getByRole('dialog').getByRole('button', { name: 'Add group', exact: true }).click();
      await page.getByText('Group added.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Add group', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ theme, width, pagination: true, retained_back: true, approval_retry: true, filters: true, add: true, errors: errors.length }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
