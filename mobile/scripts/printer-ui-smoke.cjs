// Fallback visual QA in native Electron when the in-app browser is unavailable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function prepare() {
  const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-mobile-printer-qa-'));
  const { build } = await import('vite');
  const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: { '@capacitor/core': path.join(__dirname, 'printer-capacitor-fixture.js') } }, build: { write: false, lib: { entry: path.join(__dirname, 'printer-fixture.jsx'), formats: ['iife'], name: 'PrinterFixture' } } });
  const files = (Array.isArray(result) ? result[0] : result).output;
  const code = files.find(f => f.type === 'chunk').code;
  const css = files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n');
  fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><div id="root"></div><script>${code}</script></body></html>`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const electron = require('../../desktop/node_modules/electron');
  const child = require('node:child_process').spawn(electron, [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
async function native() {
  const { app, BrowserWindow } = require('electron');
  await app.whenReady();
  const output = process.argv[3];
  const win = new BrowserWindow({ show: false, width: 390, height: 844, useContentSize: true, webPreferences: { contextIsolation: true, sandbox: true } });
  try {
    await win.loadFile(path.join(output, 'index.html'));
    for (const width of [320, 390, 768]) for (const mode of ['system', 'tcp', 'bluetooth', 'preview-58mm', 'preview-80mm', 'preview-a4']) {
      win.setContentSize(width, 844);
      await win.webContents.executeJavaScript(`window.renderPrinter('${mode}')`);
      await new Promise(resolve => setTimeout(resolve, 200));
      const metrics = await win.webContents.executeJavaScript(`({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,height:b.getBoundingClientRect().height}))})`);
      assert.ok(metrics.scroll <= metrics.width, `Horizontal overflow ${mode}: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.buttons.every(b => b.height >= 44), `Touch targets ${mode}: ${JSON.stringify(metrics)}`);
      if (mode.startsWith('preview-')) {
        const receipt = await win.webContents.executeJavaScript(`(()=>{const f=document.querySelector('iframe');return {width:f.getBoundingClientRect().width,parent:f.parentElement.clientWidth,sandbox:f.getAttribute('sandbox'),end:f.srcdoc.includes('End of receipt')}})()`);
        assert.ok(receipt.width <= receipt.parent, `Receipt overflow ${width}/${mode}: ${JSON.stringify(receipt)}`);
        assert.equal(receipt.sandbox, ''); assert.ok(receipt.end);
      }
      fs.writeFileSync(path.join(output, `${mode}-${width}.png`), (await win.webContents.capturePage()).toPNG());
    }
    console.log(`Printer/receipt UI: all 18 layouts passed. Screenshots: ${output}`);
  } finally { win.destroy(); app.quit(); }
}
(process.argv.includes('--native') ? native() : prepare()).catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
