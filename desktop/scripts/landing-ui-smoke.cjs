// Public landing-page layout QA; no account or business data is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
if (!process.argv.includes('--native')) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = require('node:child_process').spawn(require('electron'), [__filename, '--native'], { env, stdio: 'inherit', windowsHide: true });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  const { app, BrowserWindow } = require('electron');
  app.whenReady().then(async () => {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-landing-qa-'));
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { sandbox: true, contextIsolation: true } });
    try {
      await win.loadURL(process.env.MKPOS_LANDING_URL || 'http://127.0.0.1:8000/');
      for (const width of [1440, 1024, 768, 390, 320]) {
        win.setContentSize(width, 1000);
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await win.webContents.executeJavaScript(`(() => {
          const links = [...document.querySelectorAll('a[href^="#"]')];
          return { width: innerWidth, scroll: document.documentElement.scrollWidth,
            missing: links.filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash),
            docs: document.querySelectorAll('.guide-link').length,
            columns: getComputedStyle(document.querySelector('.feature-grid')).gridTemplateColumns.split(' ').length };
        })()`);
        assert.ok(result.scroll <= result.width, JSON.stringify(result));
        assert.deepEqual(result.missing, []);
        assert.equal(result.docs, 6);
        const density = await win.webContents.executeJavaScript(`(() => {
          const card = document.querySelector('.guide-link');
          return { padding: parseFloat(getComputedStyle(card).paddingTop),
            title: parseFloat(getComputedStyle(card.querySelector('h3')).fontSize),
            columns: getComputedStyle(document.querySelector('.docs-grid')).gridTemplateColumns.split(' ').length };
        })()`);
        assert.equal(density.padding, 12);
        assert.equal(density.title, 15);
        assert.equal(density.columns, width > 1050 ? 3 : width > 760 ? 2 : 1);
        assert.equal(result.columns, width > 1050 ? 3 : width > 760 ? 2 : 1);
        await win.webContents.executeJavaScript('window.scrollTo({top:0,behavior:"instant"})');
        fs.writeFileSync(path.join(output, `home-${width}.png`), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript('document.querySelector("#documentation").scrollIntoView({behavior:"instant"})');
        fs.writeFileSync(path.join(output, `docs-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
      await win.loadURL(new URL('documentation', process.env.MKPOS_LANDING_URL || 'http://127.0.0.1:8000/').href);
      const topics = await win.webContents.executeJavaScript('[...document.querySelectorAll(".guide-link")].map(a => "documentation/" + new URL(a.href).pathname.split("/").pop())');
      assert.equal(topics.length, 16);
      for (const page of ['documentation', ...topics, 'plans', 'tutorials']) {
        await win.loadURL(new URL(page, process.env.MKPOS_LANDING_URL || 'http://127.0.0.1:8000/').href);
        for (const width of [1440, 390, 320]) {
          win.setContentSize(width, 1000);
          await new Promise(resolve => setTimeout(resolve, 100));
          const fits = await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth');
          assert.ok(fits, `Overflow: ${page} at ${width}`);
          const active = await win.webContents.executeJavaScript('[...document.querySelectorAll(".desktop-nav a[aria-current], .mobile-nav a[aria-current]")].map(a => a.textContent)');
          const activeLabel = page === 'plans' ? 'Plans' : page === 'tutorials' ? 'Tutorials' : 'Documentation';
          assert.deepEqual(active, [activeLabel, activeLabel]);
          if (page.startsWith('documentation/')) {
            const toc = await win.webContents.executeJavaScript(`(() => {
              const links = [...document.querySelectorAll('.manual-contents a')];
              const headings = [...document.querySelectorAll('.manual-chapter h2[id]')];
              return { count: links.length, headings: headings.length,
                missing: links.filter(a => !document.getElementById(a.hash.slice(1))).length,
                overflow: [...document.querySelectorAll('.manual-chapter p, .manual-chapter li')].some(e => e.scrollWidth > e.clientWidth + 1) };
            })()`);
            assert.ok(toc.count >= 4, `Incomplete contents: ${page}`);
            assert.equal(toc.count, toc.headings);
            assert.equal(toc.missing, 0);
            assert.equal(toc.overflow, false, `Text overflow: ${page}/${width}`);
          }
          fs.writeFileSync(path.join(output, `${page.replaceAll('/', '-')}-${width}.png`), (await win.webContents.capturePage()).toPNG());
        }
      }
      console.log(`Landing QA: ${5 + (topics.length + 3) * 3} responsive layouts passed. Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }).catch(error => { console.error(error); app.exit(1); });
}
