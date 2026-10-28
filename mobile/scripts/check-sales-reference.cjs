const { setDrawerLanguage } = require('./drawer-language.cjs');
// Dev-server QA only: intercepted sales data and isolated browser context.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/sales-reference'), origin = 'http://127.0.0.1:5176';
const session = { user: { id: 301, role: 'owner', name: 'Fixture owner' }, business: { id: 301, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'customers', 'shop'], subscription: { is_valid: true } };
const customer = { id: 1, name: 'Emma Wilson', phone: '+95 9 123 456 789' };
const products = ['Premium Jasmine Rice', 'Sunflower Cooking Oil', 'Green Tea — Original'].map((name, i) => ({ id: i + 1, name, sku: `00${i + 1}`, base_unit: ['5 kg bag', '1 litre', '100 g box'][i], price: [18500, 8500, 3500][i], stock: 50, photo_url: `/products/${i + 1}/photo`, prices: [{ name: 'Retail', price: [18500, 8500, 3500][i] }] }));
let sale = { id: 1048, receipt_no: 'SALE-1048', customer_id: 1, customer_name: customer.name, customer_phone: customer.phone, created_at: '2026-10-15 10:24:00', source: 'pos', status: 'completed', subtotal: 49000, total: 49000, paid_amount: 30000, credit_amount: 19000, discount: 0, payment_method: 'Cash', payment_type: 'credit', item_count: 3, items: products.map((p, i) => ({ id: i + 1, product_id: p.id, product_name: p.name, unit_name: p.base_unit, sku: p.sku, photo_url: p.photo_url, price_type: 'Retail', quantity: i ? 1 : 2, foc_quantity: 0, unit_price: p.price, line_total: p.price * (i ? 1 : 2) })) };
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image; from pathlib import Path; p=Path('artifacts/sales-reference'); [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(p/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/sales').glob('*.png')]; im=Image.open('docs/design/purchases/016-purchases-new-select-products-step-select-products-step.png').resize((393,850)); [im.crop(box).save(p/name) for box,name in [((54,304,123,393),'rice.png'),((54,400,123,490),'oil.png'),((54,496,123,583),'tea.png')]]"], { cwd: root });
  const engine = process.env.SALES_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true }); let page, calls = [], errors = [], failSave = false, printFailures = 2;
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, timezoneId: 'Asia/Yangon', ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4), method = req.method(), body = ['POST', 'PUT'].includes(method) ? req.postDataJSON() : undefined;
      calls.push({ endpoint, query: url.search, method, body });
      if (/^\/products\/\d+\/photo$/.test(endpoint)) return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(output, ['rice.png', 'oil.png', 'tea.png'][Number(endpoint.split('/')[2]) - 1])) });
      let result;
      if (method === 'PUT' && endpoint === '/sales/1048') {
        if (failSave) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture: save failed; retry.' }) });
        sale = { ...sale, ...body, items: body.items.map((item, index) => ({ ...sale.items[index], ...item, id: index + 1, line_total: item.quantity * item.unit_price })) }; sale.subtotal = sale.items.reduce((sum, item) => sum + item.line_total, 0); sale.total = Math.max(0, sale.subtotal - sale.discount); sale.credit_amount = Math.max(0, sale.total - sale.paid_amount); result = sale;
      } else if (endpoint === '/auth/me') result = session;
      else if (endpoint === '/app-config') result = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') result = { payment_methods: 'Cash, Mobile Money', price_types: 'Retail', admin_pin_set: '0', currency: 'MMK' };
      else if (endpoint === '/sales/1048/receipt') { if (printFailures-- > 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Printer not connected. Please check that your 80 mm receipt printer is turned on and connected.' }) }); result = { sale, html: '<h1>PwarMyar</h1><p>SALE-1048</p><p>Total 49,000 MMK</p>', text: 'PwarMyar SALE-1048 Total 49,000 MMK', paper_size: '80mm' }; }
      else if (endpoint === '/sales/1048') result = sale;
      else if (endpoint === '/sales') {
        const rows = [sale, ...[22000, 18500, 75000, 120000].map((total, i) => ({ id: 1047 - i, receipt_no: `SALE-${1047 - i}`, total, subtotal: total, paid_amount: i === 3 ? 100000 : total, credit_amount: i === 3 ? 20000 : 0, payment_method: i === 1 ? 'Mobile Money' : 'Cash', customer_name: [null, 'Daniel Lee', null, 'Sophia Tan'][i], created_at: `2026-10-${14 - i} 14:11:00`, item_count: [1, 2, 4, 1][i] }))].filter(row => !url.searchParams.get('q') || row.receipt_no.includes(url.searchParams.get('q')));
        result = { items: rows, total: rows.length };
      } else if (endpoint === '/products') result = { items: products, total: products.length };
      else if (endpoint === '/categories') result = ['Rice', 'Cooking Oil', 'Tea'];
      else if (endpoint === '/customers') result = { items: [customer], total: 1 };
      else if (endpoint === '/shop-admin/chat/config') result = { enabled: false };
      else result = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    async function capture(id) {
      await page.locator(':focus').evaluateAll(nodes => nodes.forEach(n => n.blur())); await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready; });
      if (['025','026'].includes(id)) { await page.waitForFunction(() => document.querySelector('main:not([hidden]) .sales-reference-photo img')?.complete); await page.locator('main:visible .sales-reference-photo img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => {})))); }
      await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}.png`) });
      execFileSync('python', ['-c', `from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/sales-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/sales-reference/screen-${id}.png'),(393,0)); im.save('artifacts/sales-reference/comparison-${id}.png')`], { cwd: root });
      for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: ${width}px overflow`); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}-${width}.png`) }); } await page.setViewportSize({ width: 393, height: 817 });
    }
    await page.goto(`${origin}/sales`); await page.getByRole('button', { name: 'View sale SALE-1048', exact: true }).waitFor(); await capture('024');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    const filterDrawer = page.getByRole('dialog', { name: 'Filters', exact: true });
    assert.equal(await filterDrawer.getByRole('button', { name: 'Customer filter', exact: true }).count(), 0);
    assert.equal(await filterDrawer.getByText('More filters', { exact: true }).count(), 0);
    const channel = filterDrawer.getByLabel('Sale channel', { exact: true });
    assert.equal(await channel.isVisible(), true, 'Channel is available without expanding another section');
    await page.getByRole('button', { name: 'This month', exact: true }).click();
    await filterDrawer.getByLabel('Payment method', { exact: true }).selectOption('Cash');
    await channel.selectOption('online');
    await capture('114');
    await Promise.all([page.waitForResponse(r => r.url().includes('/sales?') && new URL(r.url()).searchParams.get('sale_channel') === 'online'), page.getByRole('button', { name: 'Apply filters', exact: true }).click()]);
    await page.getByRole('button', { name: /^Filters,/ }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.equal(await channel.inputValue(), 'all');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();

    await page.getByRole('button', { name: 'Filters', exact: true }).click(); const filterRequests = calls.filter(c => c.endpoint === '/sales').length;
    await page.locator('dialog:visible').getByLabel('Payment method', { exact: true }).selectOption('Mobile Money'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); assert.equal(await page.locator('dialog:visible').getByLabel('Payment method', { exact: true }).inputValue(), '');
    await page.getByRole('button', { name: 'Custom', exact: true }).click(); await page.getByLabel('From', { exact: true }).fill('2026-12-31'); await page.getByLabel('To', { exact: true }).fill('2026-01-01'); await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await page.getByText('From date cannot be later than To date.', { exact: true }).waitFor(); assert.equal(calls.filter(c => c.endpoint === '/sales').length, filterRequests); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'View sale SALE-1048', exact: true }).click(); await page.getByRole('heading', { name: 'SALE-1048', exact: true }).waitFor(); await capture('025');
    await page.locator('main:visible .sales-reference-detail-actions').getByRole('button', { name: 'Print receipt', exact: true }).click(); await page.getByRole('dialog', { name: 'Print receipt', exact: true }).waitFor(); await capture('135'); const mutationsBeforePrint = calls.filter(c => c.method === 'PUT').length; await page.getByRole('button', { name: 'Retry print', exact: true }).click(); await page.getByText('Printer not connected', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Retry print', exact: true }).click(); await page.getByRole('dialog', { name: 'Print receipt', exact: true }).waitFor({ state: 'hidden' }); assert.equal(calls.filter(c => c.endpoint === '/sales/1048/receipt').length, 3); assert.equal(calls.filter(c => c.method === 'PUT').length, mutationsBeforePrint);

    await page.getByRole('button', { name: 'Edit sale', exact: true }).click(); await page.getByRole('heading', { name: 'Edit sale', exact: true }).waitFor(); await capture('026');
    await page.locator('main:visible .sales-reference-cart-subtotal').evaluate(n => n.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.screenshot({ animations: 'disabled', path: path.join(output, 'cart-end.png') });
    assert.ok(await page.locator('main:visible .sales-reference-cart-subtotal').evaluate(n => n.getBoundingClientRect().bottom <= document.querySelector('main:not([hidden]) .sales-reference-footer').getBoundingClientRect().top));
    await page.getByRole('button', { name: 'Increase Premium Jasmine Rice', exact: true }).click(); await page.getByRole('button', { name: 'Decrease Premium Jasmine Rice', exact: true }).click();
    await page.getByLabel('Premium Jasmine Rice unit price', { exact: true }).fill('19000'); await page.getByLabel('Premium Jasmine Rice unit price', { exact: true }).fill('18500');
    await page.getByRole('button', { name: 'Add product', exact: true }).click(); await page.getByRole('button', { name: 'Product filters', exact: true }).click(); await page.locator('dialog:visible').getByLabel('Product category', { exact: true }).selectOption('Rice'); await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await page.getByRole('dialog', { name: 'Add product', exact: true }).getByRole('button', { name: /Premium Jasmine Rice/ }).click(); await page.locator('main:visible .sales-reference-cart-line').last().getByRole('button', { name: 'Remove Premium Jasmine Rice', exact: true }).click();

    await page.getByRole('button', { name: 'Increase FOC for Premium Jasmine Rice', exact: true }).click(); assert.equal(await page.locator('main:visible').getByLabel('Premium Jasmine Rice FOC quantity', { exact: true }).inputValue(), '1'); await page.getByRole('button', { name: 'Decrease FOC for Premium Jasmine Rice', exact: true }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).waitFor(); await capture('027');
    await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).focus(); await page.screenshot({ path: path.join(output, 'payment-focus.png') });
    await page.getByRole('button', { name: 'Pay full', exact: true }).click(); assert.equal(await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).inputValue(), '49000'); await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).fill('30000');
    await page.locator('main:visible .sales-reference-customer > button').click(); await page.getByRole('button', { name: 'Use walk-in customer instead', exact: true }).click(); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('A customer is required for unpaid credit.', { exact: true }).waitFor(); await page.locator('main:visible .sales-reference-customer > button').click(); await page.getByRole('dialog', { name: 'Choose customer', exact: true }).getByRole('button', { name: /^Emma Wilson/ }).click();

    await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).fill('31000'); await page.getByRole('button', { name: 'Previous', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click(); assert.equal(await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).inputValue(), '31000');
    failSave = true; await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('Fixture: save failed; retry.', { exact: true }).waitFor(); assert.equal(await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).inputValue(), '31000'); failSave = false;
    await page.getByRole('button', { name: 'Back to sales', exact: true }).click(); await page.getByRole('heading', { name: 'SALE-1048', exact: true }).waitFor(); await page.goForward(); await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).waitFor(); assert.equal(await page.locator('main:visible').getByLabel('Paid amount', { exact: true }).inputValue(), '31000');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByRole('heading', { name: 'SALE-1048', exact: true }).waitFor(); await page.getByRole('button', { name: 'Back to sales', exact: true }).click(); await page.getByRole('heading', { name: 'Sales', exact: true }).waitFor(); assert.equal(calls.filter(c => c.method === 'PUT').length, 2);
    await Promise.all([page.waitForResponse(r => r.url().includes('q=SALE-1048')), page.getByRole('textbox', { name: 'Search sales', exact: true }).fill('SALE-1048')]); await page.getByRole('button', { name: 'View sale SALE-1048', exact: true }).evaluate(n => n.dataset.retention = 'sale-source'); const requests = calls.filter(c => c.endpoint === '/sales').length;
    await page.getByRole('button', { name: 'View sale SALE-1048', exact: true }).click(); await page.getByRole('heading', { name: 'SALE-1048', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: /^(More|Sale actions)$/ }).count(), 0); assert.equal(await page.locator('.shared-app-bar .app-bar-menu').count(), 1); await page.getByRole('button', { name: 'Back to sales', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'View sale SALE-1048', exact: true }).getAttribute('data-retention'), 'sale-source'); assert.equal(calls.filter(c => c.endpoint === '/sales').length, requests);
    await page.getByRole('button', { name: 'Actions for sale SALE-1048', exact: true }).click(); await page.getByRole('button', { name: 'Delete sale', exact: true }).click(); await page.getByRole('dialog', { name: 'Delete sale?', exact: true }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(calls.filter(c => c.method === 'DELETE').length, 0);
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.locator('dialog:visible').getByLabel('Payment type', { exact: true }).selectOption('credit'); await page.getByRole('button', { name: /^Apply filters/ }).click(); await page.getByRole('button', { name: /Filters, 1 active/ }).click(); await page.getByRole('button', { name: 'Reset', exact: true }).click(); await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sales', exact: true }).focus(); await page.screenshot({ path: path.join(output, 'search-focus.png') });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-history.png') }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('main:visible .mobile-filter-toggle').click(); await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-filter.png') }); assert.ok(await page.locator('dialog[open] .mobile-filter-drawer-body').evaluate(n => n.scrollWidth <= n.clientWidth + 1)); await page.keyboard.press('Escape');
    await page.locator('main:visible .sales-reference-history-main').first().click(); await page.locator('main:visible .sales-reference-detail-actions').waitFor(); await page.locator('main:visible .sales-reference-detail-actions > button').nth(1).click(); await page.locator('main:visible .sales-reference-progress > button').first().click(); await page.locator('main:visible .sales-reference-cart-line').first().waitFor();
    await page.setViewportSize({ width: 320, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-cart-320.png') });
    await page.locator('main:visible .sales-reference-footer > button').last().click(); await page.locator('main:visible .sales-reference-payment').waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ animations: 'disabled', fullPage: true, path: path.join(output, 'myanmar-checkout-320.png') });
    await page.locator('main:visible .sales-reference-balance').first().evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'})); await page.screenshot({animations:'disabled',path:path.join(output,'myanmar-checkout-end-320.png')});
    assert.ok(await page.locator('main:visible .sales-reference-balance').first().evaluate(n=>n.getBoundingClientRect().bottom<=document.querySelector('main:not([hidden]) .sales-reference-footer').getBoundingClientRect().top));
    assert.deepEqual(errors, []); await fs.writeFile(path.join(output, `checks-${engine}.json`), JSON.stringify({ browser: engine, result: 'Six sales captures, directly visible channel and removed customer filter, date/payment/channel application and draft validation, print failure and successful retry, responsive overflow, cart end, quantity/FOC, Pay full, checkout retention, save failure/retry, retained source, delete cancellation and Myanmar history/drawer/editor passed.', errors, calls }, null, 2)); console.log(`Sales ${engine} dev-server checks passed.`);
  } catch (error) { if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, errors, calls, text: await page.locator('body').innerText() }, null, 2)); } throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
