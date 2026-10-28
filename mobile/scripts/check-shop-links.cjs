// Test the real mobile and existing customer apps with intercepted API fixtures.
const { chromium } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const output = path.resolve(__dirname, '../artifacts/shop');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errors = [], calls = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const settings = { slug: 'test-shop', display_name: 'Test Shop', currency: 'Ks', phone: '091234', address: 'Yangon', description: 'Existing customer shop', price_type: 'Retail', price_types: ['Retail'], storefront_enabled: true, accepting_orders: true, marketplace_enabled: true, delivery_zones: [], opening_hours: [], timezone: 'Asia/Rangoon', categories: [] };
    const product = { id: 5, name: 'Rice', price: 16000, currency: 'Ks', unit_name: 'Bag', store_slug: 'test-shop', store_name: 'Test Shop', available_quantity: 12, description: 'Rice from the existing shop', rating: { count: 0, average: 0 } };
    await context.route(/^http:\/\/127\.0\.0\.1:(5176|5177|8000)\/api\//, async route => {
      const url = new URL(route.request().url()), endpoint = url.pathname.slice(4);
      calls.push(url.href);
      let data;
      if (endpoint === '/auth/me') data = { user: { id: 1, name: 'Test Owner', role: 'owner' }, business: { id: 1, name: 'Test Shop', currency: 'Ks' }, permissions: ['shop'], subscription: { is_valid: true } };
      else if (endpoint === '/app-config') data = { enabled_modules: ['shop'], permissions: ['shop'], language: 'en', business: {} };
      else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
      else if (endpoint === '/shop-admin/settings') data = settings;
      else if (endpoint === '/shop-admin/chat/config') data = { enabled: true, realtime_enabled: false };
      else if (endpoint === `/shop-admin/chat/${uuid}/messages`) data = { items: [{ id: 1, sender: 'owner', product, body: '', created_at: '2026-10-13T00:00:00Z' }], thread: { customer_name: 'Alice' }, has_more: false };
      else if (endpoint === '/ecommerce/stores/test-shop') data = settings;
      else if (endpoint === '/ecommerce/stores/test-shop/products/5') data = product;
      else if (endpoint.includes('/reviews')) data = { items: [], total: 0, average: 0, count: 0 };
      else data = { items: [], total: 0, has_more: false, enabled: false, unread_count: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const mobile = await context.newPage();
    await mobile.goto('http://127.0.0.1:5176/shop/storefront');
    const link = mobile.getByRole('link', { name: 'Open customer shop' });
    assert.equal(await link.getAttribute('href'), 'http://127.0.0.1:5177/#/store/test-shop');
    const popup = mobile.waitForEvent('popup'); await link.click();
    const shop = await popup;
    await shop.getByRole('heading', { name: 'Test Shop', exact: true }).waitFor();
    await shop.close();
    assert.equal(await mobile.getByLabel('Shop slug').inputValue(), 'test-shop');
    await mobile.goto(`http://127.0.0.1:5176/shop/chat/${uuid}`);
    const productLink = mobile.locator('.shop-mobile-message a');
    assert.equal(await productLink.getAttribute('href'), 'http://127.0.0.1:5177/#/store/test-shop/products/5');
    const productPopup = mobile.waitForEvent('popup'); await productLink.click();
    const detail = await productPopup;
    await detail.getByRole('heading', { name: 'Rice', exact: true }).waitFor();
    await detail.screenshot({ path: path.join(output, 'linked-customer-product-phone.png'), fullPage: true });
    await detail.close();
    await mobile.getByLabel('Message', { exact: true }).fill('Retained draft');
    assert.equal(await mobile.getByLabel('Message', { exact: true }).inputValue(), 'Retained draft');
    // This is the actual compiled sibling app served through the new Laravel route.
    const hosted = await context.newPage();
    const before = calls.length;
    await hosted.goto('http://127.0.0.1:8000/shop/#/store/test-shop/products/5');
    await hosted.getByRole('heading', { name: 'Rice', exact: true }).waitFor();
    assert.ok(calls.slice(before).some(url => url.startsWith('http://127.0.0.1:8000/api/ecommerce/stores/test-shop/products/5')));
    assert.ok(calls.slice(before).every(url => url.startsWith('http://127.0.0.1:8000/api/')), 'Hosted shop must use its own API server');
    await hosted.screenshot({ path: path.join(output, 'hosted-customer-product-phone.png'), fullPage: true });
    assert.deepEqual(errors, []);
    const report = { passed: true, errors, checks: ['mobile Open customer shop popup renders existing shop', 'shared product popup renders existing product page', 'closing popup leaves mobile source mounted', 'Laravel /shop/ serves compiled customer app', 'relative assets and API stay on the Laravel server'], hostedShop: 'http://127.0.0.1:8000/shop/', productionShop: 'https://www.pwarmyar.com/public/shop/' };
    await fs.writeFile(path.join(output, 'shop-links-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
