const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const roots = process.argv.length > 2 ? process.argv.slice(2) : [path.resolve(__dirname, '..')];
const modules = ['products', 'sales', 'purchases', 'customers', 'suppliers', 'expenses', 'transactions', 'reports', 'settings', 'billing', 'access', 'sell', 'shop'];
const cases = [
  ['products', '/products'], ['sales', '/sales'], ['purchases', '/purchases'],
  ['customers', '/customers'], ['suppliers', '/suppliers'], ['expenses', '/expenses'],
  ['transactions', '/customer-payments'], ['reports', '/reports/summary'],
  ['settings', '/settings'], ['billing', '/subscription'], ['access', '/roles'],
  ['sell', '/products'], ['shop', '/shop-admin/orders'],
  ['shop', '/shop-admin/reviews', '?shopTab=reviews'], ['assistant', '/ai-assistant/config'],
];
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Refresh fixture', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: modules, subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
const product = { id: 1, name: 'Fixture product', sku: 'SKU-1', category: 'General', price: 1000, cost: 500, stock: 20, is_active: true, prices: [{ name: 'Retail', price: 1000 }], unit_name: 'Unit' };
function payload(endpoint) {
  if (endpoint === '/shop-admin/owner-location') return { submitted: true };
  if (endpoint === '/auth/me') return session;
  if (endpoint === '/app-config') return { enabled_modules: modules, permissions: modules, language: 'en', business: session.business };
  if (endpoint === '/settings') return { language: 'en', currency: 'MMK', shop_name: 'Refresh fixture', price_types: 'Retail' };
  if (endpoint === '/categories') return ['General'];
  if (endpoint === '/price-types') return { items: ['Retail'], rules: [], usage: {} };
  if (endpoint === '/products') return { items: [product], total: 1 };
  if (endpoint === '/products/summary') return { total_products: 1, low_stock: 0, out_of_stock: 0 };
  if (endpoint === '/expenses') return [];
  if (endpoint === '/expenses/summary') return { matching_count: 0, today_total: 0, month_total: 0, filter_total: 0 };
  if (endpoint === '/subscription') return session.subscription;
  if (endpoint === '/ai-assistant/config') return { enabled: true, configured: true, storage_ready: true, weekly_limit: 50 };
  if (endpoint === '/reports/summary') return { all_time: true, sales_count: 0, sales_total: 0, cash_total: 0, credit_total: 0, expense_total: 0, profit_estimate: 0,
    payment_methods: [], expense_categories: [], top_products: [], cash_movement: {}, current_accounts: {}, inventory_valuation: {},
    sales_trends: { month: { label: 'October', items: [] }, year: { label: '2026', items: [] } } };
  return { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false, unread_count: 0, cursor: 0 };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const root of roots) {
      const app = path.basename(root) === 'pwarmyar-pos' ? 'pos' : 'app';
      const base = path.resolve(root, 'laravel/public', app);
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
      try {
        for (const [module, endpoint, query = ''] of cases.filter(([module]) => !process.env.APPBAR_REFRESH_MODULES || process.env.APPBAR_REFRESH_MODULES.split(',').includes(module))) {
          const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
          const page = await context.newPage(), errors = [], calls = [];
          let blocked = false, held = [];
          page.on('pageerror', error => errors.push(error.message));
          try {
            await page.addInitScript(module => {
              localStorage.setItem('mkpos.activeModule', module);
              localStorage.setItem('mkpos.accessToken', 'local-fixture');
            }, module);
            await page.route('**/*', async route => {
              const request = route.request(), url = new URL(request.url());
              if (url.pathname.includes('/api/')) {
                const name = url.pathname.split('/api')[1];
                calls.push({ name, method: request.method() });
                if (blocked && name === endpoint && request.method() === 'GET') await new Promise(resolve => held.push(resolve));
                return route.fulfill({ status: 200, headers: {
                  'Access-Control-Allow-Origin': request.headers().origin || '*', 'Access-Control-Allow-Credentials': 'true',
                  'Access-Control-Allow-Headers': 'authorization,content-type,x-requested-with,x-xsrf-token,accept', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                }, json: payload(name) });
              }
              if (url.pathname.endsWith('/sanctum/csrf-cookie')) return route.fulfill({ status: 204 });
              if (url.hostname !== '127.0.0.1') return route.abort();
              return route.continue();
            });
            const initial = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api' + endpoint) && response.request().method() === 'GET', { timeout: 15000 });
            await page.goto(`http://127.0.0.1:${server.address().port}/${query}`);
            await initial;
            const button = page.getByRole('button', { name: 'Refresh', exact: true });
            await button.waitFor({ timeout: 10000 });
            const initialCalls = calls.filter(call => call.name === endpoint && call.method === 'GET').length;
            blocked = true;
            const refreshed = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/api' + endpoint) && request.method() === 'GET', { timeout: 10000 });
            await button.click(); await refreshed;
            const busy = page.getByRole('button', { name: 'Refreshing page', exact: true });
            assert.equal(await busy.isDisabled(), true);
            assert.equal(await busy.getAttribute('aria-busy'), 'true');
            assert.equal(await busy.locator('.workspace-refresh-spin').count(), 1);
            assert.equal(await busy.getByText('Refreshing…', { exact: true }).isVisible(), true);
            assert.equal(await busy.locator('svg').evaluate(el => getComputedStyle(el).animationName), 'workspace-refresh-spin');
            await busy.dispatchEvent('click');
            assert.equal(calls.filter(call => call.name === endpoint && call.method === 'GET').length, initialCalls + 1, 'Repeat clicks must not duplicate reads');
            if (module === 'products') {
              await fs.mkdir(path.join(root, 'artifacts/appbar-refresh'), { recursive: true });
              await page.screenshot({ path: path.join(root, 'artifacts/appbar-refresh/products-busy.png') });
              await page.screenshot({ path: path.join(root, 'artifacts/appbar-refresh/appbar-busy.png'), clip: { x: 940, y: 0, width: 500, height: 60 } });
              await page.emulateMedia({ reducedMotion: 'reduce' });
              assert.equal(await busy.locator('svg').evaluate(el => getComputedStyle(el).animationName), 'none');
              assert.equal(await busy.getByText('Refreshing…', { exact: true }).isVisible(), true);
              await page.emulateMedia({ reducedMotion: 'no-preference' });
            }
            blocked = false; held.splice(0).forEach(resolve => resolve());
            await page.waitForFunction(() => document.querySelector('.workspace-refresh-button')?.getAttribute('aria-busy') === 'false', { timeout: 10000 });
            assert.equal(await page.getByRole('button', { name: 'Refresh', exact: true }).isEnabled(), true);
            assert.equal(errors.length, 0, errors.join('\n'));
            results.push({ root, module, endpoint, loading: true, duplicatePrevented: true, completed: true, errors });
            console.log(JSON.stringify(results.at(-1)));
          } catch (error) {
            console.log('Failed fixture:', { root, module, endpoint, errors, calls: calls.slice(-10) });
            console.log((await page.locator('body').innerText()).slice(0, 1000));
            throw error;
          } finally {
            blocked = false; held.splice(0).forEach(resolve => resolve()); await context.close();
          }
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    await fs.writeFile(path.join(roots[0], process.env.APPBAR_REFRESH_MODULES ? 'artifacts/appbar-refresh-browser-partial.json' : 'artifacts/appbar-refresh-browser.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
