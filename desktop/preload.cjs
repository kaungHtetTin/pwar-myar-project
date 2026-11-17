const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mkposDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  applyTheme: (payload) => ipcRenderer.invoke('desktop:apply-theme', payload),
  openTutorials: () => ipcRenderer.invoke('desktop:open-tutorials'),
  apiRequest: (payload) => ipcRenderer.invoke('desktop:api-request', payload),
  getBootstrap: () => ipcRenderer.invoke('desktop:get-bootstrap'),
  cacheOnlineData: (payload) => ipcRenderer.invoke('desktop:cache-online-data', payload),
  clearOfflineSession: () => ipcRenderer.invoke('desktop:clear-offline-session'),
  getOfflineData: () => ipcRenderer.invoke('desktop:get-offline-data'),
  createOfflineSale: (payload) => ipcRenderer.invoke('desktop:create-offline-sale', payload),
  listOfflineSales: (options) => ipcRenderer.invoke('desktop:list-offline-sales', options),
  markSaleSyncing: (id) => ipcRenderer.invoke('desktop:mark-sale-syncing', id),
  markSaleSynced: (id, sale) => ipcRenderer.invoke('desktop:mark-sale-synced', { id, sale }),
  markSaleFailed: (id, message) => ipcRenderer.invoke('desktop:mark-sale-failed', { id, message }),
  retryFailedSale: (id) => ipcRenderer.invoke('desktop:retry-failed-sale', id),
  markSalePending: (id, message) => ipcRenderer.invoke('desktop:mark-sale-pending', { id, message }),
  checkConnectivity: () => ipcRenderer.invoke('desktop:check-connectivity'),
  switchMode: (mode) => ipcRenderer.invoke('desktop:switch-mode', mode),
  openOnline: () => ipcRenderer.invoke('desktop:open-online'),
  openLogFolder: () => ipcRenderer.invoke('desktop:open-log-folder'),
  getPrinters: () => ipcRenderer.invoke('desktop:get-printers'),
  getPrinterConfig: () => ipcRenderer.invoke('desktop:get-printer-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('desktop:save-printer-config', config),
  listSerialPorts: () => ipcRenderer.invoke('desktop:list-serial-ports'),
  checkPrinter: (config) => ipcRenderer.invoke('desktop:check-printer', config),
  openPrinterSettings: (section) => ipcRenderer.invoke('desktop:open-printer-settings', section),
  getPrinterPreference: () => ipcRenderer.invoke('desktop:get-printer-preference'),
  setPrinterPreference: (name) => ipcRenderer.invoke('desktop:set-printer-preference', name),
  printReceipt: (payload) => ipcRenderer.invoke('desktop:print-receipt', payload),
  onConnectivityChanged: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on('desktop:connectivity', handler);
    return () => ipcRenderer.removeListener('desktop:connectivity', handler);
  },
}));

window.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('mkpos-desktop'));
