import { Button } from '../components/Controls';
import React from 'react';
import { Edit3, Trash2, Wallet } from 'lucide-react';
import { money } from '../products/productUtils';
import { PurchaseReferenceHeader, PurchaseReferenceItems, PurchaseSupplierSummary } from './PurchaseReferenceParts';

export function PurchaseReferenceDetail({ purchase, currency, onBack, onEdit, onDelete, onPrint, onSupplier, notice, deleteSheet }) {
  const date = (purchase.purchase_date || purchase.created_at) ? new Date((purchase.purchase_date || purchase.created_at).replace(' ', 'T')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const credit = Number(purchase.credit_amount || 0), paid = Number(purchase.paid_amount || 0), total = Number(purchase.total_cost || 0);
  return <main className="sale-retail-page purchase-reference-page purchase-reference-detail"><PurchaseReferenceHeader title={`PUR${String(purchase.id).padStart(4, '0')}`} onBack={onBack} onPrint={onPrint} />{notice}
    <section className="purchase-reference-panel purchase-detail-supplier"><PurchaseSupplierSummary name={purchase.supplier_name} onOpen={onSupplier} /><div className="purchase-detail-metadata"><span><small>Purchase date</small><strong>{date}</strong></span><span><small>Payment method</small><strong>{purchase.payment_method || 'Cash'}</strong></span><span><small>Status</small><strong className={`purchase-payment-badge ${credit ? paid ? 'has-credit' : 'has-credit is-unpaid' : ''}`}>{credit ? paid ? 'Part paid' : 'Unpaid' : 'Paid'}</strong></span></div></section>
    <div className="purchase-detail-items-panel"><PurchaseReferenceItems items={purchase.items || []} currency={currency} detail /><section className="purchase-reference-panel purchase-detail-totals"><span>Subtotal<strong>{money(total, currency)}</strong></span><span>Discount<strong>{money(purchase.discount || 0, currency)}</strong></span><span>Total amount<strong>{money(total, currency)}</strong></span><span>Paid amount<strong>{money(paid, currency)}</strong></span><span className="purchase-detail-balance">Balance<strong>{money(credit, currency)}</strong></span>{credit > 0 && <small>Shop owes supplier</small>}</section></div>
    <section className="purchase-reference-panel purchase-recorded-payment"><h2>Payment history ({paid > 0 ? 1 : 0})</h2>{paid > 0 && <div><Wallet size={21} /><span><time>{date}{purchase.created_at && `, ${new Date(purchase.created_at.replace(' ', 'T')).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}</time><small>{purchase.payment_method || 'Cash'}</small></span><strong>{money(paid, currency)}</strong></div>}</section>
    {purchase.note && <section className="purchase-reference-panel"><h2>Note</h2><p className="purchase-review-note" data-no-localize>{purchase.note}</p></section>}
    <footer className="purchase-reference-footer"><div><Button variant="secondary" className="mobile-secondary" type="button" aria-label="Edit purchase" onClick={onEdit}><Edit3 size={18} />Edit</Button><Button variant="danger" className="mobile-danger" type="button" aria-label="Delete purchase" onClick={onDelete}><Trash2 size={18} />Delete</Button></div></footer>{deleteSheet}
  </main>;
}
