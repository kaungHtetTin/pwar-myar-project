const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  const output = path.resolve('artifacts/shop-checkout'); await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [375, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('mkpos.shop.cart.v1', JSON.stringify({ slug: 'test', name: 'Test shop', origin: 'storefront', items: [{ id: 1, name: 'Rice', quantity: 1, price: 1000, currency: 'Ks' }] }));
      });
      const method = { id: 'bank', name: 'Bank transfer', type: 'transfer', provider: 'manual' };
      const quote = { items: [{ product_id: 1, name: 'Rice', quantity: 1, unit_name: 'Bag', line_total: 1000 }], subtotal: 1000, delivery_fee: 0, total: 1000, currency: 'Ks', quote_hash: 'a'.repeat(64) };
      const order = { ...quote, reference: `O-REVIEW-${width}`, status: 'pending', payment_status: 'proof_submitted', payment_method: method, payment_reviews: [{ id: 1, status: 'pending' }] };
      const gate = () => { let release; const promise = new Promise(done => { release = done; }); return { promise, release }; };
      const checkout = gate(), proof = gate(), tracking = gate();
      const calls = [], errors = [];
      await context.route('**/api/ecommerce/**', async route => {
        const endpoint = new URL(route.request().url()).pathname.split('/api/ecommerce')[1]; calls.push(endpoint);
        let data = { items: [], has_more: false };
        if (endpoint === '/stores/test') data = { slug: 'test', display_name: 'Test shop', accepting_orders: true, payment_methods: [method], delivery_zones: [] };
        if (endpoint.endsWith('/quote')) data = quote;
        if (endpoint.endsWith('/checkout')) { await checkout.promise; data = { reference: order.reference, tracking_credential: 'c'.repeat(64) }; }
        if (endpoint === '/proofs') { await proof.promise; data = { ok: true }; }
        if (endpoint === '/tracking') { await tracking.promise; data = order; }
        await route.fulfill({ status: 200, json: data });
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5177/#/store/test/checkout');
      await page.getByLabel('Your name').fill('Demo buyer');
      await page.getByLabel('Phone number').fill('0912345678');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByLabel('Payment screenshot (optional)').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
      await page.getByRole('button', { name: 'Review order', exact: true }).click();
      const place = page.getByRole('button', { name: 'Place order', exact: true });
      await place.click();
      const check = async stage => {
        const busy = page.getByRole('button', { name: 'Placing order\u2026' }); await busy.waitFor();
        assert.equal(await busy.isDisabled(), true);
        assert.equal(await page.getByText('Finish your order', { exact: true }).count(), 0);
        assert.equal(await page.locator('[data-page-loading]:visible').count(), 0);
        assert.equal(await page.locator('.checkout-steps button[aria-current="step"]').innerText(), '4\nReview');
        await page.screenshot({ path: path.join(output, `${width}-${stage}.png`), fullPage: true });
      };
      await check('submitting');
      checkout.release(); await page.waitForRequest('**/api/ecommerce/proofs'); await check('uploading-proof');
      proof.release(); await page.waitForRequest('**/api/ecommerce/tracking'); await check('loading-confirmation');
      tracking.release(); await page.getByRole('heading', { name: order.reference }).waitFor();
      assert.equal(calls.filter(p => p === '/tracking').length, 1);
      assert.equal(await page.locator('[data-page-loading]:visible').count(), 0);
      await page.screenshot({ path: path.join(output, `${width}-confirmed.png`), fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`${width}px: Review stays visible through checkout/proof/tracking; one disabled submit state; confirmed order opens without another fetch or skeleton.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
