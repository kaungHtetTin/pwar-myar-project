// Isolated Office fixture: all API calls and CSRF are intercepted; no real credentials or Telegram traffic.
const { chromium } = require('../shop/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const output = 'artifacts/telegram-office-settings';
  await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch();
  try {
    for (const [mode,width,height] of [['light',1440,900],['dark',1280,720],['light',1024,900],['light',390,844]]) {
      const page = await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
      const errors=[], calls=[];
      let failSave=true;
      let settings={enabled:false,token_configured:false,webhook_secret_configured:true,storage_ready:true,webhook_url:'',version:0,daily_limit:200,per_chat_daily_limit:20};
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(!['localhost','127.0.0.1'].includes(url.hostname)) return route.abort();
        if(url.pathname==='/sanctum/csrf-cookie') return route.fulfill({status:204});
        if(!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint=url.pathname.slice(4), method=request.method();
        calls.push({endpoint,method});
        let json={items:[],total:0,has_more:false,realtime_enabled:false,enabled:false};
        if(endpoint==='/office/auth/me') json={admin:{id:1,name:'Fixture reviewer',role:'super_admin'}};
        else if(endpoint==='/branding') json={theme_mode:mode,primary_color:'#087f74',theme_version:1};
        else if(endpoint==='/office/telegram-support') {
          if(method==='PUT') {
            if(failSave) {failSave=false;return route.fulfill({status:422,json:{message:'Fixture: please retry saving.'}});}
            const body=request.postDataJSON();
            settings={...settings,...body,token_configured:true,version:settings.version+1};
            delete settings.bot_token;
          }
          json={settings,message:method==='PUT'?'Telegram settings saved.':undefined};
        } else if(endpoint==='/office/telegram-support/groups') json={groups:[],total:0,page:1,per_page:25,last_page:1};
        else if(endpoint==='/office/telegram-support/test-connection') json={connection:{bot_username:'fixture_support_bot',webhook_status:'different',pending_updates:2},message:'Telegram connection verified.'};
        else if(endpoint==='/office/telegram-support/register-webhook') {
          assert.equal(request.postDataJSON().replace_existing,true);
          settings={...settings,version:settings.version+1,bot_username:'fixture_support_bot',last_registered_at:'2026-10-26 07:00:00'};
          json={settings,connection:{bot_username:'fixture_support_bot',webhook_status:'registered',pending_updates:2},message:'Telegram webhook registered.'};
        } else assert.equal(method,'GET',`Unexpected mutation: ${endpoint}`);
        return route.fulfill({json});
      });
      await page.goto('http://127.0.0.1:5175/#/settings/telegram-support');
      const token=page.getByLabel(/^Bot token/), limits=page.getByLabel('Daily AI requests per chat');
      await token.waitFor();
      const dimensions = await page.locator('.office-telegram-settings .office-management-form').first().evaluate(form => {
        const controls = [...form.querySelectorAll('input, select')].map(element => {
          const rect = element.getBoundingClientRect();
          return { label: element.getAttribute('aria-label') || element.closest('label')?.firstChild.textContent, top: rect.top, height: rect.height, width: rect.width };
        });
        return controls;
      });
      const service = dimensions.find(field => field.label === 'Telegram service status');
      const groups = dimensions.find(field => field.label === 'Group replies');
      const all = dimensions.find(field => field.label === 'Daily AI requests, all chats');
      const chat = dimensions.find(field => field.label === 'Daily AI requests per chat');
      assert.ok(Math.abs(service.top - groups.top) < 1, 'Status selects must align.');
      assert.ok(Math.abs(all.top - chat.top) < 1, 'Daily quota inputs must align.');
      assert.ok(dimensions.every(field => Math.abs(field.height - (width <= 600 ? 40 : 36)) < 1), 'Controls must have consistent heights.');
      assert.equal(await token.inputValue(),''); assert.equal(await token.getAttribute('type'),'password');
      await token.fill('123456:fixture_token_12345678901234567890'); await limits.fill('30');
      await page.getByLabel('Image reading', {exact:true}).selectOption('true');
      await page.getByLabel('Admin receipt notices', {exact:true}).selectOption('true');
      await page.getByLabel('Admin group chat ID', {exact:true}).fill('-100777');
      await page.getByLabel('Admin group topic ID', {exact:true}).fill('77');
      const sections=page.getByRole('navigation',{name:'Settings sections'});
      await sections.getByRole('button',{name:/Account/}).click();
      await page.goBack(); await token.waitFor(); assert.equal(await limits.inputValue(),'30');
      await page.goForward(); await sections.getByRole('button',{name:/Telegram customer service/}).click();
      assert.equal(calls.filter(call=>call.endpoint==='/office/telegram-support').length,1);
      assert.equal(await token.inputValue(),'123456:fixture_token_12345678901234567890');
      assert.equal(await page.getByLabel('Admin group chat ID', {exact:true}).inputValue(), '-100777');
      if(width>=1024) {
        await page.getByRole('button',{name:'Overview',exact:true}).click();
        await page.goBack();
        await token.waitFor();
        assert.equal(await limits.inputValue(),'30');
        assert.equal(calls.filter(call=>call.endpoint==='/office/telegram-support').length,1);
      }
      await page.getByRole('button',{name:'Test connection',exact:true}).click();
      await page.getByText('Telegram connection verified.',{exact:true}).waitFor();
      assert.equal(calls.filter(call=>call.method==='PUT').length,0);
      assert.ok(await page.getByRole('button',{name:'Register webhook',exact:true}).isDisabled());
      await page.getByLabel('Webhook URL').fill('https://example.test/integrations/telegram/customer-service');
      await page.getByLabel('Telegram service status').selectOption('true');
      await page.getByLabel('Webhook URL').press('Enter');
      await page.getByRole('alert').filter({hasText:'Fixture: please retry saving.'}).waitFor();
      assert.equal(calls.filter(call=>call.method==='PUT').length,1,'Enter submits once.');
      assert.ok(await token.inputValue()); assert.equal(await limits.inputValue(),'30');
      await page.getByRole('button',{name:'Save settings',exact:true}).click();
      await page.getByText('Telegram settings saved.',{exact:true}).waitFor();
      assert.equal(await token.inputValue(),'');
      assert.equal(calls.filter(call=>call.endpoint.endsWith('/register-webhook')).length,0);
      await page.getByLabel('Replace an existing webhook for this bot').check();
      await page.getByRole('button',{name:'Register webhook',exact:true}).click();
      await page.getByText('Telegram webhook registered.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:'Worker health'}).getAttribute('href'),'/api/health/workers');
      const leaked=await page.evaluate(()=>Object.values(localStorage).join('')+Object.values(sessionStorage).join(''));
      assert.ok(!leaked.includes('fixture_token'));
      await page.getByText('Keep the customer-service worker and scheduler running.',{exact:false}).scrollIntoViewIfNeeded();
      await page.screenshot({path:`${output}/${mode}-${width}-connection.png`,fullPage:true});
      await page.locator('.office-content').evaluate(element=>{element.scrollTop=0;});
      await page.screenshot({path:`${output}/${mode}-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({mode,width,height,aligned_fields:true,control_height:service.height,draft_back_retained:true,save_retry:true,explicit_test_and_registration:true,errors:errors.length}));
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
