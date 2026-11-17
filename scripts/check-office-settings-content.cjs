const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');
(async () => {
  const source = await fs.readFile('shared/theme/themeRuntime.js', 'utf8');
  const { makeThemePalettes } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const branding = { primary_color: '#ff8800', theme_mode: 'light', theme_version: 1, palettes: makeThemePalettes('#ff8800') };
  let settings = { enabled: true, configured: true, model: 'deepseek-flash', weekly_limit: 50, max_tokens: 1600, usd_to_mmk_rate: '4200.125', sales_ai_markup_percent: '5.00' }, saves = 0, keySaves = 0;
  const keyTests = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.includes('/api/')) return route.continue();
      const path = pathname.slice(pathname.indexOf('/api/') + 4);
      let data = { items: [], total: 0, last_page: 1 };
      if (path === '/branding' || path === '/office/branding') data = branding;
      if (path === '/office/auth/me') data = { admin: { id: 1, name: 'Theme admin', email: 'admin@example.test', role: 'super_admin' } };
      if (path === '/office/ai-assistant') {
        if (route.request().method() === 'PUT') { settings = { ...settings, ...route.request().postDataJSON() }; saves++; }
        data = { settings };
      }
      if (path === '/office/ai-assistant/test-connection') { keyTests.push(route.request().postDataJSON()); data = { message: 'Connection successful.' }; }
      if (path === '/office/ai-assistant/api-key') { keySaves++; data = { settings }; }
      return route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5175/#/settings/theme');
    const primary = page.getByLabel('Primary HEX'); await primary.waitFor();
    await primary.fill('#4f46e5'); const original = await primary.elementHandle();
    const panel = page.locator('.office-settings-panel');
    assert.equal(await panel.locator('.office-brand-assets-section').evaluate(node => Boolean(node.compareDocumentPosition(node.nextElementSibling) & Node.DOCUMENT_POSITION_FOLLOWING) && node.nextElementSibling.classList.contains('office-theme-settings')), true);
    assert.equal(await panel.getByRole('img', { name: /^Current / }).count(), 3);
    const chooser = page.waitForEvent('filechooser');
    await panel.locator('.office-brand-asset-upload').first().click();
    const fileChooser = await chooser;
    await fileChooser.setFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await page.getByRole('alert').filter({ hasText: 'Images must be 2 MB or smaller.' }).waitFor();
    const flat = async () => assert.deepEqual(await panel.locator('.office-branding-panel:visible').evaluate(node => {
      const s = getComputedStyle(node); return [s.borderTopWidth, s.boxShadow, s.paddingTop];
    }), ['0px', 'none', '18px']);
    await flat();
    await panel.screenshot({ path: 'artifacts/platform-theme/settings-branding-content.png', animations: 'disabled' });
    const tabs = page.getByRole('navigation', { name: 'Settings sections' });
    await tabs.getByRole('button', { name: /^AI assistant/ }).click();
    await page.getByLabel('DeepSeek model').waitFor(); await flat();
    await page.getByLabel('Weekly requests per user').fill('30');
    await page.getByLabel('USD to MMK exchange rate').fill('4300.5');
    assert.equal(await page.getByLabel('Platform markup (%)', { exact: true }).inputValue(), '5.00');
    await page.getByLabel('Platform markup (%)', { exact: true }).fill('7.5');
    await panel.screenshot({ path: 'artifacts/platform-theme/settings-ai-content.png', animations: 'disabled' });
    await tabs.getByRole('button', { name: /^Theme & branding/ }).click();
    assert.equal(await original.evaluate(node => node.isConnected), true);
    assert.equal(await primary.inputValue(), '#4f46e5');
    await tabs.getByRole('button', { name: /^AI assistant/ }).click();
    assert.equal(await page.getByLabel('Weekly requests per user').inputValue(), '30');
    assert.equal(await page.getByLabel('USD to MMK exchange rate').inputValue(), '4300.5');
    assert.equal(await page.getByLabel('Platform markup (%)', { exact: true }).inputValue(), '7.5');
    await page.getByRole('button', { name: 'Save assistant settings', exact: true }).click();
    await page.getByText('AI assistant settings saved.', { exact: true }).waitFor();
    assert.equal(saves, 1); assert.equal(settings.weekly_limit, 30);
    assert.equal(settings.usd_to_mmk_rate, '4300.5');
    assert.equal(settings.sales_ai_markup_percent, '7.5');
    const keyInput = page.getByLabel('New API key');
    assert.equal(await keyInput.getAttribute('type'), 'password');
    assert.equal(await keyInput.inputValue(), '');
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await page.getByText('Connection successful.', { exact: true }).waitFor();
    assert.deepEqual(keyTests[0], {});
    await keyInput.fill('sk-browser-synthetic-example');
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await page.getByText('Connection successful.', { exact: true }).waitFor();
    assert.equal(keyTests[1].api_key, 'sk-browser-synthetic-example'); assert.equal(keySaves, 0);
    await page.getByRole('button', { name: 'Replace key', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByText('API key replaced.', { exact: true }).waitFor();
    assert.equal(keySaves, 1); assert.equal(await keyInput.inputValue(), '');
    await panel.screenshot({ path: 'artifacts/platform-theme/settings-ai-key-content.png', animations: 'disabled' });
    console.log('Settings containers and retained drafts passed. AI Save, saved/draft connection tests and keyboard key replacement submit once; replacement clears the masked field. Writes and provider calls mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
