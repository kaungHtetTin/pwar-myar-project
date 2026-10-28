const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated browser IndexedDB and intercepted API only. No real sales are sent.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../artifacts/offline-sales-reference');
const session = { user: { id: 101, role: 'owner', name: 'Fixture owner' }, business: { id: 101, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'shop'], subscription: { is_valid: true } };
const config = { enabled_modules: ['sell', 'products', 'sales', 'shop'], permissions: session.permissions, business: {} };
const settings = { currency: 'MMK', price_types: 'Retail', payment_methods: 'Cash', shop_name: 'Fixture shop' };
const products = [18500, 8500, 3500].map((price, i) => ({ id: i + 1, name: ['Rice', 'Oil', 'Tea'][i], price, stock: 50, prices: [{ name: 'Retail', price }] }));
(async () => {
  await fs.mkdir(output, { recursive: true });
  if (await fs.access(path.resolve(__dirname, '../docs/design/sell/005-sell-offline-sales-offline-queue-default.png')).then(() => true, () => false)) {
  execFileSync('python', ['-c', "from PIL import Image; Image.open('docs/design/sell/005-sell-offline-sales-offline-queue-default.png').resize((393,850)).crop((0,33,393,850)).save('artifacts/offline-sales-reference/reference-content.png')"], { cwd: path.resolve(__dirname, '..') });
  } else {
    await fs.access(path.join(output, 'reference-content.png'));
    console.log('Original reference unavailable; using the previously normalized comparison asset.');
  }
  const engine = process.env.SELL_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, timezoneId: 'Asia/Yangon', ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    const page = await context.newPage(), errors = [], calls = [];
    let rejectFirst = true;
    page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.slice(4);
      calls.push({ endpoint, method: req.method(), body: req.method() === 'POST' ? req.postDataJSON() : undefined });
      let body;
      if (endpoint === '/auth/me') body = session;
      else if (endpoint === '/app-config') body = config;
      else if (endpoint === '/settings') body = settings;
      else if (endpoint === '/categories') body = [];
      else if (endpoint === '/products') body = { items: products, total: products.length };
      else if (endpoint === '/sales/offline-sync') {
        if (rejectFirst) { rejectFirst = false; return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture stock conflict' }) }); }
        body = { id: 100 + calls.length, receipt_no: `S-${calls.length}` };
      }
      else if (endpoint === '/shop-admin/chat/config') body = { enabled: false };
      else body = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    await page.goto(`${origin}/sell`);
    await page.getByRole('button', { name: /Rice/ }).waitFor();
    await page.evaluate(async ({ session, config, products, settings }) => {
      const store = await import('/src/offline/offlineStore.js');
      await store.replaceOfflineCache({ session, appConfig: config, products, settings, categories: [] });
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('mkpos-mobile-offline', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const tx = db.transaction('offline_sales', 'readwrite');
      const date = new Date(); date.setHours(10, 24, 0, 0);
      for (let i = 0; i < 5; i++) {
        const id = 24 - i, items = i === 0 ? products.map((p, index) => ({ product_id: p.id, product_name: p.name, price_type: 'Retail', quantity: index ? 1 : 2, foc_quantity: 0, unit_price: p.price })) : [{ product_id: products[Math.min(i - 1, 2)].id, product_name: 'Fixture product', quantity: 1, unit_price: products[Math.min(i - 1, 2)].price }];
        tx.objectStore('offline_sales').put({ id, uuid: crypto.randomUUID(), business_id: session.business.id, user_id: session.user.id, status: i < 3 ? 'pending' : 'synced', local_total: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), created_at: new Date(date.getTime() - i * 6 * 60000).toISOString(), payload: { offline_sale_uuid: crypto.randomUUID(), offline_created_at: date.toISOString(), items, paid_amount: 49000, discount: 0, payment_type: 'cash', payment_method: 'Cash', customer_id: null }, receipt_no: i < 3 ? '' : `S-${id}`, error_message: '' });
      }
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close(); window.dispatchEvent(new Event('mkpos:mobile-offline-state'));
    }, { session, config, products, settings });
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await page.getByRole('link', { name: /Offline invoices/ }).click();
    await page.getByRole('heading', { name: 'Offline sales', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'You’re offline', exact: true }).waitFor();
    await page.getByText('OFF-000024', { exact: true }).waitFor();
    await page.mouse.move(0, 0);
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'offline-sales-393.png') });
    execFileSync('python', ['-c', "from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/offline-sales-reference/reference-content.png'),(0,0)); im.paste(Image.open('artifacts/offline-sales-reference/offline-sales-393.png'),(393,0)); im.save('artifacts/offline-sales-reference/comparison.png')"], { cwd: path.resolve(__dirname, '..') });
    assert.ok(await page.getByRole('button', { name: 'Sync now', exact: true }).isDisabled());
    assert.match(await page.locator('.offline-status-summary').innerText(), /3\s+Pending/);
    await page.getByRole('combobox', { name: 'Local sales order', exact: true }).focus();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'focused-393.png') });
    await page.getByRole('button', { name: 'View local receipt OFF-000024', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Local receipt', exact: true });
    await preview.waitFor();
    assert.match(await preview.locator('iframe').getAttribute('srcdoc'), /49,000/);
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'local-receipt-393.png') });
    await preview.getByRole('button', { name: 'Close Local receipt', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for OFF-000024', exact: true }).click();
    const actions = page.getByRole('dialog', { name: 'Sale actions', exact: true });
    await actions.getByRole('button', { name: 'Print receipt', exact: true }).waitFor();
    await actions.getByRole('button', { name: 'View local receipt', exact: true }).click();
    await preview.waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Local sales order', exact: true }).selectOption('oldest');
    await page.waitForFunction(() => document.querySelector('.offline-reference-number')?.textContent === 'OFF-000020');
    await page.getByRole('button', { name: 'Back to sell', exact: true }).click();
    await page.getByRole('heading', { name: 'Sell', exact: true }).waitFor();
    await page.goForward(); await page.getByRole('heading', { name: 'Offline sales', exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Local sales order', exact: true }).inputValue(), 'oldest');
    await page.getByRole('combobox', { name: 'Local sales order', exact: true }).selectOption('latest');
    await page.waitForFunction(() => document.querySelector('.offline-reference-number')?.textContent === 'OFF-000024');
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 817 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} overflow`);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `offline-sales-${width}.png`) });
    }
    await page.setViewportSize({ width: 393, height: 817 });
    assert.equal(calls.filter(call => call.method === 'POST').length, 0, 'Offline views must not submit');
    await context.setOffline(false);
    await page.getByRole('heading', { name: 'Connection available', exact: true }).waitFor();
    await page.getByText('Fixture stock conflict', { exact: true }).waitFor();
    await page.locator('.offline-reference-error').evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'conflict-393.png') });
    await page.getByRole('button', { name: 'Retry OFF-000022', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.offline-reference-error'));
    await page.waitForFunction(() => [...document.querySelectorAll('.offline-reference-badge')].every(el => el.textContent.includes('Completed')));
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'completed-393.png') });
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Main navigation', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Products', exact: true }).click();
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my');
    await page.keyboard.press('Escape');
    await page.goBack();
    await page.locator('.offline-reference-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Myanmar overflow');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-393.png') });
    assert.deepEqual(errors, []);
    assert.ok(calls.filter(c => c.method === 'POST').every(c => c.endpoint === '/sales/offline-sync'));
    const unavailable = await browser.newContext({viewport:{width:393,height:817}});
    await unavailable.route(`${origin}/api/**`,r=>r.abort('failed'));
    await unavailable.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}));
    const gate = await unavailable.newPage(); await gate.goto(`${origin}/sell`); await gate.locator('.sell-offline-unavailable').waitFor();
    await gate.screenshot({animations:'disabled',path:path.join(output,'unavailable-393.png')});
    for(const width of [320,768]) { await gate.setViewportSize({width,height:817}); assert.ok(await gate.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); await gate.screenshot({animations:'disabled',path:path.join(output,`unavailable-${width}.png`)}); }
    await gate.getByRole('button',{name:'Back to login',exact:true}).last().click(); await gate.waitForURL('**/login'); await gate.locator('.auth-reference-page').waitFor(); await unavailable.close();
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ browser: engine, errors, calls, result: 'Passed offline gating, real IndexedDB counts/sort, local receipt/menu, retained Back/Forward, responsive widths, reconnect auto-sync, conflict and retry.' }, null, 2));
    console.log('Offline sales reference and isolated sync checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
