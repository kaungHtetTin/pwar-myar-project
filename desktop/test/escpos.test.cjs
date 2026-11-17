const assert = require('node:assert/strict');
const test = require('node:test');
const net = require('node:net');
const { emulatorTarget, rasterCommands, sendRasterReceipt } = require('../escpos.cjs');

test('ESC/POS addresses accept network hosts but reject credentials and URL paths', () => {
  assert.deepEqual(emulatorTarget('escpos://127.0.0.1:9100'), { host: '127.0.0.1', port: 9100 });
  assert.equal(emulatorTarget('XP-58C'), null);
  assert.deepEqual(emulatorTarget('escpos://192.168.1.100:9200'), { host: '192.168.1.100', port: 9200 });
  assert.deepEqual(emulatorTarget('escpos://printer.local:9100'), { host: 'printer.local', port: 9100 });
  assert.throws(() => emulatorTarget('escpos://localhost:9100/path'), /Invalid/);
  assert.throws(() => emulatorTarget('escpos://user:pass@localhost:9100'), /Invalid/);
});

test('legacy column images, no-cutter mode, feed, threshold and copies are encoded', () => {
  const pixels = Buffer.alloc(8 * 24 * 4, 255);
  pixels[0] = pixels[1] = pixels[2] = 0;
  const bytes = rasterCommands(pixels, 8, 24, { imageMode: 'column', cut: 'none', feedLines: 0 });
  assert.deepEqual([...bytes.subarray(2, 10)], [0x1b, 0x33, 24, 0x1b, 0x2a, 33, 8, 0]);
  assert.equal(bytes[10], 0x80);
  assert.equal(bytes.includes(Buffer.from([0x1d, 0x56])), false);
  assert.equal(rasterCommands(pixels, 8, 24, { imageMode: 'column', cut: 'none', feedLines: 0, copies: 2 }).length, bytes.length * 2);
  assert.deepEqual([...rasterCommands(pixels, 8, 24, { cut: 'partial', feedLines: 5 }).subarray(-6)], [0x1b, 0x64, 5, 0x1d, 0x56, 1]);
});

test('raster dots use most-significant-bit first and white transparency', () => {
  const pixels = Buffer.alloc(8 * 4, 255);
  pixels[0] = pixels[1] = pixels[2] = 0;
  pixels[4] = pixels[5] = pixels[6] = pixels[7] = 0;
  const bytes = rasterCommands(pixels, 8, 1);
  assert.deepEqual([...bytes.subarray(2, 10)], [0x1d, 0x76, 0x30, 0, 1, 0, 1, 0]);
  assert.equal(bytes[10], 0x80);
  assert.deepEqual([...bytes.subarray(-3)], [0x1d, 0x56, 0]);
});

test('raster receipt reaches a TCP listener intact', async () => {
  let received = Buffer.alloc(0);
  const server = net.createServer((socket) => socket.on('data', (chunk) => { received = Buffer.concat([received, chunk]); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const bitmap = Buffer.alloc(8 * 2 * 4, 255);
    await sendRasterReceipt({ host: '127.0.0.1', port: server.address().port }, { getSize: () => ({ width: 8, height: 2 }), toBitmap: () => bitmap });
    assert.deepEqual(received, rasterCommands(bitmap, 8, 2));
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
