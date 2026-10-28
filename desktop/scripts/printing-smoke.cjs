// Native Electron rendering QA. --emulator additionally submits one synthetic
// receipt to the local CrossEscPos listener. No sales or Windows queue are touched.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

async function prepare() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'mkpos-print-qa-'));
  const { build } = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/node_modules/vite/dist/node/index.js')));
  const result = await build({ configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { alias: { react: path.resolve(__dirname, '../../frontend/node_modules/react') } }, build: {
    write: false, minify: false, lib: { entry: path.join(__dirname, 'printing-fixture.mjs'), formats: ['es'] },
  } });
  const bundle = (Array.isArray(result) ? result[0] : result).output.find((item) => item.type === 'chunk');
  fs.writeFileSync(path.join(output, 'fixture.mjs'), bundle.code);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const { spawn } = require('node:child_process');
  const child = spawn(require('electron'), [__filename, '--native', output, ...(process.argv.includes('--emulator') ? ['--emulator'] : [])], { env, stdio: 'inherit', windowsHide: true });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}

async function native() {
  const { app, BrowserWindow } = require('electron');
  const output = process.argv[process.argv.indexOf('--native') + 1];
  app.setPath('userData', path.join(output, 'profile'));
  await app.whenReady();
  const fixture = await import(pathToFileURL(path.join(output, 'fixture.mjs')));
  const { createPrintService } = require('../printing.cjs');
  const owner = new BrowserWindow({ show: false, webPreferences: { sandbox: true, backgroundThrottling: false } });
  let captured;
  global.window = { mkposDesktop: { printReceipt: async (payload) => { captured = payload; return { ok: true }; } } };
  const logs = [];
  try {
    fs.writeFileSync(path.join(output, 'picker.html'), '<html><head><meta charset="utf-8"></head><body><script type="module">import { mountPrinterInput } from "./fixture.mjs"; mountPrinterInput();</script></body></html>');
    const picker = new BrowserWindow({ show: false, width: 1100, height: 650, webPreferences: { sandbox: true, backgroundThrottling: false } });
    await picker.loadFile(path.join(output, 'picker.html'));
    await picker.webContents.executeJavaScript(`(async () => {
      document.querySelector('[role="combobox"]').focus();
      document.querySelector('[role="combobox"]').click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    assert.equal(await picker.webContents.executeJavaScript('document.querySelectorAll(\'[role="option"]\').length'), 6);
    fs.writeFileSync(path.join(output, 'printer-picker.png'), (await picker.webContents.capturePage({}, { stayHidden: true, stayAwake: true })).toPNG());
    await picker.webContents.executeJavaScript(`(async () => {
      [...document.querySelectorAll('[role="option"]')].find(el => el.textContent.startsWith('escpos:')).click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    assert.equal(await picker.webContents.executeJavaScript('document.querySelector(\'[role="combobox"]\').value'), 'escpos://127.0.0.1:9100');
    picker.destroy();
    for (const connection of ['windows', 'tcp', 'bluetooth']) {
      const config = require('../printer-config.cjs').defaults();
      config.connection = connection;
      config.windows.printerName = 'Canon Office';
      config.bluetooth.port = 'COM5';
      fs.writeFileSync(path.join(output, 'settings.html'), `<html><head><meta charset="utf-8"></head><body><script type="module">import { mountPrinterSettings } from './fixture.mjs'; mountPrinterSettings(${JSON.stringify(config)});</script></body></html>`);
      const settingsWindow = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { sandbox: true, backgroundThrottling: false } });
      await settingsWindow.loadFile(path.join(output, 'settings.html'));
      await settingsWindow.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      assert.equal(await settingsWindow.webContents.executeJavaScript('document.querySelector("select").value'), connection);
      if (connection === 'windows') assert.equal(await settingsWindow.webContents.executeJavaScript(`(() => {
        const grid = document.querySelector('.printer-windows-options');
        const controls = [...grid.querySelectorAll('input[type=number], .settings-check-grid label')].map(el => el.getBoundingClientRect());
        return controls.length === 4 && controls.every(rect => Math.abs(rect.height - 48) < 1)
          && Math.abs(controls[0].top - controls[1].top) < 1 && Math.abs(controls[2].top - controls[3].top) < 1
          && controls[2].top > controls[0].bottom && Math.abs(controls[0].left - controls[2].left) < 1;
      })()`), true, 'Installed printer options form two aligned rows of equal-height controls');
      assert.equal(await settingsWindow.webContents.executeJavaScript('document.documentElement.scrollWidth > window.innerWidth + 1'), false);
      assert.equal(await settingsWindow.webContents.executeJavaScript('document.querySelector(".settings-panel").getBoundingClientRect().bottom <= innerHeight'), true, 'Settings remain inside window');
      const actionBounds = await settingsWindow.webContents.executeJavaScript(`(() => {
        const buttons = [...document.querySelectorAll('.printer-settings-save-actions button')].map(el => el.getBoundingClientRect());
        return buttons.map(rect => ({ top: rect.top, height: rect.height }));
      })()`);
      assert.ok(actionBounds.length === 2 && actionBounds.every(rect => Math.abs(rect.height - 36) < 1) && Math.abs(actionBounds[0].top - actionBounds[1].top) < 1, `Save and check buttons share standard height and alignment: ${JSON.stringify(actionBounds)}`);
      if (connection !== 'windows') assert.equal(await settingsWindow.webContents.executeJavaScript(`(() => {
        const row = document.querySelector('.printer-output-row');
        const copies = row.querySelector('input[type=number]').getBoundingClientRect();
        const cutter = row.querySelector('.settings-check-grid label').getBoundingClientRect();
        return Math.abs(copies.top - cutter.top) < 1 && Math.abs(copies.height - cutter.height) < 1;
      })()`), true, 'Copies and cutter align at equal height');
      assert.equal(await settingsWindow.webContents.executeJavaScript('[...document.querySelectorAll("input[type=checkbox]")].every(el => el.getBoundingClientRect().height <= 20 && el.getBoundingClientRect().width <= 20)'), true, 'Checkboxes remain compact');
      fs.writeFileSync(path.join(output, `printer-settings-${connection}.png`), (await settingsWindow.webContents.capturePage({}, { stayHidden: true, stayAwake: true })).toPNG());
      await settingsWindow.webContents.executeJavaScript(`(async () => {
        const panel = document.querySelector('.settings-panel-content');
        panel.scrollTop = panel.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()`);
      assert.equal(await settingsWindow.webContents.executeJavaScript('document.querySelector(".settings-panel-content").scrollWidth <= document.querySelector(".settings-panel-content").clientWidth + 1'), true, 'No clipped horizontal content');
      fs.writeFileSync(path.join(output, `printer-settings-${connection}-bottom.png`), (await settingsWindow.webContents.capturePage({}, { stayHidden: true, stayAwake: true })).toPNG());
      settingsWindow.destroy();
    }
    for (const scenario of [...['50mm', '58mm', '80mm', '85mm', 'a5', 'a4'].map((paper) => ({ paper })), { paper: '58mm', count: 150, label: '58mm-long' }]) {
      const { paper, count = 1, label = paper } = scenario;
      const receipt = fixture.offlineReceiptPayload({ id: 1, created_at: '2026-09-05T08:00:00Z', local_total: 999999999,
        payload: { items: Array.from({ length: count }, () => ({ product_name: 'Myanmar မြန်မာစာ စမ်းသပ်ရန် — long product name with wrapping', quantity: 1, unit_price: 999999999, price_type: 'Retail' })) },
      }, { shop_name: 'PwarMyar PRINT TEST', receipt_paper_size: paper });
      await fixture.printReceiptText(receipt.text, paper, { html: receipt.html, layout: receipt.layout });
      const win = new BrowserWindow({ show: false, width: 1000, height: 1000, webPreferences: { sandbox: true, backgroundThrottling: false } });
      await win.loadURL('data:text/html;base64,' + Buffer.from(captured.html).toString('base64'));
      const stats = await win.webContents.executeJavaScript(`(async () => {
        await document.fonts.ready;
        const shell = document.querySelector('.receipt-shell');
        return { width: shell.getBoundingClientRect().width, height: shell.getBoundingClientRect().height,
          overflow: [...document.querySelectorAll('.receipt-row, .receipt-item-name')].some(el => el.scrollWidth > el.clientWidth + 1),
          loadedFonts: [...document.fonts].filter(f => f.status === 'loaded').length,
          invalidSizeAccepted: CSS.supports('size', '58mm auto') };
      })()`);
      const mm = paper === 'a4' ? 210 : paper === 'a5' ? 148 : Number.parseInt(paper);
      assert.ok(Math.abs(stats.width - mm * 96 / 25.4) < 1, `${paper} width`);
      assert.equal(stats.overflow, false, `${paper} overflow`);
      assert.ok(stats.loadedFonts >= 2, `${paper} bundled fonts`);
      assert.equal(stats.invalidSizeAccepted, false);
      const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: paper === 'a4' ? 'A4' : paper === 'a5' ? 'A5' : { width: mm / 25.4, height: Math.min(1000, Math.max(30, stats.height * 25.4 / 96 + 1)) / 25.4 }, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
      if (count > 1) assert.ok(pages > 1, 'Long receipts paginate');
      fs.writeFileSync(path.join(output, `${label}.pdf`), pdf);
      const screenshot = await win.webContents.capturePage({ x: 0, y: 0, width: Math.ceil(stats.width), height: Math.min(1000, Math.ceil(stats.height)) }, { stayHidden: true, stayAwake: true });
      fs.writeFileSync(path.join(output, `${label}.png`), screenshot.toPNG());
      logs.push({ paper: label, ...stats, pages, pdfBytes: pdf.length });
      win.destroy();
      if (paper === '80mm' || paper === 'a5' || paper === 'a4') {
        for (const printerName of ['Microsoft Print to PDF', 'Adobe PDF']) {
          const pdfService = createPrintService({ BrowserWindow, getMainWindow: () => owner,
            savePdf: async (_owner, bytes) => {
              assert.ok(bytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
              const media = bytes.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
              assert.ok(media, 'PDF media box exists');
              assert.ok(Math.abs(Number(media[1]) - mm * 72 / 25.4) < 1, 'PDF retains selected paper width');
              fs.writeFileSync(path.join(output, `${printerName.replaceAll(' ', '-')}-${paper}.pdf`), bytes);
              return true;
            },
          });
          const result = await pdfService({ ...captured, printerName });
          assert.equal(result.status, 'saved');
          assert.equal(result.mode, 'pdf');
          logs.push({ printerName, paper, status: result.status });
        }
      }
    }
    // Capture a long receipt through the real raster service into an isolated
    // loopback listener, checking that the bottom of the image was not clipped.
    const net = require('node:net');
    // Exercise Bluetooth routing with real rendering and encoding, but an injected
    // serial transport: no physical Bluetooth printer is present in this workspace.
    const longReceiptPayload = captured;
    let serialBytes;
    const bluetoothConfig = require('../printer-config.cjs').defaults();
    bluetoothConfig.connection = 'bluetooth'; bluetoothConfig.bluetooth.port = 'COM5';
    bluetoothConfig.thermal.imageMode = 'column'; bluetoothConfig.thermal.widthDots = 384;
    const serialPrint = createPrintService({ BrowserWindow, getMainWindow: () => owner,
      sendSerialBytes: async (config, bytes) => { assert.equal(config.bluetooth.port, 'COM5'); serialBytes = bytes; },
    });
    const sample = fixture.offlineReceiptPayload({ id: 0, is_sample: true, payload: { items: [{ product_name: 'Bluetooth routing test', quantity: 1, unit_price: 1000 }] } }, { receipt_paper_size: '58mm' });
    await fixture.printReceiptText(sample.text, '58mm', { html: sample.html, layout: sample.layout });
    assert.equal((await serialPrint({ ...captured, printerConfig: bluetoothConfig })).mode, 'bluetooth');
    assert.ok(serialBytes.includes(Buffer.from([0x1b, 0x2a, 33])));
    assert.equal(serialBytes.includes(Buffer.from([0x1d, 0x56])), false);
    console.log('Bluetooth raster routing passed (mock serial transport).');
    captured = longReceiptPayload;
    let rasterBytes = Buffer.alloc(0);
    const listener = net.createServer((socket) => socket.on('data', (chunk) => { rasterBytes = Buffer.concat([rasterBytes, chunk]); }));
    await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
    try {
      const print = createPrintService({ BrowserWindow, getMainWindow: () => owner });
      await print({ ...captured, printerName: `escpos://127.0.0.1:${listener.address().port}` });
      let offset = 2;
      const rasterData = [];
      let totalRows = 0;
      while (rasterBytes[offset] === 0x1d && rasterBytes[offset + 1] === 0x76) {
        const rowBytes = rasterBytes.readUInt16LE(offset + 4);
        const rows = rasterBytes.readUInt16LE(offset + 6);
        rasterData.push(rasterBytes.subarray(offset + 8, offset + 8 + rowBytes * rows));
        totalRows += rows;
        offset += 8 + rowBytes * rows;
      }
      assert.ok(totalRows > 10000, 'Long emulator receipt retains its complete height');
      assert.ok(Buffer.concat(rasterData).subarray(-4800).some((byte) => byte !== 0), 'Receipt footer survives long raster capture');
      console.log('Long ESC/POS raster passed:', totalRows, 'rows');
    } finally { await new Promise((resolve) => listener.close(resolve)); }
    // Verify the actual service's raster path against the user's emulator.
    if (process.argv.includes('--emulator')) {
      const print = createPrintService({ BrowserWindow, getMainWindow: () => owner, log: (level, message, details) => console.log(level, message, JSON.stringify(details)), versions: process.versions });
      const receipt = fixture.offlineReceiptPayload({ id: 0, is_sample: true, created_at: new Date().toISOString(), local_total: 1000,
        payload: { items: [{ product_name: 'Emulator test — မြန်မာစာ စမ်းသပ်ရန်', quantity: 1, unit_price: 1000, price_type: 'Retail' }] },
      }, { shop_name: 'PwarMyar 0.2.4 PRINT TEST', receipt_paper_size: '80mm' });
      await fixture.printReceiptText(receipt.text, '80mm', { html: receipt.html, layout: receipt.layout });
      assert.equal((await print({ ...captured, printerName: 'escpos://127.0.0.1:9100' })).status, 'submitted');
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(logs, null, 2));
    console.log('PRINT QA PASSED', JSON.stringify(logs));
    console.log('Artifacts:', output);
  } finally { owner.destroy(); app.quit(); }
}

(process.versions.electron ? native() : prepare()).catch((error) => {
  console.error(error);
  if (process.versions.electron) require('electron').app.exit(1);
  else process.exitCode = 1;
});
