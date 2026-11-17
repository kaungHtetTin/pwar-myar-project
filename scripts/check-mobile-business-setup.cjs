// Uses fixture API responses only; never changes real business records.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const origin = process.env.SETUP_ORIGIN || 'http://127.0.0.1:5183';
const brand = process.env.SETUP_BRAND || 'PwarMyar';
const output = path.resolve('artifacts/mobile-business-setup');
(async () => {
  const { BUSINESS_SETUP_MESSAGES: setup, BUSINESS_SETUP_PATTERNS: setupPatterns } = await import(pathToFileURL(path.resolve('shared/localization/businessSetup.js')));
  const { PRODUCT_UNIT_MESSAGES: units, PRODUCT_UNIT_PATTERNS: unitPatterns } = await import(pathToFileURL(path.resolve('shared/localization/productUnits.js')));
  const messages = { ...setup, ...units, 'Business name': 'လုပ်ငန်းအမည်', 'Product name': 'ကုန်ပစ္စည်းအမည်', Payments: 'ပေးချေမှုများ', Back: 'နောက်သို့', 'Previous setup step': 'ယခင်ပြင်ဆင်မှုအဆင့်သို့ ပြန်သွားမည်' };
  const browser = await chromium.launch({ headless: true });
  const results = [];
  await fs.mkdir(output, { recursive: true });
  try {
    for (const [width, height, language, mode, scenario = 'new'] of [[390,844,'en','light'], [320,740,'en','light'], [390,844,'my','light'], [768,900,'en','dark'], [390,844,'en','light','legacy'], [390,844,'en','light','complete'], [390,844,'en','light','staff'], [390,844,'en','light','direct'], [390,844,'en','light','return'], [390,844,'en','light','signup']]) {
      if (process.env.SETUP_ONLY && process.env.SETUP_ONLY !== scenario) continue;
      const reduced = width === 320;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const calls = [], errors = [];
      const data = {
        progress: scenario === 'legacy' ? null : { step: scenario === 'complete' ? 4 : scenario === 'direct' ? 3 : 1, status: scenario === 'complete' ? 'complete' : 'pending' },
        business: { id: 91, name: 'Mobile Corner Shop', currency: 'Ks', timezone: 'Asia/Yangon' },
        basics: { name: 'Mobile Corner Shop', phone: '', address: '', currency: 'Ks', timezone: 'Asia/Yangon' },
        payment_methods: ['Cash'], product_count: 0, can_products: true, can_sell: true, currency_locked: false, timezones: ['Asia/Yangon','Asia/Bangkok','UTC'],
      };
      const session = { user: { id: 91, name: 'Fixture owner', role: scenario === 'staff' ? 'staff' : 'owner' }, business: data.business, permissions: ['sell','products','settings'], subscription: { is_valid: true } };
      if (scenario === 'return') session.permissions = ['products','settings'];
      let failBasics = width === 390 && language === 'en' && scenario === 'new';
      let failFinish = failBasics;
      let registered = scenario !== 'signup';
      await context.addInitScript(({ language }) => { localStorage.setItem('mkpos.language', language); sessionStorage.setItem('mkpos.variant-recommendation.dismissed','1'); }, { language });
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname.slice(4), method = req.method();
        calls.push({ endpoint, method });
        let response = { items: [], total: 0, enabled: false, realtime_enabled: false };
        if (endpoint === '/auth/me') {
          if (!registered) return route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } });
          response = session;
        }
        else if (endpoint === '/auth/register') { registered = true; response = session; }
        else if (endpoint === '/branding') response = { primary_color: '#087f74', theme_mode: mode };
        else if (endpoint === '/app-config') response = { enabled_modules: session.permissions, permissions: session.permissions, business: data.business, language };
        else if (endpoint === '/categories') response = [];
        else if (endpoint === '/price-types') response = { items: ['Retail'], rules: [] };
        else if (endpoint === '/products' && scenario === 'return') {
          const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 30);
          response = { items: Array.from({ length: Math.max(0, Math.min(limit, 120 - offset)) }, (_, i) => ({ id: offset+i+1, name: `Tea ${offset+i+1}`, base_unit: 'Piece', price: 1500, cost: 1000, stock: 12, prices: [{name:'Retail',price:1500}] })), total: 120 };
        }
        else if (endpoint === '/settings') response = { shop_name: data.business.name, currency: 'Ks', payment_methods: 'Cash', price_types: 'Retail', language };
        else if (endpoint === '/settings/logo') {
          data.receipt_logo_data_url = method === 'DELETE' ? '' : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=';
          response = { receipt_logo_data_url: data.receipt_logo_data_url };
        } else if (endpoint === '/business-setup') {
          if (method === 'PUT') {
            const payload = req.postDataJSON();
            if (payload.action === 'basics') {
              if (failBasics) { failBasics = false; return route.fulfill({ status: 422, json: { message: 'Check contact details', errors: { phone: ['Fixture phone validation'] } } }); }
              const { name, phone, address, currency, timezone } = payload;
              data.basics = { name, phone, address, currency, timezone }; Object.assign(data.business, { name, currency, timezone }); data.progress.step = 2;
            }
            if (payload.action === 'payments') { data.payment_methods = payload.payment_methods; data.progress.step = 3; }
            if (payload.action === 'finish') {
              if (failFinish) { failFinish = false; return route.fulfill({ status: 422, json: { message: 'Fixture completion failed; retry safely.' } }); }
              data.progress = { ...data.progress, step: 4, status: 'complete' };
            }
          }
          response = data;
        } else if (endpoint === '/business-setup/product') {
          const product = req.postDataJSON(); assert.equal(product.stock, 24); assert.equal(product.cost, 1000); assert.equal(product.name, 'Drinking Water');
          data.progress.product_id = 77; data.product_count = 1; response = data;
        }
        await route.fulfill({ status: 200, json: response });
      });
      await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.goto(`${origin}${scenario === 'signup' ? '/signup' : scenario === 'direct' ? '/setup/product' : ['legacy','complete','staff'].includes(scenario) ? '/setup/business' : '/products'}`);
      if (scenario === 'signup') {
        await page.getByLabel('Business name',{exact:true}).fill('My Mobile Shop');
        await page.getByLabel('Owner name',{exact:true}).fill('Fixture owner');
        await page.getByLabel('Email address',{exact:true}).fill('mobile-fixture@example.test');
        await page.getByLabel('Password',{exact:true}).fill('fixture-password-123');
        await page.getByLabel('Confirm password',{exact:true}).fill('fixture-password-123');
        await page.getByRole('button',{name:'Create account',exact:true}).click();
      }
      const wizard = page.locator('.mobile-business-setup');
      const t = label => {
        if (language !== 'my') return label;
        if (messages[label]) return messages[label];
        for (const [pattern, replacement] of [...setupPatterns, ...unitPatterns]) if (pattern.test(label)) return label.replace(pattern, replacement);
        return label;
      };
      const button = name => wizard.getByRole('button', { name: t(name), exact: true });
      const field = name => wizard.getByLabel(t(name), { exact: true });
      const heading = name => wizard.getByRole('heading', { name: t(name), exact: true });
      const shot = async name => {
        await page.evaluate(() => document.fonts.ready);
        await page.locator('.mobile-setup-body').evaluate(node => Promise.all(node.getAnimations().map(a => a.finished.catch(() => {}))));
        await page.evaluate(() => scrollTo(0,0));
        await page.screenshot({ path: `${output}/${width}-${mode}-${language}-${name}.png`, fullPage: true, animations: 'disabled' });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
        assert.equal(await page.locator('.shared-app-bar').count(), 1, 'Uses the shared app bar');
        assert.equal(await page.getByRole('region', { name: 'Pull to refresh page' }).count(), 1, 'Uses shared swipe refresh');
        assert.equal(await wizard.getByRole('dialog').count(), 0, 'Setup is a full page');
        const sizes = await wizard.locator('.ui-input:not([type=file]),.mobile-setup-actions button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
        assert.ok(sizes.every(size => size >= 44), 'Controls retain mobile touch targets');
      };
      if (scenario === 'signup') {
        await heading('Business basics').waitFor();
        assert.ok(page.url().endsWith('/setup/business'),'Registration opens business setup directly');
        assert.equal(calls.filter(c=>c.endpoint==='/auth/register').length,1);
        assert.equal(await page.locator('.sale-bottom-navigation').count(),0);
        await shot('signup'); results.push({scenario,registeredOnce:true,directFirstOwnerSetup:true}); await context.close(); continue;
      }
      if (['legacy','complete','staff'].includes(scenario)) {
        await page.locator('.sale-bottom-navigation').waitFor();
        assert.equal(await wizard.count(), 0, 'Excluded accounts do not open setup');
        assert.equal(await page.locator('.mobile-setup-reminder').count(), 0);
        if (scenario === 'staff') assert.equal(calls.filter(c => c.endpoint === '/business-setup').length, 0);
        assert.ok(!calls.some(c => c.endpoint === '/business-setup' && c.method === 'PUT'));
        results.push({ width, language, scenario, excluded: true }); await context.close(); continue;
      }
      if (scenario === 'return') {
        await heading('Business basics').waitFor(); await button('Finish later').click(); await wizard.waitFor({ state: 'hidden' });
        const search = page.getByRole('textbox', { name: 'Search products', exact: true });
        await search.fill('Tea'); await page.getByText('Tea 1', { exact: true }).waitFor();
        await page.evaluate(() => scrollTo(0,500)); await page.waitForFunction(() => scrollY >= 450);
        const scroll = await page.evaluate(() => scrollY);
        const reads = calls.filter(c => c.endpoint === '/products' && c.method === 'GET').length;
        const setupReads = calls.filter(c => c.endpoint === '/business-setup' && c.method === 'GET').length;
        await page.goForward(); await heading('Business basics').waitFor();
        await button('Finish later').click(); await wizard.waitFor({ state: 'hidden' });
        assert.equal(await search.inputValue(),'Tea');
        await page.waitForFunction(top => Math.abs(scrollY - top) < 2, scroll);
        assert.equal(calls.filter(c => c.endpoint === '/products' && c.method === 'GET').length, reads, 'Returning does not reload the source product list');
        assert.equal(calls.filter(c => c.endpoint === '/business-setup' && c.method === 'GET').length, setupReads);
        await page.evaluate(() => scrollTo(0,0));
        await page.getByRole('button',{name:'Resume setup',exact:true}).click(); await heading('Business basics').waitFor();
        await button('Finish later').click(); await wizard.waitFor({state:'hidden'});
        assert.equal(await search.inputValue(),'Tea');
        await page.getByRole('button',{name:'Hide setup reminder',exact:true}).click();
        assert.equal(await page.locator('.mobile-setup-reminder').count(),0);
        results.push({scenario,retainedSearch:true,scroll,sourceRefetches:0,reminderResume:true}); await context.close(); continue;
      }
      if (scenario === 'direct') {
        await heading('Add a product').waitFor(); assert.ok(page.url().endsWith('/setup/product')); await shot('direct-product');
        await button('Back').click(); await heading('Payments').waitFor();
        results.push({ scenario, directResume: true, backToParent: true }); await context.close(); continue;
      }
      await heading('Business basics').waitFor().catch(async error => {
        await page.screenshot({ path: `${output}/load-error.png`, fullPage: true });
        console.log('Setup load diagnostic', page.url(), errors, await page.locator('body').innerText(), calls.filter(call => ['/business-setup','/auth/me','/app-config'].includes(call.endpoint)));
        throw error;
      });
      assert.equal(await page.locator('.mobile-setup-appbar strong').innerText(), brand);
      assert.equal(await page.locator('.sale-bottom-navigation').count(), 0);
      await field('Business name').fill('My Mobile Shop');
      await field('Business phone (optional)').fill('09123456789');
      await field('Business address (optional)').fill('No. 12, Market Road\nYangon');
      if (width === 390 && language === 'en') {
        const locale = page.getByRole('switch', { name: 'English / မြန်မာ', exact: true });
        await locale.click(); await wizard.getByRole('heading', { name: setup['Business basics'], exact: true }).waitFor();
        assert.equal(await wizard.getByLabel(setup['Business phone (optional)'], { exact: true }).inputValue(), '09123456789');
        await locale.press('Space'); await heading('Business basics').waitFor();
        const before = calls.filter(c => c.endpoint === '/business-setup').length;
        const refreshed = page.waitForResponse(response => response.url().endsWith('/business-setup'));
        await page.evaluate(() => scrollTo(0,0));
        await wizard.locator('.mobile-setup-topline').evaluate(node => {
          const send = (type, y) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientX: 100, clientY: y }] }); node.dispatchEvent(event); };
          send('touchstart', 50); send('touchmove', 230); send('touchend', 230);
        });
        await refreshed;
        assert.ok(calls.filter(c => c.endpoint === '/business-setup').length > before, 'Refresh reloads setup');
        assert.equal(await field('Business name').inputValue(), 'My Mobile Shop');
        const logo = { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=','base64') };
        const chooseLogo = async label => { const chooser = page.waitForEvent('filechooser'); await button(label).click(); await (await chooser).setFiles(logo); await wizard.getByAltText(t('Current business logo'), { exact: true }).waitFor(); };
        await chooseLogo('Upload logo');
        await wizard.getByAltText(t('Current business logo'), { exact: true }).waitFor();
        await chooseLogo('Replace logo');
        await button('Remove logo').click(); await button('Upload logo').waitFor();
        assert.equal(calls.filter(c=>c.endpoint==='/settings/logo'&&c.method==='POST').length,2);
      }
      await shot('basics');
      await button('Save & continue').click();
      if (width === 390 && language === 'en' && scenario === 'new') { await wizard.locator('.mobile-field-error').filter({ hasText: 'Fixture phone validation' }).waitFor(); assert.equal(await field('Business phone (optional)').inputValue(), '09123456789'); await button('Save & continue').click(); }
      await heading('Payments').waitFor();
      await wizard.getByRole('checkbox', { name: 'KPay', exact: true }).check();
      await field('Other payment methods (optional)').fill('Card'); await shot('payments');
      await page.getByRole('button', { name: t('Previous setup step'), exact: true }).click(); await heading('Business basics').waitFor();
      assert.equal(await field('Business address (optional)').inputValue(), 'No. 12, Market Road\nYangon');
      const reads = calls.filter(c => c.endpoint === '/business-setup' && c.method === 'GET').length;
      await page.goForward(); await heading('Payments').waitFor();
      assert.ok(await wizard.getByRole('checkbox', { name: 'KPay', exact: true }).isChecked());
      assert.equal(calls.filter(c => c.endpoint === '/business-setup' && c.method === 'GET').length, reads);
      await button('Save & continue').click(); await heading('Add a product').waitFor();
      await field('Product name').fill('Drinking Water'); await field('Selling price per Piece (Ks)').fill('1500');
      await wizard.getByRole('checkbox', { name: t('Buy in a different unit?'), exact: true }).check();
      await field('Purchase unit').fill('Carton'); await field('How many Piece in 1 Carton?').fill('12');
      await field('Stock entry unit').selectOption('purchase'); await field('Cost entry unit').selectOption('purchase');
      await field('Opening stock (Carton)').fill('2'); await field('Purchase cost per Carton (Ks)').fill('12000');
      await shot('product'); await button('Save product & finish').click();
      if (width === 390 && language === 'en' && scenario === 'new') { await wizard.getByText('Fixture completion failed; retry safely.', { exact: true }).waitFor(); await button('Finish setup').click(); }
      await heading('Your business is ready').waitFor(); await shot('complete');
      assert.equal(calls.filter(c => c.endpoint === '/business-setup/product').length, 1);
      await button('Start selling').click(); await wizard.waitFor({ state: 'hidden' });
      await page.reload(); await page.locator('.sale-bottom-navigation').waitFor(); assert.equal(await wizard.count(), 0);
      assert.deepEqual(errors, []); results.push({ width, height, language, mode, scenario, finished: true, preservedDrafts: true, createdOnce: true, reducedMotion: reduced, errors });
      await context.close();
    }
    await fs.writeFile(`${output}/results${process.env.SETUP_ONLY ? `-${process.env.SETUP_ONLY}` : ''}.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
