const { setDrawerLanguage } = require('./drawer-language.cjs');
// Browser fixtures only: never reads device GPS or mutates live shop branding/location.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:5176', engine = process.env.IDENTITY_BROWSER || 'chromium';
(async () => {
  const output = path.resolve('artifacts/shop-identity-reference'); await fs.mkdir(output, { recursive: true });
  const logo = await fs.readFile('public/branding/pwarmyar-icon.png');
  const browser = await (engine === 'firefox' ? firefox : chromium).launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, hasTouch: true });
    await context.addInitScript(() => {
      localStorage.setItem('mkpos.language', 'en'); window.__geoMode = 'denied'; window.__logoEvents = [];
      window.addEventListener('mkpos:shop-logo-updated', event => window.__logoEvents.push(event.detail));
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(ok, fail) {
        const mode = window.__geoMode;
        setTimeout(() => mode === 'success' ? ok({ coords: { latitude: 17.123, longitude: 97.456, accuracy: 12 } }) : fail({ code: mode === 'denied' ? 1 : mode === 'timeout' ? 3 : 2 }), 30);
      } } });
    });
    let location = { submitted: true, location: { latitude: 16.8409, longitude: 96.1735, accuracy: 10, captured_at: '2026-10-15T02:54:00Z' } };
    let currentLogo = 'data:image/png;base64,' + logo.toString('base64'), failLocation = true, failUpload = true, failDelete = true;
    const session = { user: { id: 301, role: 'owner', name: 'Owner' }, business: { id: 301, name: 'Demo Shop', timezone: 'Asia/Rangoon' }, permissions: ['shop', 'sell', 'products', 'sales', 'ecommerce_settings', 'ecommerce_orders'], subscription: { is_valid: true } };
    const calls = [], errors = [];
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await context.route(`${origin}/api/**`, async route => {
      const request = route.request(), endpoint = new URL(request.url()).pathname.slice(4), method = request.method(); calls.push({ endpoint, method }); let data = { items: [], total: 0 };
      if (endpoint === '/auth/me') data = session;
      else if (endpoint === '/app-config') data = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') data = { currency: 'MMK', language: 'en' };
      else if (endpoint === '/shop-admin/settings') data = { receipt_logo_data_url: currentLogo };
      else if (endpoint === '/shop-admin/owner-location') {
        if (method === 'POST') {
          assert.deepEqual(request.postDataJSON(), { latitude: 17.123, longitude: 97.456, accuracy: 12 });
          if (failLocation) { failLocation = false; return route.fulfill({ status: 503, json: { message: 'Location could not be saved. Retry.' } }); }
          location = { submitted: true, location: { ...request.postDataJSON(), captured_at: '2026-10-16T05:00:00Z' } };
        }
        data = location;
      } else if (endpoint === '/settings/logo') {
        if (method === 'POST') {
          assert.ok(request.headers()['content-type'].includes('multipart/form-data'));
          if (failUpload) { failUpload = false; return route.fulfill({ status: 422, json: { message: 'Please review logo.', errors: { logo: ['Logo could not be uploaded. Retry.'] } } }); }
          currentLogo = 'data:image/png;base64,' + logo.toString('base64');
        } else if (method === 'DELETE') {
          if (failDelete) { failDelete = false; return route.fulfill({ status: 503, json: { message: 'Logo could not be removed. Retry.' } }); }
          currentLogo = '';
        }
        data = { receipt_logo_data_url: currentLogo };
      }
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const count = (endpoint, method) => calls.filter(call => call.endpoint === endpoint && call.method === method).length;
    async function shot(name) { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' }); }
    async function responsive(name) { await shot(name); for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${width} overflow`); await shot(`${name}-${width}`); } await page.setViewportSize({ width: 393, height: 817 }); }
    await page.goto(`${origin}/shop`); const source = page.locator('.shop-overview-page'); await source.waitFor(); await source.evaluate(node => node.dataset.retention = 'kept');
    await page.getByRole('button', { name: /^Shop location/ }).click(); await page.getByText('16.8409, 96.1735', { exact: true }).waitFor(); await responsive('072');
    for (const title of ['Location permission denied', 'Location unavailable', 'Location request timed out', 'Insecure environment']) {
      const row = page.locator('.shop-location-help details').filter({ has: page.getByText(title, { exact: true }) }); await row.locator('summary').click(); assert.equal(await row.getAttribute('open'), ''); await row.locator('summary').click();
    }
    await page.locator('.shop-location-help summary').first().press('Enter'); await shot('help-focus'); await page.locator('.shop-location-help summary').first().press('Enter');
    await page.locator('.shop-location-help').evaluate(node => node.scrollIntoView({ block: 'end', behavior: 'instant' })); await shot('help');
    await page.getByRole('button', { name: 'Update location', exact: true }).click(); await page.getByRole('heading', { name: 'Location access denied' }).waitFor(); await responsive('154'); assert.equal(count('/shop-admin/owner-location', 'POST'), 0);
    await page.evaluate(() => window.__geoMode = 'timeout'); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Location timed out' }).waitFor(); await shot('timeout');
    await page.evaluate(() => window.__geoMode = 'unavailable'); await page.getByRole('button', { name: 'Update location', exact: true }).click(); await page.getByRole('alert').filter({hasText:'Enable device location'}).waitFor();
    await page.evaluate(() => window.__geoMode = 'success'); await page.getByRole('button', { name: 'Update location', exact: true }).click(); await page.getByText('Location could not be saved. Retry.', { exact: true }).waitFor(); assert.equal(await page.getByText('16.8409, 96.1735', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Update location', exact: true }).click(); await page.getByText('17.1230, 97.4560', { exact: true }).waitFor(); await page.getByRole('status').waitFor(); await shot('location-saved');
    const beforeBack = calls.length; await page.getByRole('button', { name: 'Back', exact: true }).click(); await source.waitFor(); assert.equal(await source.getAttribute('data-retention'), 'kept'); assert.equal(calls.length, beforeBack, 'Location Back keeps source without fetch');
    await page.getByRole('button', { name: /^Business logo/ }).click(); await page.getByAltText('Current business logo').waitFor(); await responsive('104'); await page.locator('.shop-logo-image-actions').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'})); const logoActions=await page.locator('.shop-logo-image-actions').boundingBox(), saveBar=await page.locator('.shop-logo-save-bar').boundingBox(); assert.ok(logoActions.y+logoActions.height<=saveBar.y+1,'Logo controls scroll above fixed Save'); await page.locator('.shop-logo-form').evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'})); assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Replace logo', exact: true }).press('Enter'); await (await chooser).setFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: logo }); await page.getByAltText('Selected business logo preview').waitFor();
    const input = page.getByLabel('Business logo file', { exact: true }); await input.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') }); await page.getByRole('alert').waitFor(); assert.equal(await page.getByText('replacement.png', { exact: true }).count(), 1);
    await input.setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(512 * 1024 + 1) }); await page.getByText('Choose a PNG, JPG or WebP up to 512 KB.', { exact: true }).waitFor();
    const beforeCancel = count('/shop-admin/settings', 'GET'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await source.waitFor(); assert.equal(count('/settings/logo', 'POST'), 0); await page.goForward(); await page.getByAltText('Selected business logo preview').waitFor(); assert.equal(count('/shop-admin/settings', 'GET'), beforeCancel, 'Forward restores selected file without fetch');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('Logo could not be uploaded. Retry.', { exact: true }).waitFor(); assert.equal(await page.getByText('replacement.png', { exact: true }).count(), 1); await shot('logo-upload-error');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForURL('**/shop'); assert.equal(await page.evaluate(() => window.__logoEvents.length), 1);
    await page.getByRole('button', { name: /^Business logo/ }).click(); await page.getByRole('button', { name: 'Remove logo', exact: true }).click(); const dialog = page.getByRole('dialog', { name: 'Remove business logo?', exact: true }); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(count('/settings/logo', 'DELETE'), 0);
    await page.getByRole('button', { name: 'Remove logo', exact: true }).click(); await dialog.getByRole('button', { name: 'Remove logo', exact: true }).click(); await page.getByText('Logo will be removed', { exact: true }).waitFor(); assert.equal(count('/settings/logo', 'DELETE'), 0); await shot('logo-staged-removal');
    await page.getByRole('button', { name: 'Undo removal', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Remove logo', exact: true }).click(); await dialog.getByRole('button', { name: 'Remove logo', exact: true }).click(); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByText('Logo could not be removed. Retry.', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.waitForURL('**/shop');
    await page.getByRole('button', { name: /^Business logo/ }).click(); await page.getByText('No business logo yet', { exact: true }).waitFor(); await shot('logo-empty');
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); await page.waitForFunction(() => document.documentElement.lang === 'my'); await shot('logo-myanmar');
    session.user.role = 'staff'; await page.goto(`${origin}/shop/logo`); await page.getByRole('alert').filter({hasText:'Only the owner'}).waitFor(); assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).count(), 0);
    location = {submitted:false,location:null}; await page.goto(`${origin}/shop/orders`); await page.getByText('Ask the business owner to submit the shop location.', {exact:true}).waitFor(); assert.equal(await page.getByRole('heading',{name:'Online orders',exact:true}).count(),0);
    session.user.role='owner'; await page.goto(`${origin}/shop`); await page.getByRole('button',{name:'Allow location and save',exact:true}).waitFor(); await page.evaluate(()=>window.__geoMode='success'); await page.getByRole('button',{name:'Allow location and save',exact:true}).click(); await page.getByRole('heading',{name:'My Shop',exact:true}).waitFor();
    assert.deepEqual(errors, []); await fs.writeFile(path.join(output, `verification-${engine}.json`), JSON.stringify({ widths:[320,393,768],checks:['072 and 154 location states','Real coordinate payload','Denied/timeout/API retries','Help disclosures','104 logo layout','Native file picker and validation','Staged removal/Undo','Upload/delete retry','Shared logo event','Retained source/draft','Owner and required-location gates'],errors },null,2));
    console.log(`Shop location/logo ${engine}: reference and interaction checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
