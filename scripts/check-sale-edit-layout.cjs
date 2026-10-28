const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch();
  const output = 'artifacts/sale-edit-layout';
  await fs.mkdir(output, { recursive: true });
  const requests = [], mutations = [];
  const sale = { id: 12, receipt_no: 'R261018-0012', status: 'completed', created_at: '2026-10-18 09:00:00', paid_amount: 2700, discount: 0, items: [
    { product_id: 4, product_name: 'Beer', unit_name: 'Bottle', price_type: 'Retail', quantity: 1, foc_quantity: 0, unit_price: 2000 },
    { product_id: 5, product_name: 'Apple', unit_name: 'Piece', price_type: 'Retail', quantity: 1, foc_quantity: 0, unit_price: 700 },
  ] };
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('Page error:', error.message); });
    await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname.slice(4); requests.push(path);
      let data = { items: [], total: 0 };
      if (route.request().method() === 'PUT') { mutations.push(JSON.parse(route.request().postData())); data = { ...sale, ...mutations.at(-1) }; }
      else if (path === '/sales/12') data = sale;
      else if (path === '/settings') data = { price_types: 'Retail,Wholesale', currency: 'Ks', payment_methods: 'Cash,KPay', admin_pin_set: '0' };
      else if (path === '/categories') data = ['Beverages', 'Food'];
      else if (path === '/price-types') data = [];
      else if (path === '/products') {
        const all = Array.from({ length: 25 }, (_, i) => ({ id: i + 30, name: i ? `Product ${i + 1}` : 'Orange Juice', category: 'Beverages', base_unit: 'Bottle', price: 1200, sku: `SKU-${i + 1}` }));
        const filtered = all.filter(row => (!url.searchParams.get('q') || row.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase())) && (!url.searchParams.get('category') || row.category === url.searchParams.get('category')));
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
        data = { items: filtered.slice(offset, offset + limit), total: filtered.length };
      }
      await route.fulfill({ json: data });
    });
    await page.route('**/__sale-edit-layout', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const client=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=client.default||client;
      await import('/src/styles/cascade.css');
      const {SalesHistoryScreen}=await import('/src/transactions/SalesHistoryScreen.jsx');
      const {LocaleProvider}=await import('/src/localization/LocaleProvider.jsx');
      window.navigation=[];createRoot(document.getElementById('root')).render(React.createElement(LocaleProvider,null,React.createElement(SalesHistoryScreen,{pathname:'/sales/12/edit',onNavigate:(...args)=>window.navigation.push(args)})));
    </script>` }));
    await page.goto('http://127.0.0.1:5176/__sale-edit-layout');
    await page.getByLabel('Beer quantity', { exact: true }).waitFor().catch(async error => { console.log(await page.locator('body').innerText()); console.log(requests); throw error; });
    await page.getByLabel('Beer quantity', { exact: true }).fill('3');
    await page.screenshot({ path: `${output}/cart-393.png`, fullPage: true });
    assert.equal(await page.locator('.sale-cart-card').count(), 2);
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    let drawer = page.getByRole('dialog', { name: 'Add product' });
    await drawer.getByRole('checkbox', { name: 'Select Orange Juice', exact: true }).check();
    await page.screenshot({ path: `${output}/drawer-393.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByLabel('Beer quantity', { exact: true }).inputValue(), '3');
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    drawer = page.getByRole('dialog', { name: 'Add product' });
    await drawer.getByRole('checkbox', { name: 'Select Orange Juice', exact: true }).check();
    await drawer.getByRole('button', { name: 'Add 1 product', exact: true }).click();
    assert.equal(await page.locator('.sale-cart-card').count(), 3);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    assert.equal(await page.getByLabel('Beer quantity', { exact: true }).inputValue(), '3');
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 852 });
      await page.screenshot({ path: `${output}/cart-${width}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Pay full', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.waitForFunction(() => window.navigation.length > 0);
    assert.equal(mutations.length, 1); assert.equal(mutations[0].items.length, 3);
    assert.equal(requests.filter(path => path === '/sales/12').length, 2); // one initial GET, one save
    assert.deepEqual(errors, []);
    await fs.writeFile(`${output}/verification.json`, JSON.stringify({ viewports: [320, 393, 768], passed: ['shared cart frame', 'Escape discards staged choice', 'sale draft retained', 'one confirmed addition', 'Checkout/Previous retain edits', 'no horizontal overflow', 'single save'], mutations: mutations.length, errors }, null, 2));
    console.log('Sale editor rendered checks passed; no live API requests or writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
