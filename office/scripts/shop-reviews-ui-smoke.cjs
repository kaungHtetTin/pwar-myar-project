// Isolated rendered CRUD checks. All requests use in-memory fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
 if (!process.argv.includes('--native')) {
  const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-shop-reviews-qa-'));
  const { build } = await import('vite');
  const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'shop-reviews-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'shop-reviews-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
  const files = (Array.isArray(result) ? result[0] : result).output;
  fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(file => file.fileName.endsWith('.css')).map(file => file.source).join('\n')}</style></head><body><div id="root"></div><script>${files.find(file => file.type === 'chunk').code}</script></body></html>`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
  child.on('exit', code => { process.exitCode = code ?? 1; });
 } else {
  const { app, BrowserWindow } = require('electron'); await app.whenReady();
  const output = process.argv[3], win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { backgroundThrottling: false } });
  const js = code => win.webContents.executeJavaScript(code);
  const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(${expression})resolve();else if(Date.now()-start>5000)reject(new Error(${JSON.stringify(expression)}));else requestAnimationFrame(check);};check();})`);
  const painted = () => js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const click = text => js(`([...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}) || [...document.querySelectorAll('button')].find(button=>!button.closest('[hidden]') && button.textContent.trim()===${JSON.stringify(text)})).click()`);
  const change = (label, value) => js(`{ const input=[...document.querySelectorAll('[role=dialog] label')].find(label=>label.firstChild.textContent===${JSON.stringify(label)}).querySelector('input,textarea,select'); if(input.tagName==='SELECT'){input.value=${JSON.stringify(value)}; input.dispatchEvent(new Event('change',{bubbles:true}));} else {Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true}));} }`);
  try {
   await win.loadFile(path.join(output, 'index.html')); await wait("!!document.querySelector('tbody tr') && !document.querySelector('button.office-button-primary').disabled");
   await js('window.sourceReviewTable = document.querySelector("table")');
   for (const width of [1440, 1100]) {
    win.setContentSize(width, 1000); await painted();
    assert.ok(await js('document.documentElement.scrollWidth <= innerWidth'), 'No page overflow');
    assert.equal(Math.round(await js("document.querySelector('th.office-action-column').getBoundingClientRect().width")), 80);
    fs.writeFileSync(path.join(output, `shop-reviews-${width}.png`), (await win.webContents.capturePage()).toPNG());
   }
   await click('New review'); await wait("!!document.querySelector('option[value=\"11\"]')"); await change('Shop', '11');
   await wait("!!document.querySelector('option[value=\"99\"]')"); await change('Customer', '99');
   await change('Rating', '5'); await change('Customer comment', 'Created in Office'); await painted();
   fs.writeFileSync(path.join(output, 'new-shop-review.png'), (await win.webContents.capturePage()).toPNG());
   await click('Save review'); await wait("!document.querySelector('[role=dialog]') && document.querySelector('tbody').textContent.includes('Created in Office') && !document.querySelector('button.office-button-primary').disabled");
   assert.equal(await js("window.reviewCalls.filter(call=>call.method==='POST').length"), 1);
   const menu = async text => { await js("document.querySelector('button[aria-label=\"Actions for shop review 100\"]').click()"); await wait("!!document.querySelector('[role=menuitem]')"); await click(text); await wait("!!document.querySelector('[role=dialog]')"); };
   await menu('View review'); assert.ok(await js("document.querySelector('[role=dialog]').textContent.includes('Created in Office')")); await click('Close');
   await menu('Edit review'); await change('Customer comment', 'Retained review draft');
   const before = await js("window.reviewCalls.filter(call=>call.path.startsWith('/office/shop-reviews?')).length");
   await click('Other section'); await click('Reviews section');
   assert.equal(await js("document.querySelector('textarea').value"), 'Retained review draft');
   assert.equal(await js("window.reviewCalls.filter(call=>call.path.startsWith('/office/shop-reviews?')).length"), before);
   await click('Cancel'); await menu('Edit review'); await change('Customer comment', 'Edited in Office'); await change('Seller reply', 'Thank you for the review.');
   await click('Save review'); await wait("!document.querySelector('[role=dialog]') && document.querySelector('tbody').textContent.includes('Edited in Office') && !document.querySelector('button.office-button-primary').disabled");
   assert.equal(await js("window.reviewCalls.filter(call=>call.method==='PUT').length"), 1);
   await menu('Delete review'); await click('Cancel'); assert.equal(await js("window.reviewCalls.filter(call=>call.method==='DELETE').length"), 0);
   await menu('Delete review'); await click('Delete review'); await wait("!document.querySelector('[role=dialog]') && !document.querySelector('button.office-button-primary').disabled");
   assert.equal(await js("window.reviewCalls.filter(call=>call.method==='DELETE').length"), 1);
   assert.ok(await js('document.querySelector("table") === window.sourceReviewTable'), 'Table remains mounted through CRUD');
   await click('Filters'); await wait("!!document.querySelector('[role=dialog]')"); await change('Rating', '4'); await change('Reply status', 'unreplied');
   await click('Apply filters'); await wait("window.reviewCalls.some(call=>call.path.includes('rating=4')) && !document.querySelector('button.office-button-primary').disabled");
   console.log(`Shop reviews: two desktop widths, shared action column, CRUD, cancel, filters and retained draft passed. Screenshots: ${output}`);
  } finally { win.destroy(); app.quit(); }
 }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
