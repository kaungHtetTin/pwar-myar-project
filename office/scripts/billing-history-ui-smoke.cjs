// Isolated billing period UI checks using in-memory fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-billing-history-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'billing-history-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'billing-history-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="root"></div><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron'); await app.whenReady();
    const output = process.argv[3], win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { backgroundThrottling: false } });
    const js = code => win.webContents.executeJavaScript(code);
    const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(${expression})resolve();else if(Date.now()-start>5000)reject(new Error(${JSON.stringify(expression)}));else requestAnimationFrame(check);};check();})`);
    try {
      await win.loadFile(path.join(output, 'index.html')); await wait("!!document.querySelector('tbody tr')");
      for (const width of [1440, 900, 680]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const metrics = await js(`({table: document.querySelector('table').getBoundingClientRect().width, available: document.querySelector('.office-table-scroll').clientWidth, scroll: document.querySelector('.office-table-scroll').scrollWidth})`);
        assert.ok(metrics.table <= metrics.available + 1, JSON.stringify(metrics));
        assert.ok(metrics.scroll <= metrics.available + 1, 'No horizontal scrolling');
        await js("document.querySelector('.row-actions-trigger').click()"); await wait("!!document.querySelector('[role=menuitem]')"); await js("document.querySelector('[role=menuitem]').click()"); await wait("!!document.querySelector('[role=dialog]')");
        await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js("[...document.querySelectorAll('input')].every(input=>input.getBoundingClientRect().right<=innerWidth)"));
        fs.writeFileSync(path.join(output, `billing-edit-${width}.png`), (await win.webContents.capturePage()).toPNG());
        await js("[...document.querySelectorAll('button')].find(button=>button.textContent==='Cancel').click()"); await wait("!document.querySelector('form')");
      }
      assert.equal(await js('window.billingFixtureCalls.length'), 0, 'Cancel has no mutation');
      await js("document.querySelector('.row-actions-trigger').click()"); await wait("!!document.querySelector('[role=menuitem]')"); await js("document.querySelector('[role=menuitem]').click()"); await wait("!!document.querySelector('form')");
      await js("document.querySelector('button[type=submit]').click()"); await wait("!!document.querySelector('[role=status]')");
      assert.equal(await js('window.billingFixtureCalls.length'), 1, 'Save runs exactly once');
      console.log(`Billing history: 3 fitted table layouts, action menu, modal cancel and save passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
