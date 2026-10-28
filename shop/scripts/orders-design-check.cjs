const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', error => console.log('Browser error:', error.message));
  const calls = [];
  const orders = ['completed', 'packing', 'cancelled', 'completed', 'completed'].map((status, index) => ({
    reference: ['ORD-20240715-0012', 'ORD-20240714-0098', 'ORD-20240713-0045', 'ORD-20240712-0076', 'ORD-20240710-0031'][index], status, payment_status: index === 1 ? 'proof_submitted' : 'unpaid',
    store_name: ['Demo Shop', 'Sunrise Store', "Nature’s Best", 'Move On', 'Beauty House'][index], store_slug: 'demo-shop-01',
    total: [28500, 30000, 21000, 45000, 33500][index], currency: 'K', created_at: ['2024-07-15 10:24:00', '2024-07-14 16:18:00', '2024-07-13 11:05:00', '2024-07-12 09:32:00', '2024-07-10 12:40:00'][index], item_count: [4,3,4,1,3][index],
    item_previews: ['Fresh Apples', 'Organic Rice', 'Handmade Mug'].slice(0,[3,2,2,1,2][index]).map(name => ({ name, photo_url: '/src/assets/home-local-groceries.webp' })),
  }));
  await page.addInitScript(() => localStorage.setItem('mkpos.shop.customerToken', 'browser-fixture'));
  await page.route('**/ecommerce/**', async route => {
    const url = new URL(route.request().url()); calls.push(url.pathname + url.search);
    if (url.pathname.endsWith('/me')) return route.fulfill({ json: { customer: { id: 901, name: 'Browser Buyer' } } });
    if (url.pathname.endsWith('/orders')) {
      const status = url.searchParams.get('status');
      const items = orders.filter(o => status === 'completed' ? o.status === 'completed' : status === 'cancelled' ? o.status === 'cancelled' : status === 'processing' ? o.status === 'packing' : true);
      return route.fulfill({ json: { items, has_more: false } });
    }
    if (url.pathname.endsWith('/buy-again')) return route.fulfill({ json: { items: [], skipped: [], warnings: [] } });
    if (/\/orders\/ORD-/.test(url.pathname) || url.pathname.endsWith('/tracking')) return route.fulfill({ json: { ...orders[1], total: 28500, subtotal: 28500, discount: 2000, delivery_fee: 2000, fulfillment: 'delivery', receipt: { customer_name: 'Aung Min', phone: '09 123 456 789', address: 'No. 123, Bogyoke Aung San Road, Kyauktada Township, Yangon' }, items: [{ product_id: 1, name: 'Fresh Apples', quantity: 2, unit_name: 'Piece', unit_price: 4500, line_total: 9000 }, { product_id: 2, name: 'Cotton T-Shirt', quantity: 1, unit_name: 'Piece', unit_price: 12000, line_total: 12000 }, { product_id: 3, name: 'Organic Honey', quantity: 1, unit_name: 'Jar', unit_price: 7500, line_total: 7500 }], tracking_credential: 'fixture-private-key', payment_method: { name: 'KBZ Pay', type: 'transfer', provider: 'manual' }, payment_reviews: [{ id: 1, status: 'pending' }], customer_requests: [] } });
    return route.fulfill({ json: { items: [], has_more: false, unread_count: 0 } });
  });
  await page.goto('http://127.0.0.1:5177/#/orders');
  await page.locator('.customer-order-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync('test-artifacts/orders', { recursive: true });
  for (const width of [393, 440, 1366]) {
    await page.setViewportSize({ width, height: 852 });
    await page.screenshot({ path: `test-artifacts/orders/orders-${width}.png` });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow');
  }
  await page.setViewportSize({ width: 393, height: 852 });
  for (const [label, count] of [['Completed', 3], ['Cancelled', 1], ['Processing', 1]]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(n => document.querySelectorAll('.customer-order-card').length === n, count);
  }
  const before = calls.filter(c => c.includes('/orders?')).length;
  const source = await page.locator('.customer-orders').elementHandle();
  // Open from the body of the card, away from the chevron.
  await page.locator('.customer-order-card').click({ position: { x: 40, y: 105 } });
  await page.waitForURL('**/#/orders/track');
  await page.locator('.tracking-result').waitFor();
  if (await page.locator('.mobile-navigation').count()) throw Error('Order detail has bottom navigation');
  if (await page.locator('.account-app-bar-title').innerText() !== 'Order details') throw Error('Order detail app bar missing');
  if (await page.locator('.order-lookup, .tracking-credential').count()) throw Error('Account orders must not show guest tracking controls');
  if (calls.some(path => path.endsWith('/tracking'))) throw Error('Account order must load through authenticated order API');
  if (JSON.parse(await page.evaluate(() => sessionStorage.getItem('mkpos.shop.tracking'))).credential) throw Error('Account order credential persisted');
  for (const width of [393, 440, 1366]) {
    await page.setViewportSize({ width, height: 852 });
    await page.screenshot({ path: `test-artifacts/orders/order-detail-${width}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Order detail horizontal overflow');
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.locator('.receipt-disclosure > summary').click();
  await page.getByRole('button', { name: 'Download receipt', exact: true }).waitFor();
  await page.locator('.receipt-disclosure > summary').click();
  await page.getByRole('button', { name: 'Request cancellation', exact: true }).click();
  await page.getByRole('button', { name: 'Close request', exact: true }).click();
  await page.getByRole('button', { name: 'Buy again', exact: true }).click();
  await page.getByRole('dialog', { name: 'Review your repeat order' }).waitFor();
  await page.getByRole('button', { name: 'Close repeat order' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForURL('**/#/orders');
  await page.waitForTimeout(300);
  if (!(await source.evaluate(el => el.isConnected))) throw Error('Orders source remounted');
  if (await page.getByRole('button', { name: 'Processing', exact: true }).getAttribute('aria-pressed') !== 'true') throw Error('Filter lost');
  if (calls.filter(c => c.includes('/orders?')).length !== before) throw Error('Orders reloaded on Back');
  await page.getByRole('button', { name: /^View order:/ }).press('Enter');
  await page.waitForURL('**/#/orders/track');
  await page.goBack();
  await page.locator('.customer-order-card').waitFor();
  if (await page.getByRole('button', { name: 'Processing', exact: true }).getAttribute('aria-pressed') !== 'true') throw Error('Browser Back lost order filter');
  const detailReads = calls.filter(c => /\/customer\/orders\/ORD-/.test(c)).length;
  await page.locator('.customer-order-card .order-card-header a').click();
  await page.waitForURL('**/#/store/demo-shop-01');
  if (calls.filter(c => /\/customer\/orders\/ORD-/.test(c)).length !== detailReads) throw Error('Shop link also opened order detail');
  await page.goBack();
  await page.locator('.customer-order-card').waitFor();
  if (calls.filter(c => c.includes('/orders?')).length !== before) throw Error('Shop return reloaded order list');
  const comparison = await browser.newPage({ viewport: { width: 806, height: 880 } });
  const reference = fs.readFileSync('design/ChatGPT Image Oct 13, 2026, 12_04_28 PM-9.png').toString('base64');
  const actual = fs.readFileSync('test-artifacts/orders/orders-393.png').toString('base64');
  await comparison.setContent(`<body style="margin:0;display:flex;gap:20px;background:#ddd;font:12px Arial"><div>Reference · 393 × 852<img style="display:block;width:393px;height:852px" src="data:image/png;base64,${reference}"></div><div>Rendered · 393 × 852<img style="display:block;width:393px;height:852px" src="data:image/png;base64,${actual}"></div></body>`);
  await comparison.screenshot({ path: 'test-artifacts/orders/reference-comparison.png' });
  const detailReference = fs.readFileSync('C:/Users/Hp/Downloads/PwarMyar Order Details Screen.png').toString('base64');
  const detailActual = fs.readFileSync('test-artifacts/orders/order-detail-440.png').toString('base64');
  await comparison.setViewportSize({ width: 912, height: 1000 });
  await comparison.setContent(`<body style="margin:0;padding:8px;display:flex;align-items:flex-start;gap:16px;background:#e8eeec;font:13px Arial"><div style="width:440px">Reference (scaled to 440px)<img style="display:block;width:440px" src="data:image/png;base64,${detailReference}"></div><div style="width:440px">Rendered (440px viewport)<img style="display:block;width:440px" src="data:image/png;base64,${detailActual}"></div></body>`);
  await comparison.screenshot({ path: 'test-artifacts/orders/order-detail-comparison.png', fullPage: true });
  console.log('PASS: mobile/desktop layout, all filters, authenticated order detail without tracking controls or saved credential, receipt expansion, cancellation open/close, app-bar Back preserves source/filter without fetch, Buy again preview and close. API requests intercepted.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
