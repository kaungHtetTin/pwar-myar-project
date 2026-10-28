// Isolated UI verification: no real accounts or authentication mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../shop/node_modules/playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  const output = path.join(root, 'artifacts/auth-locale');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [index, app] of ['frontend', 'mobile', 'office', 'shop'].entries()) {
      const { createServer } = await import(pathToFileURL(path.join(root, app, 'node_modules/vite/dist/node/index.js')));
      const server = await createServer({ root: path.join(root, app), configFile: path.join(root, app, 'vite.config.js'), server: { host: '127.0.0.1', port: 5290 + index, strictPort: true } });
      await server.listen();
      try {
        const screens = app === 'office' ? [['login', '/']] : app === 'shop'
          ? [['login', '/#/account/login'], ['register', '/#/account/register']]
          : app === 'frontend' ? [['login', '/#/login'], ['register', '/#/signup']]
            : [['login', '/login'], ['register', '/signup']];
        for (const width of [360, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 960 }, serviceWorkers: 'block' });
          const errors = [];
          let submits = 0;
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/api/') || (url.hostname !== '127.0.0.1' && url.pathname.includes('/api/')) || url.pathname.includes('/sanctum/')) {
              if (route.request().method() === 'POST') submits++;
              if (url.pathname.endsWith('/settings')) return route.fulfill({ status: 403, json: { message: 'Sign in required.' } });
              if (url.pathname.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } });
              return route.fulfill({ json: { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false } });
            }
            if (url.hostname !== '127.0.0.1') return route.abort();
            return route.continue();
          });
          for (const [screen, destination] of screens) {
            console.log(`Checking ${app} ${screen} ${width}`);
            await page.goto(`http://127.0.0.1:${5290 + index}${destination}`);
            const toggle = page.locator(app === 'mobile' ? '.auth-header-locale:visible' : '.auth-locale-toggle:visible');
            await toggle.waitFor({ timeout: 10000 }).catch(async error => { console.log(await page.locator('body').innerText(), errors); throw error; });
            const dialog = page.getByRole('dialog');
            if (await dialog.isVisible()) {
              console.log('Dismissing auth notice:', await dialog.innerText());
              await dialog.locator('button').first().click();
            }
            const email = page.locator('input[type="email"]:visible').first();
            await email.fill('locale@example.com');
            const baseline = submits;
            for (const locale of ['my', 'en', 'my']) {
              const button = app === 'mobile' ? toggle.locator('button') : toggle.locator(`[lang="${locale}"]`);
              if (app !== 'mobile' || await button.getAttribute('data-language') !== locale) await button.click();
              await page.waitForFunction(({ locale, app }) => document.querySelector(app === 'mobile' ? '.auth-header-locale button[data-language="' + locale + '"]' : '.auth-locale-toggle button[lang="' + locale + '"][aria-pressed="true"]'), { locale, app });
              assert.equal(await email.inputValue(), 'locale@example.com', `${app}: locale preserves draft`);
              assert.equal(submits, baseline, `${app}: toggle must never submit`);
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${app}: horizontal overflow at ${width}`);
              assert.equal(await button.evaluate(el => el.getBoundingClientRect().height >= 44), true);
              if (app === 'mobile') assert.equal(await button.evaluate(el => { const r = el.getBoundingClientRect(); return r.top < 55 && r.right > innerWidth - 100; }), true, 'Mobile locale belongs in the top-right corner');
            }
            await page.screenshot({ path: path.join(output, `${app}-${screen}-${width}-my.png`), fullPage: true });
            await page.reload();
            await page.locator(app === 'mobile' ? '.auth-header-locale:visible button[data-language="my"]' : '.auth-locale-toggle:visible button[lang="my"][aria-pressed="true"]').waitFor();
            assert.deepEqual(errors, [], `${app}: browser errors`);
            console.log(`PASS ${app} ${screen} ${width}: language, draft, persistence, touch targets, overflow`);
          }
          await page.close();
        }
      } finally { await server.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
