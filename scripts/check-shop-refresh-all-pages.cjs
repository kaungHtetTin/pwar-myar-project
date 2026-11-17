const { chromium, webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

const product = { id: 1, store_slug: 'fixture', store_name: 'Fixture shop', name: 'Fixture rice', price: 9000, currency: 'Ks', unit_name: 'Bag', available_quantity: 20, category: 'Food' };
const store = { slug: 'fixture', display_name: 'Fixture shop', name: 'Fixture shop', accepting_orders: true, currency: 'Ks', description: 'Test shop', categories: ['Food'], payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash' }], delivery_zones: [], location: { latitude: 16.84, longitude: 96.17 } };
const order = { reference: 'O-FIXTURE', status: 'packing', payment_status: 'paid', store_name: 'Fixture shop', store_slug: 'fixture', fulfillment: 'pickup', total: 9000, subtotal: 9000, discount: 0, delivery_fee: 0, currency: 'Ks', created_at: '2026-10-18 10:00:00', items: [{ ...product, product_id: 1, quantity: 1, unit_price: 9000, line_total: 9000 }], receipt: { customer_name: 'Buyer' }, payment_method: { id: 'cash', name: 'Cash', type: 'cash' }, payment_reviews: [], customer_requests: [] };
const cases = [
  ['home', '/marketplace', '.home-search-band'],
  ['marketplace-products', '/marketplace', '.home-search-band', 'catalog-products'],
  ['marketplace-shops', '/marketplace', '.home-search-band', 'catalog-shops'],
  ['cart-selection', '/cart', '.cart-selection-workspace'],
  ['cart-review', '/cart/fixture', '.cart-review-workspace'],
  ['orders', '/orders', '.orders-filters'],
  ['order-detail', '/orders/track?reference=O-FIXTURE', '.order-detail-page'],
  ['chats', '/chats', '.chats-search-band'],
  ['conversation', '/chats/one', '.customer-chat-page'],
  ['account', '/account', '.me-dashboard'],
  ['profile', '/account/profile', '.edit-profile-page'],
  ['favorites', '/account/favorites', '.favorites-intro'],
  ['addresses', '/account/addresses', '.addresses-page'],
  ['notifications', '/account/notifications', '.updates-page'],
  ['stock-alerts', '/account/alerts', '.feature-subtitle'],
  ['recent', '/account/recent', '.recent-products-toolbar'],
  ['radar', '/account/radar', '.radar-controls'],
  ['shop-products', '/store/fixture', '.shop-detail-tabs'],
  ['shop-about', '/store/fixture', '.shop-detail-tabs', 'About'],
  ['shop-reviews', '/store/fixture', '.shop-detail-tabs', 'Reviews'],
  ['product', '/store/fixture/products/1', '.product-detail-info'],
  ['report', '/store/fixture/report', '.shop-report-page'],
  ['checkout', '/store/fixture/checkout', '.checkout-steps'],
  ['login', '/account/login', '.auth-input', null, true],
  ['register', '/account/register', '.auth-input', null, true],
  ['password-reset', '/account/forgot-password', '.customer-auth-page', null, true],
  ['guest-account', '/account', '.me-guest', null, true],
  ['guest-tracking', '/orders/track', '.tracking-page', null, true],
];

(async () => {
  const output = 'artifacts/shop-refresh-all-pages';
  await fs.mkdir(output, { recursive: true });
  const results = [];
  for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const wide = new Set(['home', 'cart-review', 'orders', 'chats', 'favorites', 'radar', 'checkout']);
      const requested = (process.env.SHOP_REFRESH_PAGES || '').split(',').filter(Boolean);
      const runs = cases.map(entry => ({ entry, width: 393 })).concat(cases.filter(entry => wide.has(entry[0])).map(entry => ({ entry, width: 1024 }))).filter(({ entry }) => !requested.length || requested.includes(entry[0]));
      for (const { entry: [name, route, selector, tab, guest], width } of runs) {
        const page = await browser.newPage({ viewport: { width, height: 852 }, isMobile: width === 393, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
          await page.route('https://fonts.gstatic.com/**', r => r.abort());
          await page.addInitScript(({ guest, product }) => {
            if (!guest) localStorage.setItem('mkpos.shop.customerToken', 'fixture');
            localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify([{ slug: 'fixture', name: 'Fixture shop', items: [{ ...product, quantity: 1 }] }]));
            localStorage.setItem('mkpos.shop.recent.1', JSON.stringify([{ slug: 'fixture', id: 1 }]));
            sessionStorage.setItem('mkpos.shop.tracking.customer', '1');
            Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: success => success({ coords: { latitude: 16.84, longitude: 96.17, accuracy: 10 } }) } });
          }, { guest, product });
          await page.route('https://maps.google.com/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Map fixture</p>' }));
          await page.route('**/api/**', async r => {
            const url = new URL(r.request().url());
            if (!url.pathname.includes('/api/ecommerce/')) return r.continue();
            const path = url.pathname.split('/api/ecommerce')[1];
            let data = { items: [], has_more: false, enabled: false, realtime_enabled: false, cursor: 0, unread_count: 0 };
            if (path === '/customer/me') data = { customer: { id: 1, name: 'Buyer', phone: '0912345678', email: 'buyer@example.test' } };
            else if (path === '/stores/fixture') data = store;
            else if (path === '/stores/fixture/products/1') data = product;
            else if (path.includes('/reviews')) data = { ...data, summary: { count: 0, average: 0 }, review: null, can_review: false };
            else if (path === '/customer/orders/O-FIXTURE') data = order;
            else if (path === '/chat/one') data = { thread: { uuid: 'one', slug: 'fixture', shop_name: 'Fixture shop' } };
            else if (path.endsWith('/products')) data = { ...data, items: [product] };
            else if (path.endsWith('/quote')) data = { ...order, quote_hash: 'fixture' };
            await r.fulfill({ json: data });
          });
          await page.goto(`http://127.0.0.1:5177/#${route}`);
          await page.locator(selector).first().waitFor();
          if (tab?.startsWith('catalog-')) await page.locator('.home-section-heading button').first().click();
          if (tab === 'catalog-shops') await page.locator('.home-browse-bar').getByRole('button', { name: 'Shops', exact: true }).click();
          if (tab && !tab.startsWith('catalog-')) await page.getByRole('tab', { name: tab, exact: true }).click();
          await page.locator('[data-retained-view]:not([hidden]) [data-page-load-content]:not([hidden])').first().waitFor();
          await page.evaluate(async () => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            await new Promise(resolve => requestAnimationFrame(resolve));
          });
          const bars = page.locator('.app-bar-search-band:visible, [data-shop-refresh-bar]:visible');
          const before = await bars.evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
          await page.evaluate(() => {
            const root = document.querySelector('.swipe-refresh-shell');
            const target = root.querySelector('[data-retained-view]:not([hidden]) .customer-chat-page') || root;
            for (const [type, y] of [['touchstart', 20], ['touchmove', 210]]) {
              const event = new Event(type, { bubbles: true, cancelable: true });
              Object.defineProperty(event, 'touches', { value: [{ clientX: 80, clientY: y }] });
              target.dispatchEvent(event);
            }
          });
          if (name === 'conversation') {
            assert.equal(await page.locator('.swipe-refresh-indicator.is-visible').count(), 0, 'Conversation must retain its own scroll');
          } else {
            await page.locator('.swipe-refresh-indicator.is-visible').waitFor();
            const after = await bars.evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
            assert.equal(after.length, before.length);
            after.forEach((bar, i) => assert.ok(Math.abs(bar.top - before[i].top) < 1, `${name}: control row moved`));
            const indicator = await page.locator('.swipe-refresh-indicator').boundingBox();
            const header = await page.locator('#root > .site-header').boundingBox();
            assert.ok(indicator.y >= Math.max(header.y + header.height, ...after.map(bar => bar.bottom)) - 1, `${name}: indicator overlaps action bar`);
            if (['orders', 'favorites', 'radar', 'checkout', 'home'].includes(name)) await page.screenshot({ path: `${output}/${name}-${engineName}-${width}.png` });
          }
          assert.deepEqual(errors, []);
          results.push({ engine: engineName, page: name, route, width, controlRows: before.length, passed: true });
          console.log('PASS', engineName, name, width);
        } catch (error) {
          results.push({ engine: engineName, page: name, route, width, passed: false, error: error.message, pageErrors: errors });
          console.log('FAIL', engineName, name, error.message.slice(0, 170));
        } finally { await page.close(); }
      }
      console.log(engineName, 'route audit finished');
    } finally { await browser.close(); }
  }
  await fs.writeFile(`${output}/${process.env.SHOP_REFRESH_PAGES ? 'verification-rerun' : 'verification'}.json`, JSON.stringify(results, null, 2));
  const failures = results.filter(row => !row.passed);
  console.log(`${results.length - failures.length}/${results.length} page checks passed. No live backend writes.`);
  assert.equal(failures.length, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
