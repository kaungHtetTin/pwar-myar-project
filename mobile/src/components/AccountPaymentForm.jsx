import React from 'react';
import { Button, ChoiceGroup, FieldShell, Input, InputGroup, Radio, Select, Textarea } from './Controls';
import { MobileField } from './MobilePrimitives';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { balanceState, customerInitials, customerDate } from '../customers/customerUtils';
import { money } from '../products/productUtils';

export function AccountPaymentForm({
  editing,
  account,
  accountKind = 'customer',
  className = '',
  onOpenAccount,
  children,
  form,
  errors,
  methods,
  saving,
  onChange,
  onCancel,
  onSubmit,
  currency = 'Ks',
}) {
  const balance = balanceState(account?.balance);
  const supplier = accountKind === 'supplier';
  const directions = supplier ? [['shop_to_supplier','Shop pays supplier','Reduce amount we owe this supplier'],['supplier_to_shop','Supplier refunds shop','Record money returned by the supplier']] : [['customer_to_shop','Customer pays shop','Reduce customer balance'],['shop_to_customer','Shop pays customer','Increase customer balance']];
  const balanceLabel = supplier ? (balance.key === 'receivable' ? 'Shop owes supplier' : balance.key === 'payable' ? 'Supplier owes shop' : 'Settled') : (balance.key === 'receivable' ? 'Customer owes shop' : balance.key === 'payable' ? 'Shop owes customer' : 'Settled');
  return <form className={`account-payment-form customer-reference-page customer-payment-page-form customer-reference-payment-form ${className} ${editing ? 'is-editing' : 'is-creating'}`} onSubmit={onSubmit} noValidate>
    {errors.general && <div className="mobile-notice mobile-notice--error" role="alert">{errors.general}</div>}
    <section className="customer-reference-panel customer-payment-profile"><span className="customer-reference-avatar">{customerInitials(account?.name)}</span><div>{onOpenAccount?<Button variant="plain" type="button" className="account-payment-identity" aria-label="View supplier" onClick={onOpenAccount}><strong data-no-localize>{account?.name||'Supplier'}</strong></Button>:<strong data-no-localize>{account?.name || 'Customer'}</strong>}<small>{supplier?'Supplier':'Customer'} · #{account?.id}</small>{supplier&&account?.phone&&<small data-no-localize>{account.phone}</small>}</div>{editing ? <span className={`customer-payment-current balance-${balance.key}`}><small>{supplier?balanceLabel:(balance.key === 'receivable' ? 'Customer owes' : balance.key === 'payable' ? 'Shop owes' : 'Settled')}</small><strong>{money(balance.amount, currency)}</strong></span> : <div className="customer-payment-outstanding"><span><small>Outstanding balance</small><strong>{money(balance.amount, currency)}</strong></span><em>{balanceLabel}</em></div>}</section>
    <fieldset disabled={saving} className={editing ? 'customer-reference-panel' : ''}>
      {editing && <><h2>Payment details</h2><FieldShell as="label" className="mobile-field"><span>Date</span><output>{customerDate(form.created_at)}</output></FieldShell></>}
      {editing ? <MobileField id="customer-payment-direction" label="Direction" error={errors.direction}><Select id="customer-payment-direction" value={form.direction} onChange={event=>onChange('direction',event.target.value)}>{directions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></MobileField> : <ChoiceGroup className="customer-payment-directions"><legend>Payment direction</legend>{directions.map(([value,label,hint],i)=><label key={value} className={form.direction===value?'is-selected':''}><Radio type="radio" name="direction" value={value} checked={form.direction===value} onChange={()=>onChange('direction',value)}/><span className="customer-direction-icon">{i?<ArrowUp size={19}/>:<ArrowDown size={19}/>}</span><strong>{label}</strong><small>{hint}</small></label>)}</ChoiceGroup>}
      <MobileField id="customer-payment-amount" label={editing ? `Amount (${currency})` : 'Amount'} error={errors.amount}><InputGroup className="customer-payment-amount-input">{!editing && <span>{currency}</span>}<Input id="customer-payment-amount" aria-label="Amount" placeholder="0" type="number" inputMode="numeric" min="1" step="1" value={form.amount} onChange={event => onChange('amount', event.target.value)} aria-describedby={errors.amount ? 'customer-payment-amount-error' : undefined} /></InputGroup></MobileField>
      <MobileField id="customer-payment-method" label="Payment method" error={errors.payment_method}><Select id="customer-payment-method" value={form.payment_method} onChange={event => onChange('payment_method', event.target.value)}>{methods.map(method => <option key={method} value={method}>{method}</option>)}</Select></MobileField>
      <MobileField id="customer-payment-note" label="Note (optional)" error={errors.note}><Textarea id="customer-payment-note" rows="3" value={form.note} onChange={event => onChange('note', event.target.value)} placeholder="Add a note" aria-describedby={errors.note ? 'customer-payment-note-error' : undefined} /><small className="customer-character-count">{form.note.length} characters</small></MobileField>
    </fieldset>
    {editing && !supplier && <section className="customer-reference-panel customer-payment-record"><h2>Record information</h2><span>Reference<strong data-no-localize>#{form.id}</strong></span><span>Created on<strong>{customerDate(form.created_at, true)}</strong></span>{form.created_by_name && <span>Created by<strong data-no-localize>{form.created_by_name}</strong></span>}</section>}
    {children}
    <div className="mobile-form-actions customer-reference-form-actions"><Button variant="secondary" className="mobile-secondary" type="button" disabled={saving} onClick={onCancel}>Cancel</Button><Button variant="primary" className="mobile-primary" type="submit" disabled={saving}>{saving && <RefreshCw className="spin" size={17} />}{saving ? 'Saving\u2026' : editing ? 'Save changes' : 'Record payment'}</Button></div>
  </form>;
}

