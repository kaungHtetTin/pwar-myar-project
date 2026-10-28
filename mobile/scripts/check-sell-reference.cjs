const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated fixtures only: all API calls intercepted; no live checkout or inventory mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const output = path.resolve(__dirname, '../artifacts/sell-reference');
const origin = 'http://127.0.0.1:5176';
const products = [
  { id: 1, name: 'Premium Jasmine Rice', base_unit: '5 kg bag', sku: '001', stock: 48, price: 18500, photo: 'rice' },
  { id: 2, name: 'Sunflower Cooking Oil', base_unit: '1 litre', sku: '002', stock: 72, price: 8500, photo: 'oil' },
  { id: 3, name: 'Green Tea — Original', base_unit: '100 g box', sku: '003', stock: 36, price: 3500, photo: 'tea' },
  { id: 4, name: 'Natural Hand Soap', base_unit: '250 ml', sku: '004', stock: 24, price: 4200, photo: 'soap' },
  ...Array.from({ length: 20 }, (_, index) => ({ id: index + 5, name: `Pantry product ${index + 5}`, base_unit: 'Unit', sku: String(index + 5).padStart(3, '0'), stock: 12, price: 2000 })),
].map(product => ({ ...product, category: product.id <= 3 ? 'Food' : 'Household', cost: 1000, prices: [{ name: 'Retail', price: product.price }, { name: 'Wholesale', price: product.price - 100 }], photo_url: product.photo ? `/products/${product.id}/photo` : '' }));
const session = { user: { id: 101, name: 'Fixture Owner', role: 'owner' }, business: { id: 101, name: 'Reference Shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'shop'], subscription: { is_valid: true } };
const settings = { price_types: 'Retail,Wholesale', payment_methods: 'Cash,KPay', currency: 'MMK' };
const draft = { cart: products.slice(0, 3).map((p, i) => ({ product_id: p.id, product_name: p.name, photo_url: p.photo_url, price_type: 'Retail', unit_price: p.price, unit_cost: p.cost, base_unit: p.base_unit, quantity: i ? 1 : 2, foc_quantity: 0, stock: p.stock })), discount: 0, paidAmount: '', paymentMethod: 'Cash', customer: null };
(async () => {
  await fs.mkdir(output, { recursive: true });
  // Pillow crops are fixture assets only, never deployed as production product images.
  execFileSync('python', ['-c', `
from PIL import Image
from pathlib import Path
out=Path('artifacts/sell-reference')
im=Image.open('docs/design/sell/001-sell-product-selection-default.png')
for name,box in [('rice',(53,502,256,757)),('oil',(102,811,207,1078)),('tea',(60,1129,261,1376)),('soap',(67,1421,250,1586))]:
    im.crop(box).save(out/(name+'.png'))
for filename,name in [('001-sell-product-selection-default.png','sell'),('002-sell-cart-quantity-step-default.png','cart')]:
    Image.open(Path('docs/design/sell')/filename).resize((393,850)).crop((0,33,393,850)).save(out/(name+'-reference-content.png'))
`], { cwd: path.resolve(__dirname, '..') });
  const engine = process.env.SELL_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    await context.addInitScript(draft => {
      const key = 'mkpos-mobile-sale-draft-v1:101:101';
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(draft));
      localStorage.setItem('mkpos.language', 'en');
    }, draft);
    const page = await context.newPage();
    await context.addInitScript(()=>{if(navigator.mediaDevices) navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Camera permission denied','NotAllowedError');};});
    const calls = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.slice(4);
      calls.push({ endpoint, query: url.search, method: request.method() });
      let response;
      const photo = endpoint.match(/^\/products\/(\d+)\/photo$/);
      if (photo) {
        const product = products.find(p => p.id === Number(photo[1]));
        return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(output, `${product.photo}.png`)) });
      }
      if (endpoint === '/auth/me') response = session;
      else if (endpoint === '/app-config') response = { enabled_modules: ['sell', 'products', 'sales', 'shop'], permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') response = settings;
      else if (endpoint === '/price-types') response = [];
      else if (endpoint === '/categories') response = ['Food', 'Household'];
      else if (endpoint === '/products') {
        const matches = products.filter(p => (!url.searchParams.get('q') || p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('category') || p.category === url.searchParams.get('category')));
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
        response = { items: matches.slice(offset, offset + limit), total: matches.length };
      }
      else if (endpoint.startsWith('/products/barcode/')) response = products[0];
      else if (endpoint === '/shop-admin/chat/config') response = { enabled: false, realtime_enabled: false };
      else response = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.goto(`${origin}/sell`);
    await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    await page.evaluate(async ({ session, products, settings }) => {
      const store = await import('/src/offline/offlineStore.js');
      await store.replaceOfflineCache({ session, products, settings, categories: ['Food', 'Household'] });
      window.dispatchEvent(new Event('mkpos:mobile-offline-state'));
      await document.fonts.ready;
    }, { session, products, settings });
    await page.getByText('Online · Offline cache ready', { exact: true }).waitFor();
    // Search/scanner composition and inline pricing must survive shared field styles.
    const toolbarMetrics = [];
    for (const width of [320, 362, 393]) {
      await page.setViewportSize({ width, height: 874 });
      const metric = await page.locator('.sale-products-page').evaluate(root => {
        const search = root.querySelector('.sale-quick-find .ui-search');
        const input = search.querySelector('input');
        const scan = search.querySelector('.sale-scan-button');
        const row = root.querySelector('.retail-results-toolbar');
        const count = row.querySelector('span');
        const price = row.querySelector('select');
        const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; };
        return { viewport: innerWidth, search: rect(search), input: rect(input), scan: rect(scan), row: rect(row), count: rect(count), price: rect(price), inputBorder: getComputedStyle(input).borderWidth, inputShadow: getComputedStyle(input).boxShadow, countWhiteSpace: getComputedStyle(count).whiteSpace };
      });
      assert.equal(metric.inputBorder, '0px', 'The search has one outer border');
      assert.equal(metric.inputShadow, 'none', 'The inner search input has no second surface');
      assert.ok(metric.scan.right <= metric.search.right + 1, 'Scanner stays inside search');
      assert.ok(metric.count.right < metric.price.left, 'Product count and price selector do not overlap');
      assert.ok(metric.price.width < metric.row.width * .6, 'Price selector stays compact');
      assert.equal(metric.countWhiteSpace, 'nowrap', 'Product count stays on one line');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Toolbar overflow at ${width}`);
      toolbarMetrics.push(metric);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `sell-controls-${engine}-${width}.png`) });
    }
    await fs.writeFile(path.join(output, `toolbar-${engine}.json`), JSON.stringify(toolbarMetrics, null, 2));
    await page.setViewportSize({ width: 393, height: 817 });
    await page.waitForFunction(() => [...document.querySelectorAll('.sale-mobile-product-photo')].filter(img => img.complete && img.naturalWidth > 0).length === 4);
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'sell-393.png') });
    await page.getByRole('button', { name: 'View cart', exact: true }).click();
    await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.retail-cart-product-photo')].filter(img => img.complete && img.naturalWidth > 0).length === 3);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'cart-393.png') });
    execFileSync('python', ['-c', `
from PIL import Image
from pathlib import Path
out=Path('artifacts/sell-reference')
for name in ['sell','cart']:
    canvas=Image.new('RGB',(786,817),'white')
    canvas.paste(Image.open(out/(name+'-reference-content.png')).convert('RGB'),(0,0))
    canvas.paste(Image.open(out/(name+'-393.png')).convert('RGB'),(393,0))
    canvas.save(out/(name+'-comparison.png'))
`], { cwd: path.resolve(__dirname, '..') });
    console.log('Reference screenshots saved.');
    // Direct input, sold/FOC increments/decrements, FOC total semantics, and line removal.
    await page.getByRole('button', { name: 'Increase Premium Jasmine Rice free quantity', exact: true }).click();
    assert.equal(await page.getByLabel('Premium Jasmine Rice free quantity', { exact: true }).inputValue(), '1');
    assert.match(await page.locator('.retail-cart-summary').innerText(), /49,000 MMK/);
    await page.getByRole('button', { name: 'Decrease Premium Jasmine Rice free quantity', exact: true }).click();
    await page.getByRole('button', { name: 'Increase Premium Jasmine Rice', exact: true }).click();
    assert.match(await page.locator('.retail-cart-summary').innerText(), /67,500 MMK/);
    await page.getByRole('button', { name: 'Decrease Premium Jasmine Rice', exact: true }).click();
    await page.getByLabel('Premium Jasmine Rice quantity', { exact: true }).fill('2.5');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'cart-quantity-focus.png') });
    await page.getByLabel('Premium Jasmine Rice quantity', { exact: true }).blur();
    assert.match(await page.locator('.retail-cart-summary').innerText(), /58,250 MMK/);
    await page.getByLabel('Premium Jasmine Rice quantity', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Continue to checkout', exact: true }).click();
    await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Premium Jasmine Rice quantity', { exact: true }).inputValue(), '2');
    const initialProductCalls = () => calls.filter(c => c.endpoint === '/products').length;
    await page.getByRole('button', { name: 'Back to products', exact: true }).click();
    await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    const beforeSearch = initialProductCalls();
    await page.getByRole('textbox', { name: 'Search sale products', exact: true }).fill('Tea');
    await page.waitForResponse(response => response.url().includes('/api/products?') && response.url().includes('q=Tea'));
    assert.ok(initialProductCalls() > beforeSearch);
    await page.getByRole('button', { name: 'Open cart', exact: true }).click();
    await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
    const beforeReturn = initialProductCalls();
    await page.getByRole('button', { name: 'Add more products', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Search sale products', exact: true }).inputValue(), 'Tea');
    assert.equal(initialProductCalls(), beforeReturn, 'Back must not fetch products again');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.waitForResponse(response => response.url().includes('/api/products?') && !response.url().includes('q='));
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('dialog', { name: 'Filters', exact: true }).waitFor();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'filters-393.png') });
    await page.getByRole('dialog', { name: 'Filters', exact: true }).getByRole('radio', { name: 'Food', exact: true }).check();
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('button', { name: 'Filters, 1 active filters', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Filters, 1 active filters', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('combobox', { name: 'Price type', exact: true }).selectOption('Wholesale');
    await page.getByRole('combobox', { name: 'Price type', exact: true }).selectOption('Retail');
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Main navigation', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await page.getByRole('link', { name: 'Offline invoices', exact: true }).click();
    await page.getByRole('heading', { name: 'Offline sales', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    for (const width of [320, 362, 768]) {
      await page.setViewportSize({ width, height: 817 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Sell overflow at ${width}`);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `sell-${width}.png`) });
      await page.getByRole('button', { name: 'View cart', exact: true }).click();
      await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Cart overflow at ${width}`);
      assert.ok(await page.locator('.ui-quantity-control').evaluateAll(groups => groups.every(group => {
        const input = group.querySelector('input'), buttons = [...group.querySelectorAll('button')];
        return input.clientWidth >= 40 && buttons.every(button => button.clientWidth >= 42 && button.clientHeight >= 42) && group.scrollWidth <= group.clientWidth;
      })), `Cart quantity values and actions fit at ${width}`);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `cart-${width}.png`) });
      await page.getByRole('button', { name: 'Back to products', exact: true }).click();
    }
    await page.setViewportSize({ width: 393, height: 817 });
    await page.getByRole('textbox', { name: 'Search sale products', exact: true }).focus();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'search-focused-393.png') });
    await page.getByRole('button', { name: 'Scan product barcode', exact: true }).click();
    await page.getByRole('dialog', { name: 'Scan barcode', exact: true }).waitFor();
    await page.locator('.product-barcode-scanner-error').waitFor(); await page.screenshot({animations:'disabled',path:path.join(output,'scanner-denied-393.png')});
    await page.getByLabel('Enter barcode manually',{exact:true}).fill('001'); await page.getByRole('button',{name:'Search product',exact:true}).click();
    const barcodeSearch = page.getByRole('textbox', { name: 'Search sale products', exact: true });
    await barcodeSearch.fill('001');
    await barcodeSearch.press('Enter');
    await page.getByRole('button', { name: 'Open cart', exact: true }).click();
    await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Premium Jasmine Rice quantity', { exact: true }).inputValue(), '4');
    await page.getByRole('button', { name: 'Remove Green Tea — Original', exact: true }).click();
    assert.equal(await page.getByLabel('Green Tea — Original quantity', { exact: true }).count(), 0);
    // Navigation entry points remain permission-aware and usable on return.
    await page.getByRole('button', { name: 'Sell', exact: true }).click();
    await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    for (const [label, route] of [['Products', '/products'], ['Sales', '/sales'], ['My Shop', '/shop']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForURL(`${origin}${route}`);
      await page.goBack();
      await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    }
    const directPage = await context.newPage();
    await directPage.goto(`${origin}/sell`);
    assert.equal(await directPage.getByRole('button', { name: /^Back/ }).count(), 0);
    await directPage.getByRole('button', { name: 'Products', exact: true }).click();
    await directPage.waitForURL(`${origin}/products`);
    await directPage.close();
    // Switch through the real language control, then re-open Sell and Cart.
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my');
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: 'အရောင်း', exact: true }).waitFor();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'sell-myanmar-393.png') });
    await page.getByRole('button', { name: 'ခြင်းတောင်းကြည့်ရန်', exact: true }).click();
    await page.getByRole('heading', { name: 'ခြင်းတောင်း', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Myanmar Cart overflow');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'cart-myanmar-393.png') });
    assert.deepEqual(errors, []);
    assert.ok(calls.every(call => call.method === 'GET'), 'No mutation requests should be sent');
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ browser: engine, errors, requests: calls, checks: 'Reference screenshots; quantity and FOC totals; checkout Back; retained search without refetch; filters; price selector; menus/offline entry; 320/768 overflow.' }, null, 2));
    console.log('Sell/Cart isolated visual and navigation checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
