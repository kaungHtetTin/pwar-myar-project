const { setDrawerLanguage } = require('./drawer-language.cjs');
// Local dev-server verification with isolated customer/account data; no live mutations.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/expenses-reference'), origin = 'http://127.0.0.1:5176';
const session = { user: { id: 201, role: 'owner', name: 'Fixture owner' }, business: { id: 201, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'expenses', 'sales', 'shop'], subscription: { is_valid: true } };
const rows = [{ id: 124, title: 'Delivery fuel', category: 'Transport', amount: 18000, expense_date: '2026-10-15', payment_method: 'Cash', note: 'Local deliveries.' }, { id: 125, title: 'Electricity bill', category: 'Utilities', amount: 45000, expense_date: '2026-10-14', payment_method: 'Bank transfer' }, { id: 126, title: 'Shop rent', category: 'Rent', amount: 120000, expense_date: '2026-10-01', payment_method: 'Cash' }];
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image; from pathlib import Path; [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(Path('artifacts/expenses-reference')/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/expenses').glob('*.png')]"], { cwd: root });
  const browser = await chromium.launch({ headless: true }); const calls = [], errors = [];
  const context = await browser.newContext({ viewport: { width: 393, height: 817 }, timezoneId: 'Asia/Yangon', isMobile: true, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  let failSave = false;
  await context.route(`${origin}/api/**`, async route => {
    const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4), method = req.method(); calls.push({ endpoint, method, query: url.search, body: req.postData() });
    let result = { items: [], total: 0 };
    if (endpoint === '/auth/me') result = session;
    else if (endpoint === '/app-config') result = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
    else if (endpoint === '/settings') result = { payment_methods: 'Cash, Bank transfer', currency: 'MMK', admin_pin_set: '0' };
    else if (endpoint === '/expenses/summary') result = { today_total: 28000, month_total: 185000, filter_total: 183000, matching_count: 3, top_category: { category: 'Rent' } };
    else if (endpoint === '/expenses' && method === 'GET') result = { items: rows, total: 3 };
    else if (endpoint.startsWith('/expenses/')) result = rows[0];
    else if (endpoint === '/expenses') result = { ...rows[0], ...req.postDataJSON() };
    if (failSave && ['POST','PUT'].includes(method)) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Unable to save. Try again.' }) });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  await context.route('**/sanctum/csrf-cookie', r => r.fulfill({ status: 204 }));
  async function capture(id) {
    await page.setViewportSize({ width: 393, height: 817 }); await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0,0); }); await page.evaluate(() => document.fonts.ready);
    await fs.writeFile(path.join(output, `computed-${id}.json`), JSON.stringify(await page.locator('main:visible').evaluate(n => ({ font: getComputedStyle(n).fontFamily, title: getComputedStyle(document.querySelector('.shared-app-bar h1') || n.querySelector('h1')).fontFamily })), null, 2)); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}.png`) });
    execFileSync('python', ['-c', `from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/expenses-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/expenses-reference/screen-${id}.png'),(393,0)); im.save('artifacts/expenses-reference/comparison-${id}.png')`], { cwd: root });
    for (const width of [320,768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: overflow at ${width}`); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}-${width}.png`) }); }
    await page.setViewportSize({ width: 393, height: 817 });
  }
  try {
    await page.goto(`${origin}/expenses`); await page.getByText('Delivery fuel', { exact: true }).waitFor(); await capture('040');
    await page.getByText('Spending details', { exact: true }).click(); assert.equal(await page.locator('main:visible details').getAttribute('open'), ''); await page.getByText('Spending details', { exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await capture('117'); await page.keyboard.press('Escape');
    const count = calls.filter(c => c.endpoint === '/expenses').length;
    await page.getByRole('button', { name: 'New expense', exact: true }).click(); await page.getByRole('heading', { name: 'New expense', exact: true }).waitFor();
    await page.locator('main:visible').getByLabel('Title', { exact: true }).fill('Delivery fuel'); await page.locator('main:visible').getByLabel('Category', { exact: true }).fill('Transport'); await page.locator('main:visible').getByLabel('Amount', { exact: true }).fill('18000'); await capture('041');
    await page.locator('main:visible').getByLabel('Amount', { exact: true }).fill('0'); await page.getByRole('button', { name: 'Save expense', exact: true }).click(); await page.getByText('Expense amount must be a whole number greater than zero.', { exact: true }).waitFor(); await capture('151');
    await page.locator('main:visible').getByLabel('Amount', { exact: true }).fill('18000'); failSave = true; await page.getByRole('button', { name: 'Save expense', exact: true }).click(); await page.getByText('Unable to save. Try again.', { exact: true }).waitFor(); assert.equal(await page.locator('main:visible').getByLabel('Title', { exact: true }).inputValue(), 'Delivery fuel'); failSave = false;
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('heading', { name: 'Expenses', exact: true }).waitFor(); assert.equal(calls.filter(c => c.endpoint === '/expenses').length, count + 1);
    await page.getByRole('button', { name: 'Actions for Delivery fuel', exact: true }).click(); await page.getByRole('button', { name: 'Edit Delivery fuel', exact: true }).click(); await page.getByRole('heading', { name: 'Edit expense', exact: true }).waitFor(); await capture('042');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByRole('heading', { name: 'Expenses', exact: true }).waitFor(); assert.ok(calls.some(c => c.endpoint === '/expenses/124' && c.method === 'PUT'));
    await page.getByRole('button', { name: 'Actions for Delivery fuel', exact: true }).click(); await page.getByRole('button', { name: 'Delete Delivery fuel', exact: true }).click(); await page.getByRole('dialog', { name: 'Delete expense?', exact: true }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.ok(!calls.some(c => c.method === 'DELETE'));
    await page.getByRole('button', { name: 'Filters', exact: true }).click(); await page.getByRole('radio', { name: 'Cash', exact: true }).check(); await Promise.all([page.waitForResponse(r => r.url().includes('/expenses?') && r.url().includes('payment_method=Cash')), page.getByRole('button', { name: /Apply filters/ }).click()]);
    await page.getByRole('button', { name: /Filters, 1 active/ }).click(); await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search expenses', exact: true }).fill('fuel'); await page.waitForResponse(r => r.url().includes('/expenses?') && r.url().includes('q=fuel')); await page.getByRole('button', { name: 'Clear expense search', exact: true }).click();
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-index.png') });
    await page.locator('main:visible .mobile-filter-toggle').click(); await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-drawer.png') }); assert.ok(await page.locator('dialog[open] .mobile-filter-drawer-body').evaluate(n => n.scrollWidth <= n.clientWidth + 1)); await page.keyboard.press('Escape');
    assert.deepEqual(errors, []); await fs.writeFile(path.join(output,'checks.json'), JSON.stringify({ result: 'Five references captured; responsive, validation, failed save retention, edit save, delete cancellation, filters and search passed.', calls, errors }, null, 2));
    console.log('Expense dev-server checks passed.');
  } catch (e) { await page.screenshot({ path: path.join(output,'failure.png') }); await fs.writeFile(path.join(output,'failure.txt'), await page.locator('body').innerText()); throw e; }
  finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
