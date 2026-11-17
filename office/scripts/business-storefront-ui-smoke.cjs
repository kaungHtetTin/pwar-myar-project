// Isolated storefront UI checks using in-memory fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-business-storefront-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'business-storefront-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'business-storefront-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
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
      win.webContents.session.webRequest.onBeforeRequest({ urls: ['https://maps.google.com/*'] }, (_details, callback) => callback({ cancel: true }));
      await win.loadFile(path.join(output, 'index.html')); await wait("!!document.querySelector('textarea')");
      for (const width of [1440, 1100]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const metrics = await js(`({ left: document.querySelector('.office-shop-location').getBoundingClientRect().toJSON(), right: document.querySelector('.office-storefront-card').getBoundingClientRect().toJSON(), scroll: document.documentElement.scrollWidth, width: innerWidth })`);
        assert.ok(metrics.left.right <= metrics.right.left, 'GPS left and storefront right');
        assert.ok(metrics.scroll <= metrics.width, 'No horizontal overflow');
        fs.writeFileSync(path.join(output, `storefront-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      await js(`const input=document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Policy review'); input.dispatchEvent(new Event('input',{bubbles:true}));`);
      await js("document.querySelector('button[type=submit]').click()"); await wait("!!document.querySelector('[role=status]')");
      assert.equal(await js('window.storefrontCalls.length'), 1);
      assert.ok(await js("document.querySelector('.office-storefront-card').textContent.includes('Restore marketplace visibility')"));
      assert.ok(await js("!!document.querySelector('a[href*=maps][target=_blank]')"));
      console.log(`Storefront: left/right layout, suspension save, restored action and map link passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
