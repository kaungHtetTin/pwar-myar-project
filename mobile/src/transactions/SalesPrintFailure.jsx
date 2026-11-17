import { Button } from '../components/Controls';
import React from 'react';
import { CircleAlert, Printer } from 'lucide-react';
import { MobileSheet } from '../components/MobilePrimitives';
import { money } from '../products/productUtils';

export function SalesPrintFailure({ open, error, sale, settings, currency, printing, onClose, onRetry }) {
  const paper = settings.receipt_paper_size || settings.printer_paper_size || '80mm';
  return <MobileSheet open={open} title="Print receipt" description={paper ? `${paper} paper` : 'Receipt preview'} onClose={onClose} className="sales-print-failure-sheet"><div className="sales-receipt-preview"><div className="sales-receipt-paper"><strong data-no-localize>{settings.shop_name || 'PwarMyar'}</strong><small data-no-localize>{sale.receipt_no}</small><div>{(sale.items || []).slice(0, 4).map((item, i) => <span key={item.id || i}><span data-no-localize>{item.product_name}</span><b>{item.quantity}</b></span>)}</div><span>Total<strong>{money(sale.total, currency)}</strong></span><small className="sales-receipt-reference" data-no-localize>{sale.receipt_no}</small></div><span className="sales-receipt-error-icon"><CircleAlert size={38} /></span></div><div className="sales-print-error" role="alert"><CircleAlert size={23} /><div><strong>{/not connected/i.test(error || '') ? 'Printer not connected' : 'Receipt could not be printed'}</strong><p>{error}</p></div></div><footer><Button variant="secondary" className="mobile-secondary" type="button" disabled={printing} onClick={onClose}>Close</Button><Button variant="primary" className="mobile-primary" type="button" disabled={printing} onClick={onRetry}><Printer size={21} />{printing ? 'Printing…' : 'Retry print'}</Button></footer></MobileSheet>;
}
