// Exercise real auth screens against intercepted Office branding and auth APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../shop/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function checkAutofill(page, palette) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('DOM.getDocument');
    const remote = await cdp.send('Runtime.evaluate', { expression: `Array.from(document.querySelectorAll('input[type="email"]')).find(element => element.getClientRects().length)` });
    const { nodeId } = await cdp.send('DOM.requestNode', { objectId: remote.result.objectId });
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['autofill'] });
    await page.waitForFunction(expected => {
      const input = Array.from(document.querySelectorAll('input[type="email"]')).find(element => element.getClientRects().length);
      return input && getComputedStyle(input).boxShadow.includes(expected);
    }, rgb(palette.surface));
    const style = await page.locator('input[type="email"]:visible').first().evaluate(element => { const s = getComputedStyle(element); return { fill: s.webkitTextFillColor, shadow: s.boxShadow }; });
    assert.equal(style.fill, rgb(palette.text), 'Autofilled text must follow Office');
    assert.ok(style.shadow.includes(rgb(palette.surface)), `Autofilled fields must retain the Office surface: ${JSON.stringify(style)} expected ${rgb(palette.surface)}`);
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  } finally { await cdp.detach(); }
}

(async () => {
  const runtime = await import(pathToFileURL(path.join(root, 'shared/theme/themeRuntime.js')));
  const browser = await chromium.launch();
  const output = path.join(root, 'artifacts/auth-theme-3.0.1');
  await fs.mkdir(output, { recursive: true });
  const results = [];
  try {
    for (const [index, app] of ['frontend', 'mobile', 'office', 'shop'].entries()) {
      const { createServer } = await import(pathToFileURL(path.join(root, app, 'node_modules/vite/dist/node/index.js')));
      const server = await createServer({ root: path.join(root, app), configFile: path.join(root, app, 'vite.config.js'), server: { host: '127.0.0.1', port: 5190 + index, strictPort: true } });
      await server.listen();
      try {
        for (const primary of ['#0032a1', '#ffff00']) for (const mode of ['light', 'dark']) {
          let theme = { primary_color: primary, theme_mode: mode, theme_version: 1000, palettes: runtime.makeThemePalettes(primary) };
          const page = await browser.newPage({ viewport: { width: app === 'mobile' || app === 'shop' ? 390 : 1440, height: 960 }, locale: 'en-US', serviceWorkers: 'block' });
          const errors = [];
          const submitSelector = app === 'shop' ? '.customer-auth-page form button.primary-button, .customer-auth-page form button.primary'
            : app === 'office' ? '.office-login-form .auth-submit' : app === 'mobile' ? '.auth-reference-page button[type="submit"]' : '.auth-split-page .auth-submit';
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', async route => {
            const req = route.request(), url = new URL(req.url());
            if (url.pathname.endsWith('/branding')) return route.fulfill({ json: theme });
            if (url.pathname.startsWith('/api/') || (url.hostname !== '127.0.0.1' && url.pathname.includes('/api/')) || url.pathname.includes('/sanctum/')) {
              if (url.pathname.endsWith('/forgot-password')) return route.fulfill({ json: { message: 'A test code is ready.', resend_after: 60 } });
              if (url.pathname.endsWith('/reset-password')) return route.fulfill({ json: { message: 'Password reset.' } });
              if (url.pathname.endsWith('/me')) return route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } });
              return route.fulfill({ json: { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false } });
            }
            if (url.hostname !== '127.0.0.1') return route.abort();
            return route.continue();
          });
          const routes = app === 'office' ? [['login', '/']] : app === 'shop'
            ? [['login', '/#/account/login'], ['register', '/#/account/register'], ['reset', '/#/account/forgot-password']]
            : app === 'frontend' ? [['login', '/#/login'], ['register', '/#/signup'], ['reset', '/#/forgot-password']]
              : [['login', '/login'], ['register', '/signup'], ['reset', '/forgot-password']];
          try {
            for (const [screen, destination] of routes) {
              console.log(JSON.stringify({ checking: app, screen, primary, mode }));
              await page.goto(`http://127.0.0.1:${5190 + index}${destination}`);
              const button = page.locator(submitSelector).filter({ visible: true }).first();
              await button.waitFor();
              await page.waitForFunction(color => document.documentElement.style.getPropertyValue('--theme-primary').trim() === color, primary);
              await page.waitForFunction(({ background, foreground, selector }) => {
                const button = Array.from(document.querySelectorAll(selector)).find(element => element.getClientRects().length);
                if (!button) return false;
                const style = getComputedStyle(button);
                return style.color === foreground && (style.backgroundColor === background || style.backgroundImage.includes(background));
              }, { background: rgb(primary), foreground: rgb(theme.palettes[mode].on_primary), selector: submitSelector });
              const style = await button.evaluate(element => { const s = getComputedStyle(element); return { background: s.backgroundColor, image: s.backgroundImage, color: s.color }; });
              assert.ok(style.background === rgb(primary) || style.image.includes(rgb(primary)), `${app}/${screen}: primary action must follow Office: ${JSON.stringify(style)}`);
              assert.equal(style.color, rgb(theme.palettes[mode].on_primary), `${app}/${screen}: action contrast`);
              if (app === 'frontend' || app === 'office') {
                const introText = page.locator(app === 'office' ? '.office-login-copy p:visible' : '.auth-split-copy p:visible');
                assert.equal(await introText.evaluate(element => getComputedStyle(element).color), rgb(theme.palettes[mode].on_primary));
              }
              const email = page.locator('input[type="email"]:visible').first();
              await email.fill('theme-fixture@example.test');
              assert.equal(await email.evaluate(element => getComputedStyle(element).color), rgb(theme.palettes[mode].text), `${app}/${screen}/${mode}: input must use Office text color`);
              await checkAutofill(page, theme.palettes[mode]);
              if (screen === 'reset') {
                await button.click();
                await page.locator('input[autocomplete="one-time-code"]:visible').waitFor();
                const password = page.locator('input[autocomplete="new-password"]:visible').first();
                await password.fill('theme-fixture-password');
                await page.screenshot({ path: path.join(output, `${app}-${screen}-${primary.slice(1)}-${mode}.png`), fullPage: true });
                // Public branding refresh updates the mounted recovery form without losing its draft.
                const next = '#a21caf';
                theme = { primary_color: next, theme_mode: mode, theme_version: 1001, palettes: runtime.makeThemePalettes(next) };
                await page.evaluate(() => window.dispatchEvent(new Event('mkpos:refresh-branding')));
                await page.waitForFunction(color => document.documentElement.style.getPropertyValue('--theme-primary').trim() === color, next);
                assert.equal(await password.inputValue(), 'theme-fixture-password');
                await page.locator('input[autocomplete="one-time-code"]:visible').fill('123456');
                await page.locator('input[autocomplete="new-password"]:visible').nth(1).fill('theme-fixture-password');
                await page.locator(submitSelector).filter({ visible: true }).first().click();
                await page.getByText(/Your password has been changed/).waitFor();
                // The next navigation uses the originally requested Office palette again.
                theme = { primary_color: primary, theme_mode: mode, theme_version: 1000, palettes: runtime.makeThemePalettes(primary) };
              } else {
                await page.screenshot({ path: path.join(output, `${app}-${screen}-${primary.slice(1)}-${mode}.png`), fullPage: true });
              }
              results.push({ app, screen, primary, mode, office_primary_verified: true, input_text_verified: true, autofill_verified: true });
            }
            assert.deepEqual(errors, [], `${app}: page errors`);
          } catch (error) {
            console.error('Auth page failure', app, primary, mode, errors, await page.locator('body').innerText());
            await page.screenshot({ path: path.join(output, `${app}-failure.png`), fullPage: true });
            throw error;
          } finally { await page.close(); }
        }
      } finally { await server.close(); }
    }
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ intercepted_apis_only: true, states: results, reset_theme_refresh_keeps_draft: true }, null, 2));
    console.log(JSON.stringify({ states_verified: results.length, apps: 4, reset_theme_refresh_keeps_draft: true, intercepted_apis_only: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
