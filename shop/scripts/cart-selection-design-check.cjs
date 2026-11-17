const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const carts = ['Demo Shop', 'Sunrise Store', "Nature’s Best", 'Move On'].map((name, i) => ({
    name, slug: `demo-${i}`, origin: 'storefront', items: Array.from({ length: [3,2,4,2][i] }, (_, j) => ({
      id: i * 10 + j + 1, name: `Product ${j + 1}`, quantity: 1, price: [18500,24000,37200,66000][i] / [3,2,4,2][i], currency: 'K',
      available_quantity: 100, unit_name: 'Piece', photo_url: '/src/assets/home-local-groceries.webp',
    })),
  }));
  await page.addInitScript(carts => { localStorage.clear(); localStorage.setItem('mkpos.shop.carts.v2', JSON.stringify(carts)); }, carts);
  await page.route('**/ecommerce/**', route => {
    const slug = new URL(route.request().url()).pathname.split('/').at(-1);
    const cart = carts.find(c => c.slug === slug);
    return route.fulfill({ json: cart ? { slug, display_name: cart.name, logo_url: '/src/assets/home-local-groceries.webp', accepting_orders: slug !== 'demo-3' } : { items: [], has_more: false } });
  });
  await page.goto('http://127.0.0.1:5177/#/cart');
  await page.getByText('Closed', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync('test-artifacts/cart-selection', { recursive: true });
  const suffix = process.argv.includes('--before') ? 'before' : 'final';
  await page.screenshot({ path: `test-artifacts/cart-selection/${suffix}-393.png` });
  if (suffix === 'final') await page.locator('.cart-selection-card').nth(1).screenshot({ path: 'test-artifacts/cart-selection/shop-item-final.png' });
  const comparison = await browser.newPage({ viewport: { width: 806, height: 880 } });
  const ref = fs.readFileSync('design/PwarMyar Shops Cart Selection.png').toString('base64');
  const rendered = fs.readFileSync(`test-artifacts/cart-selection/${suffix}-393.png`).toString('base64');
  await comparison.setContent(`<body style="margin:0;display:flex;gap:20px;background:#ddd;font:12px Arial"><div>Reference · 393 × 852<img style="display:block;width:393px;height:852px" src="data:image/png;base64,${ref}"></div><div>${suffix} · 393 × 852<img style="display:block;width:393px;height:852px" src="data:image/png;base64,${rendered}"></div></body>`);
  await comparison.screenshot({ path: `test-artifacts/cart-selection/${suffix}-comparison.png` });
  if (suffix === 'final') {
    const card = fs.readFileSync('test-artifacts/cart-selection/shop-item-final.png').toString('base64');
    await comparison.setViewportSize({ width: 750, height: 140 });
    await comparison.setContent(`<body style="margin:0;display:flex;gap:20px;background:#ddd;font:12px Arial"><div>Reference card · 365px<canvas id="ref" width="365" height="109" style="display:block"></canvas></div><div>Rendered card · 365px<img style="display:block;width:365px" src="data:image/png;base64,${card}"></div></body>`);
    await comparison.evaluate(async data => { const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode(); document.querySelector('canvas').getContext('2d').drawImage(image, image.height < 500 ? 4 : 26, image.height < 500 ? 8 : 785, 802, 239, 0, 0, 365, 109); }, ref);
    await comparison.screenshot({ path: 'test-artifacts/cart-selection/shop-item-comparison.png' });
  }
  if (suffix === 'final') {
    for (const width of [360,393,760,1366]) {
      await page.setViewportSize({ width, height: 852 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Overflow at ${width}`);
      if (width === 1366) await page.screenshot({ path: 'test-artifacts/cart-selection/final-desktop.png' });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    const search = page.getByRole('searchbox', { name: 'Search your carts' });
    await search.fill('Sunrise');
    if (await page.locator('.cart-selection-card').count() !== 1) throw Error('Search failed');
    const source = await page.locator('.cart-shop-list').elementHandle();
    await page.getByRole('link', { name: 'Review cart', exact: true }).click();
    await page.waitForURL('**/#/cart/demo-1');
    await page.goBack();
    await page.waitForURL('**/#/cart');
    await search.waitFor();
    if (!(await source.evaluate(e => e.isConnected)) || await search.inputValue() !== 'Sunrise') throw Error('Back lost source/search');
    await search.fill('');
    const button = page.getByRole('link', { name: 'Review cart', exact: true }).first();
    await button.focus();
    if (!(await button.evaluate(e => e.matches(':focus-visible')))) throw Error('Keyboard focus missing');
    await search.fill('no matching shop');
    await page.getByText('No results found.', { exact: true }).waitFor();
    console.log('PASS: responsive overflow, local search, review route, Back retains source/search, keyboard focus, empty search. API intercepted.');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
