import { NativePrinter, isAndroidPrinter } from './printerProfile';
import myanmarRegular from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-400-normal.woff2?inline';
import myanmarBold from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-myanmar-700-normal.woff2?inline';
import latinRegular from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-latin-400-normal.woff2?inline';
import latinBold from '@fontsource/noto-sans-myanmar/files/noto-sans-myanmar-latin-700-normal.woff2?inline';

const printFonts = `
  @font-face{font-family:MKPOSReceipt;font-weight:400;src:url('${myanmarRegular}') format('woff2');unicode-range:U+1000-109F,U+200C-200D,U+25CC,U+A9E0-A9FF,U+AA60-AA7F}
  @font-face{font-family:MKPOSReceipt;font-weight:700;src:url('${myanmarBold}') format('woff2');unicode-range:U+1000-109F,U+200C-200D,U+25CC,U+A9E0-A9FF,U+AA60-AA7F}
  @font-face{font-family:MKPOSReceipt;font-weight:400;src:url('${latinRegular}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+20A0-20CF}
  @font-face{font-family:MKPOSReceipt;font-weight:700;src:url('${latinBold}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+20A0-20CF}
`;

const PAPER_LAYOUTS = {
  '50mm': { page: 'auto', width: 50, defaultBodySize: 7.5 },
  '58mm': { page: 'auto', width: 58, defaultBodySize: 7.5 },
  '80mm': { page: 'auto', width: 80, defaultBodySize: 8.2 },
  '85mm': { page: 'auto', width: 85, defaultBodySize: 8.5 },
  a5: { page: 'A5', width: 148, defaultBodySize: 10 },
  a4: { page: 'A4', width: 210, defaultBodySize: 10.5 },
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

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
  return {
    paperSize: normalizedPaper,
    page: paper.page,
    paperWidth: paper.width,
    documentPaper,
    contentWidth: normalizedPaper === 'a4' ? 148 : normalizedPaper === 'a5' ? 118 : paper.width,
    marginLeft: boundedNumber(layout.margin_left, 3, 0, maximumMargin),
    marginRight: boundedNumber(layout.margin_right, 3, 0, maximumMargin),
    headerAlignment: ['left', 'center', 'right'].includes(layout.header_alignment) ? layout.header_alignment : 'center',
    headerFontSize: boundedNumber(layout.header_font_size, 11, 7, 24),
    bodyFontSize: boundedNumber(layout.body_font_size, paper.defaultBodySize, 6, 18),
    lineHeight: boundedNumber(layout.line_height, 1.45, 1, 2.2),
  };
}

export function receiptOptions(receipt = {}, settings = {}) {
  const paperSize = receipt.paper_size || settings.receipt_paper_size || '80mm';
  return {
    paperSize,
    layout: {
      paper_size: paperSize,
      header_alignment: settings.receipt_header_alignment,
      margin_left: settings.receipt_margin_left,
      margin_right: settings.receipt_margin_right,
      header_font_size: settings.receipt_header_font_size,
      body_font_size: settings.receipt_body_font_size,
      line_height: settings.receipt_line_height,
      ...(receipt.layout || {}),
    },
  };
}

