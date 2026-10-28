import myanmarRegular from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-400-normal.woff2?inline';
import myanmarBold from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-700-normal.woff2?inline';
import latinRegular from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-latin-400-normal.woff2?inline';
import latinBold from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-latin-700-normal.woff2?inline';

const PRINT_FONTS = `
  @font-face { font-family: 'PwarMyar Print'; font-weight: 400; src: url('${myanmarRegular}') format('woff2'); unicode-range: U+1000-109F,U+200C-200D,U+25CC,U+A9E0-A9FF,U+AA60-AA7F; }
  @font-face { font-family: 'PwarMyar Print'; font-weight: 700; src: url('${myanmarBold}') format('woff2'); unicode-range: U+1000-109F,U+200C-200D,U+25CC,U+A9E0-A9FF,U+AA60-AA7F; }
  @font-face { font-family: 'PwarMyar Print'; font-weight: 400; src: url('${latinRegular}') format('woff2'); unicode-range: U+0000-00FF,U+2000-206F,U+20A0-20CF; }
  @font-face { font-family: 'PwarMyar Print'; font-weight: 700; src: url('${latinBold}') format('woff2'); unicode-range: U+0000-00FF,U+2000-206F,U+20A0-20CF; }
`;

const PAPER_LAYOUTS = {
  '50mm': { page: 'auto', width: 50, defaultBodySize: 7.5 },
  '58mm': { page: 'auto', width: 58, defaultBodySize: 7.5 },
  '80mm': { page: 'auto', width: 80, defaultBodySize: 8.2 },
  '85mm': { page: 'auto', width: 85, defaultBodySize: 8.5 },
  a5: { page: 'A5', width: 148, defaultBodySize: 10 },
  a4: { page: 'A4', width: 210, defaultBodySize: 10.5 },
};

export function normalizeReceiptPaperSize(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PAPER_LAYOUTS[normalized] ? normalized : '80mm';
}

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

export function normalizeReceiptLayout(layout = {}, paperSize = '80mm') {
  const normalizedPaper = normalizeReceiptPaperSize(layout.paper_size || paperSize);
  const paper = PAPER_LAYOUTS[normalizedPaper];
  const documentPaper = ['a4', 'a5'].includes(normalizedPaper);
  const maximumMargin = documentPaper ? 30 : Math.min(12, Math.max((paper.width - 24) / 2, 0));
  const alignment = ['left', 'center', 'right'].includes(layout.header_alignment)
    ? layout.header_alignment
    : 'center';
  return {
    paperSize: normalizedPaper,
    page: paper.page,
    paperWidth: paper.width,
    documentPaper,
    contentWidth: normalizedPaper === 'a4' ? 148 : normalizedPaper === 'a5' ? 118 : paper.width,
    marginLeft: boundedNumber(layout.margin_left, 3, 0, maximumMargin),
    marginRight: boundedNumber(layout.margin_right, 3, 0, maximumMargin),
    headerAlignment: alignment,
    headerFontSize: boundedNumber(layout.header_font_size, 11, 7, 24),
    bodyFontSize: boundedNumber(layout.body_font_size, paper.defaultBodySize, 6, 18),
    lineHeight: boundedNumber(layout.line_height, 1.45, 1, 2.2),
  };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  }[character]));
}

export function receiptLayoutVariables(layout = {}, paperSize = '80mm') {
  const normalized = normalizeReceiptLayout(layout, paperSize);
  return {
    '--receipt-paper-width': `${normalized.paperWidth}mm`,
    '--receipt-margin-left': `${normalized.marginLeft}mm`,
    '--receipt-margin-right': `${normalized.marginRight}mm`,
    '--receipt-header-align': normalized.headerAlignment,
    '--receipt-header-size': `${normalized.headerFontSize}pt`,
    '--receipt-body-size': `${normalized.bodyFontSize}pt`,
    '--receipt-line-height': normalized.lineHeight,
  };
}

function receiptClassNumber(prefix, value, factor = 1) {
  return `${prefix}-${String(Math.round(Number(value) * factor)).replace('-', 'negative')}`;
}

/** Class-only receipt layout for web previews. Printed/office documents retain
 * CSS variables because they render in isolated documents outside the web UI. */
export function receiptLayoutClassNames(layout = {}, paperSize = '80mm') {
  const normalized = normalizeReceiptLayout(layout, paperSize);
  return [
    'receipt-document-host',
    `receipt-paper-${normalized.paperSize}`,
    `receipt-align-${normalized.headerAlignment}`,
    receiptClassNumber('receipt-margin-left', normalized.marginLeft, 2),
    receiptClassNumber('receipt-margin-right', normalized.marginRight, 2),
    receiptClassNumber('receipt-header-size', normalized.headerFontSize, 2),
    receiptClassNumber('receipt-body-size', normalized.bodyFontSize, 10),
    receiptClassNumber('receipt-line-height', normalized.lineHeight, 20),
  ].join(' ');
}

