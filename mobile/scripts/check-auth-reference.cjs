// Isolated dev-server authentication QA; no live credentials or account mutations.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176', output = path.resolve('artifacts/auth-reference');
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image; from pathlib import Path; p=Path('artifacts/auth-reference'); [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(p/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/authentication').glob('*.png')]" ]);
  const browser = await chromium.launch({ headless: true }); let page; const errors = [], calls = []; let fail = true, release;
  const session = { user: { id: 1, name: 'Fixture owner', role: 'owner' }, business: { id: 1, name: 'Fixture shop', currency: 'MMK' }, permissions: ['products'], subscription: { is_valid: true } };
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 } });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    const sessionGate = new Promise(resolve => { release = resolve; });
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.slice(4);
      if (endpoint === '/auth/me') { await sessionGate; return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Unauthenticated."}' }); }
      if (req.method() === 'POST') {
        const body = req.postDataJSON(); calls.push({ endpoint, body: Object.fromEntries(Object.entries(body).map(([key, value]) => [key, key.startsWith('password') ? '[REDACTED]' : value])) });
        return route.fulfill({ status: fail ? 422 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'Check your details.', errors: { email: ['Check your email address.'] } } : session) });
      }
      const result = ['/categories', '/price-types'].includes(endpoint) ? [] : endpoint === '/app-config' ? { enabled_modules: ['products'], permissions: ['products'], business: {} } : { items: [], total: 0 };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    const active = () => page.locator('[data-retained-view]:visible');
    async function capture(id) {
      await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(output, `screen-${id}.png`) });
      execFileSync('python', ['-c', `from PIL import Image; from pathlib import Path; p=Path('artifacts/auth-reference'); a=Image.open(p/'reference-${id}.png').convert('RGB'); b=Image.open(p/'screen-${id}.png').convert('RGB'); c=Image.new('RGB',(786,817),'white'); c.paste(a,(0,0)); c.paste(b,(393,0)); c.save(p/'comparison-${id}.png')`]);
      for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, `screen-${id}-${width}.png`) }); }
      await page.setViewportSize({ width: 393, height: 817 });
    }
    await page.goto(`${origin}/login`); await page.getByText('Checking your session...', { exact: true }).waitFor(); await capture('168'); release();
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await active().getByLabel('Email address', { exact: true }).fill('owner@example.com'); await active().getByLabel('Password', { exact: true }).fill('Fixture123!'); await page.getByRole('checkbox').check(); await active().getByLabel('Email address', { exact: true }).blur(); await capture('105');
    await active().getByLabel('Password', { exact: true }).focus(); await page.keyboard.press('Tab'); assert.equal(await page.getByRole('button', { name: 'Show password', exact: true }).evaluate(node => node.matches(':focus-visible')), true); await page.screenshot({ path: path.join(output, 'password-focus.png') }); await page.getByRole('button', { name: 'Show password', exact: true }).click(); assert.equal(await active().getByLabel('Password', { exact: true }).getAttribute('type'), 'text'); await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.getByRole('link', { name: 'Forgot password?', exact: true }).click(); await page.getByRole('heading', { name: 'Forgot password?', exact: true }).waitFor(); await page.getByRole('button', { name: 'Back to login', exact: true }).click(); assert.equal(await page.locator('[data-retained-view]:visible').getByLabel('Email address', { exact: true }).inputValue(), 'owner@example.com'); assert.equal(calls.length, 0);
    await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.getByText('Check your email address.', { exact: true }).waitFor(); assert.equal(await active().getByLabel('Email address', { exact: true }).inputValue(), 'owner@example.com');
    await page.getByRole('link', { name: 'Create account', exact: true }).click();
    await active().getByLabel('Business name', { exact: true }).fill('Evergreen Market'); await active().getByLabel('Owner name', { exact: true }).fill('Olivia Martin'); await active().getByLabel('Email address', { exact: true }).fill('olivia@example.com'); await active().getByLabel('Password', { exact: true }).fill('Fixture123!'); await active().getByLabel('Confirm password', { exact: true }).fill('Fixture123!'); await active().getByLabel('Email address', { exact: true }).blur(); await capture('106');
    await active().getByRole('button', { name: 'Show confirm password', exact: true }).click(); assert.equal(await active().getByLabel('Confirm password', { exact: true }).getAttribute('type'), 'text'); await active().getByRole('button', { name: 'Hide confirm password', exact: true }).click();
    const reads = calls.length; await page.getByRole('button', { name: 'Back to login', exact: true }).click(); assert.equal(await active().getByLabel('Email address', { exact: true }).inputValue(), 'owner@example.com'); assert.equal(calls.length, reads);
    await page.goForward(); assert.equal(await active().getByLabel('Business name', { exact: true }).inputValue(), 'Evergreen Market');
    await active().getByLabel('Confirm password', { exact: true }).fill('mismatch'); await active().getByRole('button', { name: 'Create account', exact: true }).click(); await page.getByText('The passwords do not match.', { exact: true }).waitFor(); assert.equal(calls.length, reads);
    await active().getByLabel('Confirm password', { exact: true }).fill('Fixture123!'); await active().getByRole('button', { name: 'Create account', exact: true }).click(); await active().getByText('Check your email address.', { exact: true }).waitFor(); assert.equal(await active().getByLabel('Business name', { exact: true }).inputValue(), 'Evergreen Market');
    await active().getByRole('link', { name: 'Login', exact: true }).click(); await page.getByRole('button', { name: 'Back to create account', exact: true }).click(); assert.equal(await active().getByLabel('Business name', { exact: true }).inputValue(), 'Evergreen Market'); await page.getByRole('button', { name: 'Back to login', exact: true }).click(); fail = false; await active().getByRole('button', { name: 'Login', exact: true }).click(); await page.getByRole('heading', { name: 'Products', exact: true }).waitFor();
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'my'));
    const myanmar = await context.newPage(); await myanmar.goto(`${origin}/signup`); await myanmar.locator('.auth-reference-signup').waitFor(); await myanmar.evaluate(() => document.fonts.ready); assert.ok(await myanmar.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await myanmar.screenshot({ path: path.join(output, 'myanmar-signup.png'), fullPage: true }); await myanmar.close();
    assert.equal(calls.filter(c => c.endpoint === '/auth/login').length, 2); assert.equal(calls.filter(c => c.endpoint === '/auth/register').length, 1); assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ result: 'Three reference layouts, responsive overflow, remember, password toggles, API failure retention, Back/Forward drafts, mismatch validation and login handoff passed.', errors, calls }, null, 2)); console.log('Authentication dev-server checks passed.');
  } catch (error) { if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, text: await page.locator('body').innerText() }, null, 2)); } throw error; }
  finally { release?.(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
