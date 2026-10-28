const { setDrawerLanguage } = require('./drawer-language.cjs');
// Fixture APIs only; live shop settings are never modified.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176', output = path.resolve('artifacts/shop-fulfillment-reference');
const engine = process.env.FULFILLMENT_BROWSER || 'chromium';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await (engine === 'firefox' ? firefox : chromium).launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    const session = { user: { id: 301, role: 'owner', name: 'Owner' }, business: { id: 301, name: 'Evergreen Market', currency: 'MMK' }, permissions: ['shop', 'sell', 'products', 'sales', 'ecommerce_settings'], subscription: { is_valid: true } };
    let settings = { slug: 'evergreen', address: 'Main shop address', description: '', price_type: 'Retail', storefront_enabled: true, accepting_orders: true, marketplace_enabled: true, delivery_zones: [{id:'city',name:'City',fee:3000}], opening_hours: [], closed_until: null, pickup_address: '24 Market Street', pickup_hours: '09:00 – 18:00', pickup_instructions: 'We confirm orders before packing.' };
    let fail = true; const calls = [], errors = [];
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route(`${origin}/api/**`, async route => {
      const request = route.request(), endpoint = new URL(request.url()).pathname.slice(4), method = request.method();
      calls.push({ endpoint, method }); let data = { items: [], total: 0 };
      if (endpoint === '/auth/me') data = session;
      else if (endpoint === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') data = { currency: 'MMK', language: 'en' };
      else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
      else if (endpoint === '/shop-admin/settings') {
        if (method === 'PUT') {
          const input = request.postDataJSON(); assert.equal(input.delivery_zones[0].fee, 4500, 'Save preserves independently changed delivery fee');
          assert.equal(input.pickup_address, 'Collection counter, second floor');
          assert.equal(input.pickup_hours, '10:00 – 17:00');
          assert.ok(!('address' in input), 'Pickup does not overwrite business profile');
          assert.ok(!('payment_methods' in input), 'Pickup does not overwrite payment configuration');
          if (fail) { fail = false; return route.fulfill({ status: 422, json: { message: 'Please review pickup hours.', errors: { pickup_hours: ['Please review pickup hours.'] } } }); }
          settings = { ...settings, ...input };
        }
        data = settings;
      }
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const field = name => page.getByRole('textbox', { name, exact: true });
    async function shot(name) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' }); }
    await page.goto(`${origin}/shop`);
    const source = page.locator('.shop-overview-page'); await source.waitFor(); await source.evaluate(node => node.dataset.retention = 'kept');
    await page.getByRole('button', { name: /^Fulfillment/ }).click(); await field('Pickup address').waitFor();
    await shot('102');
    for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await shot(`102-${width}`); }
    await page.setViewportSize({ width: 393, height: 817 });
    await page.locator('.fulfillment-buyer-preview').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await shot('buyer-preview');
    const preview = await page.locator('.fulfillment-buyer-preview').boundingBox(), footer = await page.locator('.shop-fulfillment-actions').boundingBox(); assert.ok(preview.y + preview.height <= footer.y + 1, 'Preview scrolls above fixed action');
    await field('Pickup address').fill('Collection counter, second floor'); await field('Pickup hours').fill('10:00 – 17:00'); await field('Instructions for buyers').fill('Bring your order reference.');
    await page.locator('.fulfillment-buyer-preview').getByText('Bring your order reference.', { exact: true }).waitFor();
    const before = calls.length;
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await source.waitFor(); assert.equal(await source.getAttribute('data-retention'), 'kept'); assert.equal(calls.length, before, 'Back does not fetch');
    await page.goForward(); await field('Pickup address').waitFor(); assert.equal(await field('Pickup address').inputValue(), 'Collection counter, second floor'); assert.equal(calls.length, before, 'Forward resumes draft');
    settings.delivery_zones[0].fee = 4500;
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('Please review pickup hours.', { exact: true }).last().waitFor();
    assert.equal(await field('Instructions for buyers').inputValue(), 'Bring your order reference.'); assert.equal(await field('Pickup hours').getAttribute('aria-invalid'), 'true'); await shot('save-error');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForURL('**/shop'); assert.equal(calls.filter(call => call.method === 'PUT').length, 2);
    await page.goto(`${origin}/shop/fulfillment`); await field('Pickup address').waitFor(); await field('Instructions for buyers').fill('Long preparation instructions. '.repeat(60)); await page.setViewportSize({width:320,height:817}); await page.locator('.fulfillment-buyer-preview').evaluate(node=>node.scrollIntoView({block:'end',behavior:'instant'})); await shot('long-preview-320'); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); await page.waitForFunction(() => document.documentElement.lang === 'my'); await page.locator('.shop-fulfillment-form').evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'})); await shot('myanmar');
    assert.deepEqual(errors, []); await fs.writeFile(path.join(output, `verification-${engine}.json`), JSON.stringify({widths:[320,393,768], checks:['Reference layout','Live preview','Scrollable footer clearance','Source and draft retention','Preserved unrelated settings','Field error and retry','Myanmar and long content'], errors},null,2));
    console.log(`Shop fulfillment ${engine} checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
