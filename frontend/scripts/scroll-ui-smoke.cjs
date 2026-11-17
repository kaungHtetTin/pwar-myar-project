const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-web-scroll-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, build: { write: false, lib: { entry: path.join(__dirname, '../src/main.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    const fixture = fs.readFileSync(path.join(__dirname, 'desktop-ui-smoke.py'), 'utf8').split('fixture = r"""')[1].split('"""')[0].replace('length:12', 'length:50').replace('total:12', 'total:50');
    fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="root"></div><script>${fixture}</script><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron');
    await app.whenReady();
    const output = process.argv[3];
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { backgroundThrottling: false } });
    try {
      await win.loadFile(path.join(output, 'index.html'));
      const js = code => win.webContents.executeJavaScript(code);
      const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(${expression})resolve();else if(Date.now()-start>8000)reject(new Error(${JSON.stringify(expression)}));else setTimeout(poll,30);};poll();})`);
      const select = async label => { await js(`document.querySelector('.sidebar nav button[title="${label}"]').click()`); await wait(`document.querySelector('.workspace-page-heading h1')?.textContent === '${label}' && !document.querySelector('.module-view:not([hidden]) .table-loading-state')`); };
      win.setContentSize(1280, 720);
      await wait(`!!document.querySelector('.product-data-table tbody tr')`);
      console.log('Product layout:', await js(`JSON.stringify({ document: document.documentElement.scrollHeight, viewport: innerHeight, layout: document.querySelector('.products-layout').clientHeight, content: document.querySelector('.products-layout').scrollHeight, overflow: getComputedStyle(document.querySelector('.products-layout')).overflowY })`));
      assert.equal(await js(`getComputedStyle(document.querySelector('.products-layout')).overflowY`), 'visible', 'Product screen must grow with its rows');
      await js(`window.productTable = document.querySelector('.product-data-table'); window.scrollTo(0, 0)`);
      win.webContents.debugger.attach('1.3');
      await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 550, deltaX: 0, deltaY: 650 });
      await wait(`window.scrollY > 100`);
      const offset = await js('window.scrollY');
      await select('Customers'); await select('Products');
      await wait(`Math.abs(window.scrollY - ${offset}) < 2`);
      assert.ok(await js(`window.productTable === document.querySelector('.product-data-table')`), 'Products remains mounted on return');
      await js(`window.scrollTo(0, document.documentElement.scrollHeight)`);
      await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.ok(await js(`document.querySelector('.product-table-footer').getBoundingClientRect().bottom <= innerHeight + 1`), 'Products footer is reachable');
      assert.ok(await js(`document.querySelector('.product-data-table tbody tr:last-child').getBoundingClientRect().bottom <= innerHeight + 1`), 'Final product row is reachable');
      fs.writeFileSync(path.join(output, 'products-bottom.png'), (await win.webContents.capturePage()).toPNG());
      for (const [label, selector] of [['Customers','.customers-layout'], ['Suppliers','.suppliers-layout'], ['Purchases','.purchases-layout'], ['Expenses','.expenses-layout'], ['Transactions','.transactions-layout'], ['Reports','.reports-layout'], ['Billing','.billing-screen'], ['Settings','.settings-screen'], ['Access','.access-screen']]) {
        await select(label);
        await wait(`!!document.querySelector('.module-view:not([hidden]) ${selector}')`);
        assert.equal(await js(`getComputedStyle(document.querySelector('.module-view:not([hidden]) ${selector}')).overflowY`), 'visible', `${label} uses document scrolling`);
      }
      await js(`document.querySelector('.sidebar nav button[title="Sell"]').click()`); await wait(`document.body.classList.contains('pos-sell-active')`);
      assert.equal(await js(`getComputedStyle(document.body).overflowY`), 'hidden', 'POS remains bounded');
      await select('Products'); await wait(`!document.body.classList.contains('pos-sell-active')`);
      assert.equal(await js(`getComputedStyle(document.querySelector('.products-layout')).overflowY`), 'visible');
      console.log(`Web scroll checks passed: Products wheel, retained scroll/table, 10 page layouts, POS switch. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
