const { setDrawerLanguage } = require('./drawer-language.cjs');
// Dev-server QA only: isolated context, synthetic purchase data, intercepted API.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176', output = path.resolve(__dirname, '../artifacts/purchases-reference');
const session = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'purchases', 'suppliers', 'sales', 'shop'], subscription: { is_valid: true } };
const supplier = { id: 2, name: 'Golden River Trading', phone: '+95 9 123 456 789', contact_person: 'U Aung Kyaw', address: 'No. 123, Industrial Zone,\nYangon, Myanmar' };
const products = ['Premium Jasmine Rice', 'Sunflower Cooking Oil', 'Green Tea — Original', 'White Sugar', 'Red Lentils'].map((name, i) => ({ id: i + 1, name, sku: `SKU 00${i + 1}`, barcode: `885012345678${9 - i}`, category: ['Rice', 'Cooking Oil', 'Tea', 'Other', 'Other'][i], base_unit: ['bag', 'bottle', 'box', 'kg', 'kg'][i], purchase_unit: i === 0 ? 'carton' : '', purchase_conversion_factor: i === 0 ? 10 : 1, cost: [14000, 6000, 3000, 2000, 3000][i], price: [18500, 8500, 3500, 2800, 4200][i], stock: [48, 72, 36, 120, 80][i], photo_url: `/products/${i + 1}/photo`, prices: [{ name: 'Retail', price: [18500, 8500, 3500, 2800, 4200][i], is_manual: true }] }));
function item(i, qty, foc, cost) { const product = products[i], factor = product.purchase_conversion_factor; return { id: i + 1, product_id: product.id, product_name: product.name, unit_name: product.purchase_unit || product.base_unit, conversion_factor: factor, quantity: qty, foc_quantity: foc, base_quantity: qty * factor, base_foc_quantity: foc * factor, unit_cost: cost, line_total: qty * cost, effective_unit_cost: qty * cost / ((qty + foc) * factor) }; }
let purchase = { id: 218, supplier_id: 2, supplier_name: supplier.name, created_at: '2026-10-15 10:30:00', status: 'completed', total_cost: 340000, paid_amount: 300000, credit_amount: 40000, payment_method: 'Cash', note: 'Stock replenishment for mid-October. Next delivery in 2 weeks.', items: [item(0, 2, .1, 140000), item(1, 10, 0, 6000)] };
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image; from pathlib import Path; p=Path('artifacts/purchases-reference'); [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(p/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/purchases').glob('*.png')]; im=Image.open('docs/design/purchases/016-purchases-new-select-products-step-select-products-step.png').resize((393,850)); [im.crop(box).save(p/name) for box,name in [((54,304,123,393),'rice.png'),((54,400,123,490),'oil.png'),((54,496,123,583),'tea.png'),((54,590,123,677),'sugar.png'),((54,684,123,770),'lentils.png')]]"], { cwd: path.resolve(__dirname, '..') });
  const browser = await (process.env.PURCHASE_BROWSER === 'firefox' ? firefox : chromium).launch({ headless: true });
  let page, calls = [], errors = [], failSave = false;
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, timezoneId: 'Asia/Yangon', ...(process.env.PURCHASE_BROWSER === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4), method = req.method();
      const body = ['POST', 'PUT'].includes(method) && req.headers()['content-type']?.includes('json') ? req.postDataJSON() : undefined;
      calls.push({ endpoint, query: url.search, method, body });
      if (/^\/products\/\d+\/photo$/.test(endpoint)) return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(output, ['rice.png', 'oil.png', 'tea.png', 'sugar.png', 'lentils.png'][Number(endpoint.split('/')[2]) - 1])) });
      if ((endpoint === '/purchases' && method === 'POST') || (endpoint === '/purchases/218' && method === 'PUT')) {
        if (failSave) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture: purchase could not be saved.' }) });
        purchase = { ...purchase, ...body, items: body.items.map((line, index) => { const p = products.find(product => product.id === line.product_id), factor = line.unit_name === p.purchase_unit ? p.purchase_conversion_factor : 1; return { ...line, id: index + 1, product_name: p.name, conversion_factor: factor, base_quantity: Number(line.quantity) * factor, base_foc_quantity: Number(line.foc_quantity) * factor, line_total: Number(line.quantity) * Number(line.unit_cost), effective_unit_cost: Number(line.quantity) * Number(line.unit_cost) / ((Number(line.quantity) + Number(line.foc_quantity)) * factor) }; }) };
        purchase.total_cost = purchase.items.reduce((sum, line) => sum + line.line_total, 0); purchase.credit_amount = purchase.total_cost - purchase.paid_amount;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(purchase) });
      }
      let result;
      if (endpoint === '/auth/me') result = session;
      else if (endpoint === '/app-config') result = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') result = { currency: 'MMK', price_types: 'Retail', payment_methods: 'Cash', admin_pin_set: '1' };
      else if (endpoint === '/categories') result = ['Rice', 'Cooking Oil', 'Tea', 'Other'];
      else if (endpoint === '/suppliers/2') result = supplier;
      else if (endpoint === '/suppliers') { const rows = [supplier, { id: 3, name: 'North Star Supply', address: 'Mandalay, Myanmar', phone: '+95 9 234 567 890' }, { id: 4, name: 'Evergreen Wholesale', address: 'Nay Pyi Taw, Myanmar', phone: '+95 9 345 678 901' }].filter(s => !url.searchParams.get('q') || s.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())); result = { items: rows, total: rows.length }; }
      else if (endpoint === '/products') { const rows = products.filter(p => (!url.searchParams.get('q') || p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('category') || p.category === url.searchParams.get('category'))); result = { items: rows, total: rows.length }; }
      else if (/^\/products\/\d+$/.test(endpoint)) result = products.find(p => p.id === Number(endpoint.split('/')[2]));
      else if (endpoint === '/purchases/218') result = purchase;
      else if (endpoint === '/purchases') result = { items: [purchase, { ...purchase, id: 217, supplier_name: 'North Star Supply', total_cost: 125000, paid_amount: 125000, credit_amount: 0, created_at: '2026-10-12 10:00:00' }, { ...purchase, id: 216, supplier_name: 'Evergreen Wholesale', total_cost: 82000, paid_amount: 0, credit_amount: 82000, created_at: '2026-10-08 10:00:00' }], total: 3 };
      else if (endpoint === '/shop-admin/chat/config') result = { enabled: false };
      else result = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    async function capture(id) {
      if (id === '018') await fs.writeFile(path.join(output, 'review-font-audit.json'), JSON.stringify(await page.locator('.purchase-reference-page, .purchase-reference-page *').evaluateAll(nodes => nodes.filter(n => n.textContent.includes('Golden River') && n.children.length < 3).map(n => ({tag:n.tagName, cls:n.className,font:getComputedStyle(n).fontFamily}))), null, 2));
      await page.evaluate(() => document.fonts.ready);
      if (['015', '016', '017', '018', '019', '020', '021', '022'].includes(id)) {
        const buttons = await page.locator('main:visible .purchase-reference-footer > div:last-child > button').evaluateAll(nodes => nodes.map(node => { const s = getComputedStyle(node); const r = node.getBoundingClientRect(); return { height: r.height, width: r.width, font: s.fontSize, radius: s.borderRadius }; }));
        assert.equal(buttons.length, 2);
        assert.equal(buttons[0].height, buttons[1].height);
        assert.ok(buttons[0].height >= 44);
        assert.ok(Math.abs(buttons[0].width - buttons[1].width) < 1);
        await fs.writeFile(path.join(output, `navigation-${id}.json`), JSON.stringify(buttons, null, 2));
      }
      if (id === '018' && process.env.PURCHASE_BROWSER !== 'firefox') { const audit = await context.newCDPSession(page); await audit.send('DOM.enable'); await audit.send('CSS.enable'); const root = await audit.send('DOM.getDocument'); const node = await audit.send('DOM.querySelector', { nodeId: root.root.nodeId, selector: '.purchase-supplier-summary strong' }); await fs.writeFile(path.join(output, 'review-platform-font.json'), JSON.stringify(await audit.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId }), null, 2)); await audit.detach(); }
      if (id === '014' && process.env.PURCHASE_BROWSER !== 'firefox') { const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const doc = await cdp.send('DOM.getDocument'); const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.purchase-reference-header h1' }); await fs.writeFile(path.join(output,'font-audit.json'),JSON.stringify({ actual: await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId }), computed: await page.locator('h1').evaluate(n => ({font:getComputedStyle(n).fontFamily, inherited:getComputedStyle(n.parentElement).fontFamily})) },null,2)); await cdp.detach(); }
      await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => node.blur()));
      await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(requestAnimationFrame); });
      await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}.png`) });
      execFileSync('python', ['-c', `from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/purchases-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/purchases-reference/screen-${id}.png'),(393,0)); im.save('artifacts/purchases-reference/comparison-${id}.png')`], { cwd: path.resolve(__dirname, '..') });
      for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); await page.evaluate(() => window.scrollTo(0, 0)); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id} ${width}px overflow`); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}-${width}.png`) }); }
      await page.setViewportSize({ width: 393, height: 817 }); await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.goto(`${origin}/purchases`);
    await page.getByText('Golden River Trading', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.getByRole('button', { name: 'Custom', exact: true }).click(); await page.getByLabel('From', { exact: true }).fill('2026-10-01'); await page.getByLabel('To', { exact: true }).fill('2026-10-15'); await Promise.all([page.waitForResponse(r => r.url().includes('/purchases?') && r.url().includes('date_from=2026-10-01')), page.getByRole('button', { name: /Apply filters/ }).click()]); await capture('014'); await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'New purchase', exact: true }).click();
    await page.getByRole('heading', { name: 'New purchase', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Supplier', exact: true }).fill('Golden');
    await page.getByRole('radio', { name: /Golden River Trading/ }).check(); await capture('133'); await page.getByRole('button', { name: 'Use supplier', exact: true }).click();
    await page.getByLabel('Reference number', { exact: true }).fill('SUP0218'); await page.getByLabel('Purchase date', { exact: true }).fill('2026-10-15'); await capture('015'); await page.getByLabel('Note', { exact: true }).fill(purchase.note);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const productSearch = page.getByRole('textbox', { name: 'Search purchase products', exact: true });
    await productSearch.fill('Rice');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    assert.equal(await productSearch.inputValue(), '');
    assert.equal(await page.getByLabel('Purchase categories', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('Purchase product category', { exact: true }).selectOption('Tea');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('button', { name: 'Select Green Tea — Original', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Filters, 1 active filters', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Scan purchase product barcode', exact: true }).click();
    await page.getByRole('dialog', { name: 'Scan product barcode', exact: true }).waitFor();
    await page.getByRole('dialog', { name: 'Scan product barcode', exact: true }).getByRole('button', { name: 'Close Scan product barcode', exact: true }).click();
    await page.getByRole('button', { name: 'Select Premium Jasmine Rice', exact: true }).click();
    await page.getByRole('button', { name: 'Select Sunflower Cooking Oil', exact: true }).click(); await capture('016');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Quantity for Premium Jasmine Rice', { exact: true }).fill('2');
    await page.getByLabel('FOC for Premium Jasmine Rice', { exact: true }).fill('1');
    await page.getByLabel('Quantity for Sunflower Cooking Oil', { exact: true }).fill('10'); await capture('017');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Paid now', { exact: true }).fill('300000'); await capture('018');
    const createPage = page.locator('main:visible'); await createPage.evaluate(el => el.dataset.retainedMarker = 'same-draft');
    await page.getByRole('button', { name: 'Back to purchases', exact: true }).click(); await page.goForward();
    assert.equal(await page.locator('main:visible').getAttribute('data-retained-marker'), 'same-draft');
    assert.equal(await page.getByLabel('Paid now', { exact: true }).inputValue(), '300,000');
    await page.getByRole('button', { name: 'Previous', exact: true }).click(); await page.getByLabel('Cost for Premium Jasmine Rice', { exact: true }).fill('200000'); await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Save purchase', exact: true }).click(); await page.getByRole('dialog', { name: 'Review selling prices', exact: true }).waitFor(); await capture('134'); await page.getByRole('button', { name: 'Go back and edit', exact: true }).click(); await page.getByLabel('Cost for Premium Jasmine Rice', { exact: true }).fill('140000'); await page.getByRole('button', { name: 'Continue', exact: true }).click();
    failSave = true; await page.getByRole('button', { name: 'Save purchase', exact: true }).click();
    await page.getByText('Fixture: purchase could not be saved.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Paid now', { exact: true }).inputValue(), '300,000');
    failSave = false; await page.getByRole('button', { name: 'Save purchase', exact: true }).click();
    await page.getByRole('heading', { name: 'Purchases', exact: true }).waitFor();
    assert.ok(calls.some(call => call.method === 'POST' && call.body.items[0].foc_quantity === .1 && call.body.paid_amount === 300000));
    await page.getByRole('button', { name: 'Actions for purchase 218', exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit purchase', exact: true }).waitFor(); await page.getByLabel('Note', { exact: true }).waitFor(); await capture('019');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await capture('020');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await capture('021');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await capture('022');
    await page.getByRole('button', { name: 'Save purchase', exact: true }).click(); await page.getByRole('heading', { name: 'Purchases', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Actions for purchase 218', exact: true }).click(); await page.getByRole('button', { name: 'View details', exact: true }).click();
    await page.getByRole('heading', { name: 'PUR0218', exact: true }).waitFor(); await capture('023');
    await page.getByRole('button', { name: 'Delete purchase', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete purchase?', exact: true }).waitFor();
    await page.getByLabel('Admin PIN', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
    await page.getByRole('button', { name: 'Back to purchases', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search purchase history', exact: true }); await search.fill('Golden'); await Promise.all([page.waitForResponse(response => response.url().includes('q=Golden')), page.getByRole('button', { name: 'Apply purchase search', exact: true }).click()]);
    await search.evaluate(el => el.dataset.retainedMarker = 'same-search');
    await page.getByRole('button', { name: 'Actions for purchase 218', exact: true }).click(); await page.getByRole('button', { name: 'View details', exact: true }).click();
    await page.getByRole('heading', { name: 'PUR0218', exact: true }).waitFor(); const beforeBack = calls.length;
    await page.getByRole('button', { name: 'Back to purchases', exact: true }).click();
    assert.equal(await search.inputValue(), 'Golden'); assert.equal(await search.getAttribute('data-retained-marker'), 'same-search'); assert.equal(calls.length, beforeBack);
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.getByRole('button', { name: 'Custom', exact: true }).click(); await page.getByLabel('From', { exact: true }).fill('2026-10-01'); await page.getByLabel('To', { exact: true }).fill('2026-10-15'); await capture('113'); assert.ok(await page.locator('dialog[open] .purchase-date-input').first().evaluate(n => n.getBoundingClientRect().width >= 200)); await page.locator('dialog[open]').getByLabel('Supplier', { exact: true }).selectOption('Golden River Trading'); await page.getByRole('button', { name: /Apply filters/ }).click();
    await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-history.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ browser: process.env.PURCHASE_BROWSER || 'chromium', result: 'Thirteen purchase references captured; create/edit, date/reference fields, base-unit FOC, supplier confirmation, protected delete cancellation, filter drafts and retained navigation passed.', errors, calls }, null, 2));
    console.log('Purchase reference checks passed (13 views).');
  } catch (error) { if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ errors, calls, body: await page.locator('body').innerText() }, null, 2)); } throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
