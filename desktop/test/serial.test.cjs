const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const { runSerial, serialRequest } = require('../serial.cjs');

test('Windows discovery associates Bluetooth COM ports with installed printer names', { skip: process.platform !== 'win32' }, async () => {
  const result = await runSerial('list', {}, { readScript: file => fs.readFileSync(file, 'utf8')
    .replace('[System.IO.Ports.SerialPort]::GetPortNames()', "@('COM1', 'COM4', 'COM5')")
    .replace("$ErrorActionPreference = 'Stop'", `$ErrorActionPreference = 'Stop'
function Get-CimInstance($ClassName, $Filter) {
  if ($ClassName -eq 'Win32_Printer') {
    [pscustomobject]@{ Name = 'Xprinter XP-80'; PortName = 'COM4:' }
  } else {
    [pscustomobject]@{ Name = 'Bluetooth serial (COM4)'; PNPDeviceID = 'BTHENUM\\printer' }
    [pscustomobject]@{ Name = 'Bluetooth serial (COM5)'; PNPDeviceID = 'BTHENUM\\incoming' }
  }
}`) });
  assert.equal(result.items.find(p => p.port === 'COM4').printerName, 'Xprinter XP-80');
  assert.equal(result.items.find(p => p.port === 'COM4').bluetooth, true);
  assert.equal(result.items.find(p => p.port === 'COM5').printerName, '');
  assert.equal(result.items.find(p => p.port === 'COM1').bluetooth, false);
});

test('Windows helper preserves COM input and Unicode device names without CLIXML', { skip: process.platform !== 'win32' }, async () => {
  const result = await runSerial('test', serialRequest({ bluetooth: { port: 'com4' } }), {
    readScript: () => `param($Operation)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
@{ port = $request.serial.port; name = 'မြန်မာ Bluetooth' } | ConvertTo-Json -Compress`,
  });
  assert.deepEqual(result, { port: 'COM4', name: 'မြန်မာ Bluetooth' });
  await assert.rejects(runSerial('test', {}, {
    readScript: () => "param($Operation)\n[Console]::Error.WriteLine('COM4 unavailable'); exit 1",
  }), error => error.message.includes('COM4 unavailable') && !error.message.includes('CLIXML'));
});

test('Bluetooth bytes and serial options go through stdin, never a shell command', async () => {
  let args, options, data = '';
  const spawnProcess = (_exe, argv, opts) => {
    args = argv; options = opts;
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {} });
    child.stdin.on('data', chunk => { data += chunk; });
    child.stdin.on('finish', () => { child.stdout.write('{"ok":true}'); child.emit('close', 0); });
    return child;
  };
  const request = serialRequest({ bluetooth: { port: 'com12', baudRate: 19200 }, thermal: { chunkSize: 256, chunkDelayMs: 20 } }, Buffer.from([0x1b, 0x40, 0xff]));
  assert.equal((await runSerial('send', request, { spawnProcess, readScript: () => 'param($Operation)' })).ok, true);
  assert.equal(options.windowsHide, true);
  assert.equal(options.shell, undefined);
  assert.equal(args.at(-2), '-EncodedCommand');
  assert.match(Buffer.from(args.at(-1), 'base64').toString('utf16le'), /-Operation 'send'/);
  assert.equal(Buffer.from(args.at(-1), 'base64').toString('utf16le').includes('COM12'), false);
  assert.equal(args.includes(request.data), false);
  assert.equal(JSON.parse(data).serial.port, 'COM12');
  assert.equal(JSON.parse(data).transfer.chunkSize, 256);
  assert.deepEqual(Buffer.from(JSON.parse(data).data, 'base64'), Buffer.from([0x1b, 0x40, 0xff]));
});

test('Bluetooth helper failures are surfaced without automatic retries', async () => {
  let count = 0;
  const spawnProcess = () => {
    count++;
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() {} });
    child.stdin.on('finish', () => { child.stderr.write('Access denied to COM5'); child.emit('close', 1); });
    return child;
  };
  await assert.rejects(runSerial('test', serialRequest({ bluetooth: { port: 'COM5' } }), { spawnProcess }), /Access denied.*Check pairing/);
  assert.equal(count, 1);
});
