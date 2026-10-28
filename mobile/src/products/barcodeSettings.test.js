import { describe, expect, it } from 'vitest';
import { barcodePrintDocument, normalizeBarcodeSettings } from './barcodeSettings';

describe('mobile barcode settings', () => {
  it('uses safe defaults and bounds', () => {
    expect(normalizeBarcodeSettings({ barcode_label_format: 'bad-format' })).toMatchObject({ format: 'sheet_a4_3x8', columns: 3, rows: 8, labelsPerPage: 24 });
  });

  it('renders configured sticker format and text', () => {
    const result = barcodePrintDocument([{ name: 'Grape', barcode: '456' }], { settings: { barcode_label_format: 'sheet_a4_4x10' }, title: 'Labels', escapeHtml: String, renderBarcode: (value) => `<svg>${value}</svg>` });
    expect(result.html).toContain('repeat(4,48mm)');
    expect(result.html).toContain('grid-auto-rows:25mm');
    expect(result.html).toContain('class="name">Grape');
    expect(result.html).toContain('class="value">456');
  });

  it('prints each roll label as its own physical page', () => {
    const result = barcodePrintDocument([{ name: 'Oil', barcode: '789' }], { settings: { barcode_label_format: 'roll_40x30' }, title: 'Labels', escapeHtml: String, renderBarcode: (value) => `<svg>${value}</svg>` });
    expect(result.paperSize).toBe('40mm 30mm');
    expect(result.html).toContain('page-break-after:always');
  });
});
