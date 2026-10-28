const { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, session: electronSession, shell } = require('electron');
const { applyWindowTheme } = require('./theme.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { OfflineStore } = require('./offline-store.cjs');
const { createDesktopApiClient } = require('./api-proxy.cjs');
const { createPrintService, printerNames, EMULATOR_PRINTER } = require('./printing.cjs');
const { normalizeConfig, fromLegacy } = require('./printer-config.cjs');
const { getPrinterConfig, setPrinterConfig, forDocument } = require('./printer-preferences.cjs');
const { runSerial, serialRequest } = require('./serial.cjs');
const { sendTcpBytes } = require('./escpos.cjs');
const {
  allowedDesktopModes,
  checkServer,
  ensureRuntimeFiles,
  readServerUrl,
  resolveDesktopIconPath,
  resolveRuntimePaths,
} = require('./runtime.cjs');

const APP_ID = 'com.pwarmyar.desktop';
const PROJECT_ROOT = path.resolve(__dirname, '..');
// Keep existing offline sales and printer settings when installing the renamed app.
const legacyUserData = path.join(app.getPath('appData'), 'mkpos-desktop');
if (fs.existsSync(legacyUserData)) app.setPath('userData', legacyUserData);
const gotSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow;
let splashWindow;
let store;
let paths;
let serverUrl = '';
let connected = false;
let activeMode = 'online';
let offlineModeSelectedByUser = false;
let connectivityTimer;
let connectivityCheckRunning = false;
let desktopApi;

function writeLog(level, message, details) {
  if (!paths?.logPath) return;
  const suffix = details === undefined ? '' : ` ${typeof details === 'string' ? details : JSON.stringify(details)}`;
  const line = `${new Date().toISOString()} [${level}] ${message}${suffix}\n`;
  try { fs.appendFileSync(paths.logPath, line, 'utf8'); } catch { /* logging must never stop the app */ }
}

if (!gotSingleInstanceLock) app.quit();

function checkConfiguredServer() {
  return checkServer(serverUrl, {
    fetchImpl: net.fetch,
    onResult: (result) => writeLog(result.ok ? 'INFO' : 'WARN', 'Server health response', {
      url: `${serverUrl}/api/health`, ...result,
    }),
  });
}

function desktopIconPath() {
  return resolveDesktopIconPath({
    isPackaged: app.isPackaged,
    projectRoot: PROJECT_ROOT,
    resourcesPath: process.resourcesPath,
  });
}

function createSplash() {
  const window = new BrowserWindow({
    width: 440, height: 250, frame: false, resizable: false, show: false,
    center: true, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#0f4c3a',
    icon: desktopIconPath(),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: false },
  });
  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, 'splash.html'));
  return window;
}

function splashStatus(message) {
  if (!splashWindow || splashWindow.isDestroyed() || splashWindow.webContents.isLoading()) return;
  splashWindow.webContents.executeJavaScript(`window.setSplashStatus(${JSON.stringify(message)})`).catch(() => {});
}

function createMainWindow() {
  const window = new BrowserWindow({
    title: 'PwarMyar', width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    backgroundColor: '#f4f7f5', show: false, autoHideMenuBar: true,
    icon: desktopIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, devTools: !app.isPackaged,
    },
  });
  window.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  window.webContents.on('did-finish-load', () => writeLog('INFO', 'Renderer loaded', { mode: activeMode }));
  window.webContents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    writeLog('ERROR', 'Renderer failed to load', { code, description, validatedUrl, mode: activeMode });
  });
  window.webContents.on('render-process-gone', (_event, details) => writeLog('ERROR', 'Renderer process exited', details));
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) writeLog(level === 3 ? 'ERROR' : 'WARN', 'Renderer console message', { message, line, sourceId });
  });
  return window;
}

function desktopStatus() {
  return {
    connected,
    online: connected,
    mode: activeMode,
    allowedModes: allowedDesktopModes(connected),
  };
}

function publishConnectivity() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:connectivity', desktopStatus());
  }
}

async function loadOnline() {
  if (!await prepareOnlineMode()) return false;
  await loadBundledRenderer('online');
  return true;
}

async function prepareOnlineMode() {
  writeLog('INFO', 'Checking server before entering online mode', { serverUrl });
  connected = await checkConfiguredServer();
  if (!connected) {
    writeLog('WARN', 'Server health check failed', { serverUrl });
    publishConnectivity();
    return false;
  }
  activeMode = 'online';
  offlineModeSelectedByUser = false;
  writeLog('INFO', 'Online mode is ready');
  publishConnectivity();
  return true;
}

function loadBundledRendererAfterReply(mode) {
  setTimeout(() => {
    writeLog('INFO', 'Loading renderer for mode change', { mode });
    loadBundledRenderer(mode).catch((error) => {
      writeLog('ERROR', 'Renderer mode change failed', { mode, error: error.stack || error.message });
      dialog.showErrorBox('PwarMyar could not switch modes', error.message);
    });
  }, 150);
}

