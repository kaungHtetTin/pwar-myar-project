const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('mkpos.shop.customerToken', 'fixture'); });
  await page.route('**/ecommerce/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/customer/me') ? { customer: { id: 1, name: 'Buyer' } } : { items: [], has_more: false, unread_count: 0 } });
  });
  const dir = 'test-artifacts/chats-inbox';
  fs.mkdirSync(dir, { recursive: true });
  const shots = [];
  for (const route of ['marketplace', 'orders', 'cart', 'chats']) {
    await page.goto('http://127.0.0.1:5177/#/' + route);
    await page.locator('footer').waitFor();
    await page.waitForTimeout(350);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/${route}-initial.png` });
    shots.push(fs.readFileSync(`${dir}/${route}-initial.png`).toString('base64'));
  }
  for (const width of [360, 393, 440]) {
    await page.setViewportSize({ width, height: 852 });
    const layout = await page.evaluate(() => ({ footerTop: document.querySelector('footer').getBoundingClientRect().top, background: getComputedStyle(document.querySelector('main')).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth }));
    if (layout.footerTop < 852 || layout.background !== 'rgb(255, 255, 255)' || layout.overflow) throw Error(JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: `${dir}/chats-footer-scrolled.png` });
  const comparison = await browser.newPage({ viewport: { width: 1612, height: 880 } });
  await comparison.setContent(`<body style="margin:0;display:flex;gap:10px;background:#ddd;font:14px Arial">${shots.map((shot, i) => `<div>${['Home', 'Orders', 'Cart', 'Chats'][i]} · initial 393 × 852<img style="display:block;width:393px;height:852px" src="data:image/png;base64,${shot}"></div>`).join('')}</body>`);
  await comparison.screenshot({ path: `${dir}/initial-layout-comparison.png` });
  await browser.close();
  console.log('PASS initial Chats footer stays below viewport; white navigation backdrop and no overflow at 360, 393 and 440px.');
})().catch(error => { console.error(error); process.exit(1); });
