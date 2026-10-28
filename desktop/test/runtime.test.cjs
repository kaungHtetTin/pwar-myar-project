const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  allowedDesktopModes,
  checkServer,
  ensureRuntimeFiles,
  normalizeServerUrl,
  readServerUrl,
  resolveDesktopIconPath,
  resolveRuntimePaths,
} = require('../runtime.cjs');

test('normalizes the configured server URL and rejects unsafe protocols', () => {
  assert.equal(normalizeServerUrl('http://127.0.0.1:8000/'), 'http://127.0.0.1:8000');
  assert.equal(
    normalizeServerUrl('https://www.pwarmyar.com/public/'),
    'https://www.pwarmyar.com/public',
  );
  assert.throws(() => normalizeServerUrl('file:///tmp/app'), /HTTP or HTTPS/);
});

test('migrates legacy local and production server configs to the bundled server', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkpos-desktop-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const paths = {
    dataDir: path.join(root, 'offline'),
    logsDir: path.join(root, 'logs'),
    configPath: path.join(root, 'desktop-config.json'),
    bundledConfigPath: path.join(root, 'config.default.json'),
  };
  fs.writeFileSync(paths.bundledConfigPath, JSON.stringify({ serverUrl: 'https://www.pwarmyar.com/public' }));
  fs.writeFileSync(paths.configPath, JSON.stringify({ serverUrl: 'http://127.0.0.1:8000' }));

  ensureRuntimeFiles(paths);

  assert.equal(readServerUrl(paths, {}), 'https://www.pwarmyar.com/public');

  fs.writeFileSync(paths.configPath, JSON.stringify({ serverUrl: 'https://www.mkposmyanmar.com/mkpos-server/public' }));
  ensureRuntimeFiles(paths);

  assert.equal(readServerUrl(paths, {}), 'https://www.pwarmyar.com/public');
});

test('uses a user-data SQLite file and bundled renderer paths', () => {
  const development = resolveRuntimePaths({ projectRoot: 'C:\\mkpos', resourcesPath: 'C:\\resources', userData: 'C:\\data', isPackaged: false });
  assert.match(development.databasePath, /offline[\\/]mkpos-offline\.sqlite3$/);
  assert.match(development.frontendDist, /frontend[\\/]dist-desktop$/);
  const packaged = resolveRuntimePaths({ projectRoot: 'C:\\mkpos', resourcesPath: 'C:\\resources', userData: 'C:\\data', isPackaged: true });
  assert.match(packaged.frontendDist, /resources[\\/]app\.asar[\\/]renderer$/);
});

test('health check reports reachable and unreachable servers', async () => {
  assert.equal(await checkServer('https://mkpos.test', { fetchImpl: async () => ({ ok: true }) }), true);
  assert.equal(await checkServer('https://mkpos.test', { fetchImpl: async () => { throw new Error('offline'); } }), false);
});

test('online mode is selectable only while the Laravel server is reachable', () => {
  assert.deepEqual(allowedDesktopModes(true), ['online', 'offline']);
  assert.deepEqual(allowedDesktopModes(false), ['offline']);
});

test('resolves the Electron icon from local files in development and packaged builds', () => {
  assert.equal(
    resolveDesktopIconPath({ isPackaged: false, projectRoot: 'C:\\mkpos', resourcesPath: 'C:\\resources' }),
    'C:\\mkpos\\frontend\\public\\branding\\pwarmyar-mark.png',
  );
  assert.equal(
    resolveDesktopIconPath({ isPackaged: true, projectRoot: 'C:\\mkpos', resourcesPath: 'C:\\resources' }),
    'C:\\resources\\frontend\\branding\\pwarmyar-mark.png',
  );
});
