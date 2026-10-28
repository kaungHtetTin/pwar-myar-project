export const DEVICE_LAYOUT_KEYS = ['paper_size', 'header_alignment', 'margin_left', 'margin_right', 'header_font_size', 'body_font_size', 'line_height'];
export function deviceLayout(settings) {
  return Object.fromEntries(DEVICE_LAYOUT_KEYS.map(key => [key, settings[`receipt_${key}`]]));
}
export function withDeviceLayout(settings, config) {
  const overrides = Object.fromEntries(Object.entries(config?.receiptLayout || {}).map(([key, value]) => [`receipt_${key}`, value]));
  return { ...settings, ...overrides };
}
export function sharedSettingsPayload(settings) {
  const shared = { ...settings };
  delete shared.printer_name;
  DEVICE_LAYOUT_KEYS.forEach(key => delete shared[`receipt_${key}`]);
  return shared;
}
// Keep only everyday choices; reset hidden technical options on explicit Save.
export function simplePrinterConfig(config, paper = config.receiptLayout?.paper_size) {
  return { ...config,
    windows: { ...config.windows, media: 'document', margins: ['a4', 'a5'].includes(paper) ? 'printableArea' : 'none', scale: 100, duplex: 'simplex', dpi: 0 },
    bluetooth: { ...config.bluetooth, baudRate: 9600, dataBits: 8, stopBits: 'One', parity: 'None', handshake: 'None', dtr: false, rts: false },
    thermal: { ...config.thermal, widthDots: 0, threshold: 180, imageMode: 'raster', feedLines: 3, timeoutMs: 30000, chunkSize: 512, chunkDelayMs: 10 },
  };
}
