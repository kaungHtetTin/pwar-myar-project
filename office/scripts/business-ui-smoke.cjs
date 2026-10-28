const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-office-business-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'business-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'business-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    fs.writeFileSync(path.join(output, 'index.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="root"></div><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
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
      for (const width of [1440, 1024, 390]) {
        win.setContentSize(width, 1000);
        await new Promise(resolve => setTimeout(resolve, 150));
        const metrics = await win.webContents.executeJavaScript(`({width: innerWidth, scroll: document.documentElement.scrollWidth, rows: document.querySelectorAll('tbody tr').length, apply: document.querySelector('button[type="submit"]')?.getBoundingClientRect().right})`);
        assert.ok(metrics.scroll <= metrics.width, JSON.stringify(metrics));
        assert.ok(metrics.apply <= metrics.width, 'Apply button must stay in view');
        assert.equal(metrics.rows, 25);
        fs.writeFileSync(path.join(output, `business-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      console.log(`Business layout: 3 widths passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
