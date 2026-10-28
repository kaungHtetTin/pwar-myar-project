// Check rendered production branding without contacting production services.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('../shop/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'pwarmyar-branding');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [app, folder, route] of [['frontend', 'app', '/#/login'], ['mobile', 'mobile', '/login'], ['office', 'office', '/'], ['shop', 'shop', '/#/account/login']]) {
      const directory = path.join(root, 'laravel/public', folder);
      const server = http.createServer(async (req, res) => {
        try {
          let file = path.resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
          if (!file.startsWith(directory + path.sep) && file !== directory) { res.writeHead(403).end(); return; }
          try { if (!(await fs.stat(file)).isFile()) file = path.join(directory, 'index.html'); }
          catch { file = path.join(directory, 'index.html'); }
          const body = await fs.readFile(file);
          res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
          res.end(body);
        } catch { res.writeHead(500).end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        for (const width of [390, 1440]) {
          const page = await browser.newPage({ viewport: { width, height: 950 }, serviceWorkers: 'block' });
          const errors = [], apiCalls = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.route('**/*', async interception => {
            const url = new URL(interception.request().url());
            if (url.hostname === '127.0.0.1') return interception.continue();
            if (url.pathname.startsWith('/public/api/')) {
              assert.equal(url.origin, 'https://www.pwarmyar.com');
              apiCalls.push(url.href);
              if (url.pathname.endsWith('/branding')) return interception.fulfill({ json: { primary_color: '#0e684e', theme_mode: 'light', theme_version: 1 } });
              if (url.pathname.endsWith('/me')) return interception.fulfill({ status: 401, json: { message: 'Unauthenticated.' } });
              return interception.fulfill({ json: { items: [], total: 0, has_more: false, enabled: false, realtime_enabled: false } });
            }
            return interception.abort();
          });
          await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
          await page.locator('input[type="password"]').first().waitFor();
          assert.match(await page.title(), /PwarMyar/);
          assert.ok(apiCalls.length, `${app}: production API configuration used`);
          assert.deepEqual(errors, [], `${app}: browser errors`);
          const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
          assert.match(favicon, /pwarmyar-icon\.png/);
          const images = await page.locator('img[src*="pwarmyar-"]').evaluateAll(nodes => nodes.map(node => ({ src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0 })));
          assert.ok(images.length && images.every(image => image.loaded), `${app}: brand images loaded`);
          const text = await page.locator('body').innerText();
          assert.ok(!text.includes('MKPOS'), `${app}: no old visible brand`);
          await page.screenshot({ path: path.join(output, `${app}-${width}.png`), fullPage: true });
          results.push({ app, width, title: await page.title(), favicon, images, apiOrigin: 'https://www.pwarmyar.com/public/api', browserErrors: errors });
          await page.close();
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    }
    if (process.env.PWARMYAR_LANDING_URL) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 950 } });
        const origin = new URL(process.env.PWARMYAR_LANDING_URL).origin;
        await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        await page.goto(process.env.PWARMYAR_LANDING_URL);
        assert.match(await page.title(), /PwarMyar/);
        await page.locator('.site-header .brand img').waitFor();
        assert.ok(await page.locator('.site-header .brand img').evaluate(image => image.complete && image.naturalWidth > 0));
        assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), `${origin}/branding/pwarmyar-main.jpg`);
        await page.screenshot({ path: path.join(output, `landing-${width}.png`) });
        await page.locator('.footer-brand').scrollIntoViewIfNeeded();
        assert.ok(await page.locator('.footer-brand img').evaluate(image => image.complete && image.naturalWidth > 0));
        await page.screenshot({ path: path.join(output, `landing-footer-${width}.png`) });
        results.push({ app: 'landing', width, title: await page.title(), logosLoaded: true });
        await page.close();
      }
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`Verified PwarMyar branding in ${results.length} rendered app/viewport combinations.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