function receiptCss(layout) {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    ${printFonts}
    body { width: 100%; font-family: MKPOSReceipt, "Noto Sans Myanmar", "Myanmar Text", Pyidaungsu, Arial, sans-serif; }
    .receipt-shell {
      width: ${layout.paperWidth}mm;
      max-width: 100%;
      padding: ${layout.documentPaper ? '12mm' : '3mm'} ${layout.marginRight}mm ${layout.documentPaper ? '14mm' : '5mm'} ${layout.marginLeft}mm;
    }
    .receipt-document, .receipt-shell > .receipt {
      width: 100%;
      ${layout.documentPaper ? `max-width: ${layout.contentWidth}mm; margin: 0 auto;` : 'margin: 0;'}
      min-width: 0;
      font-size: ${layout.bodyFontSize}pt;
      line-height: ${layout.lineHeight};
      overflow-wrap: anywhere;
    }
    .receipt-shop-header { text-align: ${layout.headerAlignment}; font-size: ${layout.headerFontSize}pt; line-height: 1.45; overflow-wrap: anywhere; }
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
    .receipt-shop-header .shop-address, .receipt-shop-header .shop-phone { font-size: .88em; }
    .receipt-rule { margin: 1.5mm 0; border-top: .25mm dashed #000; }
    .receipt-meta, .receipt-items, .receipt-totals { display: grid; gap: .7mm; }
    .receipt-items-table, .receipt-page-footer { display: none; }
    .receipt-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 2mm; min-width: 0; }
    .receipt-row > span, .receipt-row > strong { min-width: 0; overflow-wrap: anywhere; }
    .receipt-row > strong { text-align: right; font-weight: 500; }
    .receipt-item { display: grid; gap: .4mm; break-inside: avoid; }
    .receipt-shop-header, .receipt-row, .receipt-totals { break-inside: avoid; }
    .receipt-item + .receipt-item { margin-top: 1mm; }
    .receipt-item-name { font-weight: 650; overflow-wrap: anywhere; }
    .receipt-item-amount > strong, .receipt-total > strong { font-weight: 800; }
    .receipt-foc { font-size: .92em; }
    .receipt-footer { text-align: center; overflow-wrap: anywhere; white-space: pre-wrap; }
    .receipt-voided { text-align: center; font-weight: 900; }
    .receipt-document-paper .receipt-document-heading {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr);
      align-items: start;
      gap: 12mm;
      break-inside: avoid;
    }
    .receipt-document-paper .receipt-shop-header { text-align: left; }
    .receipt-document-paper .receipt-logo { margin-right: 0; margin-left: 0; }
    .receipt-document-paper .receipt-rule { margin: 3mm 0; border-top-style: solid; border-top-color: #c8c8c8; }
    .receipt-document-paper .receipt-meta, .receipt-document-paper .receipt-totals { gap: 1.4mm; }
    .receipt-document-paper:has(.receipt-items-table) .receipt-items,
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
      border: .25mm solid #c8c8c8;
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
    .receipt-document-paper .receipt-page-footer { display: block; color: #444; text-align: center; white-space: pre-wrap; }
    @media print {
      .receipt-document-paper .receipt-page-footer {
        position: fixed;
        right: ${layout.marginRight}mm;
        bottom: 0;
        left: ${layout.marginLeft}mm;
        max-width: ${layout.contentWidth}mm;
        margin: 0 auto;
        padding-top: 2mm;
        border-top: .25mm solid #c8c8c8;
        background: #fff;
      }
    }
    .receipt-text-fallback { width: 100%; margin: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
    .receipt-shell > .receipt h2 { margin: 0 0 .7mm; text-align: ${layout.headerAlignment}; font-size: ${layout.headerFontSize}pt; line-height: 1.25; }
    .receipt-shell > .receipt p { margin: 0 0 1mm; text-align: ${layout.headerAlignment}; }
    .receipt-shell > .receipt table { width: 100%; border-collapse: collapse; font: inherit; }
    .receipt-shell > .receipt td, .receipt-shell > .receipt th { padding: .55mm 0; border: 0; vertical-align: top; }
    .receipt-shell > .receipt hr { margin: 1mm 0; border: 0; border-top: .25mm dashed #000; }
    .receipt-shell > .receipt > strong { display: block; text-align: right; font-size: 1.08em; }
  `;
}

export function isNativeAndroidPrinting() {
  return isAndroidPrinter();
}

export function receiptPrintDocument({ title = 'PwarMyar Receipt', html = '', text = '', paperSize = '80mm', layout = {}, autoPrint = true } = {}) {
  const normalized = normalizeReceiptLayout(layout, paperSize);
  const content = html ? String(html) : `<pre class="receipt-document receipt-text-fallback">${escapeHtml(text)}</pre>`;
  const printScript = autoPrint ? "<script>window.addEventListener('afterprint',()=>window.close());window.onload=()=>{window.focus();window.print()}</script>" : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>@page { size: ${normalized.page}; margin: ${normalized.documentPaper ? '0 0 18mm' : '0'}; }${receiptCss(normalized)}</style></head><body><div class="receipt-shell ${normalized.documentPaper ? 'receipt-document-paper' : 'receipt-thermal-paper'}">${content}</div>${printScript}</body></html>`;
}

export function reserveBrowserPrintWindow(name = '_blank', features = 'width=900,height=820') {
  if (isNativeAndroidPrinting()) return null;
  return window.open('', name, features);
}

export async function printDocumentHtml({ title = 'PwarMyar Print', documentHtml = '', popup = null, popupName = '_blank', popupFeatures = 'width=900,height=820', kind = 'document' } = {}) {
  if (isNativeAndroidPrinting()) {
    const securedFonts = String(documentHtml).includes('font-family:MKPOSReceipt') ? String(documentHtml) : String(documentHtml).replace(/<\/head>/i, head => `<style>${printFonts}body{font-family:MKPOSReceipt,sans-serif}</style>${head}`);
    const result = await NativePrinter.print({ title, html: securedFonts, kind });
    window.dispatchEvent(new CustomEvent('mkpos:print-status', { detail: result }));
    return true;
  }

  const target = popup || window.open('', popupName, popupFeatures);
  if (!target) return false;
  target.document.write(String(documentHtml));
  target.document.close();
  return true;
}

export async function printHtmlDocument(options = {}) {
  const nativeAndroid = isNativeAndroidPrinting();
  const config = nativeAndroid ? await NativePrinter.getConfig() : null;
  const paper = normalizeReceiptPaperSize(config?.paper || options.layout?.paper_size || options.paperSize);
  const documentHtml = receiptPrintDocument({ ...options, paperSize: paper, layout: { ...options.layout, paper_size: paper }, autoPrint: !nativeAndroid });
  const documentPaper = ['a4', 'a5'].includes(paper);
  const popup = nativeAndroid ? null : window.open('', '_blank', documentPaper ? 'width=900,height=820' : 'width=480,height=820');
  if (!nativeAndroid && !popup) return false;
  return printDocumentHtml({
    title: options.title || 'PwarMyar Receipt',
    documentHtml,
    popup,
    kind: 'receipt',
    popupFeatures: documentPaper ? 'width=900,height=820' : 'width=480,height=820',
  });
}
