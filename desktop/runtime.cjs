const fs = require('node:fs');
const path = require('node:path');

const LEGACY_LOCAL_SERVER_URLS = new Set([
  'http://127.0.0.1:8000',
  'http://localhost:8000',
  'https://www.mkposmyanmar.com/mkpos-server/public',
  'https://www.mkposmyanmar.com/public',
]);

function normalizeServerUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PwarMyar server URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/$/, '');
}

function resolveRuntimePaths({ projectRoot, resourcesPath, userData, isPackaged }) {
  return {
    dataDir: path.join(userData, 'offline'),
    databasePath: path.join(userData, 'offline', 'mkpos-offline.sqlite3'),
    logsDir: path.join(userData, 'logs'),
    logPath: path.join(userData, 'logs', 'mkpos-desktop.log'),
    configPath: path.join(userData, 'desktop-config.json'),
    bundledConfigPath: isPackaged
      ? path.join(resourcesPath, 'config.default.json')
      : path.join(projectRoot, 'desktop', 'config.default.json'),
    frontendDist: isPackaged
      ? path.join(resourcesPath, 'app.asar', 'renderer')
      : path.join(projectRoot, 'frontend', 'dist-desktop'),
  };
}

function ensureRuntimeFiles(paths) {
  fs.mkdirSync(paths.dataDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
  if (!fs.existsSync(paths.configPath)) {
    fs.copyFileSync(paths.bundledConfigPath, paths.configPath);
    return;
  }

  try {
    const current = JSON.parse(fs.readFileSync(paths.configPath, 'utf8'));
    const currentUrl = normalizeServerUrl(current.serverUrl);
    if (!LEGACY_LOCAL_SERVER_URLS.has(currentUrl)) return;
    const bundled = JSON.parse(fs.readFileSync(paths.bundledConfigPath, 'utf8'));
    fs.writeFileSync(paths.configPath, `${JSON.stringify({ ...current, serverUrl: bundled.serverUrl }, null, 2)}\n`);
  } catch {
    // Keep a user-managed config untouched; readServerUrl will report invalid JSON/URLs.
  }
}

function readServerUrl(paths, environment = process.env) {
  if (environment.MKPOS_SERVER_URL) return normalizeServerUrl(environment.MKPOS_SERVER_URL);
  const config = JSON.parse(fs.readFileSync(paths.configPath, 'utf8'));
  return normalizeServerUrl(config.serverUrl);
}

async function checkServer(baseUrl, { fetchImpl = fetch, timeoutMs = 4000, onResult } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalizeServerUrl(baseUrl)}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    onResult?.({ ok: response.ok, status: response.status });
    return response.ok;
  } catch (error) {
    onResult?.({ ok: false, error: error?.message || String(error) });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function allowedDesktopModes(connected) {
  return connected ? ['online', 'offline'] : ['offline'];
}

function resolveDesktopIconPath({ isPackaged, projectRoot, resourcesPath }) {
  return isPackaged
    ? path.join(resourcesPath, 'frontend', 'branding', 'pwarmyar-mark.png')
    : path.join(projectRoot, 'frontend', 'public', 'branding', 'pwarmyar-mark.png');
}

module.exports = {
  allowedDesktopModes,
  checkServer,
  ensureRuntimeFiles,
  normalizeServerUrl,
  readServerUrl,
  resolveDesktopIconPath,
  resolveRuntimePaths,
};
