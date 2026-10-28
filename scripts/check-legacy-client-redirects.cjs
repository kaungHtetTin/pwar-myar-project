// Proxy only local builds into the production URL names; never call live apps.
const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

function legacyRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: 8187, path: urlPath, headers: { Host: 'www.pwarmyar.com' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
  });
}

(async () => {
  const output = path.resolve(__dirname, '../artifacts/legacy-client-redirects');
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const request = await browser.newContext({ serviceWorkers: 'block' });
      for (const app of ['app', 'mobile', 'office']) {
        for (const suffix of ['', '/', '/login?source=old&value=a%2Bb', '/sales/90/edit?source=history', '/customers/Alice%20Shop']) {
          let response = await legacyRequest(`/public/${app}${suffix}`);
          if (response.status === 301) {
            const slashUrl = new URL(response.headers.location);
            assert.equal(slashUrl.hostname, 'www.pwarmyar.com');
            response = await legacyRequest(slashUrl.pathname + slashUrl.search);
          }
          assert.equal(response.status, 302, `${app}${suffix}`);
          const expectedPath = suffix === '' ? '/' : suffix;
          assert.equal(response.headers.location, `https://${app}.pwarmyar.com${expectedPath}`);
          results.push({ engine: name, app, oldPath: `/public/${app}${suffix}`, target: response.headers.location });
        }
        const context = await browser.newContext({ viewport: app === 'mobile' ? { width: 393, height: 852 } : { width: 1366, height: 900 }, serviceWorkers: 'block' });
        const port = { app: 8184, office: 8185, mobile: 8186 }[app];
        await context.route(/^https:\/\/www\.pwarmyar\.com\/public\/(?:app|mobile|office)(?:\/|\?|$)/, async route => {
          const url = new URL(route.request().url());
          const response = await legacyRequest(url.pathname + url.search);
          if (response.headers.location) response.headers.location = response.headers.location.replace('http://www.pwarmyar.com:8187/', 'https://www.pwarmyar.com/');
          await route.fulfill(response);
        });
        await context.route(`https://${app}.pwarmyar.com/**`, async route => {
          const url = new URL(route.request().url());
          const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
          await route.fulfill({ response });
        });
        await context.route('https://www.pwarmyar.com/public/api/**', route => route.fulfill({ status: 401, json: { message: 'Unauthenticated.' } }));
        const page = await context.newPage();
        const errors = [];
        const network = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') network.push(message.text()); });
        page.on('requestfailed', failure => network.push({ url: failure.url(), reason: failure.failure() }));
        // Check the redirect separately, then open its target as a new intercepted
        // navigation: Playwright does not reroute a redirected document request.
        const entryRedirect = await legacyRequest(`/public/${app}/?source=bookmark`);
        assert.equal(entryRedirect.status, 302);
        await page.goto(entryRedirect.headers.location);
        try { await page.locator('input[type="password"]').first().waitFor(); }
        catch (error) { console.log({ app, url: page.url(), errors, network, html: (await page.content()).slice(0, 1800) }); throw error; }
        assert.equal(new URL(page.url()).hostname, `${app}.pwarmyar.com`);
        await page.reload();
        await page.locator('input[type="password"]').first().waitFor();
        if (app === 'app') {
          const hashRedirect = await legacyRequest('/public/app/');
          await page.goto(hashRedirect.headers.location + '#/signup');
          await page.locator('input[autocomplete="new-password"]').first().waitFor();
          assert.equal(new URL(page.url()).hostname, 'pos.pwarmyar.com');
        }
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `${name}-${app}.png`) });
        await context.close();
        console.log(`PASS ${name} ${app}: five redirect cases, actual app entry, refresh${app === 'app' ? ', legacy signup fragment' : ''}`);
      }
      await request.close();
    } finally { await browser.close(); }
  }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
