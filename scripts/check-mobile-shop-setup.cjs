// All writes are intercepted fixtures; no real shop records are changed.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const output = path.resolve('artifacts/mobile-shop-setup');
const origin = process.env.SHOP_SETUP_ORIGIN || 'http://127.0.0.1:5184';
(async () => {
  const { SHOP_MESSAGES } = await import(pathToFileURL(path.resolve('mobile/src/shop/shopLocale.js')));
  const { SHOP_ADDITIONAL_MESSAGES } = await import(pathToFileURL(path.resolve('mobile/src/shop/shopAdditionalLocale.js')));
  const { SHOP_SETUP_MESSAGES } = await import(pathToFileURL(path.resolve('mobile/src/shop/shopSetupLocale.js')));
  const messages = { ...SHOP_MESSAGES, ...SHOP_ADDITIONAL_MESSAGES, ...SHOP_SETUP_MESSAGES };
  const browser = await chromium.launch({ headless: true });
  const results = [];
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, language, mode, scenario = 'flow'] of [[390,'en','light'], [320,'en','light'], [390,'my','light'], [768,'en','dark'], [390,'en','light','configured'], [390,'en','light','staff'], [390,'en','light','gps'], [320,'my','light','gps'], [768,'en','dark','gps'], [390,'en','light','resume']]) {
      if (process.env.SHOP_SETUP_ONLY && process.env.SHOP_SETUP_ONLY !== scenario) continue;
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: width === 320 ? 'reduce' : 'no-preference', serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 16.8661, longitude: 96.1951 } });
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      const calls = [], errors = [];
      const t = value => language === 'my' ? messages[value] || value : value;
      const settings = { display_name: 'Mobile Corner Shop', slug: 'mobile-corner-shop', phone: '09123456789', address: 'No. 32 Market Road, Yangon', currency: 'Ks', description: '', price_type: 'Retail', price_types: ['Retail'], pickup_address: '', pickup_hours: '', pickup_instructions: '', opening_hours: {}, announcement: 'Keep announcement', delivery_zones: [], payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash', provider: 'manual', is_active: true }], storefront_enabled: false, accepting_orders: false, marketplace_enabled: false };
      let progress = scenario === 'configured' ? { status: 'complete', step: 7, version: 2 } : { status: 'pending', step: scenario === 'resume' ? 6 : 1, version: 2 };
      let submitted = scenario !== 'gps';
      let failSettings = scenario === 'flow' && width === 390 && language === 'en';
      let failBulk = failSettings, failFinish = failSettings;
      let ai = { settings: { enabled: false, name: 'Shop assistant', instructions: 'Preserve tools and instructions', soul: 'Preserve personality', tool_permissions: { catalog: true }, sales_policies: {}, version: 4 }, wallet: { available: 0 } };
      const products = Array.from({ length: 45 }, (_, index) => ({ id: index + 1, name: `Tea ${String(index + 1).padStart(2,'0')}`, category: 'Groceries', stock: 85, base_unit: 'Piece', base_price: 1500, purchase_price: 15000, unit: 'base', price_type: 'Retail', currency: 'Ks', published: false }));
      const session = { user: { id: 91, role: scenario === 'staff' ? 'staff' : 'owner', name: 'Fixture owner' }, business: { id: 91, name: settings.display_name, currency: 'Ks', timezone: 'Asia/Yangon' }, permissions: ['shop','sell','products','settings','ecommerce_orders','ecommerce_catalog','ecommerce_settings'], subscription: { is_valid: true } };
      await context.addInitScript(({ language }) => { localStorage.setItem('mkpos.language', language); sessionStorage.setItem('mkpos.variant-recommendation.dismissed', '1'); }, { language });
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await context.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname.slice(4), method = request.method();
        calls.push({ endpoint, method, query: url.search, body: method === 'PUT' ? request.postDataJSON() : undefined });
        let response = { items: [], total: 0, enabled: false, realtime_enabled: false };
        if (endpoint === '/auth/me') response = session;
        else if (endpoint === '/branding') response = { primary_color: '#087f74', theme_mode: mode };
        else if (endpoint === '/app-config') response = { enabled_modules: session.permissions, permissions: session.permissions, business: session.business, language };
        else if (endpoint === '/business-setup') response = { progress: null };
        else if (endpoint === '/settings') response = { shop_name: settings.display_name, currency: 'Ks', payment_methods: 'Cash', price_types: 'Retail', language };
        else if (endpoint === '/categories') response = [];
        else if (endpoint === '/price-types') response = { items: ['Retail'], rules: [] };
        else if (endpoint === '/shop-admin/owner-location') { if (method === 'POST') submitted = true; response = { submitted, setup: submitted ? progress : null, location: submitted ? { latitude:16.8661, longitude:96.1951 } : null }; }
        else if (endpoint === '/shop-admin/setup') { if (failFinish && request.postDataJSON().status === 'complete') { failFinish = false; return route.fulfill({ status:422, json:{message:'Fixture completion error'} }); } progress = request.postDataJSON(); response = { setup: progress }; }
        else if (endpoint === '/shop-admin/settings') { if (method === 'PUT') { if (failSettings) { failSettings = false; return route.fulfill({status:422,json:{message:'Check phone',errors:{phone:['Fixture phone validation']}}}); } Object.assign(settings, request.postDataJSON()); } response = settings; }
        else if (endpoint === '/shop-admin/sales-ai') { if (method === 'PUT') ai = { ...ai, settings: request.postDataJSON() }; response = ai; }
        else if (endpoint === '/shop-admin/cover' || endpoint === '/settings/logo') {
          const key = endpoint.endsWith('cover') ? 'cover_data_url' : 'receipt_logo_data_url';
          const svg = key === 'cover_data_url' ? '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#175c52"/><circle cx="590" cy="70" r="210" fill="#237a68"/><circle cx="610" cy="30" r="150" fill="#369780"/><text x="40" y="190" fill="white" font-family="sans-serif" font-size="38">Mobile Market</text></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#f4c66b"/><text x="60" y="85" text-anchor="middle" fill="#175c52" font-family="sans-serif" font-size="80">M</text></svg>';
          settings[key] = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
          response = { [key]: settings[key] };
        } else if (endpoint.startsWith('/shop-admin/publications')) {
          const q = url.searchParams.get('q') || '', filtered = products.filter(product => product.name.toLowerCase().includes(q.toLowerCase()));
          if (method === 'PUT') {
            if (failBulk) { failBulk = false; return route.fulfill({status:422,json:{message:'Fixture invalid product price'}}); }
            const patch = request.postDataJSON(), id = Number(endpoint.split('/').at(-1));
            const matching = endpoint.endsWith('/bulk') ? filtered : products.filter(product => product.id === id);
            matching.forEach(product => Object.assign(product, patch));
            response = endpoint.endsWith('/bulk') ? { updated: matching.length, items: matching } : matching[0];
          } else { const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20); response = { items: filtered.slice(offset, offset + limit), total: filtered.length, has_more: offset + limit < filtered.length }; }
        }
        await route.fulfill({ status: 200, json: response });
      });
      const wizard = page.locator('.mobile-shop-setup');
      const button = name => wizard.getByRole('button', { name: t(name), exact: true });
      const field = name => wizard.getByLabel(t(name), { exact: true });
      const heading = name => wizard.getByRole('heading', { name: t(name), exact: true });
      const shot = async name => {
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => scrollTo(0,0));
        await page.screenshot({ path: `${output}/${width}-${mode}-${language}-${scenario}-${name}.png`, fullPage: true, animations: 'disabled' });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal document overflow');
        assert.equal(await page.locator('.shared-app-bar').count(), 1, 'One shared app bar');
        assert.equal(await page.getByRole('region', { name: 'Pull to refresh page' }).count(), 1, 'Shared refresh shell');
        const smallTargets = await wizard.locator('button:visible,input.ui-input:visible,select:visible').evaluateAll(nodes => nodes.filter(node => (node.closest('.ui-search') || node).getBoundingClientRect().height < 43.9).map(node => ({ text:node.textContent, height:node.getBoundingClientRect().height })));
        assert.deepEqual(smallTargets, [], '44px touch targets');
        const footer = wizard.locator('.mobile-shop-setup-actions');
        if (await footer.count()) {
          assert.ok(await footer.evaluate(node => Math.abs(node.getBoundingClientRect().bottom - innerHeight) <= 1), 'Actions pinned to viewport bottom');
          await page.evaluate(() => scrollTo(0,document.documentElement.scrollHeight));
          const clear = await wizard.evaluate(node => {
            const bar = node.querySelector('.mobile-shop-setup-actions').getBoundingClientRect();
            const fields = [...node.querySelectorAll('fieldset input,fieldset textarea,fieldset select,.mobile-shop-setup-product')].filter(item => item.getClientRects().length && item.getBoundingClientRect().height > 0);
            return !fields.length || fields.at(-1).getBoundingClientRect().bottom <= bar.top;
          });
          assert.ok(clear,'Final form control clears pinned actions');
          await page.evaluate(() => scrollTo(0,0));
        }
      };
      await page.goto(`${origin}/shop`);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${output}/debug-entry.png`, fullPage:true });
      await fs.writeFile(`${output}/debug-entry.json`, JSON.stringify({url:page.url(),calls,errors,text:await page.locator('body').innerText()},null,2));
      if (scenario === 'configured' || scenario === 'staff') {
        await page.locator('.shop-overview-page').waitFor();
        assert.equal(await wizard.count(), 0);
        assert.equal(calls.filter(call => call.endpoint === '/shop-admin/settings').length, 0);
      } else {
        if (scenario === 'gps') {
          const locate = page.getByRole('button', { name: t('Allow location and save'), exact: true });
          await locate.waitFor(); await page.evaluate(() => document.fonts.ready);
          await page.screenshot({path:`${output}/${width}-${mode}-${language}-location.png`, fullPage:true});
          assert.equal(await page.locator('.shop-location-card').count(),1,'Single location card');
          assert.equal(await page.locator('.shop-location-help').getAttribute('open'),null,'Help collapsed initially');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.locator('.shop-location-help > summary').click();
          await page.locator('.shop-location-help details').first().locator('summary').click();
          await page.screenshot({path:`${output}/${width}-${mode}-${language}-location-help.png`,fullPage:true});
          await locate.click();
        }
        if (scenario === 'resume') { await heading('Sales AI').waitFor(); await shot('sales-ai'); }
        else {
          await heading('Shop details').waitFor();
          const indicators = wizard.locator('.mobile-shop-setup-progress button');
          assert.equal(await indicators.count(),5);
          assert.ok(await indicators.evaluateAll(nodes => nodes.every(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.width >= 43.9 && rect.height >= 43.9; })), 'All five step targets fit without scrolling');
          assert.equal(await wizard.locator('.mobile-shop-setup-progress small').count(),0,'No repeated step labels');
          if (scenario === 'gps') {
            const appbar = page.locator('.shared-app-bar');
            const locale = appbar.getByRole('switch', { name:'English / မြန်မာ', exact:true });
            await locale.click();
            assert.equal(await page.locator('html').getAttribute('lang'), language === 'my' ? 'en' : 'my');
            await locale.click();
            assert.equal(await page.locator('html').getAttribute('lang'), language);
            assert.equal(await appbar.getByRole('button',{name:t('Close setup'),exact:true}).count(),1);
            assert.equal(await wizard.locator('.mobile-shop-setup-topline').count(),0);
            assert.ok(await appbar.evaluate(node => node.getBoundingClientRect().height <= 64),'Compact app bar');
          }
          await field('Public shop name').fill('Mobile Market');
          await shot('details-empty');
          const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=', 'base64');
          const [coverPicker] = await Promise.all([page.waitForEvent('filechooser'),button('Upload cover photo').click()]);
          await coverPicker.setFiles({ name:'cover.png', mimeType:'image/png', buffer:logo });
          await button('Change cover photo').waitFor();
          const [logoPicker] = await Promise.all([page.waitForEvent('filechooser'),button('Upload logo').click()]);
          await logoPicker.setFiles({ name:'logo.png', mimeType:'image/png', buffer:logo });
          await button('Change logo').waitFor();
          await shot('details');
          const ratio = await wizard.locator('.is-cover .mobile-shop-setup-preview').evaluate(node => node.clientWidth / node.clientHeight);
          assert.ok(Math.abs(ratio - 16/9) < .04, '16:9 cover');
          const expectValidation = failSettings;
          await button('Save & continue').click();
          if (expectValidation) { await wizard.locator('small[role=alert]').filter({hasText:'Fixture phone validation'}).waitFor(); assert.equal(await field('Public shop name').inputValue(),'Mobile Market'); await shot('validation'); await field('Phone').fill('099999999'); await button('Save & continue').click(); }
          await heading('Payments').waitFor();
          assert.equal(settings.storefront_enabled, false);
          assert.equal(await wizard.getByRole('button', { name:t('Fulfillment'), exact:true }).count(),0);
          assert.equal(await wizard.getByRole('button', { name:t('Delivery zones'), exact:true }).count(),0);
          await button('Add payment method').click();
          await field('Bank / wallet').fill('KBZ'); await field('Account holder').fill('Mobile Market'); await field('Account number / phone').fill('09123456789');
          await shot('payments');
          await button('Save & continue').click(); await heading('Products').waitFor();
          await wizard.locator('strong').filter({ hasText: /^Tea 01$/ }).waitFor();
          // Fetch every page, then leave and return through actual app/browser history.
          for (let i=0;i<5 && await wizard.locator('.mobile-shop-setup-product').count()<45;i++) { await wizard.locator('.mobile-shop-setup-products').evaluate(node => node.scrollIntoView({block:'end'})); await page.evaluate(() => scrollTo(0,document.body.scrollHeight)); await page.waitForTimeout(450); }
          assert.equal(await wizard.locator('.mobile-shop-setup-product').count(), 45);
          const expectBulkError = failBulk;
          await button('Publish all').click();
          if (expectBulkError) { await wizard.getByText('Fixture invalid product price', {exact:true}).waitFor(); assert.equal(products.filter(product => product.published).length,0); await button('Publish all').click(); }
          await page.waitForFunction(() => !document.querySelector('.mobile-shop-setup-actions button[disabled]'));
          assert.equal(products.filter(product => product.published).length,45, 'Bulk publish includes later pages');
          assert.equal(await wizard.locator('.mobile-shop-setup-product').count(),45, 'Mutation retains loaded range');
          await button('Unpublish all').click();
          await page.waitForFunction(() => !document.querySelector('.mobile-shop-setup-actions button[disabled]'));
          await field('Search products').fill('missing product');
          await wizard.getByText(t('No matching products.'), {exact:true}).waitFor();
          await shot('empty-products');
          await field('Search products').fill('Tea 0');
          await page.waitForTimeout(400); await wizard.locator('strong').filter({ hasText: /^Tea 01$/ }).waitFor();
          await button('Publish all').click();
          await page.waitForFunction(() => !document.querySelector('.mobile-shop-setup-actions button[disabled]'));
          assert.equal(products.filter(product => product.published).length, 9);
          await button('Unpublish all').click();
          await page.waitForFunction(() => !document.querySelector('.mobile-shop-setup-actions button[disabled]'));
          await wizard.getByRole('checkbox', { name: /Tea 01/ }).click();
          await page.waitForFunction(() => !document.querySelector('.mobile-shop-setup-actions button[disabled]'));
          await shot('products');
          assert.ok(await wizard.locator('.mobile-shop-setup-product').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height <= 52)), 'Short product names use compact single rows');
          const searchAlignment = await wizard.locator('.mobile-shop-setup-search .ui-search').evaluate(node => {
            const field = node.getBoundingClientRect(), icon = node.querySelector('svg').getBoundingClientRect();
            return { inset:icon.left - field.left, center:Math.abs(icon.top + icon.height / 2 - field.top - field.height / 2) };
          });
          assert.ok(searchAlignment.inset >= 10 && searchAlignment.center <= 1, 'Search icon has an inset and is vertically centered');
          const countBefore = calls.filter(call => call.endpoint === '/shop-admin/publications' && call.method === 'GET').length;
          await button('Continue').click(); await heading('Sales AI').waitFor();
          await page.locator('.shared-app-bar').getByRole('button', { name: /Back|နောက်သို့/ }).click();
          await heading('Products').waitFor();
          assert.equal(await field('Search products').inputValue(), 'Tea 0');
          assert.equal(calls.filter(call => call.endpoint === '/shop-admin/publications' && call.method === 'GET').length, countBefore, 'Back makes no list load');
          await page.goForward(); await heading('Sales AI').waitFor();
          await shot('sales-ai');
        }
        await wizard.getByRole('switch', { name:t('Enable Sales AI'), exact:true }).check();
        await field('Representative name').fill('Mya');
        await button('Save & continue').click(); await heading('Review').waitFor();
        assert.equal(ai.settings.instructions, 'Preserve tools and instructions');
        const checks = wizard.getByRole('checkbox'); assert.equal(await checks.count(), 3);
        for (const checkbox of await checks.all()) assert.ok(await checkbox.isChecked());
        await shot('review');
        const expectFinishError = failFinish;
        await button('Save shop setup').click();
        if (expectFinishError) { await wizard.getByText('Fixture completion error', {exact:true}).waitFor(); assert.notEqual(progress.status,'complete'); await button('Save shop setup').click(); }
        await heading('Your shop setup is saved').waitFor();
        assert.equal(progress.status, 'complete'); assert.ok(settings.storefront_enabled);
        assert.equal(settings.announcement,'Keep announcement');
        await shot('complete');
        assert.equal(await wizard.locator('.mobile-shop-setup-complete button').count(),1);
        await button('Complete').click();
        await page.locator('.shop-overview-page').waitFor();
        assert.ok((new URL(page.url())).pathname === '/shop');
      }
      assert.deepEqual(errors, []);
      results.push({ width, language, mode, scenario, errors, writes: calls.filter(call => call.method === 'PUT' || call.method === 'POST').length });
      console.log('PASS', width, language, mode, scenario);
      await context.close();
    }
    await fs.writeFile(`${output}/browser-results.json`, JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
