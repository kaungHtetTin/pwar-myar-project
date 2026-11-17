const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch();
  await fs.mkdir('artifacts/mobile-action-buttons', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    const permissions = ['sell','products','shop','ecommerce_orders','ecommerce_process'];
    const session = { user: { id: 1, name: 'Demo Owner', role: 'owner' }, business: { id: 1, name: 'Demo shop' }, permissions, subscription: { is_valid: true } };
    const product = { id: 7, name: 'Fast Water', sku: 'FW-1', category: 'Drinks', base_unit: 'Bottle', stock: 20, price: 1000, prices: [{ name: 'Retail', price: 1000 }] };
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()); if (!url.pathname.startsWith('/api/')) return route.continue();
      const endpoint = url.pathname.slice(4);
      let data = { items: [], total: 0 };
      if (endpoint === '/auth/me') data = session;
      else if (endpoint === '/app-config') data = { enabled_modules: ['sell','products','shop'], permissions, language: 'en', business: {} };
      else if (endpoint === '/settings') data = { price_types: 'Retail', payment_methods: 'Cash', currency: 'Ks' };
      else if (endpoint === '/categories') data = ['Drinks'];
      else if (endpoint === '/price-types') data = { items: ['Retail'], rules: [] };
      else if (endpoint === '/products') data = { items: [product], total: 1 };
      else if (endpoint === '/shop-admin/owner-location') data = { submitted: true };
      else if (endpoint.endsWith('/chat/config')) data = { enabled: true, realtime_enabled: false };
      else if (endpoint.endsWith('/chat/notifications')) data = { enabled: true, cursor: 0, items: [], unread_count: 0 };
      else if (endpoint === '/shop-admin/order-notifications') data = { cursor: 0, items: [] };
      await route.fulfill({ status: 200, json: data });
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/sell','/products','/shop']) {
      await page.goto('http://127.0.0.1:5176' + path);
      await page.locator('.shared-app-bar .app-bar-page-content').waitFor();
      await page.getByRole('button', { name: 'Shop chat', exact: true }).waitFor();
      for (const width of [320,375,768]) {
        await page.setViewportSize({ width, height: 812 });
        const styles = await page.locator('.shared-app-bar .ui-icon-button').evaluateAll(buttons => buttons.map(button => {
          const box=button.getBoundingClientRect(), css=getComputedStyle(button), icon=button.querySelector('svg'), iconCss=getComputedStyle(icon);
          return { label:button.getAttribute('aria-label'), width:box.width, height:box.height, left:box.left, right:box.right, color:css.color, radius:css.borderRadius, iconWidth:iconCss.width, iconHeight:iconCss.height, stroke:iconCss.strokeWidth };
        }));
        assert.ok(styles.length >= 2);
        for (const style of styles) {
          assert.equal(Math.round(style.width),44,JSON.stringify(style)); assert.equal(Math.round(style.height),44,JSON.stringify(style));
          assert.equal(style.iconWidth,'20px'); assert.equal(style.iconHeight,'20px'); assert.equal(style.stroke,'2px');
          assert.equal(style.color,styles[0].color); assert.equal(style.radius,styles[0].radius);
          assert.ok(style.left >= 0 && style.right <= width, 'Action fits viewport: ' + JSON.stringify(style));
        }
        await page.screenshot({ path: `artifacts/mobile-action-buttons/${path.slice(1)}-${width}.png` });
      }
    }
    await page.goto('http://127.0.0.1:5176/sell');
    const cart=page.getByRole('button',{name:'Open cart',exact:true}); await cart.waitFor();
    await cart.click();await page.waitForURL('**/sell/cart');
    await page.getByRole('button',{name:'Back to products',exact:true}).click();await page.waitForURL('**/sell');
    await page.getByRole('button',{name:'Shop chat',exact:true}).click();await page.waitForURL('**/shop/chat');
    await page.goBack();await page.waitForURL('**/sell');
    await page.getByRole('button',{name:'Open app menu',exact:true}).focus();await page.keyboard.press('Enter');
    await page.getByRole('dialog',{name:'Main navigation',exact:true}).waitFor();
    await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Main navigation',exact:true}).waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    console.log('Sell, Products and My Shop: identical 20px icons, 44px targets, colour/radius at 320/375/768px. Cart, Chat, menu keyboard activation, dismiss and Back passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
