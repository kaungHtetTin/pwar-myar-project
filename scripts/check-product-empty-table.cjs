const { chromium, firefox } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const roots = process.argv.length > 2 ? process.argv.slice(2) : [path.resolve(__dirname, '..')];
const widths = process.env.PRODUCT_SCROLL_WIDTH ? [Number(process.env.PRODUCT_SCROLL_WIDTH)] : [1440, 1152, 980];
const engine = process.env.PRODUCT_SCROLL_BROWSER || 'chromium';
const height = Number(process.env.PRODUCT_SCROLL_HEIGHT || 850);
const scale = Number(process.env.PRODUCT_SCROLL_DPR || 1);
const realistic = process.env.PRODUCT_SCROLL_REALISTIC === '1';
const compact = process.env.PRODUCT_SCROLL_LAYOUT === 'compact';
const artifactDir = 'product-empty';
const count = 0;
const productName = i => !realistic || i === count - 1 ? `Fixture product ${i + 1}`
  : `${['10PK 1110', '10pk 1512 belt', '4 way valve (volvo) WABCO (7ports)', 'Long replacement belt and tensioner'][i % 4]} — ${i + 1}`;
const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
(async () => {
  const browser = await ({ chromium, firefox }[engine]).launch({ headless: true });
  const results = [];
  try {
    for (const root of roots) {
      const app = path.basename(root) === 'pwarmyar-pos' ? 'pos' : 'app';
      const base = path.resolve(root, 'laravel/public', app);
      const server = http.createServer(async (req, res) => {
        let file = path.resolve(base, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
        if (file !== base && !file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
        try {
          if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
          res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
          res.end(await fs.readFile(file));
        } catch { res.writeHead(404).end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        for (const width of widths) {
          const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, serviceWorkers: 'block' });
          try {
            const page = await context.newPage();
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
              localStorage.setItem('mkpos.activeModule', 'products');
              localStorage.setItem('mkpos.accessToken', 'local-fixture');
            });
            const session = { user: { id: 1, name: 'Owner', role: 'owner' }, business: { id: 1, name: 'Scroll inspection', currency: 'MMK', timezone: 'Asia/Rangoon' }, permissions: ['products', 'sell', 'settings'], subscription: { is_valid: true, can_mutate: true, access_type: 'paid' } };
            await page.route('**/*', async route => {
              const url = new URL(route.request().url());
              if (url.pathname.includes('/api/')) {
                const endpoint = url.pathname.split('/api')[1];
                let data = { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false, unread_count: 0 };
                if (endpoint === '/auth/me') data = session;
                if (endpoint === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, language: 'en', business: session.business };
                if (endpoint === '/settings') data = { language: 'en', currency: 'MMK' };
                if (endpoint === '/categories') data = ['General'];
                if (endpoint === '/price-types') data = { items: realistic ? ['Retail', 'Wholesale'] : ['Retail'], rules: realistic ? ['Retail', 'Wholesale'].map(name => ({ name, pricing_mode: 'automatic', markup_percent: 20, rounding: 1000, minimum_profit: 0 })) : [] };
                if (endpoint === '/products/summary') data = { total_products: count, low_stock: 0, out_of_stock: 0 };
                if (endpoint === '/products') data = { items: Array.from({ length: count }, (_, i) => ({ id: i + 1, name: productName(i), sku: `SKU-${i + 1}`, barcode: `123456${i + 1}`, category: realistic ? 'Belts & Tensioners' : 'General', price: 60000, cost: 50000, stock: 20, is_active: true, prices: [{ name: 'Retail', price: 60000, is_manual: false }, ...(realistic ? [{ name: 'Wholesale', price: 57500, is_manual: false }] : [])], unit_name: 'Unit' })), total: count };
                return route.fulfill({ status: 200, headers: {
                  'Access-Control-Allow-Origin': route.request().headers().origin || '*',
                  'Access-Control-Allow-Credentials': 'true',
                  'Access-Control-Allow-Headers': 'authorization,content-type,x-requested-with,x-xsrf-token,accept',
                  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                }, json: data });
              }
              if (url.pathname.endsWith('/sanctum/csrf-cookie')) return route.fulfill({ status: 204 });
              if (url.hostname !== '127.0.0.1') return route.abort();
              return route.continue();
            });
            await page.goto(`http://127.0.0.1:${server.address().port}/`);
            const empty = page.locator('.product-empty-state');
            await empty.getByRole('heading', { name: 'No products found' }).waitFor();
            const metrics = await page.evaluate(() => {
              const wrap = document.querySelector('.product-grid-wrap');
              const empty = wrap.querySelector('.product-empty-state');
              const footer = document.querySelector('.product-table-footer');
              const box = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom }; };
              return { wrap: box(wrap), empty:box(empty), footer:box(footer), clientHeight:wrap.clientHeight,
                scrollHeight:wrap.scrollHeight, clientWidth:wrap.clientWidth, scrollWidth:wrap.scrollWidth,
                overflowX:getComputedStyle(wrap).overflowX, overflowY:getComputedStyle(wrap).overflowY };
            });
            assert.ok(metrics.empty.height >= 200, 'Empty state needs at least 200px of visible space');
            assert.ok(metrics.wrap.height >= metrics.empty.height + 30, 'Header and empty state must both contribute height');
            assert.ok(metrics.scrollHeight <= metrics.clientHeight + 1, 'Empty state must fit without vertical clipping');
            assert.equal(metrics.overflowX, 'auto', 'Horizontal scrollbar must be conditional');
            assert.equal(metrics.overflowY, 'hidden');
            assert.ok(metrics.footer.y >= metrics.empty.bottom - 1, 'Pagination must follow the full empty body');
            const before = await empty.getByRole('button', { name: 'Add Product', exact: true }).boundingBox();
            await page.locator('.product-grid-wrap').evaluate(el => { el.scrollLeft = el.scrollWidth; });
            const scrollLeft = await page.locator('.product-grid-wrap').evaluate(el => el.scrollLeft);
            if (metrics.scrollWidth > metrics.clientWidth + 1) assert.ok(scrollLeft > 0);
            else assert.equal(scrollLeft, 0, 'Wide tables must not show an unnecessary horizontal scrollbar');
            const after = await empty.getByRole('button', { name: 'Add Product', exact: true }).boundingBox();
            assert.ok(Math.abs(before.x - after.x) < 1, 'Empty-state action must stay centered in the visible scroll area');
            assert.ok(after.x >= metrics.wrap.x && after.x + after.width <= metrics.wrap.x + metrics.clientWidth + 1, 'Empty-state action must stay fully visible');
            await fs.mkdir(path.join(root, `artifacts/${artifactDir}`), { recursive: true });
            await page.screenshot({ path: path.join(root, `artifacts/${artifactDir}/${engine}-${width}-empty.png`) });
            await empty.getByRole('button', { name: 'Add Product', exact: true }).click();
            const dialog = page.getByRole('dialog', { name: 'Add Product', exact: true });
            await dialog.waitFor();
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.equal(await dialog.count(), 0);
            await empty.getByRole('heading', { name: 'No products found' }).waitFor();
            assert.deepEqual(errors, []);
            results.push({ root, engine, width, ...metrics, scrollLeft, emptyVisible:true, conditionalHorizontalScroll:true, noVerticalClipping:true, addCancelVerified:true, errors });
            console.log(JSON.stringify(results.at(-1)));
          } finally { await context.close(); }
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    await fs.writeFile(path.join(roots[0], `artifacts/${artifactDir}/results-${engine}-${process.env.PRODUCT_SCROLL_WIDTH || 'all'}-${height}-${scale}-${count}.json`), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
