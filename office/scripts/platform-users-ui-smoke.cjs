// Isolated rendered UI checks. Customer data exists only in the fixture's memory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-customers-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'platform-users-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'platform-users-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="root"></div><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron'); await app.whenReady();
    const output = process.argv[3];
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { backgroundThrottling: false } });
    const js = code => win.webContents.executeJavaScript(code);
    const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(${expression})resolve();else if(Date.now()-start>5000)reject(new Error(${JSON.stringify('UI state timeout: ')}+${JSON.stringify(expression)}));else requestAnimationFrame(check);};check();})`);
    const click = label => js(`{const b=[...document.querySelectorAll('button')].find(b=>!b.closest('[hidden]') && b.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing button');b.click();}`);
    try {
      await win.loadFile(path.join(output, 'index.html')); await wait("document.querySelectorAll('tbody tr').length===2");
      for (const width of [1440, 1024, 390, 320]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'), `List overflow at ${width}`);
        const metrics = await js(`({ width: document.querySelector('td.office-action-column').getBoundingClientRect().width, position: getComputedStyle(document.querySelector('td.office-action-column')).position, controls: document.querySelectorAll('.office-table-pagination button').length, header: document.querySelector('th.office-action-column').textContent })`);
        assert.ok(Math.abs(metrics.width - 80) < 0.1, 'Global action column width');
        assert.equal(metrics.position, 'sticky', 'Global action column stays pinned');
        assert.equal(metrics.controls, 4, 'Shared footer has First, Previous, Next and Last');
        assert.equal(metrics.header, '', 'Shared action header stays visually empty');
        fs.writeFileSync(path.join(output, `list-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      win.setContentSize(1440, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await click('Filters'); await wait("!!document.querySelector('[role=dialog]')");
      await wait("document.querySelector('.mkpos-filter-drawer').getBoundingClientRect().right <= innerWidth + 1");
      assert.equal(await js("document.querySelectorAll('.office-drawer-filter-fields select').length"), 4);
      assert.equal(await js("document.querySelectorAll('.office-drawer-filter-fields input[type=date]').length"), 2);
      fs.writeFileSync(path.join(output, 'filters-1440.png'), (await win.webContents.capturePage()).toPNG());
      await js("document.querySelector('[aria-label=\"Close filters\"]').click()");
      await wait("!document.querySelector('[role=dialog]')");
      const initialCalls = await js('window.customerFixtureCalls.length');
      await click('New customer'); await wait("document.querySelector('h2')?.textContent==='Create customer account'");
      assert.ok(await js("document.querySelector('input[type=password]').required"));
      await click('Cancel'); await wait("!document.querySelector('.office-platform-users').hidden");
      assert.equal(await js('window.customerFixtureCalls.length'), initialCalls, 'Cancel must not fetch list');
      await js("document.querySelector('[aria-label=\"Actions for Aye Aye\"]').click()"); await wait("!!document.querySelector('[role=menu]')");
      await click('View / edit'); await wait("document.querySelector('input[type=email]')?.value==='aye@example.com'");
      for (const width of [1440, 390, 320]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'), `Form overflow at ${width}`);
        fs.writeFileSync(path.join(output, `edit-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      win.setContentSize(1440, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await click('Save customer'); await wait("document.body.textContent.includes('Customer account saved.') && !document.querySelector('[role=dialog]') && !document.querySelector('.office-platform-users').hidden");
      assert.equal(await js("window.customerFixtureCalls.filter(c=>c.method==='PUT').length"), 1);
      await js('window.emailSourceTable = document.querySelector("table")');
      const listCalls = await js(`window.customerFixtureCalls.filter(c=>c.path.startsWith('/office/platform-users?')).length`);
      await js("document.querySelector('[aria-label=\"Actions for Aye Aye\"]').click()"); await wait("!!document.querySelector('[role=menu]')");
      await click('Send email'); await wait("!!document.querySelector('.office-platform-email-form')");
      await click('Cancel');
      assert.equal(await js("window.customerFixtureCalls.filter(c=>c.path.endsWith('/email')).length"), 0);
      await js("document.querySelector('[aria-label=\"Actions for Aye Aye\"]').click()"); await wait("!!document.querySelector('[role=menu]')");
      await click('Send email'); await wait("!!document.querySelector('.office-platform-email-form')");
      await js(`{const values=[['input','An update from PwarMyar'],['textarea','Hello Aye Aye,\\nThank you for shopping with PwarMyar.']];for(const [tag,value] of values){const input=document.querySelector('.office-platform-email-form '+tag);Object.getOwnPropertyDescriptor(tag==='input'?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}}`);
      for (const width of [1440, 1024, 390]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'), `Email form overflow at ${width}`);
        fs.writeFileSync(path.join(output, `email-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      await click('Send email'); await wait("!document.querySelector('[role=dialog]') && document.body.textContent.includes('Email sent to aye@example.com.')");
      assert.equal(await js("window.customerFixtureCalls.filter(c=>c.path.endsWith('/email')).length"), 1);
      assert.equal(await js(`window.customerFixtureCalls.filter(c=>c.path.startsWith('/office/platform-users?')).length`), listCalls);
      assert.ok(await js('document.querySelector("table") === window.emailSourceTable'));
      win.setContentSize(1440, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await js("document.querySelector('[aria-label=\"Actions for Aye Aye\"]').click()"); await wait("!!document.querySelector('[role=menu]')");
      await click('Delete'); await wait("!!document.querySelector('[role=dialog]')"); await click('Cancel');
      assert.equal(await js("window.customerFixtureCalls.filter(c=>c.method==='DELETE').length"), 0);
      await js("document.querySelector('[aria-label=\"Actions for Aye Aye\"]').click()"); await wait("!!document.querySelector('[role=menu]')");
      await click('Delete'); await wait("!!document.querySelector('[role=dialog]')"); await click('Delete customer'); await wait("document.querySelectorAll('tbody tr').length===1");
      assert.equal(await js("window.customerFixtureCalls.filter(c=>c.method==='DELETE').length"), 1);
      const emailPreview = path.join(require('node:os').tmpdir(), 'mkpos-platform-user-email.html');
      if (fs.existsSync(emailPreview)) {
        win.setContentSize(640, 800); await win.loadFile(emailPreview);
        await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        fs.writeFileSync(path.join(output, 'customer-email-template.png'), (await win.webContents.capturePage()).toPNG());
      }
      console.log(`Customer UI: 7 layouts, create/cancel, edit/save, email cancel/send with retained table, and confirmed deletion passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
