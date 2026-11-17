const { chromium } = require('../shop/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch(); let page;
  await fs.mkdir('artifacts/shop-radar', { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { latitude: 16.84, longitude: 96.17, accuracy: 12 }, serviceWorkers: 'block' });
    const shops = Array.from({ length: 28 }, (_, i) => ({ slug: `radar-${i + 1}`, display_name: `Nearby shop ${i + 1}`, description: 'Local goods and everyday essentials.',
      distance_km: (i + 1) / 10, accepting_orders: i !== 1, rating: { count: 0, average: null }, location: { latitude: 16.84 + (i + 1) / 1000, longitude: 96.17 }, address: 'Yangon', phone: '090000000',
      currency: 'Ks', categories: [], delivery_zones: [], payment_methods: [], contacts: [], pickup_instructions: '', pickup_address: '', pickup_hours: '' }));
    const calls = [], errors = []; let failNext = false;
    await context.route('https://maps.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#e9f2ef;display:grid;place-items:center;height:100vh;color:#527769;font:14px sans-serif">Google Maps iframe (intercepted for test)</body></html>' }));
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname, query = url.searchParams; calls.push({ path, query: url.search });
      let data = { items: [], has_more: false };
      if (path.endsWith('/marketplace/radar')) {
        assert.equal(Number(query.get('latitude')), 16.84); assert.equal(Number(query.get('longitude')), 96.17);
        if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { message: 'Radar temporarily unavailable' } }); }
        const items = shops.filter(shop => shop.distance_km <= Number(query.get('radius_km')) && shop.display_name.toLowerCase().includes((query.get('q') || '').toLowerCase()));
        const offset = Number(query.get('offset') || 0), limit = Number(query.get('limit') || 24);
        data = { items: items.slice(offset, offset + limit), has_more: items.length > offset + limit };
      }
      const match = path.match(/\/stores\/(radar-\d+)$/); if (match) data = shops.find(shop => shop.slug === match[1]);
      if (path.endsWith('/customer/me')) return route.fulfill({ status: 401, json: { message: 'Guest' } });
      await route.fulfill({ status: 200, json: data });
    });
    page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5177/#/marketplace');
    const navigation = page.locator('.mobile-navigation'); await navigation.getByRole('link', { name: 'Me', exact: true }).click();
    await page.getByRole('link', { name: /Shop Radar/ }).click();
    const reads = () => calls.filter(call => call.path.endsWith('/marketplace/radar')).length;
    await page.getByText('100 m away', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Update my location', exact: true }).count(), 0);
    assert.equal(await page.locator('.radar-intro, .radar-location-panel').count(), 0);
    assert.ok((await page.locator('.radar-shop').first().boundingBox()).height <= 90);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: 'artifacts/shop-radar/radar-page-mobile.png' });
    const radar = page.locator('.shop-radar-page');
    await radar.locator('.radar-shop').first().getByRole('button', { name: 'Show on map', exact: true }).click();
    assert.ok((await page.getByTitle('Shop Radar map').getAttribute('src')).includes(encodeURIComponent('16.840999999999998,96.17')) || (await page.getByTitle('Shop Radar map').getAttribute('src')).includes(encodeURIComponent('16.841,96.17')));
    const direction = new URL(await page.getByRole('link', { name: 'Directions', exact: true }).getAttribute('href')); assert.equal(direction.searchParams.get('origin'), '16.84,96.17');
    await page.screenshot({ path: 'artifacts/shop-radar/nearby-shops-mobile.png' });
    await page.getByRole('button', { name: 'Center on my location', exact: true }).click();
    await page.getByLabel('Distance range', { exact: true }).selectOption('10'); await page.waitForTimeout(100);
    const search = page.getByRole('searchbox', { name: 'Search nearby shops' }); await search.fill('Nearby shop 1'); await search.press('Enter');
    await page.getByText('100 m away', { exact: true }).waitFor();
    const source = await page.locator('.radar-shop-list').elementHandle(), beforeBack = reads();
    await radar.locator('.radar-shop').first().getByRole('link').first().click(); await page.locator('.shop-detail-page').waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await search.waitFor();
    assert.equal(await search.inputValue(), 'Nearby shop 1'); assert.equal(await page.getByLabel('Distance range', { exact: true }).inputValue(), '10');
    assert.equal(reads(), beforeBack); assert.ok(await page.locator('.radar-shop-list').evaluate((node, previous) => node === previous, source));
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.locator('.radar-shop').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    const loadMore = page.getByRole('button', { name: 'Load more', exact: true }); if (await loadMore.count()) await loadMore.click();
    await page.getByRole('link', { name: /Nearby shop 28/ }).waitFor();
    failNext = true; await page.getByLabel('Distance range', { exact: true }).selectOption('25'); await page.getByRole('alert').filter({ hasText: 'Radar temporarily unavailable' }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByText('100 m away', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 900 }); await page.evaluate(() => window.scrollTo(0, 0));
    const map = page.locator('.radar-map-panel'), nearby = page.locator('.radar-nearby-panel');
    const mapBounds = await map.boundingBox(), listBounds = await nearby.boundingBox();
    assert.ok(mapBounds.width > listBounds.width * 1.5); assert.ok(mapBounds.height >= 440);
    assert.ok(listBounds.x >= mapBounds.x + mapBounds.width); assert.ok(Math.abs(listBounds.y - mapBounds.y) < 2);
    const windowScroll = await page.evaluate(() => scrollY);
    await nearby.evaluate(node => { node.scrollTop = node.scrollHeight; }); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => scrollY), windowScroll); assert.equal((await map.boundingBox()).y, mapBounds.y);
    await nearby.locator('.radar-shop').first().getByRole('button', { name: 'Show on map', exact: true }).click();
    assert.ok((await page.getByTitle('Shop Radar map').getAttribute('src')).includes('z=16'));
    await page.screenshot({ path: 'artifacts/shop-radar/nearby-shops-desktop.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('link', { name: /Shop Radar/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Shop Radar: guest Me entry, automatic browser location flow, radius/search, map/center/directions, nearest distances, endless pages, retry, shop detail Back retaining DOM/query/location without refetch, account Back and compact rows and responsive layouts passed. API/maps intercepted.');
  } catch (error) { if (page) await page.screenshot({ path: 'artifacts/shop-radar/failure.png' }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
