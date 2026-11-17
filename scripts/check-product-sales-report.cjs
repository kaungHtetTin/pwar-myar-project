const { chromium, firefox } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const roots = process.argv.slice(2);
const engine = process.env.PRODUCT_REPORT_BROWSER || 'chromium';
let theme = 'light';
const modules = ['reports','products','sell','sales','shop','settings'];
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Loading fixture', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: modules, subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
const product = { id: 1, name: 'Fixture product', sku: 'SKU-1', category: 'General', price: 1000, cost: 500, stock: 20, is_active: true, prices: [{ name: 'Retail', price: 1000 }], unit_name: 'Unit' };
function payload(endpoint) {
  if (endpoint === '/shop-admin/owner-location') return { submitted: true };
  if (endpoint === '/auth/me') return session;
  if (endpoint === '/app-config') return { enabled_modules: modules, permissions: modules, language: 'en', business: session.business };
  if (endpoint === '/settings') return { language: 'en', currency: 'MMK', shop_name: 'Loading fixture', price_types: 'Retail' };
  if (endpoint === '/categories') return ['General'];
  if (endpoint === '/price-types') return { items: ['Retail'], rules: [], usage: {} };
  if (endpoint === '/products') return { items: [product], total: 1 };
  if (endpoint === '/products/summary') return { total_products: 1, low_stock: 0, out_of_stock: 0 };
  if (endpoint === '/expenses') return [{ id: 1, expense_date: '2026-10-31', title: 'Fixture expense', category: 'General', amount: 1000 }];
  if (endpoint === '/customers') return { items: [{ id: 1, name: 'Fixture customer', balance: 0 }], total: 1, account_summary: {} };
  if (endpoint === '/suppliers') return { items: [{ id: 1, name: 'Fixture supplier', balance: 0 }], total: 1 };
  if (endpoint === '/sales') return { items: [{ id: 1, created_at: '2026-10-31', receipt_no: 'Fixture sale', total: 1000, paid_amount: 1000, credit_amount: 0 }], total: 1 };
  if (endpoint === '/purchases') return { items: [{ id: 1, created_at: '2026-10-31', supplier_name: 'Fixture purchase', total_cost: 1000, paid_amount: 1000, credit_amount: 0 }], total: 1 };
  if (endpoint === '/branding') return { primary_color: '#0e684e', theme_mode: theme, theme_version: 1 };
  if (endpoint === '/expenses/summary') return { matching_count: 0, today_total: 0, month_total: 0, filter_total: 0 };
  if (endpoint === '/subscription') return session.subscription;
  if (endpoint === '/ai-assistant/config') return { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
  if (endpoint === '/reports/summary') return { all_time: true, sales_count: 0, sales_total: 0, cash_total: 0, credit_total: 0, expense_total: 0, profit_estimate: 0,
    payment_methods: [], expense_categories: [], top_products: [], cash_movement: {}, current_accounts: {}, inventory_valuation: {},
    sales_trends: { month: { label: 'October', items: [] }, year: { label: '2026', items: [] } } };
  return { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false, unread_count: 0, cursor: 0 };
}

const allRows = Array.from({ length: 35 }, (_, i) => ({ id: i + 1, product_name: `Report Item ${String(i + 1).padStart(2, '0')} – durable replacement valve`, sku: `SKU-${i + 1}`, category: i % 2 ? 'Other' : 'Hardware', sale_count: i % 5 + 1, quantity: i + 1.5, foc_quantity: .5, total: (i + 1) * 1000 }));
function productData(params) {
  const q = (params.get('q') || '').toLowerCase(), category = params.get('category');
  const filtered = allRows.filter(row => (!q || `${row.product_name} ${row.sku}`.toLowerCase().includes(q)) && (!category || row.category === category));
  const sort = params.get('sort');
  filtered.sort((a, b) => sort === 'name_asc' ? a.product_name.localeCompare(b.product_name) : sort === 'sales_desc' ? b.sale_count - a.sale_count || a.id - b.id : sort === 'quantity_desc' ? b.quantity - a.quantity : b.total - a.total);
  const offset = Number(params.get('offset')), limit = Number(params.get('limit') || 25);
  return { items: filtered.slice(offset, offset + limit), total: filtered.length, categories: ['Hardware','Other'],
    start: params.get('start'), end: params.get('end'), all_time: params.get('all_time') === 'true',
    summary: { product_count: filtered.length, quantity: filtered.reduce((sum, row) => sum + row.quantity, 0), foc_quantity: filtered.length / 2, total: filtered.reduce((sum, row) => sum + row.total, 0) } };
}
(async () => {
  const browser = await ({ chromium, firefox }[engine]).launch({ headless: true });
  const results = [];
  try {
    for (const root of roots) for (const [app, width] of [['web',1440],['web',1024],['mobile',390],['mobile',768]]) {
      const mobile = app === 'mobile';
      const base = path.join(root, 'laravel/public', mobile ? 'mobile' : path.basename(root) === 'pwarmyar-pos' ? 'pos' : 'app');
      const server = http.createServer(async (req, res) => {
        let file = path.resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
        if (file !== base && !file.startsWith(base + path.sep)) return res.writeHead(403).end();
        try {
          if (!path.extname(file) || (await fs.stat(file)).isDirectory()) file = path.join(base, 'index.html');
          res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
          res.end(await fs.readFile(file));
        } catch { res.writeHead(404).end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], calls = [];
      page.on('pageerror', err => errors.push(err.message));
      try {
        await page.addInitScript(() => { localStorage.setItem('mkpos.activeModule','reports'); localStorage.setItem('mkpos.accessToken','local-fixture'); });
        await page.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.pathname.includes('/api/')) {
            const name = url.pathname.split('/api')[1];
            if (req.method() === 'GET') calls.push({ name, params: Object.fromEntries(url.searchParams) });
            let data = payload(name);
            if (name === '/reports/products') data = productData(url.searchParams);
            if (name === '/reports/summary') data = { ...data, all_time: false, start: url.searchParams.get('start'), end: url.searchParams.get('end'), top_products: allRows.slice(-5).reverse().map(row => ({ ...row, product_name: row.product_name })) };
            return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': req.headers().origin || '*', 'Access-Control-Allow-Credentials':'true', 'Access-Control-Allow-Headers':'authorization,content-type,x-requested-with,x-xsrf-token,accept', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }, json:data });
          }
          if (url.pathname.endsWith('/sanctum/csrf-cookie')) return route.fulfill({status:204});
          if (url.hostname !== '127.0.0.1') return route.abort();
          return route.continue();
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/${mobile ? 'reports' : ''}`);
        const more = page.getByRole('button', { name:'See more', exact:true });
        await more.waitFor({ timeout:20000 });
        await more.scrollIntoViewIfNeeded();
        const sourceY = await page.evaluate(() => window.scrollY);
        await more.click();
        const target = page.locator(mobile ? '.product-sales-mobile:visible' : '.product-sales-page:visible');
        await target.getByText(allRows[34].product_name, { exact:true }).waitFor();
        await fs.mkdir(path.join(root,'artifacts/product-sales-report'),{recursive:true});
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path:path.join(root,`artifacts/product-sales-report/${engine}-${app}-${width}-initial.png`),fullPage:false });
        const source = calls.find(call => call.name === '/reports/summary');
        const first = calls.find(call => call.name === '/reports/products');
        assert.equal(first.params.start, source.params.start);
        assert.equal(first.params.end, source.params.end);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'Page must not overflow horizontally');
        if (mobile) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await target.getByText(allRows[0].product_name, { exact:true }).waitFor();
          assert.equal(await target.locator('.product-sales-mobile-row').count(),35);
        } else {
          await target.getByRole('button', { name:'Next', exact:true }).click();
          await target.getByText(allRows[9].product_name, { exact:true }).waitFor();
          assert.ok(calls.some(call => call.name === '/reports/products' && call.params.offset === '25'));
        }
        if (mobile) await page.getByRole('button', { name:'Filters', exact:true }).click();
        const filters = mobile ? page.locator('#product-sales-filters') : target;
        await filters.getByLabel('Search products', { exact:true }).fill('Report Item 3');
        await filters.getByLabel('Category', { exact:true }).selectOption('Hardware');
        await filters.getByLabel('Sort by', { exact:true }).selectOption('sales_desc');
        await filters.getByRole('button', { name:'Apply filters', exact:true }).click();
        await page.waitForFunction(() => !document.querySelector('.product-sales-page table[aria-busy="true"], .product-sales-mobile section[aria-busy="true"]'));
        await target.getByText(allRows[32].product_name, { exact:true }).waitFor();
        const last = calls.filter(call => call.name === '/reports/products').at(-1);
        assert.equal(last.params.offset,'0'); assert.equal(last.params.sort,'sales_desc'); assert.equal(last.params.category,'Hardware');
        if (mobile) await page.getByRole('button', { name:/^Filters/ }).click();
        const from = filters.getByLabel('From', { exact:true });
        const original = await from.inputValue();
        await from.fill('2099-12-31');
        const beforeInvalid = calls.filter(call => call.name === '/reports/products').length;
        await filters.getByRole('button', { name:'Apply filters', exact:true }).click();
        await filters.getByText('From date cannot be later than To date.', { exact:true }).waitFor();
        assert.equal(calls.filter(call => call.name === '/reports/products').length, beforeInvalid);
        await from.fill(original);
        if (mobile) await page.keyboard.press('Escape');
        await fs.mkdir(path.join(root,'artifacts/product-sales-report'),{recursive:true});
        await page.screenshot({ path:path.join(root,`artifacts/product-sales-report/${engine}-${app}-${width}.png`),fullPage:false });
        if (mobile) await page.getByRole('button', { name:/^Filters/ }).click();
        const reset = page.waitForRequest(req => {
          const url = new URL(req.url());
          return url.pathname.endsWith('/reports/products') && req.method() === 'GET' && !url.searchParams.has('q') && url.searchParams.get('offset') === '0';
        });
        await filters.getByRole('button', { name:'Reset', exact:true }).click();
        await reset;
        await target.getByText(allRows[34].product_name, {exact:true}).waitFor();
        await page.getByRole('button', { name:'Back to Reports', exact:true }).click();
        await more.waitFor();
        await page.waitForFunction(y => Math.abs(window.scrollY - y) < 3, sourceY);
        assert.equal(calls.filter(call => call.name === '/reports/summary').length,1,'Back must not reload the overview');
        assert.deepEqual(errors,[]);
        results.push({root,engine,app,width,seeMore:true,inheritedPeriod:true,serverPagination:!mobile,endlessAppend:mobile,filters:true,dateValidation:true,reset:true,sourceScrollRetained:true,noSummaryRefetch:true,errors});
        console.log(JSON.stringify(results.at(-1)));
      } catch (err) {
        console.log('Browser fixture failure:', app, width, page.url(), (await page.locator('body').innerText()).slice(-2200));
        await fs.mkdir(path.join(root,'artifacts/product-sales-report'),{recursive:true});
        await page.screenshot({path:path.join(root,`artifacts/product-sales-report/${engine}-failure.png`)});
        throw err;
      } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
    }
    await fs.writeFile(path.join(roots[0],`artifacts/product-sales-report/results-${engine}.json`),JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});

