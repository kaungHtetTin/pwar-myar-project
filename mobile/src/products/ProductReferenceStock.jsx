import { Button, FieldShell, IconButton, Input } from '../components/Controls';
import React from 'react';
import { ArrowDown, ArrowUp, RefreshCw, X } from 'lucide-react';
import { ProductReferenceHeader, ProductReferenceProfile, ProductUnitInput } from './ProductReferenceParts';
import { baseUnitName, formatQuantity } from './productUtils';
import { useLocale } from '../localization/LocaleContext';

export function ProductReferenceStock({ product, currency, quantity, setQuantity, reason, setReason, saving, valid, onSubmit, onBack, notice, onDismiss, list, footer }) {
  const { language } = useLocale();
  const dateLocale = language === 'my' ? 'my-MM' : 'en-US';
  const removing = Number(quantity) < 0;
  function selectDirection(remove) { const value = Math.abs(Number(quantity) || 0); setQuantity(value ? String(remove ? -value : value) : remove ? '-' : ''); }
  return <main className="sale-retail-page product-reference-page product-reference-stock-page"><ProductReferenceHeader title="Stock adjustment" onBack={onBack} />
    {notice && <div className={`mobile-notice mobile-notice--${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><IconButton variant="ghost" className="mkpos-dismiss-icon" type="button" aria-label="Dismiss message" onClick={onDismiss}><X size={17} /></IconButton></div>}
    <ProductReferenceProfile product={product} currency={currency} variant="stock" />
    <section className="product-reference-panel product-reference-adjustment"><h2>Adjustment</h2><form onSubmit={onSubmit}>
      <div className="product-adjustment-direction" role="group" aria-label="Adjustment direction"><Button variant="plain" type="button" aria-pressed={!removing && quantity !== '-'} disabled={saving} onClick={() => selectDirection(false)}><span className="product-radio" /><span><strong>Add stock</strong><small>Increase current stock</small></span></Button><Button variant="plain" type="button" aria-pressed={removing || quantity === '-'} disabled={saving} onClick={() => selectDirection(true)}><span className="product-radio" /><span><strong>Remove stock</strong><small>Decrease current stock</small></span></Button></div>
      <ProductUnitInput label="Quantity" aria-label={`Adjustment quantity (${baseUnitName(product)})`} type="number" inputMode="decimal" step="0.001" value={quantity === '-' ? '' : Math.abs(Number(quantity)) || (quantity === '' ? '' : 0)} onChange={event => { const value = event.target.value; setQuantity(value === '' ? (removing || quantity === '-' ? '-' : '') : String((removing || quantity === '-' ? -1 : 1) * Math.abs(Number(value)))); }} unit={baseUnitName(product)} disabled={saving} />
      {Number(quantity) !== 0 && quantity !== '-' && <p className={`product-adjustment-result${!valid ? ' invalid' : ''}`} role="status">Final quantity: {formatQuantity(Number(product.stock) + Number(quantity))} {baseUnitName(product)}{!valid && ' · Final quantity cannot be below zero.'}</p>}
      <FieldShell as="label" className="mobile-field product-adjustment-reason"><span>Reason</span><Input aria-label="Reason (optional)" list="product-adjustment-reasons" value={reason} onChange={event => setReason(event.target.value)} placeholder="Optional" disabled={saving} /><datalist id="product-adjustment-reasons">{['Stock count correction', 'Damaged stock', 'Returned stock', 'Opening balance'].map(value => <option key={value} value={value} />)}</datalist></FieldShell>
      <Button variant="primary" className="mobile-primary" type="submit" disabled={saving || !valid}>{saving && <RefreshCw size={17} className="spin" />}{saving ? 'Saving…' : 'Save adjustment'}</Button>
    </form></section>
    <section className="product-reference-panel product-reference-movements"><h2>Movement history {list.total !== null && `(${list.total})`}</h2>{list.initialLoading ? <p role="status"><RefreshCw className="spin" size={17} />Loading history…</p> : list.error && !list.items.length ? <div className="endless-first-error"><p role="alert">{list.error}</p><Button variant="plain" type="button" onClick={list.retry}>Try again</Button></div> : list.items.length ? <><div className="product-reference-movement-list">{list.items.map(movement => {
      const positive = Number(movement.quantity_change) > 0, date = new Date(movement.created_at), validDate = !Number.isNaN(date.getTime());
      return <article key={movement.id}><span className={positive ? 'positive' : 'negative'}>{positive ? <ArrowUp size={18} /> : <ArrowDown size={18} />}</span><div><strong className={positive ? 'positive' : 'negative'}>{positive ? '+' : ''}{formatQuantity(movement.quantity_change)} {baseUnitName(product)}</strong><p data-no-localize>{movement.note || String(movement.movement_type || 'Stock movement').replaceAll('_', ' ')}</p>{movement.reference_type && <small data-no-localize>{movement.reference_type}{movement.reference_id ? ` · ${movement.reference_id}` : ''}</small>}</div><time dateTime={movement.created_at}>{validDate ? <>{date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{date.toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit' })}</small></> : movement.created_at}</time></article>;
    })}</div>{footer}</> : <p className="mobile-inline-empty">No stock movements yet.</p>}</section>
  </main>;
}
