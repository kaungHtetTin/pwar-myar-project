const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const mode = process.argv[2] || 'after';
 const browser = await chromium.launch({ headless: true });
 const output = 'test-artifacts/app-bar-density'; fs.mkdirSync(output, { recursive: true });
 const routes = ['marketplace','cart','orders','account','chats','account/recent','account/notifications','account/addresses','account/favorites','account/profile','orders/track'];
 const widths = [360,440,1024,1366]; const metrics = {};
 try {
 const page = await browser.newPage(); page.on('pageerror', error => console.log('Page error', error.message));
 await page.addInitScript(() => localStorage.setItem('mkpos.shop.customerToken','fixture'));
 await page.route('**/ecommerce/**', route => route.fulfill({ json: route.request().url().endsWith('/customer/me') ? { customer: { id: 1, name: 'Buyer', email: 'buyer@example.test' } } : { items: [], has_more: false, unread_count: 0 } }));
 for (const width of widths) {
  await page.setViewportSize({ width, height: 956 });
  for (const route of routes) {
   await page.goto('http://127.0.0.1:5177/#/'+route); try { await page.locator('.shopping-header').waitFor({timeout:5000}); } catch(error) { console.log('Failed route',route,width,await page.locator('body').innerText()); throw error; }
   await page.evaluate(() => document.fonts.ready);
   const header = page.locator('.shopping-header');
   const bounds = await header.boundingBox(); metrics[`${route}:${width}`] = bounds.height;
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
   const overflow = await header.evaluate(el => { const box = el.getBoundingClientRect(); return [...el.children].filter(child => getComputedStyle(child).display !== 'none').some(child => {const rect = child.getBoundingClientRect(); return rect.left < box.left - 1 || rect.right > box.right + 1;}); });
   assert.equal(overflow,false,`${route} at ${width} header overflow`);
   if (['marketplace','account/recent','account/notifications','chats'].includes(route) && [440,1366].includes(width)) await header.screenshot({path:`${output}/${mode}-${route.replaceAll('/','-')}-${width}.png`});
  }
 }
 if (mode === 'after') {
  const expected = JSON.parse(fs.readFileSync(`${output}/before-metrics.json`));
  for (const route of routes) for (const width of widths) if (width > 760) expected[`${route}:${width}`] = expected[`${route}:1024`];
  assert.deepEqual(metrics, expected, 'Preserve mobile heights and use the medium two-row dimensions on large screens');
 }
 fs.writeFileSync(`${output}/${mode}-metrics.json`,JSON.stringify(metrics,null,2));
 console.log(`PASS ${mode}: ${routes.length} routes across ${widths.length} widths; no horizontal overflow${mode==='after'?'; mobile heights preserved and medium/large dimensions consistent':''}`);
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
