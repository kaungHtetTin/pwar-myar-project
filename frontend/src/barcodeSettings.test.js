import { describe, expect, it } from 'vitest';
import { barcodePrintDocument, normalizeBarcodeSettings } from './barcodeSettings';

describe('barcode settings', () => {
  it('normalizes invalid layout values', () => {
    expect(normalizeBarcodeSettings({ barcode_label_format: 'unknown' })).toMatchObject({ format: 'sheet_a4_3x8', pageWidth: 210, labelWidth: 63.5, columns: 3, rows: 8, labelsPerPage: 24 });
  });

  it('builds exact roll stickers and hides optional text', () => {
    const result = barcodePrintDocument([{ name: 'Apple', barcode: '123' }], { settings: { barcode_label_format: 'roll_50x30', barcode_show_name: '0', barcode_show_value: '0' }, title: 'Labels', escapeHtml: String, renderBarcode: (value) => `<svg>${value}</svg>` });
    expect(result.paperSize).toBe('50mm 30mm');
    expect(result.html).toContain('@page{size:50mm 30mm;margin:0mm 0mm}');
    expect(result.html).not.toContain('<h1');
    expect(result.html).not.toContain('class="name"');
    expect(result.html).not.toContain('class="value"');
  });

  it('calculates custom sheet capacity from the physical dimensions', () => {
    expect(normalizeBarcodeSettings({ barcode_label_format: 'custom_sheet', barcode_page_width_mm: 100, barcode_page_height_mm: 100, barcode_label_width_mm: 30, barcode_label_height_mm: 20, barcode_margin_x_mm: 4, barcode_margin_y_mm: 5, barcode_gap_x_mm: 2, barcode_gap_y_mm: 2 })).toMatchObject({ columns: 2, rows: 4, labelsPerPage: 8 });
  });
});
