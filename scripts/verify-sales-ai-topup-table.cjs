// Read-only visual fixture. All APIs are intercepted; no financial writes are permitted.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const proof = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64');
(async () => {
  const output = 'artifacts/sales-ai-topup-table'; await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch();
  try {
    for (const [mode,width] of [['light',1440],['dark',1280],['light',1024],['light',390]]) {
      const page = await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
      const errors=[], reads=[];
      page.on('pageerror', error=>errors.push(error.message));
      await page.route('**/api/**', async route=>{
        const request=route.request(),url=new URL(request.url());
        if(!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint=url.pathname.slice(4);
        assert.equal(request.method(),'GET','This visual fixture must never change financial data.');
        let json={items:[],total:0,has_more:false,realtime_enabled:false,enabled:false};
        if(endpoint==='/office/auth/me') json={admin:{id:1,name:'Fixture reviewer',role:'super_admin'}};
        else if(endpoint==='/branding') json={theme_mode:mode,primary_color:'#087f74',theme_version:1};
        else if(endpoint==='/office/sales-ai/topups') {
          reads.push(url.search);
          const status=url.searchParams.get('status');
          const statuses=status?[status]:['pending','approved','rejected','cancelled'];
          json={items:statuses.map((status,index)=>({id:index+147,business_id:11,business_name:index===1?'A longer business name for table layout verification':'Demo Shop 01',amount:index===1?'1234567.5':'30000',status,transaction_reference:'004314000892184310',created_at:'2026-10-25T15:44:10Z',version:1})),total:statuses.length,page:1,per_page:25,last_page:1};
        } else if(endpoint.endsWith('/screenshot')) return route.fulfill({contentType:'image/png',body:proof});
        await route.fulfill({json});
      });
      await page.goto('http://127.0.0.1:5175/#/ai/sales-topups');
      const table=page.getByRole('table',{name:'Sales AI top-ups',exact:true});
      await table.getByText('Demo Shop 01',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Filters',exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'Clear',exact:true}).click();
      await table.locator('tbody tr').nth(3).waitFor();
      const metrics=await table.evaluate(element=>({className:element.className,font:getComputedStyle(element.querySelector('td')).fontSize,
        actionWidth:element.querySelector('td.office-action-column').getBoundingClientRect().width,
        actionPosition:getComputedStyle(element.querySelector('td.office-action-column')).position,
        moneyAlign:getComputedStyle(element.querySelector('td.office-sales-ai-amount')).textAlign}));
      assert.ok(metrics.className.includes('office-data-table')); assert.equal(metrics.font,'12px');
      assert.equal(metrics.actionWidth,80); assert.equal(metrics.actionPosition,'sticky'); assert.equal(metrics.moneyAlign,'right');
      assert.ok(await table.evaluate(element=>element.getBoundingClientRect().width>=760),'Narrow viewports must scroll the table without squeezing its columns.');
      const beforeReads=reads.length;
      await table.getByRole('button',{name:'Actions for top-up 148',exact:true}).click();
      await page.getByRole('menuitem',{name:'View top-up',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Sales AI top-up #148'});
      await dialog.getByAltText('Top-up payment proof').waitFor();
      await dialog.getByRole('button',{name:'Close',exact:true}).click();
      assert.equal(reads.length,beforeReads,'Closing a detail must keep the mounted list.');
      await page.screenshot({path:`${output}/${mode}-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({mode,width,...metrics,review_close_keeps_list:true}));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
