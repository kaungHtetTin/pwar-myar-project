const { chromium, firefox } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const roots = process.argv.length > 2 ? process.argv.slice(2) : [path.resolve(__dirname, '..')];
const widths = process.env.PRODUCT_SCROLL_WIDTH ? [Number(process.env.PRODUCT_SCROLL_WIDTH)] : [1440, 1024, 980, 900, 768];
const engine = process.env.PRODUCT_SCROLL_BROWSER || 'chromium';
const height = Number(process.env.PRODUCT_SCROLL_HEIGHT || 850);
const scale = Number(process.env.PRODUCT_SCROLL_DPR || 1);
const realistic = process.env.PRODUCT_SCROLL_REALISTIC === '1';
const compact = process.env.PRODUCT_SCROLL_LAYOUT === 'compact';
const artifactDir = compact ? 'product-columns' : 'product-scrollbar-fix';
const count = realistic ? 25 : 50;
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
            try { await page.getByText(`Fixture product ${count}`, { exact: true }).waitFor({ timeout: 15000 }); }
            catch (error) { console.log('Fixture state:', (await page.locator('body').innerText()).slice(0, 1800), errors); throw error; }
            const metrics = await page.evaluate(() => {
              const select = selector => {
                const el = document.querySelector(selector), css = getComputedStyle(el);
                return { height: el.clientHeight, scrollHeight: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth, overflowY: css.overflowY, overflowX: css.overflowX, overscrollY: css.overscrollBehaviorY, maxHeight: css.maxHeight };
              };
              return { document: { height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight }, products: select('.products-layout'), panel: select('.product-main-panel'), card: select('.product-table-card'), table: select('.product-grid-wrap'), columns: [...document.querySelectorAll('.product-data-table thead th')].map(el => el.getBoundingClientRect().width) };
            });
            assert.equal(metrics.table.maxHeight, 'none', 'Product table must have no height cap');
            assert.equal(metrics.table.overflowY, 'hidden', 'Product table must never paint a vertical scrollbar');
            assert.equal(metrics.table.overflowX, 'auto', 'Horizontal scrolling must remain available');
            assert.ok(metrics.table.scrollHeight <= metrics.table.height + 1, 'Table must not scroll vertically');
            assert.ok(metrics.document.scrollHeight > metrics.document.height, 'Document must own long product lists');
            assert.equal(errors.length, 0, errors.join('\n'));
            if (compact) {
              const [selection, name, code, category, prices, stock, status, actions] = metrics.columns;
              assert.ok(name >= 251, 'Product names must have at least 252px including the thumbnail');
              for (const [actual, expected] of [[selection, 36], [code, 112], [category, 104], [prices, 220], [stock, 80], [status, 96], [actions, 80]]) {
                assert.ok(Math.abs(actual - expected) < 1, `Compact column: expected ${expected}px, got ${actual}px`);
              }
              assert.ok(Math.abs(metrics.columns.reduce((sum, value) => sum + value, 0) - Math.max(980, metrics.table.width)) < 2, 'Table must only overflow by its compact minimum');
              assert.notEqual(await page.locator('.product-data-table th.table-actions-cell').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Pinned Actions heading must cover horizontally scrolling text');
              if (metrics.table.width < 980) {
                await page.locator('.product-grid-wrap').evaluate(el => { el.scrollLeft = el.scrollWidth; });
                assert.ok(await page.locator('.product-grid-wrap').evaluate(el => el.scrollLeft > 0), 'Narrow windows must allow horizontal scrolling');
                assert.equal(await page.locator('.product-grid-wrap').evaluate(el => el.scrollTop), 0);
                await page.locator('.product-grid-wrap').evaluate(el => { el.scrollLeft = 0; });
              }
            }
            await fs.mkdir(path.join(root, `artifacts/${artifactDir}`), { recursive: true });
            if (width === 980 || width === 1152) {
              await page.screenshot({ path: path.join(root, `artifacts/${artifactDir}/${engine}-${width}-${height}-top.png`) });
            }
            await page.getByText(`Fixture product ${count}`, { exact: true }).scrollIntoViewIfNeeded();
            const last = await page.getByText(`Fixture product ${count}`, { exact: true }).boundingBox();
            assert.ok(last.y >= 0 && last.y + last.height <= height + 1, 'Last product must be reachable through page scrolling');
            await page.getByText(`1-${count} of ${count}`, { exact: true }).scrollIntoViewIfNeeded();
            assert.equal(await page.locator('.product-grid-wrap').evaluate(el => el.scrollTop), 0, 'Reaching the footer must not scroll the table vertically');
            await page.getByRole('checkbox', { name: 'Select all products on this page', exact: true }).check();
            assert.equal(await page.getByText(`${count} selected across pages`, { exact: true }).count(), 1);
            const box = await page.locator('.product-grid-wrap').boundingBox();
            await page.mouse.move(box.x + 100, Math.min(height - 40, box.y + 100));
            await page.mouse.wheel(0, 600);
            await page.waitForFunction(() => window.scrollY > 0);
            const scroll = await page.evaluate(() => ({ documentY: window.scrollY, tableY: document.querySelector('.product-grid-wrap').scrollTop }));
            assert.equal(scroll.tableY, 0, 'Wheel gestures over product rows must scroll the document');
            await page.getByRole('button', { name: 'Sell', exact: true }).click();
            await page.waitForFunction(() => document.body.classList.contains('pos-sell-active'));
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'Sell must retain its locked POS viewport');
            await page.getByRole('button', { name: 'Products', exact: true }).click();
            await page.getByText(`${count} selected across pages`, { exact: true }).waitFor();
            const returned = await page.evaluate(() => {
              const el = document.querySelector('.product-grid-wrap');
              return { height: el.clientHeight, content: el.scrollHeight, overflow: getComputedStyle(document.documentElement).overflowY };
            });
            assert.ok(returned.content <= returned.height + 1);
            assert.equal(returned.overflow, 'auto');
            results.push({ root, engine, width, viewportHeight: height, scale, count, realistic, ...metrics, scroll, lastRowReachable: true, footerReachable: true, retainedSelection: true, posViewportPreserved: true, errors });
            console.log(JSON.stringify(results.at(-1)));
          } finally { await context.close(); }
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    await fs.writeFile(path.join(roots[0], `artifacts/${artifactDir}/results-${engine}-${process.env.PRODUCT_SCROLL_WIDTH || 'all'}-${height}-${scale}-${count}.json`), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
