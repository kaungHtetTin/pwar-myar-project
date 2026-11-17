export const DEFAULT_SETTINGS = {
  shop_name: 'PwarMyar Shop', shop_title: '', shop_address: '', shop_phone: '', currency: 'Ks',
  payment_methods: 'Cash,Wallet Pay,Banking Pay,KPay,Wave Pay,Credit', receipt_footer: 'Thank you',
  receipt_show_customer: '1', receipt_show_payment_method: '1', receipt_show_price_type: '1', receipt_paper_size: '80mm',
  receipt_header_alignment: 'center', receipt_margin_left: 3, receipt_margin_right: 3, receipt_header_font_size: 11,
  receipt_body_font_size: 8.2, receipt_line_height: 1.45, printer_name: '', language: 'en', admin_pin: '', admin_pin_set: '0',
  barcode_label_format: 'sheet_a4_3x8', barcode_page_width_mm: 210, barcode_page_height_mm: 297,
  barcode_label_width_mm: 63.5, barcode_label_height_mm: 33.9, barcode_margin_x_mm: 7.25, barcode_margin_y_mm: 12.9,
  barcode_gap_x_mm: 2.5, barcode_gap_y_mm: 0, barcode_show_name: '1', barcode_show_value: '1',
};

export function settingsPageFromPath(pathname) {
  const priceEdit = pathname.match(/^\/settings\/prices\/([^/]+)\/edit$/);
  if (priceEdit) return { section: 'price-edit', value: decodeURIComponent(priceEdit[1]) };
  if (pathname === '/settings/prices/new') return { section: 'price-new', value: null };
  if (pathname === '/settings/data/restore') return { section: 'restore', value: null };
  if (pathname === '/settings/data/reset') return { section: 'reset', value: null };
  const section = pathname.match(/^\/settings\/([^/]+)$/)?.[1];
  return { section: section || 'overview', value: null };
}

export function settingsPayload(settings, patch = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...settings, ...patch };
  const checked = (value) => value === true || String(value) === '1';
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    shop_name: String(merged.shop_name || '').trim() || 'PwarMyar Shop', shop_title: String(merged.shop_title || ''), shop_address: String(merged.shop_address || ''),
    shop_phone: String(merged.shop_phone || ''), currency: String(merged.currency || '').trim() || 'Ks', payment_methods: String(merged.payment_methods || 'Cash'),
    receipt_footer: String(merged.receipt_footer || ''), receipt_show_customer: checked(merged.receipt_show_customer) ? '1' : '0', receipt_show_payment_method: checked(merged.receipt_show_payment_method) ? '1' : '0',
    receipt_show_price_type: checked(merged.receipt_show_price_type) ? '1' : '0', receipt_paper_size: ['50mm', '58mm', '80mm', '85mm', 'a5', 'a4'].includes(merged.receipt_paper_size) ? merged.receipt_paper_size : '80mm',
    receipt_header_alignment: ['left', 'center', 'right'].includes(merged.receipt_header_alignment) ? merged.receipt_header_alignment : 'center', receipt_margin_left: number(merged.receipt_margin_left, 3),
    receipt_margin_right: number(merged.receipt_margin_right, 3), receipt_header_font_size: number(merged.receipt_header_font_size, 11), receipt_body_font_size: number(merged.receipt_body_font_size, 8.2),
    receipt_line_height: number(merged.receipt_line_height, 1.45), printer_name: String(merged.printer_name || ''),
    barcode_label_format: ['sheet_a4_3x8', 'sheet_a4_4x10', 'roll_40x30', 'roll_50x30', 'roll_60x40', 'custom_sheet', 'custom_roll'].includes(merged.barcode_label_format) ? merged.barcode_label_format : 'sheet_a4_3x8',
    barcode_page_width_mm: number(merged.barcode_page_width_mm, 210), barcode_page_height_mm: number(merged.barcode_page_height_mm, 297),
    barcode_label_width_mm: number(merged.barcode_label_width_mm, 63.5), barcode_label_height_mm: number(merged.barcode_label_height_mm, 33.9),
    barcode_margin_x_mm: number(merged.barcode_margin_x_mm, 7.25), barcode_margin_y_mm: number(merged.barcode_margin_y_mm, 12.9),
    barcode_gap_x_mm: number(merged.barcode_gap_x_mm, 2.5), barcode_gap_y_mm: number(merged.barcode_gap_y_mm, 0),
    barcode_show_name: checked(merged.barcode_show_name) ? '1' : '0', barcode_show_value: checked(merged.barcode_show_value) ? '1' : '0',
    language: ['en', 'my'].includes(merged.language) ? merged.language : 'en', admin_pin: String(merged.admin_pin || ''),
  };
}

export function paymentMethodRows(value) { const rows = [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))]; return (rows.length ? rows : ['Cash']).map((name, index) => ({ id: `method-${index}-${name}`, name })); }

export function priceTypeRows(payload = {}) {
  const ruleMap = Object.fromEntries((payload.rules || []).map((rule) => [String(rule.name).toLowerCase(), rule]));
  return (payload.items || []).map((name) => ({ name, productCount: Number(payload.usage?.[name] || 0), pricing_mode: ruleMap[name.toLowerCase()]?.pricing_mode || 'manual', markup_percent: Number(ruleMap[name.toLowerCase()]?.markup_percent || 0), rounding: Number(ruleMap[name.toLowerCase()]?.rounding || 1), minimum_profit: Number(ruleMap[name.toLowerCase()]?.minimum_profit || 0), apply_to_existing: false }));
}
