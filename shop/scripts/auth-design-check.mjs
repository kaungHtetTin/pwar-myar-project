import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'test-artifacts/auth-design';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [360, 393, 430, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 852 } });
    await page.route('**/ecommerce/**', route => route.fulfill({ json: { items: [], has_more: false } }));
    for (const screen of ['login', 'register']) {
      await page.goto(`http://127.0.0.1:5177/#/account/${screen}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: screen === 'login' ? 'Welcome back' : 'Create customer account' }).waitFor();
      await page.evaluate(async () => {
        await Promise.all([400, 700, 800].map(weight => document.fonts.load(`${weight} 16px "Shop Auth DM Sans"`)));
        await document.fonts.ready;
      });
      await page.screenshot({ path: `${output}/${screen}-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${screen} overflow at ${width}`);
      await page.getByRole('button', { name: screen === 'login' ? 'Sign in' : 'Create account', exact: true }).click();
      assert.equal(await page.locator('.customer-auth-page:visible input:invalid').count(), screen === 'login' ? 2 : 4);
      await page.getByRole('button', { name: 'Change language' }).click();
      await page.screenshot({ path: `${output}/${screen}-my-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${screen} Myanmar overflow at ${width}`);
      await page.locator('.auth-language').click();
      results.push({ screen, width, english: 'pass', myanmar: 'pass', requiredFields: 'pass' });
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.goto('http://127.0.0.1:5177/#/account/register?next=%2Fstore%2Fdemo%2Fcheckout');
  await page.getByRole('heading', { name: 'Create customer account' }).waitFor();
  await page.getByRole('button', { name: 'Show confirm password', exact: true }).click();
  assert.equal(await page.getByLabel('Confirm password', { exact: true }).getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide confirm password', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.match(page.url(), /login\?next=%2Fstore%2Fdemo%2Fcheckout/);
  await page.locator('.customer-auth-page:visible').getByRole('link', { name: 'Continue as guest' }).click();
  assert.match(page.url(), /store\/demo\/checkout/);
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log('PASS: login/signup English and Myanmar at 360/393/430/1366, required validation, password toggles, destination-preserving account switch, guest continuation.');
} finally { await browser.close(); }
