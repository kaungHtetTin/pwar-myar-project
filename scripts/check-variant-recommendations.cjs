const { chromium, webkit } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/app-variant-recommendation');
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const app of ['web', 'mobile']) {
        const origin = `http://127.0.0.1:${app === 'web' ? 8184 : 8186}`;
        const target = app === 'web' ? 'https://mobilepos.pwarmyar.com/login' : 'https://pos.pwarmyar.com/login';
        const title = app === 'web' ? 'Use PwarMyar Mobile?' : 'Use PwarMyar for large screens?';
        const primary = app === 'web' ? 'Open mobile app' : 'Open web app';
        for (const width of [320, 393, 767, 768, 1024, 1199, 1200, 1440]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
          await context.route('https://www.pwarmyar.com/public/api/**', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } }));
          await context.route(target, route => route.fulfill({ contentType: 'text/html', body: '<h1>Target app fixture</h1>' }));
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(`${origin}/login`);
          await page.locator('input[type="password"]').first().waitFor();
          const visible = app === 'web' ? width < 768 : width >= 1200;
          const dialog = page.getByRole('dialog', { name: title, exact: true });
          assert.equal(await dialog.isVisible(), visible, `${engineName} ${app} ${width}`);
          if (visible) {
            assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'Focus stays inside the modal after authentication loading');
            const rect = await dialog.boundingBox();
            assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
            await page.screenshot({ path: path.join(output, `${engineName}-${app}-${width}.png`) });
            await dialog.getByRole('button', { name: 'Stay here', exact: true }).click();
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(page.url(), `${origin}/login`);
            await page.reload();
            await page.locator('input[type="password"]').first().waitFor();
            assert.equal(await dialog.isVisible(), false, 'Dismissed for the tab session');
            await page.evaluate(() => sessionStorage.clear());
            await page.reload();
            await dialog.waitFor();
            await dialog.getByRole('button', { name: primary, exact: true }).click();
            await page.waitForURL(target);
            assert.equal(page.url(), target);
            await page.goBack();
            await page.locator('input[type="password"]').first().waitFor();
            assert.equal(await dialog.isVisible(), false, 'Back does not repeat the accepted recommendation');
          }
          assert.deepEqual(errors, []);
          results.push({ engine: engineName, app, width, recommendation: visible, passed: true });
          await context.close();
        }
        // Resizing must not clear an entered value when the recommendation is dismissed.
        const context = await browser.newContext({ viewport: { width: 1024, height: 900 }, serviceWorkers: 'block' });
        await context.route('https://www.pwarmyar.com/public/api/**', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } }));
        const page = await context.newPage();
        await page.goto(`${origin}/login`);
        const email = page.locator('input[type="email"]');
        await email.fill('draft@example.test');
        await page.setViewportSize({ width: app === 'web' ? 393 : 1440, height: 900 });
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await email.inputValue(), 'draft@example.test');
        assert.equal(page.url(), `${origin}/login`);
        await context.close();
        console.log(`PASS ${engineName} ${app}: eight viewport boundaries, switch, dismissal, refresh, Escape, draft retention`);
      }
    } finally { await browser.close(); }
  }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
