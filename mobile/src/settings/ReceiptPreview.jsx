import React, { useMemo } from 'react';
import { normalizeReceiptLayout, receiptOptions, receiptPrintDocument } from '../utils/printing';

export function ReceiptPreview({ preview, settings, preparing = false }) {
  const document = useMemo(() => {
    if (!preview) return '';
    const options = receiptOptions(preview, settings);
    const layout = normalizeReceiptLayout(options.layout, options.paperSize);
    // Isolate receipt CSS from the application's form/card typography. Fit the
    // preview to the available space without changing the actual print layout.
    return receiptPrintDocument({ ...options, html: preview.html, text: preview.text, autoPrint: false })
      .replace('</head>', `<style>body{max-width:${layout.paperWidth}mm;margin:0 auto}.receipt-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.receipt-row>strong{white-space:normal;overflow-wrap:anywhere}img,table{max-width:100%}</style></head>`);
  }, [preview, settings]);
  return <section className="settings-receipt-preview" aria-label="Receipt preview" aria-busy={preparing}>
    <header className="mobile-receipt-preview-heading"><strong>Receipt preview</strong><small>{preparing ? 'Preparing…' : String(settings.receipt_paper_size || '80mm').toUpperCase()}</small></header>
    {document ? <iframe className="mobile-receipt-preview-frame" title="Receipt preview document" sandbox="" srcDoc={document} /> : <p className="mobile-receipt-preview-empty" role="status">Preview loading…</p>}
  </section>;
}
