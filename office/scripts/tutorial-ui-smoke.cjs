// Isolated layout QA. No real tutorials or business records are created.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-tutorial-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'tutorial-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'tutorial-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
    const files = (Array.isArray(result) ? result[0] : result).output;
    fs.writeFileSync(path.join(output, 'office.html'), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="root"></div><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    let publicHtml = require('node:child_process').execFileSync('C:/xampp/php/php.exe', [path.resolve(__dirname, '../../laravel/tests/Fixtures/tutorial-preview.php')], { encoding: 'utf8', windowsHide: true });
    publicHtml = publicHtml.replace(/<link rel="stylesheet"[^>]*>/g, '');
    const css = ['landing.css', 'guide.css', 'tutorials.css'].map(name => fs.readFileSync(path.resolve(__dirname, '../../laravel/public/landing', name), 'utf8')).join('\n');
    fs.writeFileSync(path.join(output, 'public.html'), publicHtml.replace('</head>', `<style>${css}</style></head>`));
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron');
    await app.whenReady();
    const output = process.argv[3];
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true });
    try {
      for (const mode of ['office', 'editor', 'public']) {
        await win.loadFile(path.join(output, mode === 'public' ? 'public.html' : 'office.html'));
        if (mode === 'editor') await win.webContents.executeJavaScript(`new Promise(resolve => { const check = () => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Add tutorial')); if (button) { button.click(); resolve(); } else requestAnimationFrame(check); }; check(); })`);
        for (const width of [1440, 1024, 390, 320]) {
          win.setContentSize(width, 1000);
          await new Promise(resolve => setTimeout(resolve, 150));
          const metrics = await win.webContents.executeJavaScript(`({width:innerWidth, scroll:document.documentElement.scrollWidth, rows:document.querySelectorAll('tbody tr').length, inputs:[...document.querySelectorAll('input,textarea')].every(e=>e.getBoundingClientRect().right<=innerWidth), cards:document.querySelectorAll('.tutorial-card').length})`);
          assert.ok(metrics.scroll <= metrics.width, `${mode}: ${JSON.stringify(metrics)}`);
          assert.ok(metrics.inputs, `Input overflow: ${mode}/${width}`);
          if (mode === 'office') assert.equal(metrics.rows, 2);
          if (mode === 'public') assert.equal(metrics.cards, 6);
          fs.writeFileSync(path.join(output, `${mode}-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
      }
      console.log(`Tutorial layout: 12 layouts passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
