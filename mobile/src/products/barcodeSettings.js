export const BARCODE_LABEL_FORMATS = Object.freeze({
  sheet_a4_3x8: { label: 'A4 sheet · 63.5 × 33.9 mm · 24 stickers', mode: 'sheet', pageWidth: 210, pageHeight: 297, labelWidth: 63.5, labelHeight: 33.9, gapX: 2.5, gapY: 0, marginX: 7.25, marginY: 12.9 },
  sheet_a4_4x10: { label: 'A4 sheet · 48 × 25 mm · 40 stickers', mode: 'sheet', pageWidth: 210, pageHeight: 297, labelWidth: 48, labelHeight: 25, gapX: 2, gapY: 0, marginX: 6, marginY: 23.5 },
  roll_40x30: { label: 'Thermal roll · 40 × 30 mm', mode: 'roll', pageWidth: 40, pageHeight: 30, labelWidth: 40, labelHeight: 30, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  roll_50x30: { label: 'Thermal roll · 50 × 30 mm', mode: 'roll', pageWidth: 50, pageHeight: 30, labelWidth: 50, labelHeight: 30, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  roll_60x40: { label: 'Thermal roll · 60 × 40 mm', mode: 'roll', pageWidth: 60, pageHeight: 40, labelWidth: 60, labelHeight: 40, gapX: 0, gapY: 0, marginX: 0, marginY: 0 },
  custom_sheet: { label: 'Custom sticker sheet', mode: 'sheet' },
  custom_roll: { label: 'Custom thermal roll', mode: 'roll' },
});

export const DEFAULT_BARCODE_SETTINGS = Object.freeze({
  barcode_label_format: 'sheet_a4_3x8', barcode_page_width_mm: 210, barcode_page_height_mm: 297,
  barcode_label_width_mm: 63.5, barcode_label_height_mm: 33.9, barcode_margin_x_mm: 7.25,
  barcode_margin_y_mm: 12.9, barcode_gap_x_mm: 2.5, barcode_gap_y_mm: 0,
  barcode_show_name: '1', barcode_show_value: '1',
});

const enabled = (value) => value === true || String(value).trim() === '1';
const bounded = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};

export function normalizeBarcodeSettings(settings = {}) {
  const merged = { ...DEFAULT_BARCODE_SETTINGS, ...settings };
  const format = BARCODE_LABEL_FORMATS[merged.barcode_label_format] ? merged.barcode_label_format : 'sheet_a4_3x8';
  const preset = BARCODE_LABEL_FORMATS[format];
  const custom = format.startsWith('custom_');
  const mode = preset.mode;
  const pageWidth = custom ? bounded(merged.barcode_page_width_mm, mode === 'roll' ? 50 : 210, 20, 400) : preset.pageWidth;
  const pageHeight = custom ? bounded(merged.barcode_page_height_mm, mode === 'roll' ? 30 : 297, 20, 600) : preset.pageHeight;
  const labelWidth = custom ? bounded(merged.barcode_label_width_mm, mode === 'roll' ? pageWidth : 63.5, 15, Math.min(200, pageWidth)) : preset.labelWidth;
  const labelHeight = custom ? bounded(merged.barcode_label_height_mm, mode === 'roll' ? pageHeight : 33.9, 18, Math.min(120, pageHeight)) : preset.labelHeight;
  const marginX = mode === 'roll' ? 0 : (custom ? bounded(merged.barcode_margin_x_mm, 5, 0, 30) : preset.marginX);
  const marginY = mode === 'roll' ? 0 : (custom ? bounded(merged.barcode_margin_y_mm, 5, 0, 30) : preset.marginY);
  const gapX = mode === 'roll' ? 0 : (custom ? bounded(merged.barcode_gap_x_mm, 2, 0, 20) : preset.gapX);
  const gapY = mode === 'roll' ? 0 : (custom ? bounded(merged.barcode_gap_y_mm, 2, 0, 20) : preset.gapY);
  const columns = mode === 'roll' ? 1 : Math.max(1, Math.floor((pageWidth - (marginX * 2) + gapX) / (labelWidth + gapX)));
  const rows = mode === 'roll' ? 1 : Math.max(1, Math.floor((pageHeight - (marginY * 2) + gapY) / (labelHeight + gapY)));
  return { format, mode, pageWidth, pageHeight, labelWidth, labelHeight, marginX, marginY, gapX, gapY, columns, rows, labelsPerPage: columns * rows, barcode_show_name: enabled(merged.barcode_show_name) ? '1' : '0', barcode_show_value: enabled(merged.barcode_show_value) ? '1' : '0' };
}

export function barcodePrintDocument(rows, { settings, title, escapeHtml, renderBarcode }) {
  const layout = normalizeBarcodeSettings(settings);
  const showName = layout.barcode_show_name === '1';
  const showValue = layout.barcode_show_value === '1';
  const verticalTextSpace = (showName ? 5.5 : 0) + (showValue ? 4.5 : 0);
  const barcodeHeight = Math.max(8, layout.labelHeight - verticalTextSpace - (layout.mode === 'roll' ? 4 : 6));
  const labels = rows.map((product) => `<article class="label">${showName ? `<div class="name">${escapeHtml(product.name)}</div>` : ''}<div class="barcode">${renderBarcode(product.barcode)}</div>${showValue ? `<div class="value">${escapeHtml(product.barcode)}</div>` : ''}</article>`).join('');
  const pageRule = `${layout.pageWidth}mm ${layout.pageHeight}mm`;
  const sheetRules = layout.mode === 'sheet'
    ? `.labels{display:grid;grid-template-columns:repeat(${layout.columns},${layout.labelWidth}mm);grid-auto-rows:${layout.labelHeight}mm;gap:${layout.gapY}mm ${layout.gapX}mm}.label{width:${layout.labelWidth}mm;height:${layout.labelHeight}mm}`
    : `.labels{display:block}.label{width:${layout.labelWidth}mm;height:${layout.labelHeight}mm;break-after:page;page-break-after:always}.label:last-child{break-after:auto;page-break-after:auto}`;
  return { paperSize: pageRule, layout, html: `<html><head><title>${escapeHtml(title)}</title><style>@page{size:${pageRule};margin:${layout.marginY}mm ${layout.marginX}mm}*{box-sizing:border-box}html,body{margin:0;padding:0;color:#111;background:#fff;font-family:Arial,sans-serif}body{width:${layout.pageWidth - (layout.marginX * 2)}mm}${sheetRules}.label{display:flex;min-width:0;padding:${layout.mode === 'roll' ? 1.5 : 2}mm;overflow:hidden;break-inside:avoid;flex-direction:column;justify-content:center;text-align:center}.name{overflow:hidden;margin-bottom:1mm;font-size:${layout.labelWidth <= 40 ? 8 : 10}px;font-weight:700;line-height:1.1;text-overflow:ellipsis;white-space:nowrap}.barcode{display:flex;min-height:0;flex:1;align-items:center;justify-content:center;overflow:hidden}.barcode svg{display:block;width:100%;height:${barcodeHeight}mm}.value{overflow:hidden;margin-top:.8mm;font-family:monospace;font-size:${layout.labelWidth <= 40 ? 7 : 9}px;line-height:1;letter-spacing:.25px;white-space:nowrap}</style></head><body><main class="labels">${labels}</main></body></html>` };
}
