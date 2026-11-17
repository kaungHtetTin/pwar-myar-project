// Isolated financial book UI checks using in-memory fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-financial-book-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'financial-book-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'financial-book-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
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
      await win.loadFile(path.join(output, 'index.html')); await wait("!!document.querySelector('tbody tr') && !document.querySelector('button.office-button-primary').disabled");
      for (const width of [1440, 1100]) {
        win.setContentSize(width, 1100); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js("document.documentElement.scrollWidth <= innerWidth"), 'No page overflow');
        assert.ok(await js("{ const [left, right] = [...document.querySelectorAll('.office-book-founder-column')].map(element => element.getBoundingClientRect()); left.right <= right.left + 1 && Math.abs(left.top - right.top) < 1 && Math.abs(left.width - right.width) < 1; }"), 'Two equal founder columns');
        assert.equal(Math.round(await js("document.querySelector('th.office-action-column').getBoundingClientRect().width")), 80);
        fs.writeFileSync(path.join(output, `financial-book-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      const click = text => js(`([...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}) || [...document.querySelectorAll('button')].find(button=>!button.closest('[hidden]') && button.textContent.trim()===${JSON.stringify(text)})).click()`);
      await click('New entry'); await wait("!!document.querySelector('[role=dialog]')");
      const fill = (label, value) => js(`{ const input=[...document.querySelectorAll('label')].find(label=>label.firstChild.textContent===${JSON.stringify(label)}).querySelector('input,textarea'); Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); }`);
      await fill('Description', 'Draft hosting expense');
      await click('Other section'); await click('Book section');
      assert.equal(await js("document.querySelector('textarea').value"), 'Draft hosting expense', 'Draft retained');
      await click('Cancel'); await wait("!document.querySelector('[role=dialog]')");
      assert.equal(await js("window.bookCalls.filter(call=>call.method).length"), 0);
      await click('New entry'); await wait("!!document.querySelector('textarea')");
      await fill('Description', 'New infrastructure expense'); await fill('Amount', '25000');
      await js(`{ const select=[...document.querySelectorAll('[role=dialog] label')].find(label=>label.firstChild.textContent==='Bank book').querySelector('select'); select.value='2'; select.dispatchEvent(new Event('change',{bubbles:true})); }`);
      await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      fs.writeFileSync(path.join(output, 'new-expense.png'), (await win.webContents.capturePage()).toPNG());
      await click('Save entry'); await wait("!document.querySelector('[role=dialog]') && !document.querySelector('button.office-button-primary').disabled");
      assert.equal(await js("window.bookCalls.filter(call=>call.method==='POST').length"), 1);
      await click('Transfer'); await wait("!!document.querySelector('[role=dialog]')");
      await js(`{ const select=[...document.querySelectorAll('[role=dialog] label')].find(label=>label.firstChild.textContent==='To bank book').querySelector('select'); select.value='3'; select.dispatchEvent(new Event('change',{bubbles:true})); }`);
      await fill('Description', 'Fund VISA'); await fill('Amount', '10000');
      await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      fs.writeFileSync(path.join(output, 'bank-transfer.png'), (await win.webContents.capturePage()).toPNG());
      await click('Record transfer'); await wait("!document.querySelector('[role=dialog]') && !document.querySelector('button.office-button-primary').disabled");
      assert.equal(await js("window.bookCalls.filter(call=>call.method==='POST').length"), 2);
      assert.ok(await js("document.querySelector('[aria-label=\"Bank book balances\"]').textContent.includes('10,000 Ks')"));
      await click('Allocate profit'); await wait("!!document.querySelector('[role=dialog]')");
      assert.ok(await js("document.querySelector('[role=dialog]').textContent.includes('Kaung Htet Tin: 50%')"));
      await js(`{ const select=[...document.querySelectorAll('[role=dialog] label')].find(label=>label.firstChild.textContent==='Bank book').querySelector('select'); select.value='3'; select.dispatchEvent(new Event('change',{bubbles:true})); }`);
      await fill('Description', 'Founder profit distribution'); await fill('Amount', '1000');
      await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      fs.writeFileSync(path.join(output, 'paid-profit-allocation.png'), (await win.webContents.capturePage()).toPNG());
      await click('Allocate profit'); await wait("!document.querySelector('[role=dialog]') && !document.querySelector('button.office-button-primary').disabled");
      assert.equal(await js("window.bookCalls.filter(call=>call.method==='POST').length"), 3);
      assert.ok(await js("document.querySelector('[aria-label=\"Bank book balances\"]').textContent.includes('9,000 Ks')"), 'Allocation deducts from VISA');
      await js("document.querySelector('.office-bank-books article button').click()"); await wait("!!document.querySelector('[role=dialog]')");
      await fill('Adjustment amount', '5000'); await fill('Reason / opening balance note', 'Funds held before bank-book tracking');
      assert.ok(await js("document.querySelector('.office-book-opening-preview').textContent.includes('5,000 Ks')"));
      await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      fs.writeFileSync(path.join(output, 'opening-adjustment.png'), (await win.webContents.capturePage()).toPNG());
      await click('Save opening adjustment'); await wait("!document.querySelector('[role=dialog]') && !document.querySelector('button.office-button-primary').disabled");
      assert.equal(await js("window.bookCalls.filter(call=>call.method==='POST').length"), 4);
      assert.ok(await js("document.querySelector('.office-bank-books article').textContent.includes('5,000 Ks')"));
      await click('Filters'); await wait("!!document.querySelector('[role=dialog] select')");
      await js(`{ const select=[...document.querySelectorAll('[role=dialog] label')].find(label=>label.firstChild.textContent==='Entry type').querySelector('select'); select.value='expense'; select.dispatchEvent(new Event('change',{bubbles:true})); }`);
      await click('Apply filters'); await wait("window.bookCalls.at(-1).path.includes('type=expense') && !document.querySelector('button.office-button-primary').disabled");
      await js("document.querySelector('tbody .row-actions-trigger').click()"); await wait("!!document.querySelector('[role=menuitem]')");
      await click('View entry'); await wait("!!document.querySelector('[role=dialog]')");
      assert.ok(await js("document.querySelector('[role=dialog]').textContent.includes('Recorded by')")); await click('Close');
      console.log(`Financial book: shared action column, two desktop widths, retained draft, cancel, save, transfer, allocation, opening adjustment, filters and entry details passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
