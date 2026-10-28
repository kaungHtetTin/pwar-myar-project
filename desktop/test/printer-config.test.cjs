const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { defaults, normalizeConfig, fromLegacy, tcpTarget } = require('../printer-config.cjs');
const { getPrinterConfig, setPrinterConfig, forDocument } = require('../printer-preferences.cjs');

test('defaults and migration retain Windows or TCP choices without enabling a cutter', () => {
  assert.equal(fromLegacy('Canon Printer').windows.printerName, 'Canon Printer');
  assert.deepEqual(fromLegacy('escpos://127.0.0.1:9200').tcp, { host: '127.0.0.1', port: 9200 });
  assert.equal(defaults().thermal.cut, 'none');
  assert.deepEqual(tcpTarget('[::1]', 9100), { host: '::1', port: 9100 });
});
test('invalid destinations and out-of-range hardware options are rejected', () => {
  assert.throws(() => normalizeConfig({ connection: 'bluetooth' }), /COM port/);
  assert.throws(() => normalizeConfig({ bluetooth: { port: 'COM5;whoami' } }), /COM port/);
  assert.throws(() => normalizeConfig({ tcp: { host: 'http://printer:9100' } }), /host/);
  assert.throws(() => normalizeConfig({ tcp: { port: 0 } }), /TCP port/);
  assert.throws(() => normalizeConfig({ thermal: { widthDots: 900 } }), /dots/);
  assert.throws(() => normalizeConfig({ thermal: { chunkDelayMs: -1 } }), /delay/);
  assert.throws(() => normalizeConfig({ windows: { copies: 100 } }), /Copies/);
  assert.throws(() => normalizeConfig({ windows: { silent: 'false' } }), /silent/);
  assert.equal(normalizeConfig({ connection: 'windows', receiptLayout: { paper_size: 'a5', header_alignment: 'center', margin_left: 3, margin_right: 3, header_font_size: 11, body_font_size: 10, line_height: 1.45 } }).receiptLayout.paper_size, 'a5');
  assert.throws(() => normalizeConfig({ connection: 'tcp', receiptLayout: { paper_size: 'a5', header_alignment: 'center', margin_left: 3, margin_right: 3, header_font_size: 11, body_font_size: 10, line_height: 1.45 } }), /thermal receipt paper/);
});
test('printer configuration is isolated per device and preserves unrelated local configuration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkpos-printer-config-'));
  const first = path.join(dir, 'till-one.json'), second = path.join(dir, 'till-two.json');
  try {
    fs.writeFileSync(first, JSON.stringify({ serverUrl: 'https://shop.example', printerName: 'Canon' }));
    fs.writeFileSync(second, JSON.stringify({ serverUrl: 'https://shop.example', printerName: 'Epson' }));
    const config = { ...defaults(), connection: 'bluetooth', bluetooth: { ...defaults().bluetooth, port: 'COM5' }, documentPrinterName: 'Office Epson', receiptLayout: { paper_size: '58mm', header_alignment: 'center', margin_left: 2, margin_right: 2, header_font_size: 11, body_font_size: 8, line_height: 1.4 } };
    setPrinterConfig(first, config);
    assert.equal(getPrinterConfig(first).bluetooth.port, 'COM5');
    assert.equal(getPrinterConfig(first).receiptLayout.paper_size, '58mm');
    assert.equal(getPrinterConfig(second).windows.printerName, 'Epson');
    assert.equal(JSON.parse(fs.readFileSync(first)).serverUrl, 'https://shop.example');
    assert.equal(forDocument(getPrinterConfig(first)).windows.printerName, 'Office Epson');
    assert.equal(forDocument(getPrinterConfig(first)).connection, 'windows');
    assert.throws(() => setPrinterConfig(first, { ...config, bluetooth: { port: 'invalid' } }), /COM port/);
    assert.equal(getPrinterConfig(first).bluetooth.port, 'COM5');
  } finally { fs.unlinkSync(first); fs.unlinkSync(second); fs.rmdirSync(dir); }
});
