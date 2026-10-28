const { setDrawerLanguage } = require('./drawer-language.cjs');
// Isolated billing QA: synthetic account, intercepted transfers; never submits real payment proof.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176', output = path.resolve('artifacts/billing-reference');
const paymentError = 'Please check the transfer amount, recipient account, payment provider, payment date and transaction ID in your screenshot. Upload the correct, clearly readable payment proof.';
(async () => {
  await fs.mkdir(output, { recursive: true });
  execFileSync('python', ['-c', "from PIL import Image,ImageDraw; from pathlib import Path; p=Path('artifacts/billing-reference'); [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(p/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/billing').glob('*.png')]; im=Image.new('RGB',(240,180),'#e9f5ef'); ImageDraw.Draw(im).text((30,70),'QA proof sample',fill='#145441'); im.save(p/'proof.png')"]);
  const plans = [{ id: 1, name: 'Standard - 1 Month', duration_days: 30, price: 30000, currency: 'MMK', description: 'All core features' }, { id: 2, name: 'Standard - 6 Months', duration_days: 180, price: 162000, currency: 'MMK', description: 'All core features' }, { id: 3, name: 'Standard - 1 Year', duration_days: 365, price: 300000, currency: 'MMK', description: 'All core features' }];
  const methods = [{ id: 1, bank: 'AYA Bank', account_no: '0123 4567 8901', account_name: 'PwarMyar Co., Ltd.' }, { id: 2, bank: 'Demo Bank', account_no: '9876 5432', account_name: 'PwarMyar Co., Ltd.' }];
  let status = { is_valid: true, access_type: 'paid', days_remaining: 30, subscription: { subscription_plan_id: 1, plan_name: 'Standard', plan_description: 'Access all core features for your business.', ends_at: '2026-11-15T00:00:00Z' }, pending_request: null };
  const session = { user: { id: 1, role: 'owner', name: 'Fixture Owner' }, business: { id: 1, name: 'Fixture shop' }, permissions: ['billing', 'sell', 'products', 'sales', 'shop'], subscription: status };
  const browser = await chromium.launch({ headless: true }); let page; const calls = [], errors = []; let fail = true;
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.slice(4); calls.push({ endpoint, method: req.method() });
      if (req.method() === 'POST' && endpoint === '/subscription/requests') {
        const body = req.postDataBuffer().toString(); assert.ok(body.includes('name="subscription_plan_id"')); assert.ok(body.includes('name="payment_method_id"')); assert.ok(body.includes('name="payment_screenshot"')); assert.ok(body.includes('Transfer reference: TXN1234567890')); assert.ok(body.includes('Bank transfer note'));
        if (fail) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: paymentError, errors: { payment_screenshot: [paymentError] } }) });
        status = { ...status, pending_request: { id: 7, subscription_plan_id: 1, plan_name: plans[0].name, price: 30000, currency: 'MMK', created_at: '2026-10-15T09:24:00', payment_bank: methods[0].bank, payment_account_no: methods[0].account_no, payment_account_name: methods[0].account_name, message: 'Transfer reference: TXN1234567890\nBank transfer note', payment_screenshot_uploaded: true } };
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ request_id: 7, subscription: status }) });
      }
      let result;
      if (endpoint === '/auth/me') result = session;
      else if (endpoint === '/app-config') result = { enabled_modules: session.permissions, permissions: session.permissions, business: {} };
      else if (endpoint === '/subscription') result = status;
      else if (endpoint === '/subscription/plans') result = { items: plans };
      else if (endpoint === '/subscription/payment-methods') result = { items: methods.slice(0, 1) };
      else if (endpoint === '/subscription/billing-history') result = { items: [{ id: 1, plan_name: 'Standard', amount: 300000, currency: 'MMK', paid_at: '2026-10-15', type: 'renewal', duration_days: 365 }], total: 1 };
      else if (['/categories', '/price-types'].includes(endpoint)) result = [];
      else result = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); const active = () => page.locator('main:visible');
    async function capture(id) {
      await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(output, `screen-${id}.png`) });
      execFileSync('python', ['-c', `from PIL import Image; from pathlib import Path; p=Path('artifacts/billing-reference'); a=Image.open(p/'reference-${id}.png').convert('RGB'); b=Image.open(p/'screen-${id}.png').convert('RGB'); c=Image.new('RGB',(786,817),'white'); c.paste(a,(0,0)); c.paste(b,(393,0)); c.save(p/'comparison-${id}.png')`]);
      for (const width of [320, 768]) { await page.setViewportSize({ width, height: 817 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, `screen-${id}-${width}.png`) }); }
      await page.setViewportSize({ width: 393, height: 817 });
    }
    await page.goto(`${origin}/billing`); await page.getByRole('button', { name: 'Request payment', exact: true }).waitFor();
    await page.getByRole('radio', { name: plans[2].name, exact: true }).check(); await page.getByRole('radio', { name: plans[0].name, exact: true }).check();
    await page.getByRole('button', { name: 'Copy bank name', exact: true }).click(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'AYA Bank'); await page.getByRole('button', { name: 'Dismiss message', exact: true }).click(); await page.evaluate(() => scrollTo(0,0)); await capture('047');
    for (const [label, value] of [['account number', methods[0].account_no], ['account name', methods[0].account_name]]) { await page.getByRole('button', { name: `Copy ${label}`, exact: true }).click(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), value); await page.getByRole('button', { name: 'Dismiss message', exact: true }).click(); }
    await page.getByRole('button', { name: 'Copy bank name', exact: true }).focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); assert.equal(await page.getByRole('button', { name: 'Copy bank name', exact: true }).evaluate(node => node.matches(':focus-visible')), true); await page.screenshot({ path: path.join(output, 'account-focus.png') });
    const extra = await context.newPage(); await extra.route(`${origin}/api/subscription/payment-methods`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [...methods, { id: 3, bank: 'WavePay', account_no: '09123456789', account_name: 'PwarMyar' }] }) })); await extra.goto(`${origin}/billing/request/2`); await extra.getByRole('radio', { name: `${methods[1].bank} ${methods[1].account_no}`, exact: true }).check(); await extra.locator('.billing-account-details').getByText(methods[1].account_no, { exact: true }).waitFor();
    for (const width of [393, 320]) {
      await extra.setViewportSize({ width, height: 852 }); assert.ok(await extra.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const options = await extra.locator('.billing-account-option').evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height })));
      assert.equal(options[0].top, options[1].top); assert.ok(options.every(option => option.height >= 44));
      if (width === 320) assert.ok(options[2].top > options[0].top);
      assert.equal(await extra.locator('.billing-account-option small').count(), 0);
      await extra.screenshot({ path: path.join(output, `account-radio-${width}.png`), fullPage: true });
    }
    await extra.close();
    await page.getByRole('button', { name: /^Latest payment/ }).click(); await page.getByRole('dialog', { name: 'Billing history', exact: true }).waitFor(); await page.screenshot({ path: path.join(output, 'history-sheet.png') }); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Need help/ }).click(); await page.getByRole('region', { name: 'Billing support contacts' }).waitFor(); await page.screenshot({ path: path.join(output, 'support-sheet.png') }); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Request payment', exact: true }).click(); await page.getByRole('button', { name: 'Submit request', exact: true }).click(); await page.getByText('Attach your payment screenshot.', { exact: true }).waitFor(); assert.equal(calls.filter(c => c.method === 'POST').length, 0);
    await active().getByLabel('Payment screenshot', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') }); await page.getByText('Use a JPG, PNG or WebP image up to 5 MB.', { exact: true }).waitFor();
    await active().getByLabel('Payment screenshot', { exact: true }).setInputFiles(path.join(output, 'proof.png')); await page.getByRole('button', { name: 'Remove payment proof', exact: true }).click(); await page.getByRole('img', { name: 'Payment proof preview', exact: true }).waitFor({ state: 'detached' }); await active().getByLabel('Payment screenshot', { exact: true }).setInputFiles(path.join(output, 'proof.png'));
    await active().getByLabel('Transfer reference', { exact: true }).fill('TXN1234567890'); await active().getByLabel('Message to office (optional)', { exact: true }).fill('Bank transfer note'); await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0,0); }); await capture('048'); await fs.writeFile(path.join(output, 'layout.json'), JSON.stringify(await page.locator('.billing-reference-form .billing-notes-group *').evaluateAll(nodes => nodes.map(n => ({ tag:n.tagName, cls:n.className, y:n.getBoundingClientRect().y, h:n.getBoundingClientRect().height, margin:getComputedStyle(n).marginTop })).filter(n => ['SECTION','H2','TEXTAREA','INPUT','SMALL'].includes(n.tag) || String(n.cls).includes('instructions') || String(n.cls).includes('section-body'))), null, 2));
    const reads = calls.length; await page.getByRole('button', { name: 'Back to billing', exact: true }).click(); assert.equal(await page.getByRole('radio', { name: plans[0].name, exact: true }).isChecked(), true); assert.equal(calls.length, reads); await page.goForward(); assert.equal(await active().getByLabel('Transfer reference', { exact: true }).inputValue(), 'TXN1234567890'); await page.getByRole('img', { name: 'Payment proof preview', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Submit request', exact: true }).click(); await page.getByText(paymentError, { exact: true }).waitFor(); assert.equal(await active().getByLabel('Message to office (optional)', { exact: true }).inputValue(), 'Bank transfer note');
    for (const width of [393, 320, 768]) {
      await page.setViewportSize({ width, height: 852 });
      await page.evaluate(() => scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const account = await page.locator('main:visible .billing-account-details').boundingBox();
      for (const button of await page.locator('main:visible .billing-account-details button').all()) {
        const box = await button.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44); assert.ok(box.x + box.width <= account.x + account.width);
      }
      await page.screenshot({ path: path.join(output, `request-spacing-${width}.png`), fullPage: true });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const cancel = await page.getByRole('button', { name: 'Cancel', exact: true }).boundingBox();
      const submit = await page.getByRole('button', { name: 'Submit request', exact: true }).boundingBox();
      assert.ok(cancel.y + cancel.height <= submit.y);
      await page.screenshot({ path: path.join(output, `request-spacing-end-${width}.png`) });
    }
    await page.setViewportSize({ width: 393, height: 817 }); fail = false;
    await page.getByRole('button', { name: 'Submit request', exact: true }).click(); await page.getByRole('heading', { name: 'Payment request pending', exact: true }).waitFor(); await page.evaluate(() => scrollTo(0,0)); await capture('149'); assert.equal(await page.getByRole('button', { name: 'Remove payment proof', exact: true }).count(), 0); assert.equal(await active().getByText('Active', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'View billing', exact: true }).click(); await page.getByRole('button', { name: 'View pending request', exact: true }).waitFor(); await page.getByRole('button', { name: 'View pending request', exact: true }).click(); await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByRole('button', { name: 'View pending request', exact: true }).waitFor();
    await page.goto(`${origin}/billing/request/1`); await page.getByRole('heading', { name: 'Payment request pending', exact: true }).waitFor(); await page.getByText('Payment proof received.', { exact: true }).waitFor(); await page.screenshot({ path: path.join(output, 'pending-reloaded.png') });
    await page.getByRole('button', { name: 'Back to billing', exact: true }).click(); await page.getByRole('button', { name: 'Open app menu', exact: true }).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, 'myanmar-overview.png') });
    const spacing = await context.newPage(); await spacing.addInitScript(() => localStorage.setItem('mkpos.language', 'en'));
    await spacing.route(`${origin}/api/subscription/plans`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: plans.slice(0, 1) }) }));
    await spacing.route(`${origin}/api/subscription/payment-methods`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: methods }) }));
    await spacing.setViewportSize({ width: 393, height: 852 }); await spacing.goto(`${origin}/billing`); await spacing.getByRole('button', { name: 'View pending request', exact: true }).waitFor(); await spacing.evaluate(() => document.fonts.ready); await spacing.screenshot({ path: path.join(output, 'overview-spacing-393.png'), fullPage: true });
    await spacing.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); assert.ok(await spacing.getByRole('button', { name: /^Need help/ }).evaluate(node => node.getBoundingClientRect().bottom <= innerHeight - 60)); await spacing.screenshot({ path: path.join(output, 'overview-spacing-end-393.png') });
    await spacing.setViewportSize({ width: 320, height: 852 }); await spacing.evaluate(() => scrollTo(0,0)); assert.ok(await spacing.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await spacing.screenshot({ path: path.join(output, 'overview-spacing-320.png'), fullPage: true }); await spacing.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); assert.ok(await spacing.getByRole('button', { name: /^Need help/ }).evaluate(node => node.getBoundingClientRect().bottom <= innerHeight - 60)); await spacing.screenshot({ path: path.join(output, 'overview-spacing-end-320.png') }); await spacing.close();
    assert.equal(calls.filter(c => c.method === 'POST').length, 2); assert.deepEqual(errors, []); await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ result: 'Three billing references, responsive overflow, account copy, plan selection, support/history sheets, proof validation/remove, multipart payload, failed retry, retained Back/Forward draft and pending no-resubmit/reload passed.', errors, calls }, null, 2)); console.log('Billing dev-server checks passed.');
  } catch (error) { if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }); await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, text: await page.locator('body').innerText() }, null, 2)); } throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
