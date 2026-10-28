export const Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
export const registerPlugin = () => ({
  getConfig: async () => ({ connection: window.printerFixtureMode || 'system', paper: '58mm', host: '192.168.1.5', port: 9100, copies: 1, address: '', cut: false, color: true, landscape: false }),
  saveConfig: async ({ config }) => config,
  checkConnection: async () => ({ message: 'Connection available. No receipt sent.' }),
  listPaired: async () => ({ items: [{ name: 'Thermal test printer with a long device name', address: '00:11:22:33:44:55' }], total: 1 }),
  openBluetoothSettings: async () => ({}),
});
