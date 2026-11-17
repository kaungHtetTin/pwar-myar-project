// Fixture-only browser verification. No real shop records are changed.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.SHOP_SETUP_ORIGIN || 'http://127.0.0.1:5180';
const output = 'artifacts/web-shop-setup';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, height, language, mode, scenario] of [[1440,1000,'en','light'], [1280,900,'my','light'], [1440,1000,'en','dark'], [1024,900,'en','light'], [1024,900,'my','dark'], [1440,900,'en','light','configured']]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: language === 'my' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [], calls = [];
      const settings = { id: 91, display_name: 'My Tea Shop', slug: 'my-tea-shop', slug_locked: false, phone: '09123456789', address: '12 Market Road, Yangon', currency: 'Ks', price_type: 'Retail', price_types: ['Retail', 'Wholesale'], description: 'Tea, snacks and everyday essentials.', receipt_logo_data_url: '', cover_data_url: '', storefront_enabled: false, accepting_orders: true, marketplace_enabled: false, pickup_address: '12 Market Road', pickup_hours: '9 am – 6 pm', pickup_instructions: 'Collect at the counter.', opening_hours: [], announcement: '', closed_until: null, timezone: 'Asia/Yangon', location: { latitude: 16.8, longitude: 96.1 }, delivery_zones: [], payment_methods: [{ id: 'cash', name: 'Cash on delivery', type: 'cash', provider: 'manual', is_active: true, instructions: 'Pay on delivery or pickup.' }] };
      if (scenario !== 'configured') { settings.description = ''; settings.accepting_orders = false; settings.pickup_address = ''; settings.pickup_hours = ''; settings.pickup_instructions = ''; }
      const ai = { settings: { enabled: false, name: 'Mia', instructions: 'Help customers choose products. Ask the owner when unsure.', soul: 'Friendly, helpful and clear.', version: 1, tool_permissions: ['search_products'], sales_policies: {} }, wallet: { available: '0', reserved: '0' }, tools: [{ name: 'search_products', description: 'Find published products with current prices.' }, { name: 'create_cart', description: 'Build a cart with customer confirmation.' }] };
      const coverPreview = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="240"><rect width="900" height="240" fill="#0e684e"/><circle cx="780" cy="120" r="180" fill="#25866a"/><circle cx="780" cy="120" r="120" fill="#429c81"/><text x="48" y="130" font-family="sans-serif" font-size="42" fill="white">MY TEA SHOP</text></svg>').toString('base64')}`;
      const logoPreview = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="20" fill="#0e684e"/><text x="60" y="84" text-anchor="middle" font-family="sans-serif" font-size="76" fill="white">T</text></svg>').toString('base64')}`;
      const products = [{ id: 1, name: 'Green tea', category: 'Tea', stock: 40, base_unit: 'Piece', unit: 'base', base_price: 2500, price_type: 'Retail', currency: 'Ks', published: false }, { id: 2, name: 'Black tea', category: 'Tea', stock: 25, base_unit: 'Piece', unit: 'base', base_price: 0, price_type: 'Retail', currency: 'Ks', published: false }];
      let locationSubmitted = language === 'my' || scenario === 'configured', onboarding = null, shopConfigured = scenario === 'configured';
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 16.8, longitude: 96.1, accuracy: 10 });
      let failSettings = language === 'en' && mode === 'light';
      await context.addInitScript(({ mode }) => { localStorage.setItem('mkpos.language','en'); localStorage.setItem('mkpos.activeModule','shop'); localStorage.setItem('mkpos.themeMode',mode); sessionStorage.setItem('mkpos.variant-recommendation.dismissed','1'); }, { mode });
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4), method = req.method();
        calls.push({ path, method, query: url.search });
        let body = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false, unread_count: 0 };
        if (path === '/branding') body = { primary_color: '#0e684e', theme_mode: mode };
        else if (path === '/auth/me') body = { user: { id: 91, name: 'Fixture owner', role: 'owner' }, business: { id: 91, name: 'My Tea Shop', timezone: 'Asia/Yangon', currency: 'Ks' }, permissions: ['shop','products','settings'], subscription: { is_valid: true } };
        else if (path === '/settings') body = { language: 'en', theme_mode: mode, currency: 'Ks', shop_name: settings.display_name };
        else if (path === '/app-config') body = { enabled_modules: ['shop','products','settings'] };
        else if (path === '/business-setup') body = { progress: null };
        else if (path === '/shop-admin/owner-location') { if (method === 'POST') locationSubmitted = true; if (locationSubmitted && !onboarding && !shopConfigured) onboarding = { status: 'pending', step: 1 }; body = { submitted: locationSubmitted, location: locationSubmitted ? settings.location : null, setup: onboarding }; }
        else if (path === '/shop-admin/setup') { onboarding = req.postDataJSON(); body = { setup: onboarding }; }
        else if (path === '/shop-admin/settings') {
          if (method === 'PUT') {
            if (failSettings) { failSettings = false; return route.fulfill({ status: 422, json: { message: 'Check the shop name.', errors: { display_name: ['Enter the public shop name.'] } } }); }
            Object.assign(settings, req.postDataJSON()); shopConfigured = true;
          }
          body = settings;
        } else if (path === '/shop-admin/cover' && method === 'POST') {
          settings.cover_data_url = coverPreview; body = { cover_data_url: coverPreview };
        } else if (path === '/settings/logo' && method === 'POST') {
          settings.receipt_logo_data_url = logoPreview; body = { receipt_logo_data_url: logoPreview };
        } else if (path === '/shop-admin/sales-ai') {
          if (method === 'PUT') ai.settings = { ...req.postDataJSON(), version: ai.settings.version + 1 };
          body = ai;
        } else if (path === '/shop-admin/orders') {
          const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 25);
          body = { items: Array.from({ length: Math.min(limit, 60 - offset) }, (_, i) => ({ id: offset + i + 1, reference: `ONLINE-${offset + i + 1}`, customer_name: 'Tea customer', status: 'pending', payment_status: 'unpaid', fulfillment: 'pickup', total: 2500, currency: 'Ks', created_at: '2026-11-04 08:00:00', origin: 'storefront', events: [], request_count: 0 })), total: 60, has_more: offset + limit < 60 };
        } else if (path === '/shop-admin/publications') body = { items: products, total: products.length, published_count: products.filter(p => p.published).length, has_more: false };
        else if (path === '/shop-admin/publications/bulk') {
          const published = req.postDataJSON().published;
          if (published && products.some(product => !product.base_price)) return route.fulfill({ status: 422, json: { message: 'Set a valid online price first.' } });
          const changed = products.filter(product => product.published !== published);
          changed.forEach(product => { product.published = published; });
          body = { items: changed, updated: changed.length };
        } else if (/^\/shop-admin\/publications\/\d+$/.test(path)) {
          const product = products.find(p => p.id === Number(path.split('/').pop()));
          if (req.postDataJSON().published && !product.base_price) return route.fulfill({ status: 422, json: { message: 'Set a valid online price first.' } });
          Object.assign(product, req.postDataJSON()); body = product;
        } else if (method !== 'GET') throw new Error(`Unexpected mutation ${method} ${path}`);
        await route.fulfill({ json: body });
      });
      await page.goto(`${origin}/?page=shop&shopTab=orders`);
      if (scenario === 'configured') {
        await page.locator('.shop-side-tabs').waitFor();
        assert.equal(await page.locator('.shop-setup-page:visible').count(), 0, 'Configured shops open the workspace');
        assert.equal(await page.getByRole('button', { name: 'Shop setup', exact: true }).count(), 0);
        results.push({ scenario, excluded: true, errors }); await context.close(); continue;
      }
      if (!locationSubmitted) await page.getByRole('button', { name: 'Allow location and submit' }).click();
      const wizard = page.locator('.shop-setup-page');
      await wizard.locator('input[value="My Tea Shop"]').waitFor();
      await page.waitForFunction(mode => document.documentElement.dataset.theme === mode, mode);
      if (language === 'my') await wizard.getByRole('switch').click();
      async function shot(name) {
        const displayedStep = { details:1, 'branding-filled':1, payments:2, products:3, 'sales-ai':4, review:5, complete:5 }[name];
        if (displayedStep) assert.equal(new URL(page.url()).searchParams.get('shopSetupStep'),String(displayedStep),'Address-bar ID matches visible setup step');
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
        await page.evaluate(() => scrollTo(0, 0));
        if (name === 'payments' || name === 'products') {
          assert.ok(await wizard.locator('.shop-setup-heading > p').evaluate(node => node.getBoundingClientRect().height <= parseFloat(getComputedStyle(node).lineHeight) + 1), 'Payments and Products descriptions use one line');
          assert.equal(await wizard.locator('.shop-setup-slide > .shop-setup-help').count(), 0, 'No duplicate guidance paragraph');
        }
        if (name === 'payments') {
          const fields = await wizard.locator('.shop-setup-method .shop-setup-grid input').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()));
          assert.equal(fields.length,3);
          assert.ok(fields.every(field => Math.abs(field.top - fields[0].top) <= 1), 'Payment inputs align on one row');
        }
        if (name === 'review') {
          const options = await wizard.locator('.shop-setup-launch-options input').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
          assert.equal(options.length,3);
          assert.ok(options.every(top => Math.abs(top - options[0]) <= 1),'Review checkboxes align on one row');
          assert.equal(await wizard.locator('.shop-setup-launch-options small').count(),0,'No option descriptions');
        }
        if (name === 'details' || name === 'branding-filled') {
          const cover = await wizard.locator('.shop-cover-preview').boundingBox();
          assert.ok(Math.abs(cover.width / cover.height - 16 / 9) < 0.02, 'Cover preview uses a 16:9 frame');
          assert.ok(cover.width <= 320, 'Cover preview stays compact');
          const logo = await wizard.locator('.shop-logo-preview').boundingBox();
          const fields = await wizard.locator('.shop-setup-detail-fields').boundingBox();
          assert.ok(logo.y < cover.y + cover.height && logo.y + logo.height > cover.y + cover.height, 'Logo overlaps the cover edge');
          assert.ok(fields.x > cover.x + cover.width, 'Inputs occupy the right column');
          const inputs = await wizard.locator('.shop-setup-detail-fields input,.shop-setup-detail-fields textarea').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().left));
          assert.ok(inputs.every(left => Math.abs(left - inputs[0]) <= 1), 'Inputs stack on one aligned column');
        }
        await page.screenshot({ fullPage: true, path: `${output}/${width}-${language}-${mode}-${name}.png`, animations: 'disabled' });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal document overflow');
        assert.equal(await page.locator('.shop-setup-page form form').count(), 0, 'No nested forms');
        assert.equal(await wizard.locator('.shop-setup-topbar').count(), 0, 'No duplicate setup bar');
        assert.equal(await wizard.locator('.shop-setup-content .shop-setup-heading-actions').count(), 1, 'Locale and Close belong to the content header');
        assert.ok(await wizard.locator('.shop-setup-check input').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().width <= 20)), 'Checkboxes retain compact dimensions');
      }
      const form = wizard.locator('#shop-setup-form');
      const next = wizard.locator('.shop-setup-actions button[type=submit]');
      await shot('details');
      for (const label of ['Edit shop cover photo', 'Edit business logo']) {
        const chooser = page.waitForEvent('filechooser');
        const input = wizard.locator(label.includes('cover') ? '.shop-cover-row button' : '.shop-logo-row button');
        await input.click();
        await (await chooser).setFiles({ name: 'preview.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=', 'base64') });
        await wizard.locator(label.includes('cover') ? '.shop-cover-preview img' : '.shop-logo-preview img').waitFor();
      }
      await shot('branding-filled');
      await next.click();
      if (language === 'en' && mode === 'light') { await wizard.getByText('Enter the public shop name.').first().waitFor(); await next.click(); }
      await wizard.locator('.shop-setup-slide > button').waitFor();
      if (language === 'en' && mode === 'light') {
        await wizard.locator('.shop-setup-heading-actions > button').click();
        await page.locator('.shop-side-tabs').waitFor();
        await page.reload();
        await wizard.locator('.shop-setup-slide > button').waitFor();
        assert.equal(onboarding.step, 4, 'Resumes the saved step after reload');
        assert.equal(calls.filter(call => call.path === '/shop-admin/owner-location' && call.method === 'POST').length, 1, 'Does not request location again');
      }
      assert.equal(settings.storefront_enabled, false);
      assert.equal(await wizard.locator('.shop-operating-settings').count(), 0);
      assert.equal(await wizard.locator('.shop-setup-zone').count(), 0);
      await wizard.locator('.shop-setup-slide > button').waitFor();
      assert.equal(await wizard.locator('.shop-setup-method').count(), 0, 'Cash on delivery is hidden');
      await wizard.locator('.shop-setup-slide > button').click();
      const transfer = wizard.locator('.shop-setup-method').first();
      await transfer.locator('input').nth(0).fill('KPay'); await transfer.locator('input').nth(1).fill('Tea Shop'); await transfer.locator('input').nth(2).fill('099999999');
      await shot('payments'); await next.click();
      const green = wizard.getByRole('checkbox', { name: 'Publish Green tea online' }); await green.waitFor();
      await wizard.getByRole('checkbox', { name: 'Publish Black tea online' }).check();
      await wizard.getByText('Set a valid online price first.').waitFor();
      assert.equal(products[1].published, false);
      await green.check(); await page.waitForFunction(() => !document.querySelector('.shop-publication-progress'));
      const bulkButtons = wizard.locator('.shop-setup-publication-actions button');
      await bulkButtons.first().click();
      await wizard.locator('.shop-bulk-error').waitFor();
      assert.equal(products[1].published, false, 'Bulk price validation preserves publication state');
      products[1].base_price = 1250;
      await bulkButtons.first().click();
      await page.waitForFunction(() => !document.querySelector('.shop-admin > fieldset').disabled);
      assert.ok(products.every(product => product.published), 'Publishes all');
      await bulkButtons.nth(1).click();
      await page.waitForFunction(() => !document.querySelector('.shop-admin > fieldset').disabled);
      assert.ok(products.every(product => !product.published), 'Unpublishes all');
      await bulkButtons.first().click();
      await page.waitForFunction(() => !document.querySelector('.shop-admin > fieldset').disabled);
      const searchBox = await wizard.locator('.shop-setup-publication-actions input').boundingBox();
      const publishBox = await bulkButtons.first().boundingBox();
      const unpublishBox = await bulkButtons.nth(1).boundingBox();
      assert.ok(Math.abs(searchBox.y + searchBox.height - publishBox.y - publishBox.height) <= 1, 'Search and Publish all share a baseline');
      assert.ok(Math.abs(publishBox.y - unpublishBox.y) <= 1, 'Both actions remain on one row');
      await shot('products'); await next.click();
      const enable = wizard.locator('.shop-setup-feature [role=switch]');
      await enable.click();
      assert.equal(await enable.getAttribute('aria-checked'), 'true');
      await enable.press('Space');
      assert.equal(await enable.getAttribute('aria-checked'), 'false');
      await enable.press('Enter');
      assert.equal(await enable.getAttribute('aria-checked'), 'true');
      await wizard.locator('.shop-setup-slide .shop-setup-field input').fill('Tea assistant');
      assert.equal(await wizard.locator('.shop-setup-slide textarea,.shop-setup-slide details').count(), 0, 'AI setup only asks for a name');
      await shot('sales-ai'); await next.click();
      await wizard.locator('.shop-setup-review').waitFor();
      assert.equal(ai.settings.enabled, true);
      assert.equal(ai.settings.name, 'Tea assistant');
      assert.equal(ai.settings.instructions, 'Help customers choose products. Ask the owner when unsure.');
      assert.deepEqual(ai.settings.tool_permissions, ['search_products']);
      assert.equal(settings.storefront_enabled, false);
      assert.equal(await wizard.locator('.shop-setup-launch-options input:checked').count(), 3, 'All launch options are checked by default');
      assert.equal(await wizard.locator('.shop-setup-publication-summary').count(), 0, 'Review excludes the product summary');
      await shot('review'); await next.click();
      await wizard.locator('.shop-setup-complete').waitFor();
      assert.equal(settings.storefront_enabled, true); assert.equal(settings.accepting_orders, true); assert.equal(settings.marketplace_enabled, true); assert.equal(settings.payment_methods.length, 2); assert.equal(settings.delivery_zones.length, 0); assert.equal(products[0].published, true);
      await shot('complete');
      assert.equal(await wizard.locator('.shop-setup-complete button').count(),1);
      assert.equal(onboarding.status, 'complete');
      await wizard.locator('.shop-setup-complete button').click();
      assert.equal(new URL(page.url()).searchParams.get('shopTab'),'orders');
      await page.locator('.shop-side-tabs').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Shop setup', exact: true }).count(), 0, 'No setup navigation entry');
      await page.reload();
      await page.locator('.shop-side-tabs').waitFor();
      assert.equal(await page.locator('.shop-setup-page:visible').count(), 0, 'Completed setup stays closed on reload');
      assert.deepEqual(errors, []);
      results.push({ width, language, mode, completed: true, existingLocation: language === 'my', savedPublication: products[0].published, enabledSalesAi: ai.settings.enabled, errors });
      await context.close();
    }
    await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
