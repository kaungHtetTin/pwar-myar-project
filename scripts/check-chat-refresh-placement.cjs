const { webkit } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    let reads = 0, release;
    await page.addInitScript(() => localStorage.setItem('mkpos.shop.customerToken', 'fixture-token'));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (!url.pathname.includes('/api/ecommerce/')) return route.continue();
      const path = url.pathname.split('/api/ecommerce')[1];
      let data = { items: [], has_more: false, enabled: false, realtime_enabled: false, cursor: 0, unread_count: 0 };
      if (path === '/customer/me') data = { customer: { id: 1, name: 'Buyer' } };
      if (path === '/chat') {
        reads++;
        if (reads === 2) await new Promise(resolve => { release = resolve; });
        data = { items: [{ uuid: 'one', shop_name: 'Demo shop', slug: 'demo', preview: 'Hello', updated_at: '2026-10-18 10:00:00', unread_count: 0 }], has_more: false };
      }
      await route.fulfill({ json: data });
    });
    await page.goto('http://127.0.0.1:5177/#/chats');
    await page.getByRole('searchbox', { name: 'Search conversations' }).waitFor();
    await page.getByText('Demo shop', { exact: true }).waitFor();
    const before = await page.locator('.app-bar-search-band').boundingBox();
    await page.evaluate(() => {
      const node = document.querySelector('.chats-list-surface');
      window.scrollTo(0, 0);
      for (const [type, y] of [['touchstart', 30], ['touchmove', 210], ['touchend', null]]) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: y === null ? [] : [{ clientX: 90, clientY: y }] });
        node.dispatchEvent(event);
      }
    });
    await page.getByText(/^Refreshing/).waitFor();
    const bar = await page.locator('.app-bar-search-band').boundingBox();
    const indicator = await page.locator('.swipe-refresh-indicator').boundingBox();
    assert.ok(Math.abs(bar.y - before.y) < 1);
    assert.ok(indicator.y >= bar.y + bar.height);
    await page.screenshot({ path: 'artifacts/shop-safari-refresh/chats-progress-webkit.png' });
    release();
    console.log('Chats WebKit: search bar stays in place; refresh progress below full action bar. Intercepted API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