async function loadBundledRenderer(mode) {
  const entry = path.join(paths.frontendDist, 'index.html');
  if (!fs.existsSync(entry)) throw new Error(`Bundled renderer was not found: ${entry}`);
  await mainWindow.loadFile(entry, { hash: mode });
}

async function loadOffline() {
  activeMode = 'offline';
  await loadBundledRenderer('offline');
}

function startConnectivityMonitor() {
  clearInterval(connectivityTimer);
  connectivityTimer = setInterval(async () => {
    if (connectivityCheckRunning) return;
    connectivityCheckRunning = true;
    const wasConnected = connected;
    const next = await checkConfiguredServer();
    connected = next;
    try {
      if (connected && activeMode === 'offline' && !offlineModeSelectedByUser) {
        activeMode = 'online';
        writeLog('INFO', 'Connection restored; returning to online mode automatically');
        publishConnectivity();
        return;
      }
      if (wasConnected !== connected) publishConnectivity();
    } finally {
      connectivityCheckRunning = false;
    }
  }, 8000);
}

function registerIpc() {
  ipcMain.handle('desktop:apply-theme', (event, payload) => {
    if (!mainWindow || event.sender.id !== mainWindow.webContents.id) throw new Error('Invalid theme sender.');
    return applyWindowTheme(mainWindow, nativeTheme, payload);
  });
  ipcMain.handle('desktop:get-info', () => ({
    version: app.getVersion(), serverUrl, ...desktopStatus(), databasePath: paths.databasePath,
    configPath: paths.configPath, packaged: app.isPackaged,
  }));
  ipcMain.handle('desktop:api-request', (_event, payload) => desktopApi.request(payload));
  ipcMain.handle('desktop:get-bootstrap', () => ({ ...store.getBootstrap(connected), ...desktopStatus() }));
  ipcMain.handle('desktop:cache-online-data', (_event, payload) => store.replaceOnlineCache(payload));
  ipcMain.handle('desktop:clear-offline-session', () => store.clearOfflineSession());
  ipcMain.handle('desktop:get-offline-data', () => store.getOfflineData());
  ipcMain.handle('desktop:create-offline-sale', (_event, payload) => store.createSale(payload));
  ipcMain.handle('desktop:list-offline-sales', (_event, options) => store.listSales(options || {}));
  ipcMain.handle('desktop:mark-sale-syncing', (_event, id) => store.markSyncing(Number(id)));
  ipcMain.handle('desktop:mark-sale-synced', (_event, { id, sale }) => store.markSynced(Number(id), sale));
  ipcMain.handle('desktop:mark-sale-failed', (_event, { id, message }) => store.markFailed(Number(id), message));
  ipcMain.handle('desktop:retry-failed-sale', (_event, id) => store.retryFailed(Number(id)));
  ipcMain.handle('desktop:mark-sale-pending', (_event, { id, message }) => store.markPending(Number(id), message));
  ipcMain.handle('desktop:check-connectivity', async () => {
    writeLog('INFO', 'Manual connection check started');
    connected = await checkConfiguredServer();
    writeLog(connected ? 'INFO' : 'WARN', 'Manual connection check completed', { connected });
    publishConnectivity();
    return desktopStatus();
  });
  ipcMain.handle('desktop:switch-mode', async (_event, requestedMode) => {
    writeLog('INFO', 'Mode switch requested', { requestedMode, activeMode });
    if (requestedMode === 'offline') {
      offlineModeSelectedByUser = true;
      if (activeMode !== 'offline') {
        activeMode = 'offline';
        publishConnectivity();
      }
      return desktopStatus();
    }
    if (requestedMode !== 'online') throw new Error('Unknown desktop mode.');
    if (!await prepareOnlineMode()) throw new Error('Online mode is unavailable because the PwarMyar server cannot be reached.');
    return desktopStatus();
  });
  ipcMain.handle('desktop:open-online', async () => {
    writeLog('INFO', 'Open online requested', { activeMode });
    if (!await prepareOnlineMode()) throw new Error('Online mode is unavailable because the PwarMyar server cannot be reached.');
    return desktopStatus();
  });
  ipcMain.handle('desktop:open-tutorials', () => shell.openExternal(`${serverUrl.replace(/\/$/, '')}/tutorials`));
  ipcMain.handle('desktop:open-log-folder', async () => {
    writeLog('INFO', 'Opening desktop log folder');
    const result = await shell.openPath(paths.logsDir);
    if (result) throw new Error(result);
    return { logPath: paths.logPath };
  });
  ipcMain.handle('desktop:get-printers', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    return [...printerNames(await mainWindow.webContents.getPrintersAsync()), EMULATOR_PRINTER];
  });
  const printDocument = createPrintService({
    BrowserWindow, getMainWindow: () => mainWindow, log: writeLog, versions: process.versions,
    sendSerialBytes: (config, bytes) => runSerial('send', serialRequest(config, bytes), { scriptPath: app.isPackaged ? path.join(process.resourcesPath, 'serial-print.ps1') : path.join(__dirname, 'serial-print.ps1') }),
    savePdf: async (owner, pdf) => {
      const result = await dialog.showSaveDialog(owner, {
        title: 'Save PwarMyar document as PDF', defaultPath: 'PwarMyar-document.pdf',
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return false;
      await fs.promises.writeFile(result.filePath, pdf);
      return true;
    },
  });
  ipcMain.handle('desktop:get-printer-preference', () => {
    return JSON.parse(fs.readFileSync(paths.configPath, 'utf8')).printerName ?? null;
  });
  ipcMain.handle('desktop:set-printer-preference', (_event, name) => {
    if (typeof name !== 'string' || name.length > 255) throw new Error('Invalid printer name.');
    setPrinterConfig(paths.configPath, fromLegacy(name));
    return name;
  });
  ipcMain.handle('desktop:print-receipt', (_event, payload) => {
    if (checkingPrinter) throw new Error('Finish the connection check before printing.');
    const config = getPrinterConfig(paths.configPath);
    return printDocument({ ...payload, printerConfig: payload?.useSystemPrinter ? forDocument(config) : config });
  });
  let checkingPrinter = false;
  const serialOptions = () => ({ scriptPath: app.isPackaged ? path.join(process.resourcesPath, 'serial-print.ps1') : path.join(__dirname, 'serial-print.ps1') });
  ipcMain.handle('desktop:get-printer-config', () => getPrinterConfig(paths.configPath));
  ipcMain.handle('desktop:save-printer-config', (_event, input) => {
    if (printDocument.isBusy() || checkingPrinter) throw new Error('Finish the active print or connection check before saving printer settings.');
    return setPrinterConfig(paths.configPath, input);
  });
  ipcMain.handle('desktop:list-serial-ports', () => runSerial('list', {}, serialOptions()));
  ipcMain.handle('desktop:open-printer-settings', (_event, section) => shell.openExternal(section === 'bluetooth' ? 'ms-settings:bluetooth' : 'ms-settings:printers'));
  ipcMain.handle('desktop:check-printer', async (_event, input) => {
    if (printDocument.isBusy() || checkingPrinter) throw new Error('Another print or connection check is active.');
    const config = normalizeConfig(input);
    checkingPrinter = true;
    try {
      if (config.connection === 'tcp') await sendTcpBytes(config.tcp, null, config.thermal);
      else if (config.connection === 'bluetooth') await runSerial('test', serialRequest(config), serialOptions());
      else {
        const printers = await mainWindow.webContents.getPrintersAsync();
        const selected = config.windows.printerName ? printers.find(p => p.name === config.windows.printerName) : printers.find(p => p.isDefault);
        if (!selected) throw new Error('The selected Windows printer is not installed. Refresh printers and select a queue.');
        return { ok: true, message: `Windows queue found: ${selected.name}. This does not confirm the printer is online; use Test Print or a Windows test page.` };
      }
      return { ok: true, message: 'Connection opened successfully. No print data was sent. Use Test Print to check ESC/POS compatibility and output.' };
    } finally { checkingPrinter = false; }
  });
}

async function start() {
  splashWindow = createSplash();
  await new Promise((resolve) => splashWindow.webContents.once('did-finish-load', resolve));
  splashStatus('Opening the local offline database...');
  paths = resolveRuntimePaths({
    projectRoot: PROJECT_ROOT, resourcesPath: process.resourcesPath,
    userData: app.getPath('userData'), isPackaged: app.isPackaged,
  });
  ensureRuntimeFiles(paths);
  serverUrl = readServerUrl(paths);
  writeLog('INFO', 'PwarMyar Desktop starting', {
    version: app.getVersion(), packaged: app.isPackaged, serverUrl, databasePath: paths.databasePath,
  });
  desktopApi = createDesktopApiClient({
    serverUrl,
    fetchImpl: net.fetch,
    getCookies: (filter) => electronSession.defaultSession.cookies.get(filter),
  });
  store = new OfflineStore(paths.databasePath);
  registerIpc();
  mainWindow = createMainWindow();
  splashStatus('Checking the PwarMyar server...');
  if (!await loadOnline()) {
    splashStatus('Starting Offline POS...');
    await loadOffline();
  }
  startConnectivityMonitor();
}

app.setAppUserModelId(APP_ID);
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});
app.whenReady().then(start).catch((error) => {
  writeLog('ERROR', 'Desktop startup failed', error.stack || error.message);
  dialog.showErrorBox('PwarMyar could not start', error.message);
  app.quit();
});
app.on('before-quit', () => {
  clearInterval(connectivityTimer);
  try { store?.close(); } catch { /* already closed */ }
});
app.on('window-all-closed', () => app.quit());
