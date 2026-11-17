// Fixture APIs only; never changes live subscriptions.
const { chromium } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.MOBILE_ORIGIN || 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../../artifacts/paid-renewal-banner');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const language of ['en', 'my']) for (const width of [320, 768]) for (const days of [7, 3]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(lang => localStorage.setItem('mkpos.language', lang), language);
      const page = await context.newPage();
      const urgent = days <= 3;
      const session = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'Ks' },
        permissions: ['sell', 'products', 'sales', 'settings', 'billing'], subscription: {
          is_valid: true, can_mutate: true, access_type: 'paid', days_remaining: days, ends_at: '2030-05-01T00:00:00Z',
          lifecycle_notice: { code: 'subscription_ending', stage: urgent ? 'warning' : 'reminder',
            title: urgent ? 'Your plan expires very soon.' : 'Your plan is ending soon.',
            message: urgent ? 'Renew now to avoid an interruption when your current plan expires.' : 'Renew your plan before it expires to continue using the service.' },
        } };
      await context.route(`${origin}/api/**`, async route => {
        const endpoint = new URL(route.request().url()).pathname.slice(4);
        let body = { items: [], total: 0 };
        if (endpoint === '/auth/me') body = session;
        else if (endpoint === '/app-config') body = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
        else if (endpoint === '/subscription') body = session.subscription;
        else if (endpoint === '/settings') body = { currency: 'Ks', price_types: 'Retail', payment_methods: 'Cash' };
        else if (endpoint === '/products/summary') body = { total_products: 0, low_stock: 0, total_stock_units: 0, out_of_stock: 0 };
        else if (endpoint === '/categories') body = [];
        else if (endpoint === '/price-types') body = { items: ['Retail'], rules: [] };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/products`);
      const banner = page.locator('.mobile-trial-banner');
      await banner.waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await banner.evaluate((node, expected) => node.classList.contains(expected), urgent ? 'is-warning' : 'is-reminder'));
      assert.ok((await banner.textContent()).includes(language === 'my' ? `${days} ရက်ကျန်` : `${days} days remaining`));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const rect = await banner.boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      const button = banner.getByRole('button');
      assert.ok((await button.boundingBox()).height >= 44);
      await page.screenshot({ path: path.join(output, `${language}-${width}-${days}-days.png`), animations: 'disabled' });
      await button.click();
      await page.waitForURL('**/billing');
      await page.goBack();
      await page.waitForURL('**/products');
      await banner.waitFor();
      results.push({ language, width, days, billingAndBack: true });
      await context.close();
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`${results.length} paid renewal banner cases passed, including Billing and browser Back.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
