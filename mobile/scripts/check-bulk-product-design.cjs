// Isolated browser contexts and intercepted fixture APIs; no live mutations.
const { chromium } = require('../../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = process.env.MOBILE_ORIGIN || 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../../artifacts/mobile-bulk-design');

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const language of ['en', 'my']) for (const width of [320, 402, 768]) {
      const height = width === 320 ? 740 : width === 402 ? 877 : 1024;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Yangon' });
      await context.addInitScript(lang => localStorage.setItem('mkpos.language', lang), language);
      const page = await context.newPage();
      let products = Array.from({ length: 137 }, (_, index) => ({ id: index + 1,
        name: ['copper bushing (volvo brake)', 'Brake shoe assembly', 'Drinking Water'][index] || `Spare part ${index + 1}`,
        sku: index === 0 ? '' : `SP-${index + 1}`, barcode: '', category: 'Parts', base_unit: 'Piece',
        stock: index === 0 ? 0 : 12, low_stock_threshold: 3, price: 1500 + index * 100, cost: 1000, prices: [] }));
      const requests = [], errors = [];
      const session = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'Ks' },
        permissions: ['sell', 'products', 'sales', 'shop', 'settings'], subscription: { is_valid: true } };
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
      await context.route(`${origin}/api/**`, async route => {
        const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.slice(4);
        requests.push({ endpoint, method: request.method() });
        let body;
        if (endpoint === '/products/bulk-delete') {
          const ids = request.postDataJSON().ids, deleted = ids.filter(id => id !== 2);
          products = products.filter(product => !deleted.includes(product.id));
          body = { ok: true, deleted_count: deleted.length, deleted_ids: deleted, skipped_count: ids.includes(2) ? 1 : 0,
            skipped_products: products.filter(product => ids.includes(product.id) && product.id === 2) };
        } else if (endpoint === '/auth/me') body = session;
        else if (endpoint === '/app-config') body = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
        else if (endpoint === '/settings') body = { currency: 'Ks', price_types: 'Retail', payment_methods: 'Cash' };
        else if (endpoint === '/products/summary') body = { total_products: products.length, low_stock: 27, total_stock_units: 1632, out_of_stock: 1 };
        else if (endpoint === '/categories') body = ['Parts'];
        else if (endpoint === '/price-types') body = { items: ['Retail'], rules: [{ name: 'Retail', pricing_mode: 'manual' }] };
        else if (endpoint === '/products') {
          const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
          body = { items: products.slice(offset, offset + limit), total: products.length };
        } else if (endpoint === '/shop-admin/chat/config') body = { enabled: false };
        else body = { items: [], total: 0 };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/products`);
      await page.locator('.product-toolbar-select').waitFor();
      await page.waitForFunction(() => !document.querySelector('.product-toolbar-select')?.disabled && document.querySelectorAll('.product-card').length > 0);
      await page.evaluate(() => document.fonts.ready);
      const search = page.locator('#product-search'), searchGroup = page.locator('.product-search');
      const filter = page.locator('.product-toolbar-toggle'), select = page.locator('.product-toolbar-select');
      const normalSearch = await searchGroup.boundingBox(), filterRect = await filter.boundingBox(), selectRect = await select.boundingBox();
      assert.ok(Math.abs(normalSearch.y - selectRect.y) < 1 && Math.abs(filterRect.y - selectRect.y) < 1, 'Search, Filter and Select share one row');
      assert.equal(filterRect.width, selectRect.width); assert.equal(filterRect.height, selectRect.height);
      await page.waitForFunction(() => {
        const nodes = [...document.querySelectorAll('.mobile-control-row > button')];
        const styles = nodes.map(node => { const style = getComputedStyle(node); return [style.border, style.borderRadius, style.backgroundColor, style.color].join('|'); });
        return styles.length === 2 && styles[0] === styles[1];
      });
      const buttonStyles = await page.locator('.mobile-control-row > button').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node); return [style.border, style.borderRadius, style.backgroundColor, style.color].join('|');
      }));
      assert.equal(buttonStyles[0], buttonStyles[1], 'Filter and Select have the same design');
      await page.screenshot({ path: path.join(output, `${language}-${width}-toolbar.png`), animations: 'disabled' });
      if (language === 'en' && width === 402) await page.locator('.mobile-product-controls').screenshot({ path: path.join(output, 'toolbar-row.png'), animations: 'disabled' });
      await search.focus();
      assert.equal(await filter.isVisible(), false); assert.equal(await select.isVisible(), false);
      assert.equal(await page.locator('.product-search-scan').isVisible(), false);
      const expandedSearch = await searchGroup.boundingBox();
      assert.ok(expandedSearch.width > normalSearch.width + 90, 'Focused search expands into the button space');
      await search.fill('copper');
      await page.screenshot({ path: path.join(output, `${language}-${width}-focused-search.png`), animations: 'disabled' });
      if (language === 'en' && width === 402) await page.locator('.mobile-product-controls').screenshot({ path: path.join(output, 'focused-search-row.png'), animations: 'disabled' });
      await page.locator('.product-search-clear').click();
      assert.equal(await search.inputValue(), '');
      assert.equal(await search.evaluate(node => document.activeElement === node), true, 'Clear keeps search focused');
      assert.equal(await filter.isVisible(), false);
      await page.locator('.product-reference-list-heading').click();
      assert.equal(await filter.isVisible(), true); assert.equal(await select.isVisible(), true);
      await select.click();
      await page.locator('.product-bulk-selection').waitFor();
      const zero = await page.locator('.product-bulk-selection').boundingBox();
      assert.ok(zero.height <= 60, `${language}/${width}: selection toolbar too tall: ${zero.height}`);
      assert.equal(await page.locator('.product-bulk-actions').count(), 0, 'No disabled delete bar at zero selection');
      await page.screenshot({ path: path.join(output, `${language}-${width}-empty-selection.png`), animations: 'disabled' });
      const checks = page.locator('.product-card .product-bulk-checkbox input');
      assert.ok(await checks.count() >= 2);
      const firstName = await page.locator('.product-card h3').first().boundingBox();
      const firstCheck = await checks.first().boundingBox();
      assert.ok(firstName.x + firstName.width <= firstCheck.x, 'Product identity cannot cover its checkbox');
      await checks.nth(0).check(); await checks.nth(1).check();
      const actions = page.locator('.product-bulk-actions');
      await actions.waitFor();
      if (language === 'my') assert.ok(!(await actions.textContent()).includes('selected'), 'Selection count is localized as a whole string');
      const actionRect = await actions.boundingBox();
      assert.ok(actionRect.height <= 76, 'Compact bottom actions');
      assert.ok(actionRect.y + actionRect.height < height - 50, 'Bottom actions must clear navigation');
      assert.equal(await page.locator('.product-reference-page .ui-fab').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow');
      await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => node.blur()));
      await page.screenshot({ path: path.join(output, `${language}-${width}-selected.png`), animations: 'disabled' });
      await actions.locator('button').last().click();
      const dialog = page.locator('.mobile-sheet--delete-confirmation');
      await dialog.waitFor();
      await dialog.locator('.product-bulk-confirm-list li').filter({ hasText: 'Brake shoe assembly' }).waitFor();
      const review = await dialog.locator('.product-bulk-review').evaluate(node => ({
        clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop,
        items: [...node.querySelectorAll('li')].map(item => ({ text: item.textContent, top: item.getBoundingClientRect().top, bottom: item.getBoundingClientRect().bottom })),
        top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom,
      }));
      await fs.writeFile(path.join(output, `${language}-${width}-review.json`), JSON.stringify(review, null, 2));
      assert.equal(review.items.length, 2, 'Review contains both selected products');
      assert.ok(review.items.every(item => item.top >= review.top && item.bottom <= review.bottom), 'Both names fit in the two-product review');
      await page.screenshot({ path: path.join(output, `${language}-${width}-confirm.png`), animations: 'disabled' });
      await dialog.locator('button[type="submit"]').click();
      await dialog.locator('.mobile-notice--warning').waitFor();
      await dialog.locator('.product-bulk-confirm-list li').filter({ hasText: 'Brake shoe assembly' }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.product-card .product-bulk-checkbox input:checked').count(), 1);
      assert.equal(requests.filter(request => request.endpoint === '/products/bulk-delete').length, 1);
      assert.equal(requests.filter(request => request.method === 'DELETE').length, 0);
      await page.screenshot({ path: path.join(output, `${language}-${width}-partial.png`), animations: 'disabled' });
      await dialog.locator('.mobile-delete-actions button[type="button"]').click();
      assert.equal(await page.locator('.product-card .product-bulk-checkbox input:checked').count(), 1, 'Dismissal retains the skipped selection');
      if (language === 'en' && width === 402) {
        for (let attempt = 0; attempt < 7 && await page.locator('.product-card').count() < products.length; attempt++) {
          const count = await page.locator('.product-card').count();
          await page.locator('.product-card').last().scrollIntoViewIfNeeded();
          await page.waitForFunction(previous => document.querySelectorAll('.product-card').length > previous, count);
        }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const last = await page.locator('.product-card').last().boundingBox(), bar = await actions.boundingBox();
        assert.ok(last.y + last.height <= bar.y, 'Final product must not be hidden by the bottom action bar');
        await page.screenshot({ path: path.join(output, 'en-402-scrolled-selection.png'), animations: 'disabled' });
      }
      await actions.locator('button').first().click();
      assert.equal(await page.locator('.product-bulk-actions').count(), 0, 'Clear removes the action bar');
      await page.locator('.product-bulk-selection > button').click();
      await page.locator('.product-toolbar-select[aria-pressed="false"]').waitFor();
      assert.equal(await page.locator('.product-reference-page .ui-fab').count(), 1, 'Leaving selection restores normal product actions');
      assert.deepEqual(errors, []);
      results.push({ language, width, searchWidth: normalSearch.width, focusedSearchWidth: expandedSearch.width, toolbarHeight: zero.height, actionHeight: actionRect.height, firstProductY: await page.locator('.product-card').first().evaluate(node => node.getBoundingClientRect().y) });
      await context.close();
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ passed: true, screenshots: results.length * 6 + 3, output, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
