const { isIP } = require('node:net');

function defaults() {
  return {
    version: 1, connection: 'windows', documentPrinterName: '', receiptLayout: null,
    windows: { printerName: '', silent: false, copies: 1, color: true, landscape: false, duplex: 'simplex', media: 'document', scale: 100, margins: 'none', dpi: 0 },
    tcp: { host: '127.0.0.1', port: 9100 },
    bluetooth: { port: '', baudRate: 9600, dataBits: 8, stopBits: 'One', parity: 'None', handshake: 'None', dtr: false, rts: false },
    thermal: { widthDots: 0, threshold: 180, imageMode: 'raster', feedLines: 3, cut: 'none', copies: 1, timeoutMs: 30000, chunkSize: 512, chunkDelayMs: 10 },
  };
}
function choice(value, values, label) {
  if (!values.includes(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function integer(value, min, max, label) {
  if (value === '' || value == null || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label} must be ${min}–${max}.`);
  return Number(value);
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f]/.test(value)) throw new Error(`Invalid ${label}.`);
  return value.trim();
}
function bool(value, label) { return choice(value, [true, false], label); }
function number(value, min, max, label) {
  if (value === '' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label} must be ${min}–${max}.`);
  return Number(value);
}
function receiptLayout(value) {
  if (value == null) return null;
  return {
    paper_size: choice(value.paper_size, ['50mm', '58mm', '80mm', '85mm', 'a5', 'a4'], 'receipt paper'),
    header_alignment: choice(value.header_alignment, ['left', 'center', 'right'], 'header alignment'),
    margin_left: number(value.margin_left, 0, 30, 'Left margin'), margin_right: number(value.margin_right, 0, 30, 'Right margin'),
    header_font_size: number(value.header_font_size, 7, 24, 'Header font'), body_font_size: number(value.body_font_size, 6, 18, 'Body font'), line_height: number(value.line_height, 1, 2.2, 'Line spacing'),
  };
}
function tcpTarget(host, port) {
  host = text(host, 253, 'TCP host').replace(/^\[|\]$/g, '');
  if (!host || (!isIP(host) && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host))) throw new Error('Enter a printer IP address or hostname, without a protocol or path.');
  return { host: host === 'localhost' ? '127.0.0.1' : host, port: integer(port, 1, 65535, 'TCP port') };
}
function normalizeConfig(input = {}, { requireTarget = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid printer configuration.');
  const d = defaults();
  const w = { ...d.windows, ...input.windows }, b = { ...d.bluetooth, ...input.bluetooth }, t = { ...d.thermal, ...input.thermal };
  const connection = choice(input.connection ?? d.connection, ['windows', 'tcp', 'bluetooth'], 'connection type');
  const layout = receiptLayout(input.receiptLayout);
  if (connection !== 'windows' && ['a4', 'a5'].includes(layout?.paper_size)) throw new Error('Direct ESC/POS connections require thermal receipt paper. Select 50, 58, 80 or 85 mm.');
  const port = text(b.port, 12, 'Bluetooth COM port').toUpperCase();
  if ((port || (connection === 'bluetooth' && requireTarget)) && !/^COM[1-9][0-9]{0,3}$/.test(port)) throw new Error('Select a paired outgoing Bluetooth COM port, for example COM5. BLE-only printers are not supported.');
  const rawTcp = { ...d.tcp, ...input.tcp };
  const tcp = connection === 'tcp' || rawTcp.host ? tcpTarget(rawTcp.host, rawTcp.port) : d.tcp;
  return { version: 1, connection, receiptLayout: layout, documentPrinterName: text(input.documentPrinterName ?? '', 255, 'document printer'),
    windows: { printerName: text(w.printerName, 255, 'Windows printer'), silent: bool(w.silent, 'silent printing'), copies: integer(w.copies, 1, 10, 'Copies'), color: bool(w.color, 'color'), landscape: bool(w.landscape, 'orientation'), duplex: choice(w.duplex, ['simplex', 'shortEdge', 'longEdge'], 'duplex'), media: choice(w.media, ['document', 'driver'], 'paper handling'), scale: integer(w.scale, 25, 200, 'Print scale'), margins: choice(w.margins, ['none', 'printableArea', 'default'], 'page margins'), dpi: integer(w.dpi, 0, 1200, 'DPI') },
    tcp, bluetooth: { port, baudRate: integer(b.baudRate, 1200, 921600, 'Baud rate'), dataBits: integer(b.dataBits, 7, 8, 'Data bits'), stopBits: choice(b.stopBits, ['One', 'Two'], 'stop bits'), parity: choice(b.parity, ['None', 'Odd', 'Even'], 'parity'), handshake: choice(b.handshake, ['None', 'RequestToSend', 'XOnXOff', 'RequestToSendXOnXOff'], 'flow control'), dtr: bool(b.dtr, 'DTR'), rts: bool(b.rts, 'RTS') },
    thermal: { widthDots: integer(t.widthDots, 0, 832, 'Printable dots'), threshold: integer(t.threshold, 1, 254, 'Black threshold'), imageMode: choice(t.imageMode, ['raster', 'column'], 'image command'), feedLines: integer(t.feedLines, 0, 20, 'Feed lines'), cut: choice(t.cut, ['none', 'full', 'partial'], 'cutter'), copies: integer(t.copies, 1, 10, 'Thermal copies'), timeoutMs: integer(t.timeoutMs, 1000, 300000, 'Connection timeout (ms)'), chunkSize: integer(t.chunkSize, 64, 16384, 'Chunk bytes'), chunkDelayMs: integer(t.chunkDelayMs, 0, 500, 'Chunk delay (ms)') },
  };
}
function fromLegacy(name = '') {
  const config = defaults();
  if (String(name).startsWith('escpos:')) {
    let url;
    try { url = new URL(name); } catch { throw new Error('Invalid ESC/POS TCP address.'); }
    if (url.protocol !== 'escpos:' || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) throw new Error('Invalid ESC/POS TCP address.');
    config.connection = 'tcp'; config.tcp = tcpTarget(url.hostname, url.port || 9100);
  } else config.windows.printerName = String(name || '');
  return normalizeConfig(config);
}
function legacyName(config) {
  if (config.connection === 'tcp') return `escpos://${config.tcp.host.includes(':') ? `[${config.tcp.host}]` : config.tcp.host}:${config.tcp.port}`;
  if (config.connection === 'bluetooth') return `Bluetooth ${config.bluetooth.port}`;
  return config.windows.printerName;
}
module.exports = { defaults, normalizeConfig, fromLegacy, legacyName, tcpTarget };
