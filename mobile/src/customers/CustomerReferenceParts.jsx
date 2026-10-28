import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { FloatingActionButton, ChoiceGroup, Button, IconButton, Radio } from '../components/Controls';
import React from 'react';
import { MoreHorizontal, ChevronLeft, ChevronRight, Plus, Package } from 'lucide-react';

import { backSourcePath } from '../navigation/historyNavigation';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { customerDate } from './customerUtils';
import { money } from '../products/productUtils';

export function CustomerReferenceHeader({ actions, title, onBack, onNew, onMenu, backPath = '/customers' }) {
  
  return <><PageAppBar className="retail-sale-header customer-reference-header">{onBack && <IconButton variant="ghost" type="button" aria-label={`Back to ${backSourcePath(backPath).split('/')[1]}`} onClick={onBack}><ChevronLeft size={26} /></IconButton>}<h1 data-no-localize={title !== 'Customers' && !/^(New|Edit) /.test(title) ? true : undefined}>{title}</h1>{onMenu && <IconButton variant="ghost" type="button" aria-label="Customer actions" onClick={onMenu}><MoreHorizontal size={23} /></IconButton>}{actions}<AppBarMenu /></PageAppBar>{onNew && <FloatingActionButton label="New customer" onClick={onNew}><Plus size={24} aria-hidden="true" /></FloatingActionButton>}</>;
}

export function CustomerReferenceSale({ sale, currency, onOpen }) {
  const due = Number(sale.credit_amount || 0), total = Number(sale.total || 0);
  return <article className="customer-reference-sale"><Button variant="plain" className="customer-reference-sale-heading" type="button" aria-label={`View sale ${sale.receipt_no || sale.id}`} onClick={onOpen}><span><strong data-no-localize>{sale.receipt_no || `Sale #${sale.id}`}</strong><small>{customerDate(sale.created_at, true)}</small></span><span className="customer-sale-state">{due > 0 ? due < total ? 'Partial payment' : 'Unpaid' : 'Paid'}</span><ChevronRight size={18} /></Button>{sale.items?.length > 0 && <div className="customer-reference-sale-products">{sale.items.map(item => <div key={item.id || `${item.product_id}-${item.price_type}`}><span className="customer-sale-photo">{item.photo_url ? <ProductPhoto path={item.photo_url} /> : <Package size={23} />}</span><span><strong data-no-localize>{item.product_name}</strong><small data-no-localize>{item.unit_name || item.price_type}</small></span><span><small>{item.quantity} × {Number(item.unit_price).toLocaleString('en-US')}</small><strong>{money(item.line_total ?? Number(item.quantity) * Number(item.unit_price), currency)}</strong></span></div>)}</div>}<div className="customer-reference-sale-totals"><span>Total amount<strong>{money(total, currency)}</strong></span><span>Paid<strong>{money(sale.paid_amount ?? total - due, currency)}</strong></span><span>Due<strong>{money(due, currency)}</strong></span></div></article>;
}

export function CustomerReferencePayment({ payment, currency, onActions }) {
  const date = payment.created_at ? new Date(payment.created_at.replace(' ', 'T')) : null;
  const time = date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return <article className="customer-reference-payment-entry"><Button variant="plain" className="customer-reference-payment-row" type="button" aria-label={`Actions for payment ${payment.id}`} onClick={onActions}><span className="customer-payment-date"><strong>{customerDate(payment.created_at)}</strong>{time && <small>{time}</small>}</span><span className="customer-payment-method"><span data-no-localize>{payment.payment_method || 'Cash'}</span><small>#{payment.id}</small></span><span className={`customer-payment-value${payment.direction === 'shop_to_customer' ? ' is-payout' : ''}`}><strong>{money(payment.amount, currency)}</strong><small>{payment.direction === 'shop_to_customer' ? 'Shop pays customer' : 'Customer pays shop'}</small></span><ChevronRight size={19} /></Button>{payment.note && <p className="customer-payment-record-note" data-no-localize>{payment.note}</p>}</article>;
}

export function CustomerBalanceChoices({ value, onChange }) {
  return <ChoiceGroup className="customer-balance-choices"><legend>Balance state</legend>{[['all', 'All'], ['receivable', 'Customer owes shop'], ['payable', 'Shop owes customer'], ['settled', 'Settled']].map(([key, label]) => <label className={value === key ? 'is-selected' : ''} key={key}><Radio type="radio" name="customer-balance-state" value={key} checked={value === key} onChange={() => onChange(key)} /><span className={`customer-balance-choice-label balance-${key}`}>{label}</span></label>)}</ChoiceGroup>;
}
