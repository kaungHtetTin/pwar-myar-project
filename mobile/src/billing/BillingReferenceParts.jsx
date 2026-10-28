import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { IconButton, Input, Radio } from '../components/Controls';
import React, { useEffect, useId, useState } from 'react';
import { ChevronLeft, Copy, Crown, ImagePlus, Info, X } from 'lucide-react';

import { money } from '../products/productUtils';

export function BillingHeader({ actions, title = 'Billing', onBack, disabled = false }) {
  
  return <PageAppBar className="retail-sale-header billing-reference-header">{onBack && <IconButton variant="ghost" type="button" disabled={disabled} aria-label={'Back to billing'} onClick={onBack}><ChevronLeft size={26} /></IconButton>}<h1>{title}</h1>{actions}<AppBarMenu /></PageAppBar>;
}

export function BillingSection({ icon: Icon, title, subtitle, children, footer, className = '' }) {
  return <section className={`billing-reference-card ${className}`}><div className="billing-reference-section-heading"><span className="billing-reference-icon"><Icon size={24} /></span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children && <div className="billing-reference-section-body">{children}</div>}{footer && <div className="billing-section-footer">{footer}</div>}</section>;
}

export function BillingAccount({ method, methods = [], onChange, onNotice, readOnly = false }) {
  const groupName = useId();
  async function copy(label, value) {
    try { await navigator.clipboard.writeText(String(value)); onNotice?.({ type: 'success', text: `${label} copied.` }); }
    catch { onNotice?.({ type: 'error', text: 'Unable to copy. Select and copy the account details manually.' }); }
  }
  return <>{!readOnly && methods.length > 1 && onChange && <fieldset className="billing-account-picker"><legend>Payment account</legend>{methods.map(item => <label className={`billing-account-option${String(method?.id) === String(item.id) ? ' is-selected' : ''}`} key={item.id}><Radio name={groupName} value={String(item.id)} checked={String(method?.id) === String(item.id)} onChange={event => onChange(event.target.value)} aria-label={`${item.bank} ${item.account_no}`} /><span data-no-localize><strong>{item.bank}</strong></span></label>)}</fieldset>}{method ? <dl className="billing-account-details">{[['Bank name', method.bank], ['Account number', method.account_no], ['Account name', method.account_name]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-no-localize>{value || '-'}</dd>{!readOnly && value && <IconButton variant="ghost" type="button" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => copy(label, value)}><Copy size={16} /></IconButton>}</div>)}</dl> : <p className="mobile-inline-empty">No payment method available</p>}</>;
}

export function BillingPlanSummary({ plan }) {
  return <section className="billing-reference-card billing-selected-plan"><span className="billing-reference-icon is-solid"><Crown size={26} /></span><div><small>Selected plan</small><strong data-no-localize>{plan.name}</strong><p>{plan.description || 'PwarMyar business access package.'}</p></div><div><b>{money(plan.price, plan.currency)}</b><small>{plan.duration_days} days access</small></div></section>;
}

export function BillingInstructions({ title, children, icon: Icon = Info }) {
  return <div className="billing-reference-instructions"><Icon size={23} /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function BillingProof({ file, onChange, error, readOnly = false, uploaded = false }) {
  const errorId = useId();
  const [preview, setPreview] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return undefined; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <><div className="billing-reference-proof">{preview && <div className="billing-proof-preview"><img src={preview} alt="Payment proof preview" />{!readOnly && <IconButton variant="ghost" type="button" aria-label="Remove payment proof" onClick={() => onChange(null)}><X size={17} /></IconButton>}</div>}{!readOnly ? <label className={`billing-proof-upload${error ? ' has-error' : ''}`}><ImagePlus size={25} /><span>{file ? 'Replace image' : 'Upload image'}</span><Input aria-label="Payment screenshot" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const next = event.target.files?.[0]; if (next) onChange(next); event.target.value = ''; }} /></label> : !preview && <p className="billing-proof-received">{uploaded ? 'Payment proof received.' : 'No payment proof available.'}</p>}</div>{file && <small className="billing-proof-filename" data-no-localize>{file.name}</small>}{!readOnly && <p className="billing-proof-help">JPG, PNG or WebP. Max file size 5 MB.</p>}{error && <p id={errorId} className="mobile-field-error" role="alert">{error}</p>}</>;
}

