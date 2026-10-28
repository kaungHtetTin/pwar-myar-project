// Local dev-server verification with isolated customer/account data; no live mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
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
  const browser = await (process.env.DRAWER_BROWSER === 'firefox' ? firefox : chromium).launch({ headless: true }); const calls = [], errors = [];
  const context = await browser.newContext({ viewport: { width: 393, height: 817 }, timezoneId: 'Asia/Yangon', hasTouch: true });
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
    await fs.writeFile(path.join(output, `computed-${id}.json`), JSON.stringify(await page.locator('main:visible').evaluate(n => ({ font: getComputedStyle(n).fontFamily, title: getComputedStyle(n.querySelector('h1')).fontFamily })), null, 2)); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}.png`) });
    execFileSync('python', ['-c', `from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/expenses-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/expenses-reference/screen-${id}.png'),(393,0)); im.save('artifacts/expenses-reference/comparison-${id}.png')`], { cwd: root });
    for (const width of [320,768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: overflow at ${width}`); await page.screenshot({ animations: 'disabled', path: path.join(output, `screen-${id}-${width}.png`) }); }
    await page.setViewportSize({ width: 393, height: 817 });
  }
  try {
    await page.goto(`${origin}/expenses`); await page.getByText('Delivery fuel', { exact: true }).waitFor();
    const toggle = page.getByRole('button', { name: 'Filters', exact: true });
    await toggle.click(); const drawer = page.locator('dialog[open] .mobile-filter-drawer');
    await drawer.waitFor();
    const frames = await page.evaluate(async () => {
      const frames = [];
      for (let i = 0; i < 20; i++) {
        await new Promise(requestAnimationFrame);
        const layer = document.querySelector('dialog[open]'), panel = layer.querySelector('.mobile-filter-drawer');
        frames.push({ scrollLeft: layer.scrollLeft, x: panel.getBoundingClientRect().x, transform: getComputedStyle(panel).transform });
      }
      return frames;
    });
    assert.ok(frames.every(frame => frame.scrollLeft === 0), 'Overlay must not scroll horizontally and cancel the drawer animation');
    await fs.writeFile(path.join(output, `animation-frames-${process.env.DRAWER_BROWSER || 'chromium'}.json`), JSON.stringify(frames,null,2));
    await drawer.evaluate(n => Promise.all(n.getAnimations().map(a => a.finished)));
    await page.screenshot({ path: path.join(output, 'animation-open.png') });
    await page.getByRole('button', { name: 'Close filters', exact: true }).click();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.screenshot({ path: path.join(output, 'animation-closed.png') });
    await page.locator('dialog[open]').waitFor({ state: 'detached' }); assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.ok(await toggle.evaluate(n => n === document.activeElement));
    await toggle.click(); await page.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'detached' });
    await page.emulateMedia({ reducedMotion: 'reduce' }); await toggle.click(); await page.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'detached' });
    assert.deepEqual(errors, []); console.log('Drawer open/close, focus restoration, Escape and reduced-motion checks passed.');
  } catch (e) { await page.screenshot({ path: path.join(output,'failure.png') }); await fs.writeFile(path.join(output,'failure.txt'), await page.locator('body').innerText()); throw e; }
  finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
