import { describe, expect, it } from 'vitest';
import { deviceLayout, withDeviceLayout, sharedSettingsPayload, simplePrinterConfig } from './printerSettings';

describe('device-specific printer settings', () => {
  it('defaults hidden technical options without changing the selected destinations or familiar choices', () => {
    const config = { connection: 'bluetooth', documentPrinterName: 'Office Canon',
      windows: { printerName: 'Epson', copies: 2, color: false, landscape: true, silent: true, dpi: 600, duplex: 'longEdge', scale: 50, media: 'driver' },
      tcp: { host: '192.168.1.5', port: 9200 }, bluetooth: { port: 'COM4', baudRate: 115200, parity: 'Odd', dtr: true },
      thermal: { copies: 2, cut: 'full', widthDots: 832, imageMode: 'column', timeoutMs: 1000 } };
    const clean = simplePrinterConfig(config, 'a4');
    expect(clean.windows).toMatchObject({ printerName: 'Epson', copies: 2, color: false, landscape: true, silent: true, dpi: 0, duplex: 'simplex', scale: 100, media: 'document', margins: 'printableArea' });
    expect(clean.bluetooth).toMatchObject({ port: 'COM4', baudRate: 9600, parity: 'None', dtr: false });
    expect(clean.thermal).toMatchObject({ copies: 2, cut: 'full', widthDots: 0, imageMode: 'raster', timeoutMs: 30000 });
    expect(clean.tcp).toEqual(config.tcp);
    expect(clean.documentPrinterName).toBe('Office Canon');
    expect(config.windows.dpi).toBe(600);
    expect(simplePrinterConfig(config, '58mm').windows.margins).toBe('none');
    expect(simplePrinterConfig(config, 'a5').windows.margins).toBe('printableArea');
  });
  it('never includes printer names or layout values in a shared settings update', () => {
    const input = { shop_name: 'Shop', receipt_footer: 'Thank you', printer_name: 'Canon', receipt_paper_size: '58mm', receipt_margin_left: 2, receipt_header_alignment: 'left', receipt_header_font_size: 12, receipt_body_font_size: 8, receipt_line_height: 1.4, receipt_margin_right: 2 };
    expect(sharedSettingsPayload(input)).toEqual({ shop_name: 'Shop', receipt_footer: 'Thank you' });
    expect(deviceLayout(input).paper_size).toBe('58mm');
    expect(input.printer_name).toBe('Canon');
  });
  it('local layout wins when shared shop settings are refreshed', () => {
    expect(withDeviceLayout({ receipt_paper_size: 'a4', shop_name: 'Renamed shop', receipt_footer: 'New wording' }, { receiptLayout: { paper_size: '58mm', margin_left: 2 } })).toEqual({ receipt_paper_size: '58mm', receipt_margin_left: 2, shop_name: 'Renamed shop', receipt_footer: 'New wording' });
  });
});
