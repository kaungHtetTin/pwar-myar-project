import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeReceiptLayout,
  normalizeReceiptPaperSize,
  printHtmlDocument,
  receiptOptions,
  receiptPrintDocument,
} from './printing';

describe('compact mobile receipt printing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a narrow thermal document using the saved layout', () => {
    const html = receiptPrintDocument({
      title: 'R-10',
      html: '<div class="receipt"><h2>My Shop</h2><table><tr><td>Water</td><td>1,000</td></tr></table></div>',
      paperSize: '58mm',
      layout: { margin_left: 2, margin_right: 2, body_font_size: 7.5, line_height: 1.25 },
    });

    expect(html).toContain('@page { size: auto; margin: 0; }');
    expect(html).toContain('width: 58mm');
    expect(html).toContain('padding: 3mm 2mm 5mm 2mm');
    expect(html).toContain('font-size: 7.5pt');
    expect(html).toContain('line-height: 1.25');
    expect(html).toContain('receipt-shell receipt-thermal-paper');
    expect(html).toContain('max-width: min(100%, 34mm)');
    expect(html).toContain('.receipt-items-table, .receipt-page-footer { display: none; }');
    expect(html).toContain("window.addEventListener('afterprint',()=>window.close())");
  });

  it('combines receipt paper metadata with mobile settings', () => {
    expect(receiptOptions({ paper_size: '50mm', layout: { margin_left: 1 } }, {
      receipt_paper_size: '80mm', receipt_margin_left: 3, receipt_margin_right: 4,
      receipt_body_font_size: 8, receipt_line_height: 1.4,
    })).toEqual({
      paperSize: '50mm',
      layout: expect.objectContaining({ paper_size: '50mm', margin_left: 1, margin_right: 4, body_font_size: 8, line_height: 1.4 }),
    });
  });

  it('writes the compact receipt document to the print popup', async () => {
    const popup = { document: { write: vi.fn(), close: vi.fn() } };
    vi.spyOn(window, 'open').mockReturnValue(popup);

    await expect(printHtmlDocument({ title: 'Receipt', text: 'Shop <Main>', paperSize: '50mm' })).resolves.toBe(true);
    const html = popup.document.write.mock.calls[0][0];
    expect(html).toContain('@page { size: auto;');
    expect(html).toContain('width: 50mm');
    expect(html).toContain('Shop &lt;Main&gt;');
    expect(popup.document.close).toHaveBeenCalled();
  });

  it('matches the web document layout for A4 and A5 receipts', () => {
    const a4 = receiptPrintDocument({
      paperSize: 'a4',
      html: '<div class="receipt-document"><div class="receipt-document-heading">Shop</div><table class="receipt-items-table"></table></div>',
      layout: { margin_left: 14, margin_right: 16 },
    });
    const a5 = receiptPrintDocument({ paperSize: 'a5', text: 'A5 receipt' });

    expect(a4).toContain('@page { size: A4; margin: 0 0 18mm; }');
    expect(a4).toContain('padding: 12mm 16mm 14mm 14mm');
    expect(a4).toContain('max-width: 148mm; margin: 0 auto');
    expect(a4).toContain('receipt-shell receipt-document-paper');
    expect(a4).toContain('.receipt-items-table thead { display: table-header-group; }');
    expect(a4).toContain('position: fixed');
    expect(a5).toContain('@page { size: A5; margin: 0 0 18mm; }');
    expect(a5).toContain('width: 148mm');
    expect(a5).toContain('max-width: 118mm; margin: 0 auto');
    expect(normalizeReceiptPaperSize('A5')).toBe('a5');
  });

  it('can create a receipt document without browser print lifecycle scripts', () => {
    const html = receiptPrintDocument({ text: 'Native receipt', autoPrint: false });
    expect(html).not.toContain('window.print()');
    expect(html).not.toContain('afterprint');
  });

  it('bounds layout values and falls back to 80mm paper', () => {
    expect(normalizeReceiptPaperSize('unknown')).toBe('80mm');
    expect(normalizeReceiptLayout({ paper_size: '50mm', margin_left: 99, body_font_size: 2 })).toMatchObject({
      paperSize: '50mm', marginLeft: 12, bodyFontSize: 6,
    });
  });
});
