import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeReceiptLayout,
  normalizeReceiptPaperSize,
  printReceiptText,
  receiptLayoutVariables,
  receiptLayoutClassNames,
  printDocumentHtml,
  printResultMessage,
} from './printing';

describe('receipt browser printing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.mkposDesktop;
  });

  it('uses the selected thermal paper size and escapes receipt text', async () => {
    const printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    await expect(printReceiptText('Shop <Main>', '50mm')).resolves.toMatchObject({ ok: true, mode: 'browser' });
    const html = printWindow.document.write.mock.calls[0][0];
    expect(html.includes('@page { size: auto;')).toBe(true);
    expect(html.includes('width: 50mm')).toBe(true);
    expect(html.includes('data:font/woff2;base64,')).toBe(true);
    expect(html).toContain('padding: 3mm 3mm 5mm 3mm');
    expect(html).toContain('white-space: pre-wrap');
    expect(html).toContain('Shop &lt;Main&gt;');
    expect(printWindow.print).toHaveBeenCalled();
  });

  it('uses a centered document receipt layout for normal A4 printers', async () => {
    const printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    await printReceiptText('PwarMyar Receipt', 'a4', {
      html: '<div class="receipt-document"><header class="receipt-shop-header">My Shop</header></div>',
      layout: {
        margin_left: 14,
        margin_right: 16,
        header_alignment: 'left',
        header_font_size: 15,
        body_font_size: 11,
        line_height: 1.6,
      },
    });
    const html = printWindow.document.write.mock.calls[0][0];
    expect(html).toContain('@page { size: A4; margin: 0 0 18mm;');
    expect(html).toContain('padding: 12mm 16mm 14mm 14mm');
    expect(html).toContain('max-width: 148mm; margin: 0 auto');
    expect(html).toContain('receipt-shell receipt-document-paper');
    expect(html).toContain('text-align: left');
    expect(html).toContain('font-size: 15pt');
    expect(html).toContain('font-size: 11pt');
    expect(html).toContain('line-height: 1.6');
    expect(html).toContain('grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr)');
    expect(html).toContain('.receipt-items-table thead { display: table-header-group; }');
    expect(html).toContain('position: fixed;');
    expect(html).toContain('My Shop');
  });

  it('supports A5 normal-printer receipts with an A5 page and compact document width', async () => {
    const printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    await printReceiptText('A5 receipt', 'a5', { layout: { paper_size: 'a5' } });
    const html = printWindow.document.write.mock.calls[0][0];
    expect(html).toContain('@page { size: A5; margin: 0 0 18mm;');
    expect(html).toContain('width: 148mm');
    expect(html).toContain('max-width: 118mm; margin: 0 auto');
    expect(normalizeReceiptPaperSize('A5')).toBe('a5');
  });

  it('falls back to 80 mm for unknown values', () => {
    expect(normalizeReceiptPaperSize('unknown')).toBe('80mm');
  });

  it('normalizes unsafe layout values and exposes preview variables', () => {
    expect(normalizeReceiptLayout({
      paper_size: '50mm',
      margin_left: 99,
      margin_right: -5,
      header_alignment: 'sideways',
      body_font_size: 2,
    })).toMatchObject({
      paperSize: '50mm',
      marginLeft: 12,
      marginRight: 0,
      headerAlignment: 'center',
      bodyFontSize: 6,
    });
    expect(receiptLayoutVariables({ margin_left: 2.5, margin_right: 4 }, '58mm')).toMatchObject({
      '--receipt-margin-left': '2.5mm',
      '--receipt-margin-right': '4mm',
    });
    expect(receiptLayoutClassNames({ margin_left: 2.5, margin_right: 4, header_alignment: 'left' }, '58mm'))
      .toContain('receipt-paper-58mm receipt-align-left receipt-margin-left-5 receipt-margin-right-8');
  });

  it('uses the native Electron print bridge without opening a popup', async () => {
    const printReceipt = vi.fn().mockResolvedValue({ ok: true });
    window.mkposDesktop = { printReceipt };
    const open = vi.spyOn(window, 'open');

    await expect(printReceiptText('Desktop receipt', '58mm', { printerName: 'Thermal Printer' }))
      .resolves.toMatchObject({ ok: true, mode: 'desktop' });

    expect(open).not.toHaveBeenCalled();
    expect(printReceipt).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('width: 58mm'),
      paperSize: '58mm',
      printerName: 'Thermal Printer',
    }));
  });

  it('propagates native Electron printing errors', async () => {
    window.mkposDesktop = { printReceipt: vi.fn().mockRejectedValue(new Error('Invalid printer settings')) };

    await expect(printReceiptText('Desktop receipt')).rejects.toThrow('Invalid printer settings');
  });

  it('uses the local device layout for receipts while keeping A4 document routing separate', async () => {
    window.mkposDesktop = { getPrinterConfig: vi.fn().mockResolvedValue({ receiptLayout: { paper_size: '58mm', margin_left: 2, body_font_size: 9 } }), printReceipt: vi.fn().mockResolvedValue({ ok: true, mode: 'bluetooth' }) };
    await printReceiptText('Local receipt', '80mm', { layout: { paper_size: '80mm' } });
    expect(window.mkposDesktop.printReceipt).toHaveBeenCalledWith(expect.objectContaining({ paperSize: '58mm', html: expect.stringContaining('width: 58mm') }));
    await printDocumentHtml('<html><head></head><body>A4</body></html>', { useSystemPrinter: true });
    expect(window.mkposDesktop.printReceipt).toHaveBeenLastCalledWith(expect.objectContaining({ paperSize: 'a4', useSystemPrinter: true }));
  });

  it('removes the IPC wrapper and reports PDF saves accurately', async () => {
    window.mkposDesktop = { printReceipt: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'desktop:print-receipt': Error: Cannot save PDF")) };
    await expect(printReceiptText('Receipt')).rejects.toThrow(/^Cannot save PDF$/);
    expect(printResultMessage({ ok: true, mode: 'pdf', status: 'saved' })).toBe('PDF saved successfully.');
  });

  it('keeps cancellation distinct and releases the lock for a later print', async () => {
    window.mkposDesktop = { printReceipt: vi.fn().mockResolvedValue({ ok: false, cancelled: true }) };
    const result = await printReceiptText('Cancelled');
    expect(printResultMessage(result)).toBe('Printing cancelled.');
    await expect(printReceiptText('Next')).resolves.toMatchObject({ cancelled: true });
  });

  it('prevents simultaneous jobs without suppressing a later reprint', async () => {
    let finish;
    window.mkposDesktop = { printReceipt: vi.fn(() => new Promise((resolve) => { finish = resolve; })) };
    const first = printReceiptText('First');
    await expect(printReceiptText('Second')).rejects.toThrow('already active');
    finish({ ok: true });
    await first;
    expect(window.mkposDesktop.printReceipt).toHaveBeenCalledTimes(1);
  });

  it('routes A4 documents through the bridge without blocked renderer popups', async () => {
    const open = vi.spyOn(window, 'open');
    window.mkposDesktop = { printReceipt: vi.fn().mockResolvedValue({ ok: true }) };
    await printDocumentHtml('<html><head></head><body>Statement</body></html>', { useSystemPrinter: true });
    expect(open).not.toHaveBeenCalled();
    expect(window.mkposDesktop.printReceipt).toHaveBeenCalledWith(expect.objectContaining({ paperSize: 'a4', useSystemPrinter: true }));
  });
});
