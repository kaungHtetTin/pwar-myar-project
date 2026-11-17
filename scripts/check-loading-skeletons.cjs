const { chromium, firefox } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const roots = process.argv.length > 2 ? process.argv.slice(2) : [path.resolve(__dirname, '..')];
const engine = process.env.SKELETON_BROWSER || 'chromium';
let theme = 'light';
const modules = ['products', 'sales', 'purchases', 'customers', 'suppliers', 'expenses', 'transactions', 'reports', 'settings', 'billing', 'access', 'sell', 'shop'];
const cases = [
 ['products','/products','',8], ['sales','/sales','',9], ['purchases','/purchases','',7],
 ['customers','/customers','',8], ['suppliers','/suppliers','',8], ['expenses','/expenses','',7],
 ['transactions','/customer-payments','',7], ['reports','/reports/summary','',0],
 ['settings','/settings','',0], ['billing','/subscription','',7], ['access','/roles','',4],
 ['sell','/products','',0], ['shop','/shop-admin/orders','',null],
 ['shop','/shop-admin/reviews','?shopTab=reviews',null],
 ['shop','/shop-admin/publications','?shopTab=catalog',null],
 ['shop','/shop-admin/promotions','?shopTab=promotions',7],
];
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

(async () => {
  const browser = await ({ chromium, firefox }[engine]).launch({ headless: true });
  const results = [];
  try {
    for (const root of roots) {
      const base = path.join(root, 'laravel/public', path.basename(root) === 'pwarmyar-pos' ? 'pos' : 'app');
      const server = http.createServer(async (req, res) => {
        let file = path.resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
        if (file !== base && !file.startsWith(base + path.sep)) return res.writeHead(403).end();
        try {
          if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
          res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
          res.end(await fs.readFile(file));
        } catch { res.writeHead(404).end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      await fs.mkdir(path.join(root, 'artifacts/loading-skeletons'), { recursive: true });
      try {
        for (const [index, [module, endpoint, query, columns]] of cases.entries()) {
          theme = index % 2 ? 'dark' : 'light';
          const width = module === 'products' ? 980 : module === 'settings' ? 900 : 1440;
          const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
          const page = await context.newPage(), errors = [];
          let blocked = true, held = [];
          page.on('pageerror', error => errors.push(error.message));
          try {
            await page.addInitScript(module => {
              localStorage.setItem('mkpos.activeModule', module);
              localStorage.setItem('mkpos.accessToken', 'local-fixture');
            }, module);
            await page.route('**/*', async route => {
              const req = route.request(), url = new URL(req.url());
              if (url.pathname.includes('/api/')) {
                const name = url.pathname.split('/api')[1];
                if (blocked && name === endpoint && req.method() === 'GET') await new Promise(resolve => held.push(resolve));
                return route.fulfill({ status: 200, headers: {
                  'Access-Control-Allow-Origin': req.headers().origin || '*', 'Access-Control-Allow-Credentials': 'true',
                  'Access-Control-Allow-Headers': 'authorization,content-type,x-requested-with,x-xsrf-token,accept',
                  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                }, json: payload(name) });
              }
              if (url.pathname.endsWith('/sanctum/csrf-cookie')) return route.fulfill({ status: 204 });
              if (url.hostname !== '127.0.0.1') return route.abort();
              return route.continue();
            });
            await page.goto(`http://127.0.0.1:${server.address().port}/${query}`);
            const active = page.locator('.module-view:not([hidden])');
            await active.locator('.skeleton-block').first().waitFor({ timeout: 15000 });
            await page.waitForFunction(mode => document.documentElement.dataset.theme === mode, theme);
            if (columns !== 0) {
              const row = active.locator('.table-skeleton-row').first();
              const table = row.locator('xpath=ancestor::table');
              const count = await table.locator('thead th').count();
              if (columns) assert.equal(count, columns, `${module} heading count`);
              assert.equal(await table.locator('.table-skeleton-row').count(), 6);
              for (const tr of await table.locator('.table-skeleton-row').all()) {
                assert.equal(await tr.locator('td').count(), count);
                assert.equal(await tr.getAttribute('aria-hidden'), 'true');
              }
            } else {
              assert.equal(await active.locator('.loading-skeleton').first().evaluate(el => getComputedStyle(el).position), 'static');
            }
            const block = active.locator('.skeleton-block').first();
            assert.equal(await block.evaluate(el => getComputedStyle(el).animationName), 'skeleton-pulse');
            const skin = await block.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, height: el.getBoundingClientRect().height }));
            assert.ok(skin.height > 0);
            assert.notEqual(skin.background, 'rgba(0, 0, 0, 0)');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await block.evaluate(el => getComputedStyle(el).animationName), 'none');
            await page.screenshot({ path: path.join(root, `artifacts/loading-skeletons/${engine}-${module}${query.replace('?shopTab=', '-')}-${theme}.png`) });
            blocked = false; held.splice(0).forEach(resolve => resolve());
            await page.waitForFunction(() => ![...document.querySelectorAll('.module-view:not([hidden]) .skeleton-block')].some(el => el.getBoundingClientRect().height && el.getBoundingClientRect().width), { timeout: 15000 });
            if (['products', 'sales', 'purchases', 'customers', 'suppliers', 'expenses', 'reports'].includes(module)) {
              if (width < 981) await page.setViewportSize({ width: 1440, height: 900 });
              const dataText = await active.innerText();
              blocked = true;
              await page.getByRole('button', { name: 'Refresh', exact: true }).click();
              await page.getByRole('button', { name: 'Refreshing page', exact: true }).waitFor();
              assert.equal(await active.locator('.skeleton-block').count(), 0, `${module} refresh must retain loaded data`);
              if (module !== 'reports') assert.ok(dataText.includes('Fixture'), `${module} fixture must contain data`);
              blocked = false; held.splice(0).forEach(resolve => resolve());
              await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
            }
            assert.deepEqual(errors, []);
            results.push({ root, engine, module, query, width, theme, columns, initialSkeleton: true, reducedMotion: true, completed: true, refreshRetained: ['products', 'sales', 'purchases', 'customers', 'suppliers', 'expenses', 'reports'].includes(module), errors });
            console.log(JSON.stringify(results.at(-1)));
          } finally {
            blocked = false; held.splice(0).forEach(resolve => resolve());
            await context.close();
          }
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    await fs.writeFile(path.join(roots[0], `artifacts/loading-skeletons/results-${engine}.json`), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
