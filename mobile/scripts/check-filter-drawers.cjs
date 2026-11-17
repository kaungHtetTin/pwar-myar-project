const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated browser verification: intercept every API request; never change business data.
const { chromium, webkit } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { beginPull, releasePull, pullToRefresh } = require('./swipe-refresh.cjs');

(async () => {
  const engineName = process.env.FILTER_BROWSER || 'chromium';
  const output = path.resolve(__dirname, process.argv.includes('--reset-close') ? `../artifacts/filter-reset-close/${engineName}` : '../artifacts/filter-drawers');
  await fs.mkdir(output, { recursive: true });
  const listSurfaceCss = (await fs.readFile(path.resolve(__dirname, '../src/styles/list-surfaces.css'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const listCardSelector = listSurfaceCss.match(/\.common-navigation-shell :is\(([\s\S]*?)\)\s*\{/)[1];
  const borderAudit = [];
  const browser = await (engineName === 'webkit' ? webkit : chromium).launch({ headless: true });
  const results = [], errors = [], calls = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const modules = ['shop', 'sell', 'products', 'purchases', 'sales', 'suppliers', 'customers', 'expenses', 'transactions', 'reports', 'settings', 'access', 'billing'];
    const session = { user: { id: 1, name: 'Test Owner', role: 'owner' }, business: { id: 1, name: 'Test Shop', currency: 'Ks', timezone: 'Asia/Rangoon' }, permissions: modules, subscription: { is_valid: true } };
    const product = { id: 5, name: 'Rice', category: 'Food', sku: 'RICE-1', stock: 12, base_unit: 'Bag', cost: 1000, price: 1600, prices: [{ name: 'Retail', price: 1600, is_manual: true }], base_price: 1600 };
    const order = { id: 8, reference: 'SHOP-8', customer_name: 'Alice', status: 'pending', fulfillment: 'pickup', payment_status: 'unpaid', total: 32000, currency: 'Ks', created_at: '2026-10-15 08:00:00', payment_method: { name: 'Cash', provider: 'manual' }, items: [], payments: [], events: [], customer_requests: [] };
    const customer = { id: 7, name: 'Alice', customer_name: 'Alice', customer_key: 'account:7', account_type: 'account', purchase_count: 2, balance: 0 };
    const report = { start: '2026-10-01', end: '2026-10-15', date_from: '2026-10-01', date_to: '2026-10-15', previous_from: '2026-09-01', previous_to: '2026-09-15', currency: 'Ks', currencies: ['Ks'], timezone: 'Asia/Rangoon', summary: {}, previous: {}, trend: [], top_products: [], buyers: [], outcomes: [], origins: [], segments: [], follow_up: [], payment_methods: [], expense_categories: [], sales_count: 0, sales_total: 0, cash_total: 0, credit_total: 0, profit_estimate: 0, top_customers: [], cash_movement: {}, current_accounts: {}, inventory_valuation: {} };
    let fixtureLanguage = 'en';
    let delayRefresh = false;
    let emptyFabLists = false;
    let fabCapacity = false;
    await context.route('http://127.0.0.1:5176/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^.*\/api/, '');
      calls.push({ endpoint, query: url.search, method: request.method() });
      if (endpoint === '/shop-admin/chat/presence' && request.method() === 'POST') return route.fulfill({ status: 200, json: { ok: true } });
      assert.equal(request.method(), 'GET', `Unexpected mutation: ${endpoint}`);
      let data = { items: [], total: 0, has_more: false };
      if (endpoint === '/auth/me') data = session;
      else if (endpoint === '/app-config') data = { enabled_modules: modules, permissions: modules, language: fixtureLanguage, business: {} };
      else if (endpoint === '/settings') data = { payment_methods: 'Cash, KPay', price_types: 'Retail, Wholesale', admin_pin_set: '1' };
      else if (endpoint === '/categories') data = ['Food', 'Drinks'];
      else if (endpoint === '/products' || endpoint === '/shop-admin/publications') data = { items: [product], total: 1 };
      else if (endpoint === '/shop-admin/publications/filters') data = { categories: ['Food', 'Drinks'] };
      else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
      else if (endpoint === '/shop-admin/orders' || endpoint.endsWith('/history')) data = { items: [order], total: 1 };
      else if (endpoint === '/shop-admin/orders/8') data = order;
      else if (endpoint === '/shop-admin/customers') data = { items: [customer], total: 1 };
      else if (endpoint.startsWith('/shop-admin/customers/')) data = { customer, report: { ...report, metrics: [], orders: [] } };
      else if (endpoint === '/shop-admin/chat/config') data = { enabled: true, realtime_enabled: false };
      else if (endpoint === '/shop-admin/chat/notifications') data = { enabled: true, unread_count: 0, cursor: 0, items: [] };
      else if (endpoint === '/shop-admin/report' || endpoint === '/reports/summary') data = report;
      else if (endpoint === '/expenses/summary') data = { today_total: 0, month_total: 0, matching_count: 0, filter_total: 0 };
      else if (endpoint === '/suppliers/3') data = { supplier: { id: 3, name: 'Green Wholesale', balance: 0 }, summary: {}, purchases: [], filtered_stats: {}, total: 0 };
      else if (endpoint === '/customers/7/detail') data = { customer, summary: {} };
      if (process.argv.includes('--csv-app-bars')) {
        const row = { ...customer, id: 3, name: 'CSV fixture', supplier_name: 'Green Wholesale', customer_name: 'Alice', created_at: '2026-10-15 08:00:00', purchase_date: '2026-10-15', reference_no: 'PUR-3', receipt_no: 'SALE-3', total: 32000, total_cost: 32000, amount: 1000, paid_amount: 1000, credit_amount: 0, payment_method: 'Cash', direction: 'customer_to_shop', status: 'completed', items: [], rating: 5, is_active: true };
        if (['/purchases', '/sales', '/customers', '/suppliers', '/expenses', '/customer-payments', '/supplier-payments', '/subscription/billing-history', '/staff', '/shop-admin/reviews'].includes(endpoint) || /^\/(?:customers\/7|suppliers\/3)\/(?:sales|payments|purchases)$/.test(endpoint)) data = { items: [row], total: 1, has_more: false };
        if (endpoint === '/suppliers/3/statement') data = { purchases: [row], payments: [] };
        if (endpoint === '/suppliers/3') data = { supplier: { id: 3, name: 'Green Wholesale', balance: 0 }, summary: {}, purchases: [row], total: 1, filtered_stats: {} };
      }
      if (delayRefresh) await new Promise(resolve => setTimeout(resolve, 350));
      if (process.argv.includes('--create-fabs') && ['/products', '/purchases'].includes(endpoint)) {
        const items = emptyFabLists ? [] : Array.from({ length: 12 }, (_, index) => endpoint === '/products' ? { ...product, id: index + 5, name: `Rice ${index + 1}` } : { id: index + 1, supplier_name: `Supplier ${index + 1}`, purchase_date: '2026-10-15', total_cost: 1000, paid_amount: 1000, credit_amount: 0, items: [] });
        data = { items, total: items.length, has_more: false };
      }
      if (process.argv.includes('--all-create-fabs')) {
        const rows = (row, count = 12) => ({ items: Array.from({ length: count }, (_, index) => ({ ...row, id: index + 1 })), total: count, has_more: false });
        if (endpoint === '/price-types') data = { items: ['Retail', 'Wholesale'], rules: [] };
        if (endpoint === '/roles') data = rows({ name: 'Cashier', permissions: ['sell'], staff_count: 1 }, fabCapacity ? 0 : 2);
        if (endpoint === '/staff') data = rows({ name: 'Test staff', email: 'staff@example.test', is_active: true, access_role: { name: 'Cashier' } });
        if (endpoint === '/customers' || endpoint === '/suppliers') data = rows({ ...customer, name: 'Test contact with a long readable name' });
        if (endpoint === '/expenses') data = rows({ title: 'Office supplies', category: 'General', amount: 1000, expense_date: '2026-10-17', payment_method: 'Cash' });
        if (endpoint === '/shop-admin/contacts') data = rows({ platform: 'phone', label: 'Shop contact', value: '09123456789' }, fabCapacity ? 100 : 12);
        if (endpoint === '/shop-admin/delivery-zones') data = rows({ name: 'Delivery zone', fee: 1500 }, fabCapacity ? 100 : 12);
        if (endpoint === '/shop-admin/payment-methods') data = rows({ name: 'Cash', type: 'cash', is_active: true, provider: 'manual' }, fabCapacity ? 20 : 12);
        if (endpoint === '/shop-admin/promotions') data = { ...rows({ name: 'Weekend discount', code: 'WEEKEND', type: 'coupon', discount_type: 'percentage', discount_value: 10, enabled: true, status: 'active', used_count: 0 }), timezone: 'Asia/Rangoon' };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    if (process.argv.includes('--all-create-fabs')) {
      const targets = [
        ['/customers', 'New customer', '/customers/new', '/customers'],
        ['/suppliers', 'New supplier', '/suppliers/new', '/suppliers'],
        ['/expenses', 'New expense', '/expenses/new', '/expenses'],
        ['/access', 'New role', '/access/roles/new', '/roles'],
        ['/access', 'New staff', '/access/staff/new', '/staff', 'Staff'],
        ['/settings/prices', 'New price type', '/settings/prices/new', '/price-types'],
        ['/shop/contacts', 'Add contact', '/shop/contacts/new', '/shop-admin/contacts'],
        ['/shop/delivery', 'Add delivery', '/shop/delivery/new', '/shop-admin/delivery-zones'],
        ['/shop/methods', 'Add payment method', '/shop/methods/new', '/shop-admin/payment-methods'],
        ['/shop/promotions', 'Add promotion', '/shop/promotions/new/coupon', '/shop-admin/promotions'],
      ].filter(target => !process.argv.includes('--fab-promotions-only') || target[0] === '/shop/promotions');
      for (const width of [320, 362, 768]) {
        await page.setViewportSize({ width, height: 874 });
        for (const [sourcePath, label, destination, endpoint, tab] of targets) {
          await page.goto(`http://127.0.0.1:5176${sourcePath}`); await page.waitForLoadState('networkidle');
          if (tab) await page.getByRole('button', { name: tab, exact: true }).click();
          const fab = page.getByRole('button', { name: label, exact: true });
          assert.equal(await page.locator('.ui-fab:visible').count(), 1, `${label}: one FAB`);
          assert.ok(await fab.evaluate(button => button.classList.contains('ui-fab') && !button.closest('.shared-app-bar')));
          assert.equal(await fab.isEnabled(), true);
          const box = await fab.boundingBox(), nav = await page.locator('.sale-bottom-navigation').boundingBox();
          assert.equal(box.width, 56); assert.equal(box.height, 56);
          assert.ok(Math.abs(nav.y - (box.y + box.height) - 16) < 2, `${label}: FAB clears navigation`);
          const menu = page.locator('.shared-app-bar .app-bar-menu');
          assert.ok(await menu.evaluate(button => button.parentElement.lastElementChild === button));
          assert.equal(await page.locator('.shared-app-bar').getByRole('button', { name: label, exact: true }).count(), 0);
          const search = page.locator('input[type="search"]:visible').first();
          if (await search.count()) { await search.fill('Test'); await page.waitForTimeout(400); }
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.screenshot({ path: path.join(output, `fab-all-${label.replaceAll(' ', '-')}-${width}.png`), animations: 'disabled' });
          const last = page.locator('main:visible article, main:visible .settings-price-row, main:visible .access-card, main:visible .endless-list-footer').last();
          if (await last.count()) {
            const lastBox = await last.boundingBox();
            assert.ok(lastBox.y + lastBox.height <= box.y + 1, `${label}: final item can scroll above FAB`);
          }
          const source = await page.locator('main:visible').last().elementHandle();
          if (label === 'Add promotion') {
            await fab.click();
            const option = page.getByRole('button', { name: 'New coupon', exact: true });
            const optionBox = await option.boundingBox();
            assert.ok(optionBox.y + optionBox.height < box.y, 'Promotion choices open above FAB');
            await page.screenshot({ path: path.join(output, `fab-promotion-options-${width}.png`), animations: 'disabled' });
            await page.keyboard.press('Escape'); assert.equal(await option.count(), 0);
            await fab.click(); await option.click();
          } else { await fab.focus(); await page.keyboard.press('Enter'); }
          await page.waitForURL(`**${destination}`);
          await page.locator('main:visible form').first().waitFor();
          assert.equal(await page.locator('.ui-fab:visible').count(), 0, `${label}: form has no list FAB`);
          await page.waitForLoadState('networkidle');
          const before = calls.filter(call => call.endpoint === endpoint).length;
          if (width === 362) await page.locator('.shared-app-bar').getByRole('button', { name: /^Back/ }).first().click();
          else await page.goBack();
          await page.waitForURL(`**${sourcePath}`); await page.waitForTimeout(100);
          assert.ok(await source.evaluate(node => node.isConnected), `${label}: source remains mounted`);
          assert.equal(calls.filter(call => call.endpoint === endpoint).length, before, `${label}: Back avoids initial list refetch`);
          if (await search.count()) assert.equal(await search.inputValue(), 'Test');
          if (label === 'Add promotion' && width === 320) {
            await fab.click();
            await page.getByRole('button', { name: 'New flash sale', exact: true }).click();
            await page.waitForURL('**/shop/promotions/new/flash_sale');
            await page.locator('main:visible form').first().waitFor();
            await page.goBack(); await page.waitForURL(`**${sourcePath}`);
            assert.ok(await source.evaluate(node => node.isConnected));
          }
          if (label === 'Add promotion') {
            await page.locator('main:visible .shop-mobile-list input[type="checkbox"]').first().check();
            await page.waitForFunction(() => {
              const fab = document.querySelector('.promotion-fab-menu')?.getBoundingClientRect();
              const bar = document.querySelector('.promotion-selection-bar')?.getBoundingClientRect();
              return fab && bar && fab.bottom <= bar.top - 15;
            });
            await page.screenshot({ path: path.join(output, `fab-promotion-bulk-${width}.png`), animations: 'disabled' });
            await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
          }
        }
      }
      fabCapacity = true;
      for (const target of ['/shop/contacts', '/shop/delivery', '/shop/methods']) {
        await page.goto(`http://127.0.0.1:5176${target}`); await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('.ui-fab:visible').isDisabled(), true, `${target}: creation limit retained`);
      }
      await page.goto('http://127.0.0.1:5176/access'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Staff', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'New staff', exact: true }).isDisabled(), true);
      fabCapacity = false; fixtureLanguage = 'my';
      await page.setViewportSize({ width: 320, height: 667 });
      for (const [sourcePath, label] of targets.filter(target => !target[4])) {
        await page.goto(`http://127.0.0.1:5176${sourcePath}`); await page.waitForLoadState('networkidle');
        assert.equal(await page.locator('.ui-fab:visible').count(), 1);
        await page.screenshot({ path: path.join(output, `fab-myanmar-${label.replaceAll(' ', '-')}-320.png`), animations: 'disabled' });
      }
      assert.deepEqual(errors, []);
      console.log('All app-bar create actions moved to FABs: layout, creation, retained Back, limits and Myanmar passed.');
      return;
    }
    if (process.argv.includes('--create-fabs')) {
      for (const width of [320, 362, 768]) {
        await page.setViewportSize({ width, height: 874 });
        for (const [target, label] of [['products','Add product'], ['purchases','New purchase']]) {
          await page.goto(`http://127.0.0.1:5176/${target}`); await page.waitForLoadState('networkidle');
          const fab = page.getByRole('button', { name: label, exact: true });
          assert.equal(await fab.count(), 1);
          assert.ok(await fab.evaluate(button => button.classList.contains('ui-fab')));
          assert.equal(await page.locator('.shared-app-bar').getByRole('button', { name: label, exact: true }).count(), 0);
          const checkPosition = async () => {
            const button = await fab.boundingBox(), nav = await page.locator('.sale-bottom-navigation').boundingBox();
            assert.equal(button.width, 56); assert.equal(button.height, 56);
            assert.ok(button.y + button.height <= nav.y - 12, 'FAB stays above bottom navigation');
            assert.ok(button.x >= 0 && button.x + button.width <= width, 'FAB fits viewport');
          };
          await checkPosition();
          await page.screenshot({ path: path.join(output, `fab-${target}-${width}.png`), animations: 'disabled' });
          await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
          await checkPosition();
          const last = page.locator(target === 'products' ? '.product-card-list > :last-child' : '.purchase-history-list > :last-child');
          const lastBox = await last.boundingBox(), fabBox = await fab.boundingBox();
          assert.ok(lastBox.y + lastBox.height < fabBox.y, 'Final list item can scroll fully above FAB');
          const source = await last.elementHandle();
          await fab.click(); await page.waitForURL(`**/${target}/new`);
          await page.waitForLoadState('networkidle');
          assert.equal(await page.locator('.ui-fab:visible').count(), 0, 'Create form has no list FAB');
          if (target === '/products') {
            for (const name of ['Import CSV', 'Select and print barcodes']) {
              const action = page.getByRole('button', { name, exact: true });
              assert.equal(await action.innerText(), '');
              assert.equal(await action.evaluate(button => Boolean(button.closest('header'))), true);
            }
            assert.equal(await page.getByRole('button', { name: 'Tools', exact: true }).count(), 0);
            const readsBeforePicker = calls.filter(call => call.endpoint === '/products').length;
            await page.getByRole('button', { name: 'Select and print barcodes', exact: true }).click();
            await page.getByRole('dialog', { name: 'Print barcodes', exact: true }).waitFor();
            await page.keyboard.press('Escape');
            assert.equal(calls.filter(call => call.endpoint === '/products').length, readsBeforePicker);
          }
          const reads = calls.length;
          await page.getByRole('button', { name: `Back to ${target}`, exact: true }).click(); await page.waitForURL(`**/${target}`);
          assert.ok(await source.evaluate(el => el.isConnected), 'Back retains original list');
          assert.equal(calls.slice(reads).filter(call => call.endpoint === `/${target}`).length, 0, 'Back does not reload list');
        }
      }
      emptyFabLists = true;
      await page.setViewportSize({ width: 320, height: 874 });
      for (const target of ['products','purchases']) { await page.goto(`http://127.0.0.1:5176/${target}`); await page.waitForLoadState('networkidle'); assert.equal(await page.locator('.ui-fab:visible').count(), 1); await page.screenshot({ path: path.join(output, `fab-${target}-empty-320.png`), animations: 'disabled' }); }
      assert.deepEqual(errors, []);
      console.log('Product/Purchase FABs: 320/362/768px, long/empty lists, create and retained Back passed.');
      return;
    }
    if (process.argv.includes('--common-shell')) {
      await page.setViewportSize({ width: 362, height: 874 });
      await page.goto('http://127.0.0.1:5176/sell'); await page.waitForLoadState('networkidle');
      const bar = await page.locator('.shared-app-bar').elementHandle(), bottom = await page.locator('.sale-bottom-navigation').elementHandle();
      const shellState = await page.evaluate(() => { window.shellVerificationMarker = 'retained-document'; return document.querySelector('.shared-app-bar').getBoundingClientRect().toJSON(); });
      await Promise.all([page.waitForResponse(response => response.url().includes('/products?') && response.url().includes('q=Rice')), page.getByLabel('Search sale products', { exact: true }).fill('Rice')]); await page.waitForLoadState('networkidle');
      const source = await page.getByLabel('Search sale products', { exact: true }).elementHandle();
      const reads = () => calls.filter(call => call.endpoint === '/products' && new URLSearchParams(call.query).get('limit') === '20' && new URLSearchParams(call.query).get('q') === 'Rice').length;
      const beforeReads = reads();
      await beginPull(page);
      assert.deepEqual(await bar.evaluate(el => el.getBoundingClientRect().toJSON()), shellState, 'Pull leaves app bar fixed');
      assert.equal(await bar.evaluate(el => !!el.closest('.swipe-refresh-shell')), false);
      await page.screenshot({ path: path.join(output, 'common-shell-sell-pull.png'), animations: 'disabled' });
      await page.locator('.swipe-refresh-shell').dispatchEvent('touchcancel');
      for (const [label, target] of [['Products','/products'], ['Sales','/sales'], ['My Shop','/shop'], ['Reports','/reports']]) {
        await page.locator('.sale-bottom-navigation').getByRole('button', { name: label, exact: true }).click(); await page.waitForURL(`**${target}`); await page.waitForLoadState('networkidle');
        assert.equal(await bar.evaluate(el => el === document.querySelector('.shared-app-bar')), true, 'Persistent app bar');
        assert.equal(await bottom.evaluate(el => el === document.querySelector('.sale-bottom-navigation')), true, 'Persistent bottom navigation');
        assert.equal(await page.locator('.shared-app-bar .app-bar-menu').count(), 1, 'Only current header controls');
        await page.goBack(); await page.waitForURL('**/sell');
        assert.equal(await page.getByLabel('Search sale products', { exact: true }).inputValue(), 'Rice');
        assert.ok(await source.evaluate(el => el.isConnected));
      }
      assert.equal(reads(), beforeReads, 'Returns do not refetch the filtered Sell list');
      assert.equal(await page.evaluate(() => window.shellVerificationMarker), 'retained-document');
      await page.getByRole('button', { name: 'Open cart', exact: true }).click(); await page.waitForURL('**/sell/cart');
      await page.getByRole('button', { name: 'Back to products', exact: true }).click(); await page.waitForURL('**/sell');
      assert.equal(await page.getByLabel('Search sale products', { exact: true }).inputValue(), 'Rice');
      assert.ok(await bar.evaluate(el => el.isConnected));
      assert.deepEqual(errors, []);
      console.log('Common app bar/bottom nav identity, fixed pull position, module switching, nested Back and retained state passed.');
      return;
    }
    if (process.argv.includes('--swipe-refresh')) {
      await page.setViewportSize({ width: 362, height: 874 });
      const pages = [['sell','/products'], ['products','/products'], ['purchases','/purchases'], ['sales','/sales'], ['customers','/customers'], ['suppliers','/suppliers'], ['expenses','/expenses'], ['transactions','/customer-payments'], ['reports','/reports/summary'], ['settings','/settings'], ['billing','/subscription/billing-history'], ['access','/roles'], ['shop','/app-config'], ['shop/orders','/shop-admin/orders'], ['shop/customers','/shop-admin/customers']];
      for (const [target, endpoint] of pages) {
        await page.goto(`http://127.0.0.1:5176/${target}`);
        await page.waitForLoadState('networkidle');
        assert.equal(await page.getByRole('button', { name: /^Refresh/ }).count(), 0, `${target}: no refresh button`);
        if (target === 'sell') { await Promise.all([page.waitForResponse(response => response.url().includes('/products?') && response.url().includes('q=Rice')), page.getByLabel('Search sale products', { exact: true }).fill('Rice')]); await page.waitForLoadState('networkidle'); }
        if (target === 'products') { assert.equal(await page.getByRole('button', { name: /^Refresh/ }).count(), 0); }
        if (target === 'shop/orders') { await page.getByRole('button', { name: 'More order actions', exact: true }).click(); assert.equal(await page.getByRole('button', { name: /^Refresh/ }).count(), 0); await page.keyboard.press('Escape'); }
        const before = calls.filter(call => call.endpoint === endpoint).length;
        const source = await page.locator('main:visible').first().elementHandle();
        delayRefresh = true;
        await beginPull(page);
        if (['reports','products','shop/orders'].includes(target)) await page.screenshot({ path: path.join(output, `swipe-${target.replaceAll('/','-')}-ready.png`), animations: 'disabled' });
        await releasePull(page);
        await page.locator('.swipe-refresh-shell.is-refreshing').waitFor();
        if (target === 'reports') await page.screenshot({ path: path.join(output, 'swipe-reports-refreshing.png'), animations: 'disabled' });
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => document.querySelector('.swipe-refresh-shell')?.getAttribute('aria-busy') === 'false');
        delayRefresh = false;
        assert.ok(calls.filter(call => call.endpoint === endpoint).length > before, `${target}: current-page data refreshes`);
        assert.ok(await source.evaluate(el => el.isConnected), `${target}: page stays mounted`);
        if (target === 'sell') assert.equal(await page.getByLabel('Search sale products', { exact: true }).inputValue(), 'Rice');
        console.log('Swipe refresh passed:', target);
      }
      // Retained module data must not refresh merely because another module pulls.
      await page.goto('http://127.0.0.1:5176/products'); await page.waitForLoadState('networkidle');
      await page.locator('.sale-bottom-navigation').getByRole('button', { name: 'Reports', exact: true }).click(); await page.waitForLoadState('networkidle');
      const productReads = calls.filter(call => call.endpoint === '/products' && new URLSearchParams(call.query).get('limit') === '20').length;
      await pullToRefresh(page);
      assert.equal(calls.filter(call => call.endpoint === '/products' && new URLSearchParams(call.query).get('limit') === '20').length, productReads);
      await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 320, height: 874 }); await beginPull(page);
      await page.screenshot({ path: path.join(output, 'swipe-reports-myanmar-320.png'), animations: 'disabled' });
      await page.locator('.swipe-refresh-shell').dispatchEvent('touchcancel');
      assert.deepEqual(errors, []);
      console.log('15 routes: swipe refresh, no buttons, busy indicator, retained source/data and Myanmar passed.');
      return;
    }
    if (process.argv.includes('--bottom-reports')) {
      const bottom = page.locator('.sale-bottom-navigation');
      await page.goto('http://127.0.0.1:5176/sell');
      const search = page.getByRole('textbox', { name: 'Search sale products', exact: true });
      await search.fill('Rice');
      await page.waitForLoadState('networkidle');
      const retained = await search.elementHandle();
      const productReads = () => calls.filter(call => call.endpoint === '/products').length;
      const reportReads = () => calls.filter(call => call.endpoint === '/reports/summary').length;
      const initialProductReads = productReads();
      assert.deepEqual(await bottom.getByRole('button').allTextContents(), ['Sell', 'Products', 'Sales', 'My Shop', 'Reports']);
      await bottom.getByRole('button', { name: 'Reports', exact: true }).click();
      await page.waitForURL('**/reports');
      await page.waitForLoadState('networkidle');
      assert.equal(await bottom.getByRole('button', { name: 'Reports', exact: true }).getAttribute('aria-current'), 'page');
      const initialReportReads = reportReads();
      await bottom.getByRole('button', { name: 'Reports', exact: true }).click();
      assert.equal(reportReads(), initialReportReads, 'Active tab does not reload Reports');
      await page.goBack();
      await page.waitForURL('**/sell');
      assert.equal(await search.inputValue(), 'Rice');
      assert.ok(await retained.evaluate(el => el.isConnected), 'Source input stays mounted');
      assert.equal(productReads(), initialProductReads, 'Back does not refetch Sell products');
      await bottom.getByRole('button', { name: 'Reports', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.waitForURL('**/reports');
      assert.equal(reportReads(), initialReportReads, 'Returning to Reports retains loaded data');
      for (const width of [320, 362]) {
        await page.setViewportSize({ width, height: 874 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `bottom-reports-${width}.png`), animations: 'disabled' });
      }
      await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
      await setDrawerLanguage(page, 'my');
      await page.keyboard.press('Escape');
      const translatedReports = bottom.getByRole('button').last();
      assert.match(await translatedReports.innerText(), /[\u1000-\u109f]/);
      assert.equal(await translatedReports.getAttribute('aria-current'), 'page');
      await page.screenshot({ path: path.join(output, 'bottom-reports-myanmar-362.png'), animations: 'disabled' });
      assert.deepEqual(errors, []);
      console.log('Bottom Reports navigation, active state, keyboard, retained state/data and Myanmar passed.');
      return;
    }
    if (process.argv.includes('--entry-headers') || process.argv.includes('--app-bar-menus')) {
      let targets = modules.map(module => `/${module}`);
      if (process.argv.includes('--app-bar-menus')) targets.push('/sell/cart', '/sell/checkout', '/sell/customer/new', '/sell/offline-sales', '/products/new', '/products/5/edit', '/products/5/stock', '/purchases/new', '/purchases/8', '/purchases/8/edit', '/customers/new', '/customers/7', '/customers/7/edit', '/suppliers/new', '/suppliers/3', '/suppliers/3/edit', '/expenses/new', '/settings/account', '/settings/printer', '/settings/about', '/billing/request/1', '/access/roles/new', '/access/staff/new', '/shop/orders', '/shop/catalog', '/shop/customers', '/shop/reviews', '/shop/promotions', '/shop/report', '/shop/chat', '/shop/chat/00000000-0000-0000-0000-000000000001', '/shop/contacts', '/shop/cover', '/shop/logo', '/shop/location', '/shop/fulfillment', '/shop/methods', '/shop/storefront');
      const selectedTargets = process.argv.find(arg => arg.startsWith('--app-bar-targets='));
      if (selectedTargets) targets = selectedTargets.split('=')[1].split(',');
      for (const width of [320, 362]) {
        await page.setViewportSize({ width, height: 874 });
        for (const target of targets) {
          await page.goto(`http://127.0.0.1:5176${target}`);
          await page.waitForLoadState('networkidle');
          if (modules.includes(target.slice(1))) assert.equal(await page.getByRole('button', { name: /^Back/ }).count(), 0, `${target}: module entry has no Back action`);
          const menu = page.getByRole('button', { name: 'Open app menu', exact: true });
          assert.equal(await menu.count(), 1, `${target}: one app-bar drawer trigger`);
          const layout = await menu.evaluate(button => {
            const header = button.parentElement, rect = button.getBoundingClientRect(), bar = header.getBoundingClientRect();
            return { last: header.lastElementChild === button, right: rect.right, barRight: bar.right, width: rect.width, height: rect.height, overlap: [...header.children].filter(el => el !== button).some(el => el.getBoundingClientRect().right > rect.left + 1) };
          });
          assert.equal(layout.last, true, `${target}: menu is last app-bar action`);
          assert.equal(layout.overlap, false, `${target}: actions do not overlap`);
          assert.ok(layout.barRight - layout.right <= 20, `${target}: menu at far right`);
          assert.ok(layout.height >= 44 && layout.width >= 36, `${target}: usable touch target`);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${target}: no horizontal overflow`);
          if (process.argv.includes('--list-card-borders')) {
            const cards = await page.locator(listCardSelector).evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => {
              const css = getComputedStyle(element);
              const visible = side => parseFloat(css[`border${side}Width`]) > 0 && css[`border${side}Style`] !== 'none' && !['transparent', 'rgba(0, 0, 0, 0)'].includes(css[`border${side}Color`]);
              return { className: element.className, frame: ['Top', 'Right', 'Bottom'].some(visible), left: visible('Left'), status: element.matches('.offline-sale-row.status-synced,.offline-sale-row.status-failed,.offline-sale-row.status-syncing') };
            }));
            assert.ok(cards.every(card => !card.frame && (!card.left || card.status)), `${target}: list cards have no outer frame: ${JSON.stringify(cards.filter(card => card.frame))}`);
            borderAudit.push({ target, width, cards: cards.length });
          }
          if (process.argv.includes('--page-top-spacing') && !target.startsWith('/shop/chat/')) {
            const spacing = await page.locator('main:visible').evaluateAll(pages => pages.filter(page => page.querySelector('[data-page-app-bar]')).map(page => ({ padding: parseFloat(getComputedStyle(page).paddingTop), top: page.getBoundingClientRect().top })));
            assert.ok(spacing.length > 0, `${target}: rendered page layout`);
            assert.ok(spacing.every(page => page.padding === 0), `${target}: no duplicate page top padding`);
            assert.equal(await page.locator('.swipe-refresh-content').evaluate(element => parseFloat(getComputedStyle(element).paddingTop)), 12, `${target}: shared 12px content top padding`);
            if (target === '/shop/orders') {
              const gap = await page.locator('.shop-order-controls').evaluate(controls => controls.getBoundingClientRect().top - document.querySelector('.shared-app-bar').getBoundingClientRect().bottom);
              assert.equal(gap, 12, 'Orders search has the shared gap below the app bar');
            }
          }
          if (process.argv.includes('--csv-app-bars')) {
            const exports = page.locator('.app-bar-export:visible');
            assert.ok(await exports.count() > 0, `${target}: export in app bar`);
            assert.equal(await page.locator('.mobile-export-button:visible').evaluateAll(buttons => buttons.filter(button => !button.closest('header')).length), 0, `${target}: no export in page content`);
            for (const button of await exports.all()) {
              assert.equal(await button.innerText(), '', `${target}: icon only`);
              if (width === 320) {
                console.log('Checking CSV:', target, await button.getAttribute('aria-label'));
                const download = page.waitForEvent('download');
                await button.click();
                assert.match((await download).suggestedFilename(), /\.csv$/);
                await page.waitForLoadState('networkidle');
              }
            }
            if (width === 320 && target === '/transactions') {
              await page.getByRole('button', { name: 'Suppliers', exact: true }).click();
              const button = page.locator('.app-bar-export:visible');
              assert.equal(await button.count(), 1, 'Only active payment tab exports in header');
              const download = page.waitForEvent('download'); await button.click();
              assert.match((await download).suggestedFilename(), /supplier-payments.*\.csv$/);
              await page.getByRole('button', { name: 'Customers', exact: true }).click();
              assert.equal(await page.locator('.app-bar-export:visible').count(), 1);
            }
            if (width === 320 && target === '/suppliers/3') {
              await page.getByRole('tab', { name: /^Payment records/ }).click();
              const button = page.getByRole('button', { name: 'Export supplier payments', exact: true });
              const download = page.waitForEvent('download'); await button.click();
              assert.match((await download).suggestedFilename(), /payments.*\.csv$/);
            }
          }
          const reads = calls.length;
          await menu.click();
          await page.getByRole('dialog', { name: 'Main navigation', exact: true }).waitFor();
          assert.equal(await menu.getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await menu.evaluate(el => el === document.activeElement), true, `${target}: focus returns to app-bar trigger`);
          assert.equal(calls.length, reads, `${target}: opening/closing drawer does not refetch page data`);
          await page.screenshot({ path: path.join(output, `entry-${target.slice(1).replaceAll('/', '-')}-${width}.png`), animations: 'disabled' });
        }
      }
      assert.deepEqual(errors, []);
      if (process.argv.includes('--list-card-borders')) await fs.writeFile(path.join(output, 'list-card-borders.json'), JSON.stringify(borderAudit, null, 2));
      console.log(`${targets.length} app bars passed at 320px and 362px.`);
      return;
    }
    const routes = ['/products', '/purchases', '/sales', '/transactions', '/transactions#suppliers', '/expenses', '/reports', '/sell', '/suppliers/3', '/customers/7', '/shop/orders', '/shop/catalog', '/shop/customers', '/shop/customers/account%3A7', '/shop/reviews', '/shop/report', '/shop/promotions', '/shop/chat'];
    if (process.argv.includes('--reset-close')) {
      routes.push('/suppliers', '/suppliers/3#payments', '/purchases/new#category', '/customers', '/customers/7#payments');
      if (process.env.RESET_RESUME === '1') {
        const previous = JSON.parse(await fs.readFile(path.join(output, 'verification-in-progress.json'), 'utf8'));
        results.push(...previous.results);
      }
      for (const target of routes) {
        if (results.some(result => result.route === target)) continue;
        console.log(`CHECK Reset ${target}`);
        await page.goto(`http://127.0.0.1:5176${target.split('#')[0]}?resetCase=${encodeURIComponent(target)}`);
        if (target === '/transactions#suppliers') await page.getByRole('navigation', { name: 'Payment history sections' }).getByRole('button', { name: 'Suppliers', exact: true }).click();
        if (target === '/suppliers/3#payments') await page.getByRole('tab', { name: /^Payment records/ }).click();
        if (target === '/customers/7#payments') await page.getByRole('tab', { name: /^Payment records/ }).click();
        if (target === '/purchases/new#category') await page.getByRole('button', { name: 'Continue', exact: true }).click();
        const trigger = page.locator('.mobile-filter-toggle:visible');
        await trigger.waitFor();
        await page.waitForLoadState('networkidle');
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
        await dialog.waitFor();
        const fields = () => dialog.locator('select, input[type="radio"], input[type="date"]').evaluateAll(nodes => nodes.map(node => ({ key: node.getAttribute('aria-label') || node.type || node.tagName, value: node.type === 'radio' ? node.checked : node.value })));
        const defaults = await fields();
        const select = dialog.locator('select:visible').filter({ has: page.locator('option:nth-child(2)') }).first();
        if (await select.count()) await select.selectOption(await select.locator('option').nth(1).getAttribute('value') ?? await select.locator('option').nth(1).textContent());
        else if (await dialog.locator('input[type="radio"]:not(:checked)').count()) await dialog.locator('input[type="radio"]:not(:checked)').first().check();
        else if (await dialog.locator('input[type="date"]').count()) {
          const dates = dialog.locator('input[type="date"]');
          await dates.first().fill('2026-10-05');
          if (await dates.count() > 1) await dates.nth(1).fill('2026-10-15');
        }
        await dialog.getByRole('button', { name: /^Apply(?: filters)?(?: \(\d+\))?$/ }).click();
        await dialog.waitFor({ state: 'hidden' });
        await trigger.click();
        await dialog.waitFor();
        await page.screenshot({ path: path.join(output, `${target.slice(1).replaceAll(/[\/#%]/g, '-')}-before.png`) });
        await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 3000 });
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', `${target}: scroll unlock`);
        assert.equal(await trigger.evaluate(node => node === document.activeElement), true, `${target}: focus restored`);
        await trigger.click();
        await dialog.waitFor();
        assert.deepEqual(await fields(), defaults, `${target}: applied defaults persist after reopening`);
        await page.screenshot({ path: path.join(output, `${target.slice(1).replaceAll(/[\/#%]/g, '-')}-reset.png`) });
        await dialog.getByRole('button', { name: 'Close filters', exact: true }).click();
        results.push({ route: target, resetCloses: true, defaultsApplied: true, focusRestored: true });
        await fs.writeFile(path.join(output, 'verification-in-progress.json'), JSON.stringify({ engine: engineName, results, errors }, null, 2));
        console.log(`PASS Reset ${target}`);
      }
      assert.deepEqual(errors, []);
      await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ engine: engineName, results, errors }, null, 2));
      return;
    }
    for (const target of process.argv.includes('--navigation-only') ? [] : routes) {
      await page.goto(`http://127.0.0.1:5176${target}`);
      if (target.endsWith('#suppliers')) await page.getByRole('navigation', { name: 'Payment history sections' }).getByRole('button', { name: 'Suppliers', exact: true }).click();
      const trigger = page.getByRole('button', { name: /^Filters(?:,|$)/ });
      try { await trigger.waitFor({ timeout: 10000 }); }
      catch (error) { console.log(target, await page.locator('body').innerText(), errors, calls.slice(-12)); throw error; }
      await page.waitForLoadState('networkidle');
      // Purchase supplier choices load lazily on the first drawer open.
      if (target === '/purchases') {
        await trigger.click();
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: 'Close filters', exact: true }).click();
      }
      const before = calls.length;
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
      await dialog.waitFor();
      await page.locator('.mobile-filter-drawer').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      const dimensions = await page.locator('.mobile-filter-drawer').evaluate(element => {
        const rect = element.getBoundingClientRect();
        const body = element.querySelector('.mobile-filter-drawer-body');
        const footer = element.querySelector('.mobile-filter-drawer-footer').getBoundingClientRect();
        return { right: rect.right, width: rect.width, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, bodyOverflow: body.scrollWidth > body.clientWidth + 1, footerBottom: footer.bottom, columns: getComputedStyle(body).gridTemplateColumns };
      });
      assert.ok(Math.abs(dimensions.right - dimensions.viewportWidth) <= 1, `${target}: drawer must align to the right`);
      assert.equal(dimensions.top, 0, `${target}: drawer top`);
      assert.ok(Math.abs(dimensions.bottom - dimensions.viewportHeight) <= 1, `${target}: full viewport height`);
      assert.equal(dimensions.bodyOverflow, false, `${target}: horizontal field overflow`);
      assert.ok(dimensions.footerBottom <= dimensions.viewportHeight, `${target}: visible action footer`);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await page.evaluate(() => document.querySelector('dialog').matches(':modal')), true, 'Native modal must make background inert');
      const close = dialog.getByRole('button', { name: 'Close filters', exact: true });
      await close.press('Shift+Tab');
      await page.waitForFunction(() => document.activeElement?.closest('.mobile-filter-drawer-footer'));
      await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(element => document.activeElement === element), true);
      const stem = target.slice(1).replaceAll('/', '-').replaceAll('%3A', '-');
      if (process.argv.includes('--shared-controls')) {
        const appearance = await dialog.locator('.mobile-filter-drawer').evaluate(drawer => {
          const body = drawer.querySelector('.mobile-filter-drawer-body');
          return { headerIcons: drawer.querySelectorAll('.mobile-filter-drawer-header .mobile-filter-drawer-icon').length, headerShadow: getComputedStyle(drawer.querySelector('header')).boxShadow, bodyBackground: getComputedStyle(body).backgroundColor, groups: [...body.querySelectorAll('.ui-choice-group')].map(group => ({ border: getComputedStyle(group).borderWidth, shadow: getComputedStyle(group).boxShadow })), radios: [...body.querySelectorAll('.ui-check[type="radio"]')].map(input => ({ width: input.getBoundingClientRect().width, appearance: getComputedStyle(input).appearance })) };
        });
        assert.equal(appearance.headerIcons, 0, `${target}: reference header is title and close`);
        assert.equal(appearance.headerShadow, 'none');
        assert.equal(appearance.bodyBackground, 'rgb(255, 255, 255)');
        for (const group of appearance.groups) { assert.equal(group.border, '0px'); assert.equal(group.shadow, 'none'); }
        for (const radio of appearance.radios) { assert.equal(radio.width, 20); assert.equal(radio.appearance, 'none'); }
        const dateFields = await dialog.locator('.product-filter-date').evaluateAll(fields => fields.map(field => {
          const r = field.getBoundingClientRect(), input = field.querySelector('input')?.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, inputBottom: input?.bottom };
        }).filter(field => field.height > 0));
        for (const field of dateFields) assert.ok(!field.inputBottom || field.inputBottom <= field.bottom + 1, `${target}: date input must fit inside its field without overlapping the next label`);
        if (target === '/expenses') {
          await fs.writeFile(path.join(output, 'expense-field-layout.json'), JSON.stringify(await dialog.locator('.product-filter-field').evaluateAll(fields => fields.map(field => [...field.querySelectorAll('*'), field].map(node => { const r = node.getBoundingClientRect(), s = getComputedStyle(node); return { tag: node.tagName, cls: node.className, text: node.tagName === 'SMALL' ? node.textContent : '', y: r.y, height: r.height, display: s.display, position: s.position, rows: s.gridTemplateRows, minHeight: s.minHeight, maxHeight: s.maxHeight, overflow: s.overflow }; }))), null, 2));
        }
        const controls = await dialog.locator('button:not([tabindex="-1"]), input, select, textarea').evaluateAll(nodes => nodes.map(node => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          return { tag: node.tagName, name: node.getAttribute('aria-label') || node.textContent, className: node.className, font: style.font, radius: style.borderRadius, height: rect.height, width: rect.width, padding: style.padding };
        }));
        await fs.writeFile(path.join(output, `${stem}-controls.json`), JSON.stringify(controls, null, 2));
      }
      await page.screenshot({ path: path.join(output, `${stem}-390.png`), fullPage: false });
      await close.click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      // Ignore independent periodic chat updates; opening/closing a filter must not fetch.
      if (target !== '/shop/chat') assert.equal(calls.length, before, `${target}: dismissal must not refetch: ${JSON.stringify(calls.slice(before))}`);
      await trigger.click();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await trigger.click();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('mkpos:hardware-back', { cancelable: true })));
      await dialog.waitFor({ state: 'hidden' });
      await trigger.click();
      await dialog.getByRole('button', { name: 'Dismiss filters', exact: true }).click({ position: { x: 4, y: 100 } });
      await dialog.waitFor({ state: 'hidden' });
      await trigger.click();
      await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
      if (!await dialog.isVisible()) await trigger.click();
      await dialog.getByRole('button', { name: /^Apply(?: filters)?$/ }).click();
      await dialog.waitFor({ state: 'hidden' });
      results.push({ route: target, ...dimensions, controls: 'Close, backdrop, Escape, focus trap, Android Back, Reset and Apply passed' });
      console.log(`PASS ${target}`);
    }

    await page.goto('http://127.0.0.1:5176/shop/orders');
    const trigger = page.getByRole('button', { name: /^Filters(?:,|$)/ });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
    await dialog.getByLabel('From date', { exact: true }).fill('2026-10-15');
    await dialog.getByLabel('To date', { exact: true }).fill('2026-10-01');
    await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(await dialog.isVisible(), true, 'Invalid dates keep drawer open');
    await dialog.getByLabel('To date', { exact: true }).fill('2026-10-15');
    await dialog.getByRole('button', { name: 'Apply filters' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForLoadState('networkidle');
    assert.ok(calls.some(call => call.endpoint === '/shop-admin/orders' && call.query.includes('date_from=2026-10-15') && call.query.includes('date_to=2026-10-15')));

    for (const size of [{ width: 320, height: 640 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(size);
      await trigger.click();
      await page.locator('.mobile-filter-drawer').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      const geometry = await page.locator('.mobile-filter-drawer').evaluate(element => {
        const footer = element.querySelector('.mobile-filter-drawer-footer').getBoundingClientRect();
        const body = element.querySelector('.mobile-filter-drawer-body');
        return { horizontalOverflow: body.scrollWidth > body.clientWidth + 1, footerBottom: footer.bottom, height: innerHeight };
      });
      assert.equal(geometry.horizontalOverflow, false);
      assert.ok(geometry.footerBottom <= geometry.height, 'Footer remains visible in landscape and narrow screens');
      await page.screenshot({ path: path.join(output, `shop-orders-${size.width}x${size.height}.png`), fullPage: false });
      await dialog.getByRole('button', { name: 'Close filters', exact: true }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const searchResponse = page.waitForResponse(response => response.url().includes('/shop-admin/orders?') && new URL(response.url()).searchParams.get('q') === 'Alice');
    await page.getByRole('searchbox', { name: 'Search orders' }).fill('Alice');
    await searchResponse;
    await page.waitForLoadState('networkidle');
    const initialListRequests = calls.filter(call => call.endpoint === '/shop-admin/orders').length;
    const card = page.getByRole('button', { name: 'View order SHOP-8' });
    await card.evaluate(element => { window.filterSourceCard = element; });
    await card.click();
    await page.getByRole('heading', { name: 'SHOP-8', exact: true }).waitFor();
    await page.goBack();
    await card.waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search orders' }).inputValue(), 'Alice');
    assert.equal(await card.evaluate(element => element === window.filterSourceCard), true, 'Back retains the original list content');
    assert.equal(calls.filter(call => call.endpoint === '/shop-admin/orders').length, initialListRequests, 'Browser Back does not refetch list');
    await card.click();
    await page.getByRole('heading', { name: 'SHOP-8', exact: true }).waitFor();
    await page.locator('.shop-orders-header').getByRole('button', { name: 'Back', exact: true }).click();
    await card.waitFor();
    assert.equal(await page.getByRole('searchbox', { name: 'Search orders' }).inputValue(), 'Alice');
    assert.equal(calls.filter(call => call.endpoint === '/shop-admin/orders').length, initialListRequests, 'App-bar Back does not refetch list');

    fixtureLanguage = 'my';
    await page.evaluate(() => localStorage.setItem('mkpos.language', 'my'));
    await page.goto('http://127.0.0.1:5176/shop/orders');
    await page.locator('.mobile-filter-toggle').click();
    const myDialog = page.getByRole('dialog');
    await myDialog.waitFor();
    assert.equal(await myDialog.getByRole('heading', { name: 'စစ်ထုတ်ရန်', exact: true }).isVisible(), true);
    await page.locator('.mobile-filter-drawer').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: path.join(output, 'shop-orders-myanmar.png'), fullPage: false });
    assert.deepEqual(errors, [], 'No page errors');
    await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ results, additionalChecks: ['Invalid dates remain open', 'Valid dates reach API', '320px phone, landscape and tablet layout', 'Browser and app-bar Back retain search and mounted content without refetch', 'Myanmar localization'], errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
