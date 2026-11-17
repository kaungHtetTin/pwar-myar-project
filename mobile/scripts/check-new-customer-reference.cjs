const { setDrawerLanguage } = require('./drawer-language.cjs');
// Synthetic API only. Creates fixture customers; never writes to a real business.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = 'http://127.0.0.1:5176';
const output = path.resolve(__dirname, '../artifacts/new-customer-reference');
const session = { user: { id: 101, role: 'owner' }, business: { id: 101, name: 'Fixture Shop', currency: 'MMK' }, permissions: ['sell', 'products', 'sales', 'shop'], subscription: { is_valid: true } };
const settings = { currency: 'MMK', price_types: 'Retail', payment_methods: 'Cash,Bank transfer' };
const products = [18500, 8500, 3500].map((price, i) => ({ id: i + 1, name: ['Rice', 'Oil', 'Tea'][i], price, stock: 50 }));
const draft = { cart: products.map((p, i) => ({ product_id: p.id, product_name: p.name, unit_price: p.price, price_type: 'Retail', quantity: i ? 1 : 2, foc_quantity: 0, stock: 50 })), discount: 0, paidAmount: '30000', paymentMethod: 'Bank transfer', customer: null };
(async () => {
  await fs.mkdir(output, { recursive: true });
  if (await fs.access(path.resolve(__dirname, '../docs/design/sell/004-sell-customer-new-new-checkout-customer-default.png')).then(() => true, () => false)) {
  execFileSync('python', ['-c', "from PIL import Image; Image.open('docs/design/sell/004-sell-customer-new-new-checkout-customer-default.png').resize((393,850)).crop((0,33,393,850)).save('artifacts/new-customer-reference/reference-content.png')"], { cwd: path.resolve(__dirname, '..') });
  } else {
    await fs.access(path.join(output, 'reference-content.png'));
    console.log('Original reference unavailable; using the previously normalized comparison asset.');
  }
  const engine = process.env.SELL_BROWSER || 'chromium';
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 817 }, ...(engine === 'firefox' ? {} : { isMobile: true }), hasTouch: true });
    await context.addInitScript(draft => { sessionStorage.setItem('mkpos-mobile-sale-draft-v1:101:101', JSON.stringify(draft)); localStorage.setItem('mkpos.language', 'en'); }, draft);
    const page = await context.newPage(), calls = [], errors = [];
    let failCreate = true;
    page.on('pageerror', error => errors.push(error.message));
    await context.route(`${origin}/api/**`, async route => {
      const req = route.request(), endpoint = new URL(req.url()).pathname.slice(4);
      calls.push({ endpoint, method: req.method(), body: req.method() === 'POST' ? req.postDataJSON() : undefined });
      let body;
      if (endpoint === '/auth/me') body = session;
      else if (endpoint === '/app-config') body = { enabled_modules: ['sell', 'products', 'sales', 'shop'], permissions: session.permissions, business: {} };
      else if (endpoint === '/settings') body = settings;
      else if (endpoint === '/categories') body = [];
      else if (endpoint === '/products') body = { items: products, total: products.length };
      else if (endpoint === '/customers' && req.method() === 'POST') {
        if (failCreate) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Review customer details.', errors: { email: ['Fixture: email is already in use.'] } }) });
        body = { id: 77, ...req.postDataJSON() };
      }
      else if (endpoint === '/customers') body = { items: [], total: 0 };
      else if (endpoint === '/shop-admin/chat/config') body = { enabled: false };
      else body = { items: [], total: 0 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
    const enter = async () => {
      await page.getByRole('button', { name: 'Change', exact: true }).click();
      await page.getByRole('dialog', { name: 'Choose customer', exact: true }).getByRole('button', { name: 'New customer', exact: true }).click(); await page.getByRole('button', { name: 'Confirm selection', exact: true }).click();
      await page.getByRole('heading', { name: 'New customer', exact: true }).waitFor();
    };
    await page.goto(`${origin}/sell/checkout`);
    await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
    await page.getByRole('radio', { name: 'Bank transfer', exact: true }).check();
    await enter();
    await page.getByRole('button', { name: 'Create customer', exact: true }).click();
    await page.getByText('Customer name is required.', { exact: true }).waitFor();
    await page.getByText('Phone is required.', { exact: true }).waitFor();
    assert.equal(calls.filter(c => c.method === 'POST').length, 0);
    for (const [label, value] of [['Customer name', 'Emma Wilson'], ['Phone', '09 123 456 78'], ['Email (optional)', 'emma@example.com'], ['Address (optional)', '24 Market Street, Yangon']]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Address (optional)', { exact: true }).blur();
    await page.mouse.move(0, 0);
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'new-customer-393.png') });
    execFileSync('python', ['-c', "from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/new-customer-reference/reference-content.png'),(0,0)); im.paste(Image.open('artifacts/new-customer-reference/new-customer-393.png'),(393,0)); im.save('artifacts/new-customer-reference/comparison.png')"], { cwd: path.resolve(__dirname, '..') });
    await page.getByRole('textbox', { name: 'Note (optional)', exact: true }).fill('Customer-specific note');
    const count = calls.length;
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Paid amount', { exact: true }).inputValue(), '30,000');
    assert.ok(await page.getByRole('radio', { name: 'Bank transfer', exact: true }).isChecked());
    assert.equal(calls.length, count, 'Cancel does not restart Checkout');
    await page.goForward();
    await page.getByRole('heading', { name: 'New customer', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Note (optional)', exact: true }).inputValue(), 'Customer-specific note');
    await page.getByRole('button', { name: 'Go to previous sale step', exact: true }).click();
    await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
    await enter();
    await page.getByRole('button', { name: 'Open cart', exact: true }).click();
    await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'New customer', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Main navigation', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 817 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} overflow`);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `new-customer-${width}.png`) });
    }
    await page.setViewportSize({ width: 393, height: 817 });
    await page.getByLabel('Customer name', { exact: true }).focus();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'focused-393.png') });
    await page.getByRole('button', { name: 'Products', exact: true }).click();
    await page.getByRole('button', { name: 'Open app menu', exact: true }).click();
    await setDrawerLanguage(page, 'my');
    await page.keyboard.press('Escape');
    await page.goBack();
    await page.getByRole('heading', { name: 'ဖောက်သည်အသစ်', exact: true }).waitFor();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'myanmar-393.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Myanmar overflow');
    await page.locator('.sale-bottom-navigation button').filter({ hasText: 'ကုန်ပစ္စည်း' }).click();
    await page.locator('.sale-bottom-navigation > button').last().click();
    await page.getByRole('button', { name: 'Change language to English', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.goBack();
    await page.getByRole('button', { name: 'Create customer', exact: true }).click();
    await page.getByText('Fixture: email is already in use.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Note (optional)', exact: true }).inputValue(), 'Customer-specific note');
    failCreate = false;
    await page.getByLabel('Email (optional)', { exact: true }).fill('EMMA@example.com');
    await page.getByRole('button', { name: 'Create customer', exact: true }).click();
    await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
    await page.getByText('Emma Wilson', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Paid amount', { exact: true }).inputValue(), '30,000');
    const created = calls.filter(c => c.method === 'POST').at(-1).body;
    assert.equal(created.note, 'Customer-specific note'); assert.equal(created.email, 'emma@example.com');
    assert.ok(calls.filter(c => c.method === 'POST').every(c => c.endpoint === '/customers'));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ browser: engine, calls, errors, result: 'Passed required fields; Cancel/Back/Forward retention; cart and menu; 320/393/768 and Myanmar; server error/retry; synthetic create and auto-selection with checkout preserved.' }, null, 2));
    console.log('New checkout customer reference and interaction checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
