// Isolated report review QA; all report changes stay in the fixture's memory.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-report-review-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'report-review-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'report-review-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
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
      await js("window.sourceTable = document.querySelector('table'); document.querySelector('[aria-label=\"Actions for report 7\"]').click()");
      await wait("!!document.querySelector('[role=menu]')"); await js("document.querySelector('[role=menuitem]').click()");
      await wait("!!document.querySelector('[role=dialog] textarea')");
      for (const width of [1440, 1024, 390, 320]) {
        win.setContentSize(width, 1000); await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'), `Page overflow at ${width}`);
        assert.ok(await js("document.querySelector('[role=dialog]').scrollWidth<=document.querySelector('[role=dialog]').clientWidth"), `Modal overflow at ${width}`);
        assert.ok(await js("document.querySelector('.office-modal-footer').getBoundingClientRect().bottom<=innerHeight"), 'Footer remains visible');
        assert.ok(await js('window.sourceTable === document.querySelector("table")'), 'List remains mounted');
        fs.writeFileSync(path.join(output, `review-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      await js("document.querySelector('[aria-label=\"Close report review\"]').click()");
      await wait("!document.querySelector('[role=dialog]:not([hidden] [role=dialog])')");
      assert.equal(await js("window.reportFixtureCalls.filter(call=>call.path.includes('?')).length"), 1, 'Closing does not fetch list');
      console.log(`Report review: 4 modal layouts and retained-list close passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
