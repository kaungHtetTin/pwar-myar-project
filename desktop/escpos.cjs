const net = require('node:net');
const { fromLegacy, normalizeConfig, tcpTarget } = require('./printer-config.cjs');

function emulatorTarget(name = '') {
  return String(name).startsWith('escpos:') ? fromLegacy(name).tcp : null;
}
function rasterCommands(bitmap, width, height, options = {}) {
  const settings = normalizeConfig({ thermal: { cut: 'full', ...options } }).thermal;
  if (!Number.isInteger(width) || width < 1 || width > 832 || !Number.isInteger(height) || height < 1 || height > 50000 || bitmap.length !== width * height * 4) throw new Error('Invalid receipt bitmap.');
  const black = (x, y) => {
    if (y >= height) return false;
    const offset = (y * width + x) * 4;
    const gray = (bitmap[offset] * .114 + bitmap[offset + 1] * .587 + bitmap[offset + 2] * .299) * bitmap[offset + 3] / 255 + 255 - bitmap[offset + 3];
    return gray < settings.threshold;
  };
  const chunks = [Buffer.from([0x1b, 0x40])];
  if (settings.imageMode === 'column') {
    // ESC * 33: 24-dot double-density columns for older ESC/POS printers.
    chunks.push(Buffer.from([0x1b, 0x33, 24]));
    for (let top = 0; top < height; top += 24) {
      const data = Buffer.alloc(5 + width * 3 + 1);
      data.set([0x1b, 0x2a, 33, width & 255, width >> 8]);
      for (let x = 0; x < width; x++) for (let y = 0; y < 24; y++) if (black(x, top + y)) data[5 + x * 3 + (y >> 3)] |= 0x80 >> (y & 7);
      data[data.length - 1] = 10;
      chunks.push(data);
    }
    chunks.push(Buffer.from([0x1b, 0x32]));
  } else {
    const rowBytes = Math.ceil(width / 8);
    for (let top = 0; top < height; top += 256) {
      const rows = Math.min(256, height - top), data = Buffer.alloc(8 + rowBytes * rows);
      data.set([0x1d, 0x76, 0x30, 0, rowBytes & 255, rowBytes >> 8, rows & 255, rows >> 8]);
      for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) if (black(x, top + y)) data[8 + y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      chunks.push(data);
    }
  }
  if (settings.feedLines) chunks.push(Buffer.from([0x1b, 0x64, settings.feedLines]));
  if (settings.cut !== 'none') chunks.push(Buffer.from([0x1d, 0x56, settings.cut === 'partial' ? 1 : 0]));
  const receipt = Buffer.concat(chunks);
  return Buffer.concat(Array.from({ length: settings.copies }, () => receipt));
}

function sendTcpBytes(target, bytes, options = {}) {
  target = tcpTarget(target.host, target.port);
  const settings = normalizeConfig({ thermal: options }).thermal;
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(target);
    let settled = false, pause;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(pause); socket.destroy();
      error ? reject(new Error('ESC/POS TCP ' + target.host + ':' + target.port + ': ' + error.message + '. Check connection and printer output before retrying; no automatic retry was made.')) : resolve();
    };
    const timer = setTimeout(() => finish(new Error('Transfer timed out')), settings.timeoutMs);
    socket.on('error', finish);
    socket.on('data', () => {});
    socket.on('close', () => { if (!settled) finish(new Error('Printer disconnected before the transfer finished')); });
    socket.once('connect', () => {
      if (!bytes?.length) { socket.end(); finish(); return; }
      let offset = 0;
      function next() {
        if (settled) return;
        if (offset >= bytes.length) { socket.end(() => finish()); return; }
        const chunk = bytes.subarray(offset, offset + settings.chunkSize);
        offset += chunk.length;
        socket.write(chunk, (error) => {
          if (error) return finish(error);
          if (settings.chunkDelayMs) pause = setTimeout(next, settings.chunkDelayMs);
          else next();
        });
      }
      next();
    });
  });
}
function sendRasterReceipt(target, image, options) {
  const { width, height } = image.getSize();
  return sendTcpBytes(target, rasterCommands(image.toBitmap(), width, height, options), options);
}
module.exports = { emulatorTarget, rasterCommands, sendRasterReceipt, sendTcpBytes };
