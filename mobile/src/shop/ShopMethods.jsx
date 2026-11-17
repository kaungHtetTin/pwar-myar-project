import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { FloatingActionButton, Switch, Button, IconButton, Input, Radio, Textarea } from '../components/Controls';
import React, { useState } from 'react';
import { ArrowLeft, Banknote, Landmark, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { EndlessListFooter, MobileDeleteSheet, MobileSheet } from '../components/MobilePrimitives';
import { ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';

export function ShopMethodsHeader({ title, onBack, action, busy = false }) {
  return <PageAppBar className="shop-methods-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" disabled={busy} onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{action}<AppBarMenu /></PageAppBar>;
}
export function ShopMethodsList({ resource, list, onNavigate, deleting, busy, error, onDelete, onCloseDelete, onConfirmDelete }) {
  const [menu, setMenu] = useState(null);
  return <><ShopMethodsHeader title="Shop payment methods" onBack={() => onNavigate('/shop', { back: true })} /><FloatingActionButton label="Add payment method" disabled={!resource.data || resource.data.items.length >= 20} onClick={() => onNavigate('/shop/methods/new')}><Plus size={24} aria-hidden="true" /></FloatingActionButton><ShopLoadState resource={resource}>
    <div className="shop-methods-intro"><p>These are the ways you receive payments for shop orders. You can set up to 20 payment methods.</p><strong>{resource.data?.items.length || 0} of 20</strong></div>
    <div className="shop-methods-list">{list.initialLoading && <ShopLoading label="Loading payment methods..." />}{!list.initialLoading && !list.items.length && <section className="shop-methods-empty"><Banknote size={30} aria-hidden="true" /><h2>No payment methods yet.</h2><p>Add a manual payment method for checkout.</p></section>}{list.items.map(item => {
      const Icon = item.type === 'cash' ? Banknote : Landmark;
      const account = [item.account_name || item.bank, item.account_no ? `(•••• ${Array.from(item.account_no).slice(-4).join('')})` : ''].filter(Boolean).join(' ');
      return <article className="shop-method-row" key={item.id}><span className="shop-method-icon"><Icon size={27} aria-hidden="true" /></span><div className="shop-method-copy"><h2>{item.name}</h2>{item.type === 'transfer' && account && <p>{account}</p>}<p>Manual payment</p><span className={`shop-method-state${item.is_active ? ' is-active' : ''}`}><i aria-hidden="true" />{item.is_active ? 'Active' : 'Disabled'}</span></div><IconButton variant="ghost" type="button" className="shop-method-menu-button" aria-label={`Actions for ${item.name}`} onClick={() => setMenu(item)}><MoreVertical size={21} aria-hidden="true" /></IconButton></article>;
    })}<EndlessListFooter list={list} count={list.items.length} noun="payment methods" /></div>
    <MobileSheet open={!!menu} title={menu?.name || 'Payment method actions'} onClose={() => setMenu(null)} className="shop-method-menu"><Button variant="plain" type="button" onClick={() => { const item = menu; setMenu(null); onNavigate(`/shop/methods/${encodeURIComponent(item.id)}/edit`); }}><Pencil size={18} aria-hidden="true" />Edit payment method</Button><Button variant="danger-ghost" type="button" className="is-danger" onClick={() => { onDelete(menu); setMenu(null); }}><Trash2 size={18} aria-hidden="true" />Delete payment method</Button></MobileSheet>
    <MobileDeleteSheet open={!!deleting} title="Delete payment method" itemTitle={deleting?.name} description="Existing order payment details will be preserved. Keep at least one active payment method." busy={busy} onClose={onCloseDelete} onConfirm={onConfirmDelete}>{error && <p role="alert">{error}</p>}</MobileDeleteSheet>
  </ShopLoadState></>;
}

export function ShopMethodFields({ form, change, errors, recordKey }) {
  const fieldId = name => `shop-method-${encodeURIComponent(recordKey)}-${name}`;
  return <>
    <section className="shop-method-form-section"><ShopField id={fieldId('name')} name="name" label={<>Method name <span className="shop-method-required" aria-hidden="true">*</span></>} errors={errors}><Input required aria-label="Method name" maxLength={100} value={form.name} onChange={event => change('name', event.target.value)} /></ShopField><p className="shop-method-field-hint">This name will be shown to customers at checkout.</p></section>
    <section className="shop-method-form-section"><fieldset className="shop-method-types"><legend>Payment type <span aria-hidden="true">*</span></legend><div>{[['cash', 'Cash', Banknote], ['transfer', 'Bank transfer', Landmark]].map(([value, title, Icon]) => <label key={value} className={form.type === value ? 'is-selected' : ''}><Icon size={25} aria-hidden="true" /><span><strong>{title}</strong><small>Manual payment</small></span><Radio type="radio" name={fieldId('type')} value={value} required checked={form.type === value} onChange={() => change('type', value)} /></label>)}</div></fieldset>{errors.type && <p role="alert" className="mobile-field-error">{errors.type}</p>}</section>
    {form.type === 'transfer' && <section className="shop-method-form-section"><h2>Bank account details</h2>{[['bank', 'Bank / wallet', 100], ['account_name', 'Account holder name', 255], ['account_no', 'Account number / phone', 100]].map(([name, label, max]) => <ShopField id={fieldId(name)} name={name} key={name} label={label} errors={errors}><Input maxLength={max} value={form[name] || ''} autoComplete="off" onChange={event => change(name, event.target.value)} /></ShopField>)}<p className="shop-method-field-hint">Use the receiving bank or wallet details customers should pay.</p></section>}
    <section className="shop-method-form-section shop-method-instructions"><h2>Payment instructions</h2><p>Shown to customers when they choose this payment method.</p><ShopField id={fieldId('instructions')} name="instructions" label="Instructions for customers" errors={errors}><Textarea rows={3} maxLength={2000} value={form.instructions || ''} onChange={event => change('instructions', event.target.value)} /></ShopField><small className="shop-method-character-count">{(form.instructions || '').length}/2000</small></section>
    <section className="shop-method-form-section"><h2>Active status</h2><p>Make this payment method available to customers.</p><label className="shop-method-active"><Switch type="checkbox" role="switch" checked={form.is_active} onChange={event => change('is_active', event.target.checked)} /><span>Active</span></label>{errors.payment_methods && <p role="alert" className="mobile-field-error">{errors.payment_methods}</p>}<p className="shop-method-field-hint">Keep at least one active payment method. Payments are reviewed manually.</p></section>
  </>;
}
