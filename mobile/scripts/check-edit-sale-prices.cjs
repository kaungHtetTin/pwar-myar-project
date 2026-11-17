const { chromium, webkit } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
  const output = 'artifacts/edit-sale-prices';
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const errors = []; let saved = null, saves = 0;
      page.on('pageerror', error => errors.push(error.message));
      const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Shop', currency: 'Ks' }, permissions: ['sell', 'products', 'sales'], subscription: { is_valid: true } };
      const settings = { price_types: 'Retail,Wholesale', payment_methods: 'Cash', admin_pin_set: '0' };
      const sale = { id: 12, receipt_no: 'SALE-12', created_at: '2026-10-17 21:12:00', status: 'completed', payment_type: 'cash', payment_method: 'Cash', subtotal: 14000, total: 14000, paid_amount: 14000, discount: 0, credit_amount: 0, items: [
        { id: 1, product_id: 4, product_name: 'Ballpoint Pen', unit_name: 'Piece', price_type: 'Retail', unit_price: 9500, quantity: 1, foc_quantity: 0 },
        { id: 2, product_id: 5, product_name: 'Butter Cookies', unit_name: 'Piece', price_type: 'Retail', unit_price: 4500, quantity: 1, foc_quantity: 0 },
      ] };
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (!pathname.startsWith('/api/')) return route.continue();
        const endpoint = pathname.slice(4);
        let json = { items: [], total: 0, enabled: false };
        if (endpoint === '/auth/me') json = session;
        else if (endpoint === '/app-config') json = { enabled_modules: ['sell', 'products', 'sales'], permissions: session.permissions, language: 'en', business: session.business };
        else if (endpoint === '/settings') json = settings;
        else if (endpoint === '/sales/12') {
          if (route.request().method() === 'PUT') { saves++; saved = route.request().postDataJSON(); }
          json = sale;
        } else if (endpoint === '/products/4') {
          await new Promise(resolve => setTimeout(resolve, 200));
          json = { id: 4, price: 9500, prices: [{ name: 'Retail', price: 9500 }, { name: 'Wholesale', price: 8800 }] };
        }
        await route.fulfill({ json });
      });
      await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await page.goto('http://127.0.0.1:5176/sales/12/edit');
      const selector = page.getByLabel('Price type for Ballpoint Pen', { exact: true });
      const input = page.getByLabel('Ballpoint Pen unit price', { exact: true });
      await selector.waitFor();
      for (const width of [320, 393, 768]) {
        await page.setViewportSize({ width, height: 852 });
        const dimensions = await page.locator('.sales-edit-price-row').evaluateAll(rows => rows.map(row => {
          const controls = [...row.querySelectorAll('input,select')].map(node => node.getBoundingClientRect());
          return { aligned: Math.abs(controls[0].top - controls[1].top) < 2, separate: controls[0].right <= controls[1].left, heights: controls.map(rect => rect.height) };
        }));
        assert.ok(dimensions.every(row => row.aligned && row.separate && row.heights.every(height => height >= 44)), JSON.stringify(dimensions));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 393, height: 852 });
      await selector.selectOption('Wholesale');
      assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isEnabled(), false);
      await page.waitForFunction(() => document.querySelector('[aria-label="Ballpoint Pen unit price"]').value === '8800');
      await page.waitForFunction(() => !document.querySelector('.sales-reference-edit-form fieldset').disabled);
      assert.equal(await selector.inputValue(), 'Wholesale');
      await input.fill('8700');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      assert.equal(await input.inputValue(), '8700');
      assert.equal(await selector.inputValue(), 'Wholesale');
      await selector.selectOption('Retail');
      await page.waitForFunction(() => document.querySelector('[aria-label="Ballpoint Pen unit price"]').value === '9500');
      await selector.selectOption('Wholesale');
      await page.waitForFunction(() => document.querySelector('[aria-label="Ballpoint Pen unit price"]').value === '8800');
      await page.waitForFunction(() => !document.querySelector('.sales-reference-edit-form fieldset').disabled);
      await page.screenshot({ path: `${output}/${name}-wholesale.png`, fullPage: true });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Paid amount', { exact: true }).fill('13300');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.waitForURL('**/sales');
      assert.equal(saves, 1);
      assert.equal(saved.items[0].price_type, 'Wholesale');
      assert.equal(saved.items[0].unit_price, 8800);
      assert.deepEqual(errors, []);
      results.push({ engine: name, widths: [320, 393, 768], sameRow: true, selectedPriceApplied: true, manualDraftRetained: true, switchingBackAppliedRetail: true, savedOnce: true });
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  console.log('PASS edit-sale price selector/input: same row at 320/393/768; selected price and totals, manual draft, Retail reset and single save verified in Chromium/WebKit. Fixture APIs only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
