const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { dialogPrintOptions, printerNames, resolvePrinter, createPrintService } = require('../printing.cjs');

test('printing selects the requested printer and bounded explicit media', () => {
  const options = dialogPrintOptions({ deviceName: 'XP-58C', paperSize: '58mm', heightMm: 81.2 });
  assert.equal(options.deviceName, 'XP-58C');
  assert.equal(options.silent, false);
  assert.deepEqual(options.pageSize, { width: 58000, height: 82000 });
  assert.equal(Object.hasOwn(options, 'usePrinterDefaultPageSize'), false);
  assert.equal(dialogPrintOptions({ deviceName: 'PDF', paperSize: 'a4' }).pageSize, 'A4');
  assert.equal(dialogPrintOptions({ deviceName: 'PDF', paperSize: 'a5' }).pageSize, 'A5');
  assert.deepEqual(dialogPrintOptions({ deviceName: 'Label Printer', paperSize: '50mm 30mm' }).pageSize, { width: 50000, height: 30000 });
  assert.equal(dialogPrintOptions({ deviceName: 'XP', heightMm: 9000 }).pageSize.height, 1000000);
  assert.throws(() => dialogPrintOptions({ deviceName: 'XP', heightMm: NaN }), /height/);
});

test('missing selected printer never silently falls back to a different device', () => {
  const printers = [{ name: 'PDF', isDefault: true }, { name: 'Thermal' }];
  assert.equal(resolvePrinter(printers, 'Thermal').name, 'Thermal');
  assert.equal(resolvePrinter(printers).name, 'PDF');
  assert.throws(() => resolvePrinter(printers, 'Old Printer'), /not installed/);
});

test('Windows driver settings are forwarded and driver media never conflicts with explicit media', () => {
  const options = dialogPrintOptions({ deviceName: 'Epson', settings: { media: 'driver', silent: true, copies: 2, color: false, landscape: true, duplex: 'longEdge', dpi: 300, scale: 90, margins: 'printableArea' } });
  assert.equal(options.usePrinterDefaultPageSize, true);
  assert.equal(options.pageSize, undefined);
  assert.equal(options.silent, true);
  assert.equal(options.copies, 2);
  assert.equal(options.color, false);
  assert.equal(options.landscape, true);
  assert.equal(options.duplexMode, 'longEdge');
  assert.deepEqual(options.dpi, { horizontal: 300, vertical: 300 });
  assert.equal(options.scaleFactor, 90);
  assert.equal(options.margins.marginType, 'printableArea');
});

function fixture(behavior = () => {}, overrides = {}) {
  const windows = [];
  class PrintWindow extends EventEmitter {
    constructor() {
      super(); windows.push(this);
      this.webContents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler() {},
        executeJavaScript: async () => ({ heightMm: 100, width: 300, height: 400 }),
        insertCSS: async () => {},
        printToPDF: async (options) => { this.pdfOptions = options; return Buffer.from('%PDF-test'); },
        print: (options, callback) => { this.options = options; this.callback = callback; behavior(this); },
      });
    }
    async loadURL() {}
    show() {}
    focus() {}
    isDestroyed() { return !!this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const service = createPrintService({ BrowserWindow: PrintWindow,
    getMainWindow: () => ({ isDestroyed: () => false, webContents: { getPrintersAsync: async () => [{ name: 'PDF', isDefault: true }] } }),
    preparationTimeoutMs: 100, printTimeoutMs: 50,
    ...overrides,
  });
  return { service, windows };
}
const document = { html: '<html><head></head><body>Receipt</body></html>', paperSize: 'a4' };

