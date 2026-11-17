// Synthetic fixtures only. Support links are inspected, never opened or sent.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { setDrawerLanguage } = require('./drawer-language.cjs');
const origin = 'http://127.0.0.1:5176';
(async () => {
  const engine = process.env.DELETION_BROWSER || 'chromium';
  const output = path.resolve(__dirname, `../artifacts/account-deletion/${engine}`);
  await fs.mkdir(output, { recursive: true });
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), calls = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route(`${origin}/api/**`, async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname.slice(4);
    calls.push({ endpoint, method: req.method() });
    assert.equal(req.method(), 'GET', `Unexpected mutation: ${endpoint}`);
    let body = {};
    if (endpoint === '/auth/me') body = { user: { id: 111, name: 'Fixture Owner', email: 'owner@example.test', role: 'owner' }, business: { id: 111, name: 'Test Shop' }, permissions: ['settings'], subscription: { is_valid: true } };
    if (endpoint === '/app-config') body = { enabled_modules: ['settings'], permissions: ['settings'] };
    if (endpoint === '/settings') body = { shop_name: 'Test Shop', language: 'en', payment_methods: 'Cash', price_types: 'Retail' };
    if (endpoint === '/contact-settings') body = { phone_numbers: ['09682537158'], viber_numbers: ['09682537158'], telegram_url: 'https://t.me/moekaungdev' };
    await route.fulfill({ json: body });
  });
  try {
    for (const width of [320, 375]) for (const language of ['en', 'my']) {
      await page.setViewportSize({ width, height: 667 });
      await page.goto(`${origin}/account-deletion`);
      await page.evaluate(lang => localStorage.setItem('mkpos.language', lang), language);
      await page.reload();
      await page.locator('.account-deletion-request').waitFor();
      await page.locator('input[type=email]').fill('owner@example.test');
      await page.locator('.account-deletion-request input').nth(1).fill('Test Shop');
      assert.ok((await page.locator('textarea').inputValue()).includes('Business: Test Shop'));
      assert.equal(await page.locator('.account-deletion-contacts a[href^="https://t.me/"]').getAttribute('href'), 'https://t.me/moekaungdev');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `public-${language}-${width}.png`), fullPage: true });
    }
    assert.ok(!calls.some(call => call.endpoint === '/auth/me'), 'Public page must not require authentication');
    await page.evaluate(() => localStorage.setItem('mkpos.language', 'en'));
    await page.goto(`${origin}/settings/account`);
    const name = page.getByLabel('Owner name', { exact: true });
    await name.fill('Unsaved owner draft');
    const before = calls.length;
    await page.getByRole('button', { name: 'Request account deletion', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Request account deletion', exact: true });
    await sheet.waitFor();
    assert.equal(await sheet.getByLabel('Account email', { exact: true }).inputValue(), 'owner@example.test');
    await page.screenshot({ path: path.join(output, 'in-app-top.png'), animations: 'disabled' });
    await sheet.getByRole('link', { name: 'Public account-deletion page' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'in-app-bottom.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 400 });
    const email = sheet.getByLabel('Account email', { exact: true });
    await email.focus();
    await email.scrollIntoViewIfNeeded();
    const field = await email.boundingBox();
    assert.ok(field.y >= 0 && field.y + field.height <= 400, 'Focused field must remain reachable with reduced keyboard space');
    await page.screenshot({ path: path.join(output, 'in-app-reduced-height.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    assert.equal(await name.inputValue(), 'Unsaved owner draft');
    assert.equal(calls.length, before, 'Opening and closing must not reload account data');
    await page.setViewportSize({ width: 320, height: 667 });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'အကောင့်ဖျက်ရန် တောင်းဆိုမည်', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'in-app-my-320.png'), animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, engine, publicWidths: [320, 375], languages: ['en', 'my'], inAppMyanmar: true, reducedHeightFocus: true, sourceDraftRetained: true, mutationCount: 0 }, null, 2));
    console.log(`${engine}: public and in-app deletion request checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
