const { setDrawerLanguage } = require('./drawer-language.cjs');
const { pullToRefresh } = require('./swipe-refresh.cjs');
// Dev-server verification with intercepted report APIs; no live records or mutations.
const { chromium, firefox } = require('../../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/reports-reference');
const origin = 'http://127.0.0.1:5176', engine = process.env.REPORT_BROWSER || 'chromium';
const session = { user: { id: 301, role: 'owner', name: 'Fixture owner' }, business: { id: 301, name: 'Fixture shop', currency: 'MMK' }, permissions: ['sell', 'products', 'reports', 'sales', 'shop'], subscription: { is_valid: true } };
const fixture = {
  start: '2026-10-01', end: '2026-10-15', sales_count: 48, sales_total: 980000, cash_total: 861000, credit_total: 119000, expense_total: 145000, profit_estimate: 185000,
  foc_quantity: 3, foc_cost: 8000, purchase_foc_quantity: 1, purchase_foc_value: 13333, purchase_count: 5, purchase_total: 380000, purchase_paid_total: 200000, purchase_credit_total: 180000,
  cash_movement: { sales_received: 861000, debt_collected: 50000, supplier_refunds: 10000, shop_payouts: 5000, purchase_payments: 200000, supplier_payments: 250000, expenses: 145000, net_movement: 321000, expected_cash_drawer: 321000 },
  current_accounts: { as_of: '2026-10-15', receivable_total: 380000, payable_total: 935000, customer_payable_total: 15000, supplier_payable_total: 920000, supplier_credit_total: 25000, customers_owing: 12, open_accounts: 18 },
  inventory_valuation: { as_of: '2026-10-15', product_count: 42, stock_units: 2850, investment_value: 2340000, potential_sales_value: 3150000 },
  payment_methods: [{ payment_method: 'Cash', count: 30, total: 680000, paid_total: 600000, credit_total: 80000 }, { payment_method: 'Bank transfer', count: 12, total: 239000, paid_total: 200000, credit_total: 39000 }, { payment_method: 'Mobile money', count: 6, total: 61000, paid_total: 61000, credit_total: 0 }],
  top_products: ['Premium Jasmine Rice', 'Sunflower Cooking Oil', 'Green Tea – Original', 'Natural Hand Soap', 'Mineral Water 500 ml'].map((product_name,i) => ({ product_name, quantity: [40,60,30,50,120][i], foc_quantity: i === 0 ? 3 : 0, total: [320000,180000,105000,75000,60000][i] })),
  expense_categories: ['Rent','Salaries','Utilities','Transport','Others'].map((category,i) => ({ category, count: [1,2,3,4,5][i], total: [60000,40000,20000,15000,10000][i] })),
  sales_trends: { month: { label: 'October 2026', items: Array.from({length:31},(_,i) => ({ label: String(i+1), total: i<15 ? [52000,75000,45000,60000,47000][i%5] : 0 })) }, year: { label: '2026', items: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label,i) => ({label,total:i<10 ? 500000+i*48000 : 0})) } },
};
(async () => {
  await fs.mkdir(output,{recursive:true});
  execFileSync('python',['-c',"from PIL import Image; from pathlib import Path; [(Image.open(f).resize((393,850)).crop((0,33,393,850)).save(Path('artifacts/reports-reference')/('reference-'+f.name[:3]+'.png'))) for f in Path('docs/design/reports').glob('*.png')]"],{cwd:root});
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({headless:true});
  const context = await browser.newContext({viewport:{width:393,height:817},timezoneId:'Asia/Yangon',...(engine==='firefox'?{}:{isMobile:true}),hasTouch:true,acceptDownloads:true});
  await context.addInitScript(() => localStorage.setItem('mkpos.language','en'));
  const page = await context.newPage(), calls = [], errors = [];
  let fail = false, empty = false, slow = false;
  page.on('pageerror',e => errors.push(e.message));
  await context.route(`${origin}/api/**`,async route => {
    const url = new URL(route.request().url()), endpoint = url.pathname.slice(4); calls.push({endpoint,query:url.search,method:route.request().method()});
    let data = {items:[],total:0};
    if (endpoint === '/auth/me') data = session;
    else if (endpoint === '/app-config') data = {enabled_modules:session.permissions,permissions:session.permissions,business:{}};
    else if (endpoint === '/settings') data = {currency:'MMK'};
    else if (endpoint === '/categories' || endpoint === '/price-types') data = [];
    else if (endpoint === '/products/summary') data = {total_products:0,stock_value:0,low_stock:0,out_of_stock:0};
    else if (endpoint === '/reports/summary.csv') return route.fulfill({contentType:'text/csv',body:'Report,Value\r\nSales,980000\r\n'});
    else if (endpoint === '/reports/summary') {
      if (slow) await new Promise(r => setTimeout(r,500));
      if (fail) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture report unavailable.'})});
      data = structuredClone(fixture);
      data.start = url.searchParams.get('start') || fixture.start; data.end = url.searchParams.get('end') || fixture.end; data.all_time = url.searchParams.has('all_time');
      if (empty) data = {...data,sales_count:0,sales_total:0,cash_total:0,credit_total:0,expense_total:0,profit_estimate:0,payment_methods:[],top_products:[],expense_categories:[],sales_trends:{month:{label:'October 2026',items:[]},year:{label:'2026',items:[]}}};
    }
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await context.route('**/sanctum/csrf-cookie',r => r.fulfill({status:204}));
  const count = () => calls.filter(c => c.endpoint === '/reports/summary').length;
  async function top() { await page.evaluate(() => window.scrollTo(0,0)); }
  async function capture(id, section) {
    await page.evaluate(() => document.fonts.ready);
    if (section) await page.locator(section).evaluate(n => n.scrollIntoView({block:'start',behavior:'instant'})); else await top();
    await page.locator(':focus').evaluateAll(nodes => nodes.forEach(n => n.blur()));
    await page.screenshot({animations:'disabled',path:path.join(output,`screen-${id}.png`)});
    execFileSync('python',['-c',`from PIL import Image; im=Image.new('RGB',(786,817),'white'); im.paste(Image.open('artifacts/reports-reference/reference-${id}.png'),(0,0)); im.paste(Image.open('artifacts/reports-reference/screen-${id}.png'),(393,0)); im.save('artifacts/reports-reference/comparison-${id}.png')`],{cwd:root});
    for (const width of [320,362,768]) {
      await page.setViewportSize({width,height:817});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${id} ${width}px page overflow`);
      if (id === '046') {
        const period = await page.locator('.report-period-button').boundingBox();
        const filter = await page.locator('.report-filter-toolbar .mobile-filter-toggle').boundingBox();
        assert.ok(period.height >= 43.5 && filter.height >= 43.5 && filter.width >= 43.5, `Report toolbar has shared touch targets: ${JSON.stringify({ period, filter })}`);
        assert.ok(Math.abs(period.height - filter.height) < 1 && Math.abs(period.y - filter.y) < 1, 'Period and filter controls align');
        assert.ok(filter.x - period.x - period.width >= 7, 'Toolbar controls keep a clear gap');
      }
      if (id === '119') {
        const rows = await page.locator('.date-range-choices > label').evaluateAll(nodes => nodes.map(n => ({ width: n.clientWidth, height: n.clientHeight, scrollWidth: n.scrollWidth })));
        assert.equal(rows.length, 7);
        assert.ok(rows.every(row => row.width >= 240 && row.height >= 40 && row.scrollWidth <= row.width), 'Radio rows fit usable controls');
        assert.ok(await page.locator('.report-filter-dates input').evaluateAll(nodes => nodes.every(n => n.clientWidth >= 240 && n.scrollWidth <= n.clientWidth)), 'Native dates have room for the full value');
      }
      if (section) await page.locator(section).evaluate(n => n.scrollIntoView({block:'start',behavior:'instant'}));
      await page.screenshot({animations:'disabled',path:path.join(output,`screen-${id}-${width}.png`)});
    }
    await page.setViewportSize({width:393,height:817});
  }
  try {
    await page.goto(`${origin}/products`); await page.getByRole('button',{name:'Open app menu',exact:true}).click();
    slow = true; await page.locator('a[href="/reports"]').click(); await page.getByText('Loading report…',{exact:true}).waitFor(); await page.screenshot({path:path.join(output,'loading.png')}); slow = false;
    await page.getByRole('button',{name:'Export CSV',exact:true}).waitFor(); assert.equal(await page.getByRole('button',{name:/^Refresh/}).count(),0);
    await page.getByRole('button',{name:'Filters',exact:true}).click(); await page.getByLabel('From',{exact:true}).fill('2026-10-01'); await page.getByLabel('To',{exact:true}).fill('2026-10-15');
    await page.getByRole('button',{name:'Apply filters',exact:true}).click(); await page.locator('dialog[open]').waitFor({state:'hidden'});
    await capture('046'); await page.screenshot({fullPage:true,animations:'disabled',path:path.join(output,'full-report.png')});
    const beforePeriod = count();
    await page.locator('.report-period-button').click();
    assert.equal(await page.locator('.report-period-button').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.report-period-button').getAttribute('aria-expanded'), 'false');
    assert.equal(count(), beforePeriod, 'Opening and dismissing the period control does not refresh report data');
    await page.getByRole('button',{name:'Filters',exact:true}).click(); const before = count();
    await page.getByRole('radio',{name:'Last month',exact:true}).click(); assert.equal(count(),before);
    await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Filters',exact:true}).click(); assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2026-10-01');
    await capture('119');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByLabel('To', { exact: true }).focus();
    await page.getByLabel('To', { exact: true }).evaluate(input => input.scrollIntoView({ block: 'center' }));
    assert.ok(await page.getByLabel('To', { exact: true }).evaluate(input => input.getBoundingClientRect().bottom <= document.querySelector('.mobile-filter-drawer-footer').getBoundingClientRect().top), 'Focused date stays above footer on a short viewport');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'drawer-keyboard-space.png') });
    await page.locator('.mobile-filter-drawer-body').evaluate(body => body.scrollTop = body.scrollHeight);
    assert.ok(await page.locator('.report-filter-help').evaluate(help => help.getBoundingClientRect().bottom <= document.querySelector('.mobile-filter-drawer-footer').getBoundingClientRect().top), 'Last content can scroll clear of the footer');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'drawer-short-bottom.png') });
    await page.setViewportSize({ width: 393, height: 817 });
    await page.getByLabel('From',{exact:true}).fill('2026-12-31'); await page.getByRole('button',{name:'Apply filters',exact:true}).click(); await page.getByText('From date cannot be later than To date.',{exact:true}).waitFor(); assert.equal(count(),before);
    await page.keyboard.press('Escape');
    await capture('160','#report-cash'); await capture('161','#report-inventory'); await capture('162','#report-breakdowns');
    await page.getByRole('button',{name:'Yearly',exact:true}).click(); await page.getByRole('list',{name:'Sales of Year for 2026',exact:true}).waitFor();
    await page.getByRole('button',{name:'Monthly',exact:true}).click();
    await page.getByText('View chart values',{exact:true}).click(); assert.ok(await page.locator('.report-chart-values table').isVisible()); await page.getByText('View chart values',{exact:true}).click();
    for (const label of ['Cash movement','Inventory & accounts','Sales trend','Breakdowns']) await page.getByRole('navigation',{name:'Report sections',exact:true}).getByRole('button',{name:label,exact:true}).click();
    await top(); fail = true; await pullToRefresh(page); await page.getByText('Could not refresh.',{exact:true}).waitFor(); await capture('156'); assert.ok(await page.getByText('2,340,000 MMK',{exact:true}).count());
    fail = false; await page.getByRole('button',{name:'Retry',exact:true}).click(); await page.getByText('Could not refresh.',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Filters',exact:true}).click(); await page.getByRole('radio',{name:'All time',exact:true}).click(); await page.getByRole('button',{name:'Apply filters',exact:true}).click(); await page.locator('dialog[open]').waitFor({state:'hidden'}); assert.ok(calls.some(c=>c.query==='?all_time=true'));
    await page.getByRole('button',{name:'Filters',exact:true}).click(); await page.getByRole('button',{name:'Reset',exact:true}).click(); await page.getByRole('button',{name:'Apply filters',exact:true}).click(); await page.locator('dialog[open]').waitFor({state:'hidden'});
    const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Export CSV',exact:true}).click(); assert.match((await download).suggestedFilename(),/^mkpos-report-.*\.csv$/); await page.getByText('Report CSV is ready to save or share.',{exact:true}).waitFor(); await page.getByRole('button',{name:'Dismiss message',exact:true}).click();
    await page.getByRole('button',{name:'Yearly',exact:true}).click(); await page.locator('#report-trends').evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'})); const retainedScroll = await page.evaluate(()=>scrollY); const requestsBeforeBack = count();
    assert.equal(await page.getByRole('button',{name:/^Back/}).count(),0); await page.getByRole('button',{name:'Products',exact:true}).click(); await page.waitForURL('**/products'); await page.goBack(); await page.getByRole('heading',{name:'Reports',exact:true}).waitFor(); assert.equal(count(),requestsBeforeBack); assert.equal(await page.getByRole('button',{name:'Yearly',exact:true}).getAttribute('aria-pressed'),'true');
    await page.waitForFunction(y=>Math.abs(scrollY-y)<3,retainedScroll);
    empty = true; await pullToRefresh(page); await page.getByRole('img',{name:'Paid 0%, Credit 0%',exact:true}).waitFor(); await top(); await page.screenshot({path:path.join(output,'empty.png')});
    empty = false; await pullToRefresh(page); await page.getByRole('img',{name:'Paid 87.9%, Credit 12.1%',exact:true}).waitFor();
    await page.getByRole('button',{name:'Open app menu',exact:true}).click(); await setDrawerLanguage(page, 'my'); await page.keyboard.press('Escape'); await top(); await page.screenshot({animations:'disabled',path:path.join(output,'myanmar-index.png')});
    await page.locator('main:visible .mobile-filter-toggle').click();
    for (const width of [393, 362, 320]) {
      await page.setViewportSize({ width, height: 817 });
      assert.ok(await page.locator('dialog[open] .mobile-filter-drawer-body').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      assert.ok(await page.locator('.date-range-choices > label').evaluateAll(nodes => nodes.every(n => n.clientWidth >= 240 && n.scrollWidth <= n.clientWidth)), 'Myanmar presets remain readable');
      await page.screenshot({animations:'disabled',path:path.join(output,`myanmar-drawer-${width}.png`)});
    }
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]); assert.ok(calls.every(c=>c.method==='GET'));
    await fs.writeFile(path.join(output,`checks-${engine}.json`),JSON.stringify({browser:engine,result:'Six references captured; responsive layout, filters, validation, refresh/retry, chart tabs, CSV, Back retention and Myanmar checked.',calls,errors},null,2));
    console.log(`Reports ${engine} checks passed.`);
  } catch(error) { await page.screenshot({path:path.join(output,`failure-${engine}.png`)}); await fs.writeFile(path.join(output,'failure.txt'),JSON.stringify(errors)+'\n'+await page.locator('body').innerText()); throw error; }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