for (const name of ['Microsoft Print to PDF', 'Adobe PDF']) {
  test(`${name} saves thermal and A4 PDFs without invoking the Windows driver`, async () => {
    let calls = 0;
    const { service, windows } = fixture(() => assert.fail('Must not invoke Windows printing'), {
      getMainWindow: () => ({ isDestroyed: () => false, webContents: { getPrintersAsync: async () => [{ name, isDefault: true }] } }),
      savePdf: async (_owner, data) => { calls++; assert.equal(data.toString(), '%PDF-test'); return true; },
    });
    assert.equal((await service({ ...document, paperSize: '80mm' })).status, 'saved');
    assert.deepEqual(windows[0].pdfOptions.pageSize, { width: 80 / 25.4, height: 100 / 25.4 });
    assert.equal(windows[0].destroyed, true);
    assert.equal((await service(document)).mode, 'pdf');
    assert.equal(windows[1].pdfOptions.pageSize, 'A4');
    assert.equal((await service({ ...document, paperSize: 'a5' })).mode, 'pdf');
    assert.equal(windows[2].pdfOptions.pageSize, 'A5');
    assert.equal(calls, 3);
  });
}

test('PDF cancellation and write errors release the print lock', async () => {
  let fail = false;
  const { service, windows } = fixture(undefined, {
    getMainWindow: () => ({ isDestroyed: () => false, webContents: { getPrintersAsync: async () => [{ name: 'Microsoft Print to PDF', isDefault: true }] } }),
    savePdf: async () => { if (fail) throw new Error('Cannot save PDF'); return false; },
  });
  assert.equal((await service(document)).cancelled, true);
  fail = true;
  await assert.rejects(service(document), /Cannot save PDF/);
  fail = false;
  assert.equal((await service(document)).cancelled, true);
  assert.ok(windows.every((win) => win.destroyed));
});

test('native cancellation cleans the window and permits another job', async () => {
  const { service, windows } = fixture((win) => win.callback(false, 'Print job canceled'));
  assert.equal((await service(document)).cancelled, true);
  assert.equal(windows[0].destroyed, true);
  assert.equal((await service(document)).cancelled, true);
});

test('concurrent IPC calls are rejected and closing the window releases the job', async () => {
  const { service, windows } = fixture();
  const pending = service(document);
  await assert.rejects(service(document), /already active/);
  await new Promise((resolve) => setImmediate(resolve));
  windows[0].destroy();
  assert.equal((await pending).cancelled, true);
});

test('native errors identify the affected printer and clean up', async () => {
  const { service, windows } = fixture((win) => win.callback(false, 'Invalid printer settings'));
  await assert.rejects(service(document), /Windows rejected.*PDF/);
  assert.equal(windows[0].destroyed, true);
});

test('thermal settings rejection retries the same queue with driver media and monochrome output', async () => {
  const attempts = [];
  const { service } = fixture(win => {
    attempts.push(win.options);
    win.callback(attempts.length > 1, 'Invalid printer settings');
  });
  assert.equal((await service({ ...document, paperSize: '80mm' })).status, 'submitted');
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0].pageSize, { width: 80000, height: 100000 });
  assert.equal(attempts[1].deviceName, attempts[0].deviceName);
  assert.equal(attempts[1].usePrinterDefaultPageSize, true);
  assert.equal(attempts[1].pageSize, undefined);
  assert.equal(attempts[1].color, false);
});

test('thermal transport failures never retry and driver rejection stops after one fallback', async () => {
  for (const reason of ['Printer unavailable', 'Invalid printer settings']) {
    let attempts = 0;
    const { service, windows } = fixture(win => { attempts++; win.callback(false, reason); });
    await assert.rejects(service({ ...document, paperSize: '80mm' }));
    assert.equal(attempts, reason === 'Invalid printer settings' ? 2 : 1);
    assert.equal(windows[0].destroyed, true);
  }
});

test('a stalled native dialog times out without automatically retrying', async () => {
  const { service, windows } = fixture();
  await assert.rejects(service(document), /may already have been submitted/);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].destroyed, true);
});

test('native printer discovery returns system-defined printer names', () => {
  assert.deepEqual(printerNames([
    { name: 'Xprinter XP-365B', displayName: 'Thermal printer' },
    { name: ' Microsoft Print to PDF ' },
    { displayName: 'Missing system name' },
  ]), ['Xprinter XP-365B', 'Microsoft Print to PDF']);
});
