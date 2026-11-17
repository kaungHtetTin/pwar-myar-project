const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-business-owner-email-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'business-owner-email-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'navigation-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron');
    await app.whenReady();
    const output = process.argv[3];
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true });
    try {
      await win.loadFile(path.join(output, 'index.html'));
      const js = code => win.webContents.executeJavaScript(code);
      const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(${expression})resolve();else if(Date.now()-start>7000)reject(new Error(${JSON.stringify(expression)}));else requestAnimationFrame(check);};check();})`);
      const painted = () => js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const click = label => js(`([...document.querySelectorAll('button')].find(el=>!el.closest('[hidden]') && el.textContent.trim()===${JSON.stringify(label)})).click()`);
      const fill = async () => { await js(`{for(const [tag,value] of [['input','Business update'],['textarea','Hello owner. Thank you for using PwarMyar.']]){const input=document.querySelector('.office-platform-email-form '+tag);Object.getOwnPropertyDescriptor(tag==='input'?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}}`); };
      await wait(`!!document.querySelector('button[aria-label="Collapse navigation"]')`);
      await click('Businesses'); await wait(`!!document.querySelector('.office-business-table tbody tr')`);
      await js(`window.originalBusinesses = document.querySelector('.office-business-table')`);
      const listCalls = await js(`window.ownerEmailCalls.filter(call=>call.path.startsWith('/office/businesses?')).length`);
      const menu = async label => { await js(`document.querySelector('button[aria-label="Actions for Demo Shop 01"]').click()`); await wait(`!!document.querySelector('[role=menu]')`); await click(label); };
      await menu('Send email'); await wait(`!!document.querySelector('[role=dialog]')`); await click('Cancel');
      await menu('Send email'); await wait(`!!document.querySelector('[role=dialog]')`); await fill();
      for (const width of [1440, 1100]) { win.setContentSize(width, 1000); await painted(); assert.ok(await js('document.documentElement.scrollWidth<=innerWidth')); fs.writeFileSync(path.join(output, `business-owner-email-${width}.png`), (await win.webContents.capturePage()).toPNG()); }
      await click('Send email'); await wait(`!document.querySelector('[role=dialog]')`);
      assert.equal(await js(`window.ownerEmailCalls.filter(call=>call.path.endsWith('/email')).length`), 1);
      assert.ok(await js(`document.querySelector('.office-business-table') === window.originalBusinesses`));
      await menu('View business'); await wait(`!!document.querySelector('.office-owner-card')`);
      const card = await js(`window.ownerCard = document.querySelector('.office-owner-card'); window.ownerEmailCalls.filter(call=>call.path==='/office/businesses/11').length`);
      await click('Email owner'); await wait(`!!document.querySelector('[role=dialog]')`); await fill(); await painted();
      fs.writeFileSync(path.join(output, 'business-detail-email.png'), (await win.webContents.capturePage()).toPNG());
      await click('Send email'); await wait(`!document.querySelector('[role=dialog]')`);
      assert.equal(await js(`window.ownerEmailCalls.filter(call=>call.path.endsWith('/email')).length`), 2);
      assert.equal(await js(`window.ownerEmailCalls.filter(call=>call.path==='/office/businesses/11').length`), card);
      assert.ok(await js(`document.querySelector('.office-owner-card') === window.ownerCard`));
      await js('window.history.back()'); await wait(`!!document.querySelector('button[aria-label="Actions for Demo Shop 01"]:not([hidden])') && !document.querySelector('.office-business-table').closest('[hidden]')`);
      assert.equal(await js(`window.ownerEmailCalls.filter(call=>call.path.startsWith('/office/businesses?')).length`), listCalls);
      console.log(`Business owner email: list and detail sends, cancellation, retained source/Back and two widths passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
