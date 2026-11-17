const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function launch(appData, ownsLock) {
  const calls = [];
  let userData = path.join(appData, 'PwarMyar');
  const app = {
    getPath: (name) => name === 'appData' ? appData : userData,
    setPath: (name, value) => { assert.equal(name, 'userData'); userData = value; calls.push(['profile', value]); },
    requestSingleInstanceLock: () => { calls.push(['lock', userData]); return ownsLock; },
    quit: () => calls.push(['quit']),
    setAppUserModelId: () => {},
    on: () => {},
    whenReady: () => { calls.push(['ready']); return new Promise(() => {}); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.cjs'), 'utf8'), {
    __dirname: path.join(__dirname, '..'),
    require: (name) => {
      if (name === 'electron') return { app };
      if (name.startsWith('node:')) return require(name);
      return {};
    },
  });
  return calls;
}

test('PwarMyar acquires its lock in its own profile even when MKPOS data exists', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pwarmyar-isolation-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const mkpos = path.join(root, 'mkpos-desktop');
  fs.mkdirSync(mkpos);
  const config = path.join(mkpos, 'desktop-config.json');
  const original = JSON.stringify({ serverUrl: 'https://mkpos.example', printerName: 'MKPOS printer' });
  fs.writeFileSync(config, original);
  assert.deepEqual(launch(root, true), [
    ['profile', path.join(root, 'pwarmyar-desktop')],
    ['lock', path.join(root, 'pwarmyar-desktop')],
    ['ready'],
  ]);
  assert.equal(fs.readFileSync(config, 'utf8'), original);
});

test('a second PwarMyar instance quits without scheduling startup', () => {
  const calls = launch(os.tmpdir(), false);
  assert.equal(calls.some(([name]) => name === 'quit'), true);
  assert.equal(calls.some(([name]) => name === 'ready'), false);
});
