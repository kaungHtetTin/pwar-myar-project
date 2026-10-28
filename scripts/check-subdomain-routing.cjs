// Local Apache virtual hosts mirror the three production document roots.
// All API traffic is intercepted; no production account is used or changed.
const { chromium, webkit } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const output = path.resolve(__dirname, '../artifacts/subdomain-routing');
  await fs.mkdir(output, { recursive: true });
  const apps = [
    { name: 'app', port: 8184, routes: ['/', '/login', '/signup', '/forgot-password'] },
    { name: 'office', port: 8185, routes: ['/'] },
    { name: 'mobile', port: 8186, routes: ['/', '/login', '/signup', '/sales/90/edit'] },
  ];
  const evidence = [];
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const app of apps) {
        const origin = `http://127.0.0.1:${app.port}`;
        const context = await browser.newContext({
          viewport: app.name === 'mobile' ? { width: 393, height: 852 } : { width: 1366, height: 900 },
          serviceWorkers: 'block',
        });
        const calls = [];
        await context.route('https://www.pwarmyar.com/public/api/**', async route => {
          calls.push(route.request().url());
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthenticated.' }) });
        });
        for (const routePath of app.routes) {
          const fieldSelector = routePath === '/forgot-password' ? 'input[type="email"]' : 'input[type="password"]';
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          const response = await page.goto(origin + routePath);
          assert.equal(response.status(), 200, `${app.name}${routePath}: direct entry`);
          await page.locator(fieldSelector).first().waitFor();
          assert.equal(new URL(page.url()).pathname.startsWith('/public/'), false);
          await page.reload();
          await page.locator(fieldSelector).first().waitFor();
          assert.deepEqual(errors, []);
          const imageName = `${engineName}-${app.name}-${routePath.replaceAll('/', '-') || 'root'}.png`;
          await page.screenshot({ path: path.join(output, imageName) });
          evidence.push({ engine: engineName, app: app.name, route: routePath, directLoad: true, refresh: true });
          await page.close();
        }
        assert.ok(calls.length, `${app.name}: central API requested`);
        const response404 = await context.request.get(`${origin}/assets/missing-file.js`);
        assert.equal(response404.status(), 404);
        const hidden = await context.request.get(`${origin}/.env`);
        assert.equal(hidden.status(), 403);
        const api = await context.request.get(`${origin}/api/auth/me`);
        assert.equal(api.status(), 404);
        if (app.name === 'mobile') {
          const manifest = await context.request.get(`${origin}/manifest.webmanifest`);
          assert.equal(manifest.status(), 200);
          assert.equal((await manifest.json()).scope, './');
          const worker = await context.request.get(`${origin}/service-worker.js`);
          assert.equal(worker.status(), 200);
          assert.match(worker.headers()['content-type'], /javascript/);
        }
        await context.close();
        console.log(`PASS ${engineName} ${app.name}: root routing, direct entry, refresh, API and asset handling`);
      }
    } finally { await browser.close(); }
  }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(evidence, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