function receiptCss(layout) {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      width: 100%;
      font-family: "PwarMyar Print", "Noto Sans Myanmar", "Myanmar Text", Pyidaungsu, Arial, sans-serif;
    }
    .receipt-shell {
      width: ${layout.paperWidth}mm;
      max-width: 100%;
      padding: ${layout.documentPaper ? '12mm' : '3mm'} ${layout.marginRight}mm ${layout.documentPaper ? '14mm' : '5mm'} ${layout.marginLeft}mm;
    }
    .receipt-document {
      width: 100%;
      ${layout.documentPaper ? `max-width: ${layout.contentWidth}mm; margin: 0 auto;` : ''}
      min-width: 0;
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.lineHeight};
      overflow-wrap: anywhere;
    }
    .receipt-shop-header {
      text-align: ${layout.headerAlignment};
      font-size: ${layout.headerFontSize}pt;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .receipt-logo {
      display: block;
      width: auto;
      max-width: min(100%, 34mm);
      height: auto;
      max-height: 20mm;
      margin: 0 auto 1.5mm;
      object-fit: contain;
    }
    .receipt-shop-header .shop-name { font-weight: 800; }
    .receipt-shop-header .shop-title { font-weight: 650; }
    .receipt-shop-header .shop-address,
    .receipt-shop-header .shop-phone { font-size: 0.88em; }
    .receipt-rule { margin: 1.5mm 0; border-top: 0.25mm dashed #000; }
    .receipt-meta, .receipt-items, .receipt-totals { display: grid; gap: 0.7mm; }
    .receipt-items-table, .receipt-page-footer { display: none; }
    .receipt-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
      gap: 2mm;
      min-width: 0;
    }
    .receipt-row > span,
    .receipt-row > strong { min-width: 0; overflow-wrap: anywhere; }
    .receipt-row > strong { text-align: right; font-weight: 500; }
    .receipt-item { display: grid; gap: 0.4mm; break-inside: avoid; }
    .receipt-shop-header, .receipt-row, .receipt-totals { break-inside: avoid; }
    .receipt-item + .receipt-item { margin-top: 1mm; }
    .receipt-item-name { font-weight: 650; overflow-wrap: anywhere; }
    .receipt-item-amount > strong,
    .receipt-total > strong { font-weight: 800; }
    .receipt-foc { font-size: 0.92em; }
    .receipt-footer { text-align: center; overflow-wrap: anywhere; white-space: pre-wrap; }
    .receipt-voided { text-align: center; font-weight: 900; }
    .receipt-document-paper .receipt-document-heading {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
      align-items: start;
      gap: 12mm;
      break-inside: avoid;
    }
    .receipt-document-paper .receipt-shop-header { text-align: left; }
    .receipt-document-paper .receipt-logo { margin-right: 0; margin-left: 0; }
    .receipt-document-paper .receipt-rule { margin: 3mm 0; border-top-style: solid; border-top-color: #c8c8c8; }
    .receipt-document-paper .receipt-meta,
    .receipt-document-paper .receipt-totals { gap: 1.4mm; }
    .receipt-document-paper .receipt-items,
    .receipt-document-paper .receipt-footer--thermal { display: none; }
    .receipt-document-paper .receipt-items-table {
      display: table;
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .receipt-document-paper .receipt-items-table thead { display: table-header-group; }
    .receipt-document-paper .receipt-items-table tbody { display: table-row-group; }
    .receipt-document-paper .receipt-items-table tr { break-inside: avoid; page-break-inside: avoid; }
    .receipt-document-paper .receipt-items-table th,
    .receipt-document-paper .receipt-items-table td {
      padding: 2.2mm 2mm;
      border: 0.25mm solid #c8c8c8;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .receipt-document-paper .receipt-items-table th { background: #f3f3f3; font-weight: 700; }
    .receipt-document-paper .receipt-items-table .numeric { text-align: right; }
    .receipt-document-paper .receipt-items-table :is(th, td):first-child { width: 29%; }
    .receipt-document-paper .receipt-items-table :is(th, td):nth-child(2) { width: 15%; }
    .receipt-document-paper .receipt-items-table :is(th, td):nth-child(3),
    .receipt-document-paper .receipt-items-table :is(th, td):nth-child(4) { width: 9%; }
    .receipt-document-paper .receipt-items-table :is(th, td):nth-child(5) { width: 18%; }
    .receipt-document-paper .receipt-items-table :is(th, td):nth-child(6) { width: 20%; }
    .receipt-document-paper .receipt-totals { width: min(100%, 82mm); margin-left: auto; }
    .receipt-document-paper .receipt-page-footer {
      display: block;
      color: #444;
      text-align: center;
      white-space: pre-wrap;
    }
    @media print {
      .receipt-document-paper .receipt-page-footer {
        position: fixed;
        right: ${layout.marginRight}mm;
        bottom: 0;
        left: ${layout.marginLeft}mm;
        max-width: ${layout.contentWidth}mm;
        margin: 0 auto;
        padding-top: 2mm;
        border-top: 0.25mm solid #c8c8c8;
        background: #fff;
      }
    }
    .receipt-text-fallback {
      width: 100%;
      margin: 0;
      font: inherit;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `;
}

export function receiptPrintDocument(text, paperSize = '80mm', options = {}) {
  const layout = normalizeReceiptLayout(options.layout, paperSize);
  const content = options.html
    ? String(options.html)
    : `<pre class="receipt-document receipt-text-fallback">${escapeHtml(text)}</pre>`;
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>PwarMyar Receipt</title>
        <style>
          @page { size: ${layout.page}; margin: ${layout.documentPaper ? '0 0 18mm' : '0'}; }
          ${receiptCss(layout)}
        </style>
      </head>
      <body><div class="receipt-shell ${layout.documentPaper ? 'receipt-document-paper' : 'receipt-thermal-paper'}">${content}</div></body>
    </html>
  `;
}

export async function printReceiptText(text, paperSize = '80mm', options = {}) {
  // Every receipt path (online, reprint, offline, and test) uses the device's
  // layout rather than inheriting paper/font settings from another till.
  if (window.mkposDesktop?.getPrinterConfig) {
    const config = await window.mkposDesktop.getPrinterConfig();
    if (config.receiptLayout) options = { ...options, layout: { ...options.layout, ...config.receiptLayout } };
  }
  const layout = normalizeReceiptLayout(options.layout, paperSize);
  const documentHtml = receiptPrintDocument(text, paperSize, options);
  return printDocumentHtml(documentHtml, { ...options, paperSize: layout.paperSize });
}

let printBusy = false;
const listeners = new Set();
export const getPrintBusy = () => printBusy;
export function subscribePrinting(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function setPrintBusy(value) { printBusy = value; listeners.forEach((listener) => listener()); }

export function reservePrintWindow() {
  return window.mkposDesktop?.printReceipt ? null : window.open('', '_blank', 'width=900,height=760');
}

export function printResultMessage(result) {
  if (result?.cancelled) return 'Printing cancelled.';
  if (result?.mode === 'pdf') return 'PDF saved successfully.';
  if (result?.mode === 'escpos') return 'Receipt sent to the ESC/POS TCP destination.';
  if (result?.mode === 'bluetooth') return 'Receipt sent to the Bluetooth serial port. Check printer output.';
  return result?.mode === 'browser' ? 'Document opened in the browser print dialog.' : 'Print job submitted to Windows.';
}

export async function printDocumentHtml(html, { paperSize = 'a4', printerName = '', popup, useSystemPrinter = false, preservePageStyle = false } = {}) {
  if (printBusy) { popup?.close(); throw new Error('Another print job is already active.'); }
  setPrintBusy(true);
  try {
    const documentPageSize = paperSize === 'a4' ? 'A4' : paperSize === 'a5' ? 'A5' : '';
    const pageStyle = preservePageStyle ? '' : `@page { margin: 0; ${documentPageSize ? `size: ${documentPageSize};` : ''} }`;
    const documentHtml = html.replace(/<head\b[^>]*>/i, (head) => `${head}<meta charset="utf-8"><style>${PRINT_FONTS} body { font-family: 'PwarMyar Print', 'Myanmar Text', Arial, sans-serif !important; } tr { break-inside: avoid; } ${pageStyle}</style>`);
    if (window.mkposDesktop?.printReceipt) {
      const result = await window.mkposDesktop.printReceipt({ html: documentHtml, printerName: String(printerName), paperSize, useSystemPrinter });
      return { mode: 'desktop', ...result };
    }
    const printWindow = popup || reservePrintWindow();
    if (!printWindow) throw new Error('Cannot open the browser print dialog. Please allow pop-ups.');
    printWindow.document.write(documentHtml);
    printWindow.document.close();
    await printWindow.document.fonts?.ready;
    printWindow.focus();
    printWindow.print();
    return { ok: true, mode: 'browser' };
  } catch (error) {
    // Electron prefixes IPC errors with internal method names; show the useful cause.
    throw new Error(String(error.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
  } finally { setPrintBusy(false); }
}
