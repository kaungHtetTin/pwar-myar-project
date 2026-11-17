// Real Office UI and Leaflet, with isolated business/location API fixtures.
const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  await fs.mkdir('artifacts/office-shop-distribution', { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let reads = 0, failApi = false, failTiles = false, lastMapParams;
      const shops = Array.from({ length: 28 }, (_, index) => ({ id: index + 1, business_name: `Parts Shop ${String(index + 1).padStart(2, '0')}`,
        display_name: index === 0 ? 'Yangon Parts' : null, address: index % 2 ? 'Mandalay, Myanmar' : 'Yangon, Myanmar', phone: '09 123 456 789',
        status: index === 1 ? 'suspended' : 'active', latitude: index === 27 ? null : 16.84 + index * .14, longitude: index === 27 ? null : 96.17 + index * .04, accuracy: 12,
        shop_enabled: index % 5 !== 4, marketplace_status: index === 1 ? 'suspended' : index % 3 === 2 ? 'disabled' : 'enabled',
        orders_open: index % 5 !== 4 && index % 4 !== 3, access_state: index % 3 === 0 ? 'paid' : 'trial' }));
      await context.route('https://tile.openstreetmap.org/**', route => failTiles ? route.abort() : route.continue());
      await context.route('https://maps.google.com/**', route => route.fulfill({ body: '' }));
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url()), endpoint = url.pathname.slice(4);
        let data = { items: [], total: 0, page: 1, per_page: 25, last_page: 1 };
        if (endpoint === '/branding') data = { primary_color: '#006bdc' };
        if (endpoint === '/office/auth/me') data = { admin: { id: 1, name: 'Map admin', email: 'map@example.test', role: 'admin' } };
        if (endpoint === '/office/financial-report') data = {};
        if (/^\/office\/businesses\/\d+$/.test(endpoint)) {
          const shop = shops.find(shop => shop.id === Number(endpoint.split('/').pop()));
          data = { business: { id: shop.id, name: shop.business_name, owner_name: 'Fixture owner', owner_email: 'owner@example.test', currency: 'Ks', status: 'active' },
            billing: { is_valid: false, reason: 'no_subscription', subscription: null }, billing_history: [], business_summary: {}, shop_location: null,
            storefront: { slug: `fixture-${shop.id}`, display_name: shop.business_name, storefront_enabled: shop.shop_enabled, marketplace_enabled: true, marketplace_suspended: false } };
        }
        if (/^\/office\/businesses\/\d+\/storefront$/.test(endpoint)) {
          const shop = shops.find(shop => shop.id === Number(endpoint.split('/')[3]));
          shop.shop_enabled = route.request().postDataJSON().storefront_enabled;
          if (!shop.shop_enabled) shop.orders_open = false;
          data = { ok: true, storefront: { slug: `fixture-${shop.id}`, display_name: shop.business_name, storefront_enabled: shop.shop_enabled, marketplace_enabled: true, marketplace_suspended: false } };
        }
        if (endpoint === '/office/shop-distribution') {
          reads++;
          lastMapParams = url.searchParams;
          if (failApi) return route.fulfill({ status: 503, json: { message: 'Fixture locations unavailable' } });
          const q = (url.searchParams.get('q') || '').toLowerCase();
          const matching = shops.filter(shop => [shop.business_name, shop.display_name, shop.address, shop.phone].some(value => value?.toLowerCase().includes(q)));
          const location = url.searchParams.get('location');
          const statusMatches = matching.filter(shop => {
            const state = key => url.searchParams.get(key) || 'all';
            return (state('shop') === 'all' || shop.shop_enabled === (state('shop') === 'enabled'))
              && (state('marketplace') === 'all' || shop.marketplace_status === state('marketplace'))
              && (state('orders') === 'all' || shop.orders_open === (state('orders') === 'open'))
              && (state('access') === 'all' || (state('access') === 'unpaid' ? shop.access_state !== 'paid' : shop.access_state === state('access')));
          });
          const filtered = statusMatches.filter(shop => location === 'located' ? shop.latitude != null : location === 'missing' ? shop.latitude == null : true);
          const per_page = Number(url.searchParams.get('per_page')), last_page = Math.max(1, Math.ceil(filtered.length / per_page)), page = Math.min(Number(url.searchParams.get('page')), last_page);
          data = { items: filtered.slice((page - 1) * per_page, page * per_page), points: filtered.filter(shop => shop.latitude != null), total: filtered.length, page, per_page, last_page,
            summary: { total: statusMatches.length, located: statusMatches.filter(shop => shop.latitude != null).length, missing: statusMatches.filter(shop => shop.latitude == null).length }, map_total: filtered.filter(shop => shop.latitude != null).length, map_limit: 1000 };
        }
        await route.fulfill({ json: data });
      });
      await page.goto(((process.env.OFFICE_ORIGIN || 'http://127.0.0.1:5175') + '/#/shop-distribution'));
      const map = page.getByRole('region', { name: 'Shop distribution map', exact: true });
      await map.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => { const tiles = [...document.querySelectorAll('.leaflet-tile')]; return tiles.length > 0 && tiles.every(image => image.complete && image.naturalWidth > 0); }, { timeout: 15000 });
      await page.screenshot({ path: `artifacts/office-shop-distribution/${width}-map.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow');
      assert.ok(await page.evaluate(() => document.querySelector('.office-topbar').getBoundingClientRect().bottom <= document.querySelector('.office-page-heading').getBoundingClientRect().top), 'Toolbar stays above page content');
      await page.getByRole('searchbox', { name: 'Search shops' }).fill('Yangon Parts');
      await page.getByRole('searchbox', { name: 'Search shops' }).press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('.office-distribution-shops li').length === 1);
      const box = await map.boundingBox();
      await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
      await page.getByRole('region', { name: 'Selected shop' }).waitFor();
      assert.ok((await page.getByRole('region', { name: 'Selected shop' }).textContent()).includes('Yangon Parts'), 'Canvas marker opens matching shop');
      await page.getByRole('button', { name: 'Fit shops', exact: true }).click();
      await page.getByRole('button', { name: 'Clear search shops' }).click();
      await page.getByRole('button', { name: 'Filters', exact: true }).click();
      await page.getByLabel('Saved location').selectOption('located');
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.getByLabel('Rows per page').selectOption('10');
      await page.waitForFunction(() => document.querySelectorAll('.office-distribution-shops li').length === 10);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText('Parts Shop 11', { exact: true }).waitFor();
      await page.locator('.office-distribution-shops li').first().getByRole('button', { name: 'Show on map' }).click();
      await page.locator('.office-distribution-shops ul').evaluate(node => { node.scrollTop = 40; });
      await page.locator('.office-content').evaluate(node => { node.scrollTop = 100; });
      const snapshot = await page.evaluate(() => {
        window.distributionMapNode = document.querySelector('.office-distribution-map');
        return { list: document.querySelector('.office-distribution-shops ul').scrollTop, content: document.querySelector('.office-content').scrollTop, tiles: document.querySelector('.leaflet-map-pane').style.transform };
      });
      const before = reads;
      await page.getByRole('region', { name: 'Selected shop' }).getByRole('button', { name: 'View business', exact: true }).click();
      await page.waitForURL('**/#/businesses/11');
      await page.getByRole('heading', { name: 'Business overview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back to Shop distribution', exact: true }).click();
      await page.waitForURL('**/#/shop-distribution');
      await map.waitFor();
      assert.equal(reads, before, 'Back makes no new location request');
      assert.ok(await page.evaluate(() => document.querySelector('.office-distribution-map') === window.distributionMapNode), 'Back retains the map instance DOM');
      assert.equal(await page.getByLabel('Rows per page').inputValue(), '10');
      assert.ok((await page.getByRole('region', { name: 'Selected shop' }).textContent()).includes('Parts Shop 11'));
      const restored = await page.evaluate(() => ({ list: document.querySelector('.office-distribution-shops ul').scrollTop, content: document.querySelector('.office-content').scrollTop, tiles: document.querySelector('.leaflet-map-pane').style.transform }));
      assert.deepEqual(restored, snapshot, 'Back retains map position and source scroll');
      await page.goForward(); await page.waitForURL('**/#/businesses/11');
      await page.goBack(); await map.waitFor();
      assert.equal(reads, before, 'Browser Back also retains results');
      await page.getByRole('region', { name: 'Selected shop' }).getByRole('button', { name: 'View business', exact: true }).click();
      const toggle = page.getByRole('switch', { name: 'Storefront enabled' });
      await toggle.waitFor(); await toggle.click();
      await page.waitForFunction(() => document.querySelector('.office-storefront-toggle').getAttribute('aria-checked') === 'false');
      await page.waitForFunction(() => document.querySelector('.office-distribution-selected')?.textContent.includes('Shop disabled'));
      await page.getByRole('button', { name: 'Back to Shop distribution', exact: true }).click();
      await map.waitFor();
      assert.equal(reads, before + 1, 'Mutation reconciles the retained map once');
      assert.equal(await page.getByLabel('Rows per page').inputValue(), '10');
      assert.ok((await page.getByRole('region', { name: 'Selected shop' }).textContent()).includes('Shop disabled'));
      await page.screenshot({ path: `artifacts/office-shop-distribution/${width}-selection.png`, fullPage: true });
      failTiles = true;
      await page.locator('.leaflet-control-zoom-in').click();
      await page.getByRole('button', { name: 'Retry map', exact: true }).waitFor();
      failTiles = false;
      await page.getByRole('button', { name: 'Retry map', exact: true }).click();
      await page.waitForFunction(() => { const tiles = [...document.querySelectorAll('.leaflet-tile')]; return tiles.length > 0 && tiles.every(image => image.complete && image.naturalWidth > 0); });
      failApi = true;
      await page.getByRole('button', { name: 'Refresh current page', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Fixture locations unavailable' }).waitFor();
      failApi = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.office-distribution-error'));
      await page.getByRole('button', { name: /Filters/ }).click();
      await page.getByLabel('Saved location').selectOption('missing');
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.getByText('No saved location', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Show on map' }).count(), 0);
      await page.getByRole('searchbox', { name: 'Search shops' }).fill('No such fixture');
      await page.getByRole('searchbox', { name: 'Search shops' }).press('Enter');
      await page.getByText('No shops match these filters.', { exact: true }).waitFor();
      assert.ok(await page.getByRole('button', { name: 'Fit shops', exact: true }).isDisabled());
      await page.getByRole('button', { name: 'Clear search shops' }).click();
      await page.getByRole('button', { name: /Filters/ }).click();
      await page.getByLabel('Saved location').selectOption('all');
      await page.getByLabel('Shop status').selectOption('enabled');
      await page.getByRole('dialog').getByLabel('Marketplace status').selectOption('enabled');
      await page.getByLabel('Order acceptance').selectOption('open');
      await page.getByLabel('Paid status').selectOption('paid');
      await page.getByRole('dialog').evaluate(node => node.getAnimations().forEach(animation => animation.finish()));
      const drawerBounds = await page.getByRole('dialog').boundingBox();
      assert.ok(drawerBounds.x >= 0 && drawerBounds.x + drawerBounds.width <= width, 'Filter drawer fits viewport');
      await page.screenshot({ path: `artifacts/office-shop-distribution/${width}-filter-drawer.png` });
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      const eligible = shops.filter(shop => shop.shop_enabled && shop.marketplace_status === 'enabled' && shop.orders_open && shop.access_state === 'paid');
      await page.waitForFunction(count => document.querySelectorAll('.office-distribution-shops li').length === count, eligible.length);
      assert.equal(lastMapParams.get('page'), '1', 'Filters reset pagination');
      for (const [key, value] of Object.entries({ shop: 'enabled', marketplace: 'enabled', orders: 'open', access: 'paid' })) assert.equal(lastMapParams.get(key), value);
      assert.equal(await page.locator('.office-filter-count').textContent(), '4');
      assert.equal(await page.locator('.office-distribution-shops .office-distribution-statuses').count(), eligible.length);
      await page.waitForFunction(() => { const tiles = [...document.querySelectorAll('.leaflet-tile')]; return tiles.length > 0 && tiles.every(image => image.complete && image.naturalWidth > 0); });
      await page.screenshot({ path: `artifacts/office-shop-distribution/${width}-filtered.png`, fullPage: true });
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`Shop map ${width}px: markers, filters, pagination, detail/Back, map/scroll retention, refresh/retry and missing locations passed.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
