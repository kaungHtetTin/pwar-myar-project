const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('../shop/node_modules/playwright');
(async () => {
  const source = await fs.readFile('shared/theme/themeRuntime.js', 'utf8');
  const { makeThemePalettes } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let branding;
    let initialSettingsReads = 0;
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.includes('/api/')) return route.continue();
      const path = pathname.split('/api')[1];
      if (path === '/office/settings') initialSettingsReads++;
      const data = path === '/branding' || path === '/office/branding' ? branding
        : path === '/office/auth/me' ? { admin: { id: 1, name: 'Theme admin', email: 'admin@example.test', role: 'super_admin' } }
          : path?.includes('founders') ? { items: [], founders: [], total: 0 }
            : { items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
      return route.fulfill({ json: data });
    });
    for (const primary of ['#ff8800', '#4f46e5', '#ffff00']) for (const mode of ['light', 'dark']) {
      branding = { primary_color: primary, theme_mode: mode, theme_version: Date.now(), palettes: makeThemePalettes(primary) };
      await page.goto('about:blank');
      await page.goto('http://127.0.0.1:5175/#/settings/account');
      await page.getByRole('button', { name: 'Collapse navigation', exact: true }).waitFor();
      await page.waitForFunction(({ mode, primary }) => document.documentElement.dataset.theme === mode && document.documentElement.style.getPropertyValue('--theme-primary') === primary, { mode, primary });
      const item = page.locator('.office-sidebar nav button').filter({ hasText: 'Platform users' });
      await item.hover();
      await page.screenshot({ path: `artifacts/platform-theme/office-nav-${primary.slice(1)}-${mode}.png`, animations: 'disabled' });
      const check = async (locator, foreground, background) => {
        const actual = await locator.evaluate(node => {
          const style = getComputedStyle(node), root = getComputedStyle(document.documentElement);
          const resolve = key => { const el = document.createElement('span'); el.style.color = root.getPropertyValue(key); document.body.append(el); const value = getComputedStyle(el).color; el.remove(); return value; };
          return { color: style.color, background: style.backgroundColor, selected: resolve('--theme-sidebar-selected-text'), selectedBg: resolve('--theme-sidebar-selected'), text: resolve('--theme-text'), surface: resolve('--theme-surface') };
        });
        assert.equal(actual.color, actual[foreground]); assert.equal(actual.background, actual[background]);
      };
      await check(item, 'selected', 'selectedBg');
      await page.mouse.move(1000, 100); await item.focus();
      await check(item, 'selected', 'selectedBg');
      const collapse = page.getByRole('button', { name: 'Collapse navigation', exact: true });
      await check(collapse, 'text', 'surface');
      await collapse.click(); await page.getByRole('button', { name: 'Expand navigation', exact: true }).click();
      const settings = await page.locator('.office-settings-workspace').elementHandle();
      const reads = initialSettingsReads;
      await page.locator('.office-sidebar nav button').filter({ hasText: /^Founders$/ }).click();
      const back = page.locator('.office-appbar-back'); await back.waitFor();
      await check(back, 'text', 'surface');
      await back.focus(); await page.keyboard.press('Enter');
      await page.waitForURL('**/#/settings/account');
      if (settings) assert.equal(await settings.evaluate(node => node.isConnected), true);
      assert.equal(initialSettingsReads, reads);
    }
    console.log('Office navigation hover/focus and app-bar contrast passed for 3 primaries in both modes. Collapse/expand and keyboard Back preserve the Settings route without additional settings reads.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
