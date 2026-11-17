const { setDrawerLanguage } = require('./drawer-language.cjs');
// Synthetic product data, isolated storage, intercepted requests; no live mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176', output = path.resolve(__dirname, '../artifacts/products-reference');
const session = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'shop', 'settings'], subscription: { is_valid: true } };
const config = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
const products = ['Premium Jasmine Rice', 'Sunflower Cooking Oil', 'Green Tea — Original'].map((name, i) => ({ id: i + 1, name, sku: `SKU 00${i + 1}`, barcode: `885012345678${9 - i}`, category: 'Groceries', marketplace_category_id:7, marketplace_category_version:1, marketplace_category:{id:7,path:'Food / Rice and grains',path_my:'Food / Rice and grains'}, base_unit: ['bag', 'litre', 'box'][i], purchase_unit: 'carton', purchase_conversion_factor: 10, price: [18500, 8500, 3500][i], cost: [14000, 6000, 2500][i], stock: [48, 72, 36][i], low_stock_threshold: 10, online_description: 'Premium quality jasmine rice with fragrant aroma and soft texture.', photo_url: `/products/${i + 1}/photo`, prices: [{ name: 'Retail', price: [18500, 8500, 3500][i], is_manual: true }, { name: 'Wholesale', price: [16800, 7200, 3000][i], is_manual: false }] }));
let movements = [{ id: 1, quantity_change: 20, movement_type: 'purchase', note: 'Received from supplier', reference_type: 'PO-2024-0045', created_at: '2024-03-10T10:24:00' }, { id: 2, quantity_change: -4, movement_type: 'sale', note: 'Sold', reference_type: 'INV-2024-0187', created_at: '2024-03-08T15:16:00' }, { id: 3, quantity_change: 2, movement_type: 'adjustment', note: 'Stock adjustment', reference_type: 'ADJ-2024-0001', created_at: '2024-03-05T09:41:00' }];
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image; from pathlib import Path; p=Path('artifacts/products-reference'); [(Image.open(f).resize((393,850)).crop((0,33,393,850 if f.name[:3] in ['008','010','011','012'] else 834)).save(p/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/products').glob('*.png')]; im=Image.open('docs/design/products/006-products-inventory-default.png').resize((393,850)); [im.crop(box).save(p/name) for box,name in [((27,268,123,386),'rice.png'),((27,415,123,532),'oil.png'),((27,562,123,680),'tea.png')]]"], { cwd: path.resolve(__dirname, '..') });
  const browser = await (process.env.PRODUCT_BROWSER === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 801 }, timezoneId: 'Asia/Yangon', isMobile: process.env.PRODUCT_BROWSER !== 'firefox', hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    const page = await context.newPage(), calls = [], errors = [];
    let failSave = false, failStock = false, productMode = 'normal', releaseLoading;
    page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.slice(4), method = request.method();
      calls.push({ endpoint, query: url.search, method, body: ['POST', 'PUT'].includes(method) && request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : undefined });
      if (endpoint === '/products' && method === 'GET' && productMode === 'failure') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture connection unavailable.' }) });
      if (endpoint === '/products' && method === 'GET' && productMode === 'loading') await new Promise(resolve => { releaseLoading = resolve; });
      if (endpoint === '/products' && method === 'GET' && productMode === 'empty') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });

      if (/^\/products\/\d+\/photo$/.test(endpoint) && method === 'GET') return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(output, ['rice.png', 'oil.png', 'tea.png'][Number(endpoint.split('/')[2]) - 1] || 'rice.png')) });
      if ((endpoint === '/products' && method === 'POST') || (/^\/products\/\d+$/.test(endpoint) && method === 'PUT')) {
        if (failSave) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture rejection', errors: { name: ['Fixture: product name already exists.'] } }) });
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...products[0], ...request.postDataJSON(), id: 1 }) });
      }
      if (endpoint.endsWith('/adjust-stock')) {
        if (failStock) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture: stock adjustment rejected.' }) });
        products[0] = { ...products[0], stock: products[0].stock + Number(url.searchParams.get('quantity')) };
        movements = [{ id: 4, quantity_change: Number(url.searchParams.get('quantity')), movement_type: 'adjustment', note: url.searchParams.get('reason'), created_at: new Date().toISOString() }, ...movements];
      }
      let body;
      if (endpoint === '/auth/me') body = session;
      else if (endpoint === '/app-config') body = config;
      else if (endpoint === '/settings') body = { currency: 'MMK', price_types: 'Retail,Wholesale', payment_methods: 'Cash' };
      else if (endpoint === '/products/marketplace-categories') body = {items:[{id:7,path:'Food / Rice and grains',path_my:'Food / Rice and grains',name_en:'Rice and grains'}]};
      else if (endpoint === '/categories') body = ['Groceries', 'Rice & Grains'];
      else if (endpoint === '/price-types') body = { items: ['Retail', 'Wholesale'], rules: [{ name: 'Retail', pricing_mode: 'manual' }, { name: 'Wholesale', pricing_mode: 'automatic', markup_percent: 20, rounding: 100 }] };
      else if (endpoint === '/products/summary') body = { total_products: 124, low_stock: 8, total_stock_units: 156, out_of_stock: 0 };
      else if (endpoint === '/products') body = { items: products.filter(p => !url.searchParams.get('q') || p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())), total: url.searchParams.get('q') ? products.filter(p => p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())).length : 124 };
      else if (endpoint.endsWith('/stock-movements')) body = { items: movements, total: movements.length };
      else if (/^\/products\/\d+$/.test(endpoint) || endpoint.endsWith('/adjust-stock')) body = products[0];
      else if (endpoint === '/shop-admin/chat/config') body = { enabled: false };
      else body = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    async function ready() { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => [...document.querySelectorAll('img')].every(img => img.complete)); }
    async function capture(id) {
      const captureHeight = ['008', '010', '011', '012'].includes(id) ? 817 : 801;
      await page.setViewportSize({ width: 393, height: captureHeight });
      await ready(); await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => node.blur())); await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `screen-${id}.png`), animations: 'disabled' });
      await fs.writeFile(path.join(output, `metrics-${id}.json`), JSON.stringify(await page.locator('main:visible').evaluate(el => [...el.querySelectorAll('input, h3, .product-inventory-block, .product-wizard-progress, .product-reference-actions, .product-reference-profile')].map(node => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return { text: node.getAttribute('aria-label') || node.textContent.slice(0, 50), y: r.y, height: r.height, font: s.font, padding: s.padding, gap: s.gap, minHeight: s.minHeight }; })), null, 2));
      execFileSync('python', ['-c', `from PIL import Image; im=Image.new('RGB',(786,${captureHeight}),'white'); im.paste(Image.open('artifacts/products-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/products-reference/screen-${id}.png'),(393,0)); im.save('artifacts/products-reference/comparison-${id}.png')`], { cwd: path.resolve(__dirname, '..') });
      for (const width of [320, 768]) {
        await page.setViewportSize({ width, height: captureHeight });
        await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(requestAnimationFrame); });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: ${width}px overflow`);
        await page.screenshot({ path: path.join(output, `screen-${id}-${width}.png`), animations: 'disabled' });
      }
      await page.setViewportSize({ width: 393, height: 801 });
      await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(requestAnimationFrame); });
      if (['007', '012', '013'].includes(id)) {
        await page.setViewportSize({ width: 393, height: captureHeight });
        const input = page.locator('main:visible input:not([readonly]):not([type="file"]):not(:disabled)').first();
        await input.focus();
        await page.screenshot({ path: path.join(output, `focus-${id}.png`), animations: 'disabled' });
        await input.blur();
      }
      if (process.argv.includes('--shared-controls') && id === '007') {
        await page.setViewportSize({ width: 320, height: 400 });
        const lastInput = page.locator('main:visible input:not([type="file"]):not(:disabled)').last();
        await lastInput.focus();
        await lastInput.scrollIntoViewIfNeeded();
        const geometry = await lastInput.evaluate(node => {
          const input = node.getBoundingClientRect();
          const footer = document.querySelector('.product-reference-actions').getBoundingClientRect();
          return { inputTop: input.top, inputBottom: input.bottom, footerTop: footer.top, footerBottom: footer.bottom, viewport: innerHeight };
        });
        assert.ok(geometry.inputTop >= 0 && geometry.inputBottom <= geometry.footerTop, `Last field remains reachable above actions: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.footerBottom <= geometry.viewport, 'Primary actions remain reachable in a shortened viewport');
        await page.screenshot({ path: path.join(output, 'keyboard-height-007.png') });
        await page.screenshot({ path: path.join(output, 'full-page-007.png'), fullPage: true });
        await fs.writeFile(path.join(output, 'keyboard-height-007.json'), JSON.stringify(geometry, null, 2));
        await lastInput.blur();
        await page.setViewportSize({ width: 393, height: 801 });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }
    await page.goto(`${origin}/products`);
    await page.getByRole('heading', { name: products[0].name, exact: true }).waitFor({ timeout: 10000 }).catch(async error => { await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ errors, calls, body: await page.locator('body').innerText() }, null, 2)); throw error; });
    await capture('006');
    const exported = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    await (await exported).saveAs(path.join(output, 'products-fixture.csv'));
    assert.match(await fs.readFile(path.join(output, 'products-fixture.csv'), 'utf8'), /Premium Jasmine Rice/);
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    await page.getByRole('heading', { name: 'New product', exact: true }).waitFor();
    await page.getByLabel('Product name', { exact: true }).fill(products[0].name);
    await page.getByLabel('Category', { exact: true }).fill('Groceries');
    await page.getByLabel('SKU', { exact: true }).fill('SKU 001');
    await page.getByLabel('Barcode', { exact: true }).fill(products[0].barcode);
    await page.getByLabel('Base unit', { exact: true }).fill('bag');
    await page.getByRole('button', { name: 'Add photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Product photo', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByLabel('Choose product photo', { exact: true }).setInputFiles(path.join(output, 'rice.png'));
    await capture('130');
    await page.getByRole('button', { name: 'Use photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Crop product photo', exact: true }).waitFor({ state: 'hidden' });
    await page.getByLabel('Marketplace category (optional)',{exact:true}).selectOption('7');await capture('007');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Buying unit', { exact: true }).fill('carton');
    await page.getByLabel('1 buying unit equals', { exact: true }).fill('10');
    await page.getByLabel('Current stock quantity', { exact: true }).fill('48');
    await page.getByLabel('Average purchase cost per bag', { exact: true }).fill('14000');
    await page.getByLabel('Alert when stock is below', { exact: true }).fill('10');
    await capture('008');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Retail price', { exact: true }).fill('18500');
    assert.equal(await page.getByLabel('Wholesale price', { exact: true }).inputValue(), '16,800');
    await capture('009');
    // Back preserves the list DOM and Forward preserves the wizard's step and values.
    await page.getByRole('button', { name: 'Back to products', exact: true }).click();
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    await page.goForward();
    assert.equal(await page.getByLabel('Retail price', { exact: true }).inputValue(), '18,500');
    failSave = true;
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await page.getByText('Fixture: product name already exists.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Product name', { exact: true }).inputValue(), products[0].name);
    failSave = false;
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click();
    const actions = page.getByRole('dialog', { name: 'Product actions', exact: true });
    for (const [width, height] of [[320,667],[375,667],[393,817],[768,817]]) {
      await page.setViewportSize({ width, height });
      await actions.getByRole('button', { name: 'Delete', exact: true }).scrollIntoViewIfNeeded();
      const rows = await actions.locator('.mobile-action-menu > button').evaluateAll(buttons => buttons.map(button => {
        const icon = button.querySelector('svg').getBoundingClientRect(), copy = button.querySelector('span').getBoundingClientRect(), rect = button.getBoundingClientRect(), css = getComputedStyle(button);
        return { icon: icon.x, copy: copy.x, height: rect.height, bottom: rect.bottom, copyBottom: copy.bottom, leftBorder: css.borderLeftWidth, rightBorder: css.borderRightWidth };
      }));
      assert.equal(rows.length, 4);
      assert.ok(rows.every(row => Math.abs(row.icon - rows[0].icon) < 1 && Math.abs(row.copy - rows[0].copy) < 1), 'All actions including Delete align their icon and text columns');
      assert.ok(rows.every(row => row.height >= 44 && row.copyBottom <= row.bottom), 'Action rows retain readable text and touch targets');
      assert.ok(rows.every(row => row.leftBorder === '0px' && row.rightBorder === '0px'), 'Action rows have no outline frames');
      assert.ok(rows.at(-1).bottom <= height, 'Last action remains reachable');
      await page.screenshot({ path: path.join(output, `action-sheet-${width}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 393, height: 817 });
    const beforeClose = calls.length;
    await actions.locator('.mobile-sheet-close').click();
    assert.equal(calls.length, beforeClose, 'Dismissing actions does not refresh the inventory');
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click();
    await actions.getByRole('button', { name: 'Print barcode', exact: true }).click();
    await page.getByRole('dialog', { name: 'Print barcodes', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click();
    const beforeHardwareBack = page.url();
    await page.evaluate(() => window.dispatchEvent(new Event('mkpos:hardware-back', { cancelable: true })));
    await page.getByRole('dialog', { name: 'Product actions', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(page.url(), beforeHardwareBack);
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit product', exact: true }).waitFor();
    await page.getByLabel('Product name', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Marketplace category (optional)',{exact:true}).inputValue(),'7');await capture('010');await page.getByLabel('Marketplace category (optional)',{exact:true}).selectOption('');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await capture('011');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await capture('012');
    await page.getByRole('button', { name: 'Change photo', exact: true }).click();
    await page.getByLabel('Description (optional)', { exact: true }).fill('Fixture edited description');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    assert.ok(calls.some(c => c.method === 'PUT' && c.body.online_description === 'Fixture edited description' && c.body.marketplace_category_id === null && c.body.marketplace_category_version === 1));assert.ok(calls.some(c=>c.method==='POST'&&c.endpoint==='/products'&&c.body.marketplace_category_id===7));
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click(); await page.getByRole('button', { name: 'Stock', exact: true }).click();
    await page.getByRole('heading', { name: 'Stock adjustment', exact: true }).waitFor();
    await page.getByRole('spinbutton', { name: 'Adjustment quantity (bag)', exact: true }).fill('10');
    assert.ok(await page.locator('input[type="number"]').evaluateAll(inputs => inputs.every(input => getComputedStyle(input).appearance === 'textfield')), 'Number inputs hide native quantity spinners');
    await page.getByRole('combobox', { name: 'Reason (optional)', exact: true }).fill('Stock count correction');
    await capture('013');
    await page.getByRole('button', { name: /Remove stock/ }).click();
    await page.getByRole('spinbutton', { name: 'Adjustment quantity (bag)', exact: true }).fill('100');
    assert.ok(await page.getByRole('button', { name: 'Save adjustment', exact: true }).isDisabled());
    await page.getByRole('spinbutton', { name: 'Adjustment quantity (bag)', exact: true }).fill('4');
    failStock = true;
    await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
    await page.getByText('Fixture: stock adjustment rejected.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('spinbutton', { name: 'Adjustment quantity (bag)', exact: true }).inputValue(), '4');
    failStock = false;
    await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
    await page.getByText('Stock adjusted.', { exact: true }).waitFor();
    assert.ok(calls.some(c => c.endpoint.endsWith('/adjust-stock') && c.query.includes('quantity=-4')));
    for (const width of [320, 768]) { await page.setViewportSize({ width, height: 801 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} stock overflow`); await page.screenshot({ path: path.join(output, `stock-${width}.png`), animations: 'disabled' }); }
    await page.setViewportSize({ width: 393, height: 801 });
    await page.getByRole('button', { name: 'Back to products', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search products', exact: true });
    await search.fill('Premium');
    await page.waitForResponse(response => response.url().includes('q=Premium'));
    await search.evaluate(el => el.dataset.retentionMarker = 'same-source');
    await page.getByRole('button', { name: `Actions for ${products[0].name}`, exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const beforeReturn = calls.length;
    await page.getByRole('button', { name: 'Back to products', exact: true }).click();
    assert.equal(await search.inputValue(), 'Premium');
    assert.equal(await search.getAttribute('data-retention-marker'), 'same-source');
    assert.equal(calls.length, beforeReturn, 'Back must not refetch');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('dialog', { name: 'Filters', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Select and print barcodes', exact: true }).click();
    await page.getByRole('dialog', { name: 'Print barcodes', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await page.getByRole('dialog', { name: 'Main navigation', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await capture('112');
    const filterCalls = calls.filter(c => c.endpoint === '/products').length;
    await page.getByRole('radio', { name: 'Low stock', exact: true }).check(); await page.keyboard.press('Escape'); assert.equal(calls.filter(c => c.endpoint === '/products').length, filterCalls);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
    await (await chooser).setFiles({ name: 'products-october.csv', mimeType: 'text/csv', buffer: Buffer.from('name,sku,cost,price\nRice,R1,100,200\n,B2,120,200\nOil,O1,invalid,300') });
    await page.getByRole('dialog', { name: 'Import review', exact: true }).waitFor(); await capture('131');
    assert.ok(await page.getByRole('button', { name: 'Import (3)', exact: true }).isDisabled()); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for Premium Jasmine Rice', exact: true }).click(); await page.getByRole('button', { name: 'Delete', exact: true }).click(); await capture('129'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Select and print barcodes', exact: true }).click(); await page.getByRole('dialog', { name: 'Print barcodes', exact: true }).waitFor(); await page.getByRole('img', { name: /Barcode 885/ }).first().waitFor(); await capture('132');
    for (const width of [320, 362]) {
      await page.setViewportSize({ width, height: 700 });
      const drawer = page.getByRole('dialog', { name: 'Print barcodes', exact: true });
      assert.ok(await drawer.locator('.mobile-filter-drawer-body').evaluate(body => body.scrollWidth <= body.clientWidth));
      assert.ok(await drawer.locator('.ui-field').evaluateAll(fields => fields.every(field => field.querySelector('label').getBoundingClientRect().bottom <= field.querySelector('select').getBoundingClientRect().top)), 'Select labels are above their inputs');
      await page.screenshot({ path: path.join(output, 'barcode-drawer-' + width + '.png'), animations: 'disabled' });
    }
    const format = page.getByRole('combobox', { name: 'Sticker paper format', exact: true });
    await format.selectOption(await format.locator('option').nth(1).getAttribute('value'));
    await page.getByRole('checkbox', { name: 'Select all loaded barcode products', exact: true }).check();
    assert.ok(await page.getByRole('button', { name: /^Print selected/ }).isEnabled());
    await page.getByRole('checkbox', { name: 'Select all loaded barcode products', exact: true }).uncheck();
    assert.ok(await page.getByRole('button', { name: /^Print selected/ }).isDisabled());
    await page.getByRole('checkbox', { name: 'Select Premium Jasmine Rice', exact: true }).check();
    assert.ok(await page.getByRole('button', { name: 'Print selected (1)', exact: true }).isEnabled());
    await page.screenshot({ path: path.join(output, 'barcode-selected.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await search.inputValue(), 'Premium');
    assert.equal(await search.getAttribute('data-retention-marker'), 'same-source');
    await page.setViewportSize({ width: 393, height: 801 });
    // Keyboard focus evidence and localized versions of all eight mapped screens.
    await search.focus(); await page.screenshot({ path: path.join(output, 'focus-006.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my');
    await page.keyboard.press('Escape');
    await page.locator('.app-bar-action').nth(1).click();
    await page.getByRole('dialog').waitFor();
    for (const width of [320, 362]) {
      await page.setViewportSize({ width, height: 700 });
      assert.ok(await page.locator('.product-barcode-drawer').evaluate(body => body.scrollWidth <= body.clientWidth));
      await page.screenshot({ path: path.join(output, 'barcode-myanmar-' + width + '.png'), animations: 'disabled' });
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 393, height: 801 });
    async function localizedCapture(id) {
      await page.setViewportSize({ width: 393, height: ['008', '010', '011', '012'].includes(id) ? 817 : 801 });
      const dismiss = page.locator('main:visible .mobile-notice button');
      if (await dismiss.count()) await dismiss.click();
      await ready(); await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Myanmar ${id} overflow`);
      await page.screenshot({ path: path.join(output, `myanmar-${id}.png`), animations: 'disabled' });
    }
    await localizedCapture('006');
    await page.locator('.ui-fab:visible').click();
    await page.locator('.product-reference-form:visible .product-wizard-progress button').first().click(); await localizedCapture('007');
    await page.locator('.product-reference-actions:visible > button').last().click(); await localizedCapture('008');
    await page.locator('.product-reference-actions:visible > button').last().click(); await localizedCapture('009');
    await page.locator('.product-reference-header:visible > button').first().click();
    await page.locator('.product-card-menu-button:visible').first().click();
    for (const width of [320,375]) {
      await page.setViewportSize({ width, height: 667 });
      await page.locator('.mobile-action-menu > button').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `action-sheet-myanmar-${width}.png`), animations: 'disabled' });
    }
    await page.locator('.mobile-action-menu > button').nth(1).click();
    await page.locator('.product-reference-form:visible .product-wizard-progress button').first().click(); await localizedCapture('010');
    await page.locator('.product-reference-actions:visible > button').last().click(); await localizedCapture('011');
    await page.locator('.product-reference-actions:visible > button').last().click(); await localizedCapture('012');
    await page.locator('.product-reference-header:visible > button').first().click();
    await page.locator('.product-card-menu-button:visible').first().click(); await page.locator('.mobile-action-menu > button').first().click(); await localizedCapture('013');
    await page.evaluate(() => localStorage.setItem('mkpos.language', 'en'));
    productMode = 'empty'; await page.goto(`${origin}/products`); await page.getByRole('heading', { name: 'No products yet', exact: true }).waitFor(); await capture('146');
    productMode = 'normal'; await page.goto(`${origin}/products`); await page.getByRole('textbox', { name: 'Search products', exact: true }).fill('matcha-latte'); await page.getByRole('heading', { name: 'No matching products', exact: true }).waitFor(); await capture('147'); await page.getByRole('button', { name: 'Clear search', exact: true }).last().click();
    productMode = 'failure'; await page.goto(`${origin}/products`); await page.getByRole('heading', { name: 'Could not load products', exact: true }).waitFor(); await capture('148');
    productMode = 'normal'; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.getByRole('heading', { name: 'Premium Jasmine Rice', exact: true }).waitFor();
    productMode = 'loading'; await page.goto(`${origin}/products`, { waitUntil: 'domcontentloaded' }); await page.getByRole('status', { name: 'Loading products', exact: true }).waitFor(); await capture('145'); productMode = 'normal'; releaseLoading?.();
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ errors, calls, result: 'Seventeen mapped screens/states captured; create/edit payloads, automatic pricing, local photo crop, stock add/remove validation/retry, retained Back/Forward, filter/tools/drawer checked.' }, null, 2));
    console.log('Product references 006–013 and isolated interaction checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
