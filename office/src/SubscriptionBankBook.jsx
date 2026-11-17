import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';
import { PaymentReceiptCheck } from './PaymentReceiptCheck';

export function SubscriptionBankBook({ value, onChange, disabled = false }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    api('/office/bank-books').then(result => { if (current) { setData(result); setError(''); } }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [revision]);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('mkpos:office-bank-books-changed', update);
    return () => window.removeEventListener('mkpos:office-bank-books-changed', update);
  }, []);
  const defaultBook = data?.items?.find(item => item.id === data.subscription_account_id);
  return <label>Subscription receiving book<select disabled={disabled} value={value} onChange={event => onChange(event.target.value)}><option value="">{defaultBook ? `Default: ${defaultBook.name}` : 'Use default subscription book'}</option>{data?.items?.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{error && <span role="alert">{error} <button type="button" onClick={() => setRevision(v => v + 1)}>Retry bank books</button></span>}</label>;
}

export function PaymentApprovalModal({ request, onClose, onAction }) {
  const [book, setBook] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [transactionId, setTransactionId] = useState(request.transaction_id || '');
  const saving = useRef(false);
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const ok = await onAction(`approve-${request.id}`, `/office/subscription-requests/${request.id}/approve`, { method: 'POST', body: JSON.stringify({ ...(book ? { account_id: Number(book) } : {}), transaction_id: transactionId.trim() || null }) });
      if (ok) onClose(); else setError('Approval failed. Your receiving book selection is kept; please try again.');
    } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title="Approve subscription payment" description={`${request.business_name} · ${request.plan_name}`} busy={busy} onClose={onClose}><PaymentReceiptCheck validation={request.prevalidation} /><form className="office-management-form" onSubmit={submit}><fieldset disabled={busy}><label>Transaction ID<input maxLength={120} value={transactionId} onChange={event => setTransactionId(event.target.value)} /></label><SubscriptionBankBook value={book} onChange={setBook} disabled={busy} /><p>This approval grants subscription access and records the payment in the receiving book under your admin account.</p>{error && <p role="alert">{error}</p>}<div className="office-management-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="office-button-primary">{busy ? 'Approving…' : 'Approve payment'}</button></div></fieldset></form></OfficeModal>;
}
