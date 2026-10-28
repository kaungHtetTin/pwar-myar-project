const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-office-navigation-qa-'));
    const { build } = await import('vite');
    const result = await build({ configFile: false, root: path.resolve(__dirname, '..'), logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: './api', replacement: path.join(__dirname, 'navigation-api-fixture.js') }] }, build: { write: false, lib: { entry: path.join(__dirname, 'navigation-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
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
      await new Promise(resolve => setTimeout(resolve, 250));
      for (const height of [900, 600]) {
        win.setContentSize(1280, height);
        await new Promise(resolve => setTimeout(resolve, 100));
        const metrics = await js(`({ headings: [...document.querySelectorAll('.office-nav-group > p')].filter(el => getComputedStyle(el).display !== 'none').length, overflow: document.documentElement.scrollWidth > innerWidth, navHeight: document.querySelector('.office-sidebar nav').clientHeight, navScroll: document.querySelector('.office-sidebar nav').scrollHeight, color: getComputedStyle(document.querySelector('.office-sidebar nav')).scrollbarColor })`);
        assert.equal(metrics.headings, 5); assert.equal(metrics.overflow, false);
        assert.equal(metrics.color, 'rgb(128, 169, 154) rgba(0, 0, 0, 0)');
        if (height === 600) assert.ok(metrics.navScroll > metrics.navHeight, 'Short window scrolls navigation');
        await js(`document.querySelector('.office-sidebar nav').scrollTop = 10000`);
        fs.writeFileSync(path.join(output, `navigation-${height}.png`), (await win.webContents.capturePage()).toPNG());
      }
      await js(`document.querySelector('button[aria-label="Collapse navigation"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal(await js(`getComputedStyle(document.querySelector('.office-nav-group > p')).display`), 'none');
      assert.ok(await js(`document.querySelector('.office-shell').classList.contains('office-nav-collapsed')`));
      fs.writeFileSync(path.join(output, 'navigation-collapsed.png'), (await win.webContents.capturePage()).toPNG());
      await js(`document.querySelector('button[aria-label="Expand navigation"]').click()`);
      console.log(`Office grouped navigation: headings, short-window scrolling, scrollbar colors, collapse/expand passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
