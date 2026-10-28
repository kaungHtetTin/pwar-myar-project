import React, { useRef, useState } from 'react';
import { Bot, Save } from 'lucide-react';
import { api } from './api';
import './sales-ai-balance-form.css';

const money = value => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK`;
export function SalesAiBalanceForm({ businessId, wallet, onSaved }) {
  const [balance, setBalance] = useState(''), [reason, setReason] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const saving = useRef(false), pending = useRef(null);
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    if (!pending.current || pending.current.balance !== balance || pending.current.reason !== reason) pending.current = { balance, reason, expected_balance: wallet.balance, request_key: crypto.randomUUID() };
    saving.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try { const result = await api(`/office/businesses/${businessId}/sales-ai/wallet`, { method: 'PATCH', body: JSON.stringify(pending.current) }); onSaved(result.wallet); setBalance(''); setReason(''); pending.current = null; setNotice('AI balance updated.'); }
    catch (e) { setError(e.message); setErrors(e.payload?.errors || {}); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="office-panel office-sales-ai-balance-form">
    <div className="office-panel-header"><h2>AI usage balance</h2><Bot size={17} /></div>
    <form onSubmit={submit}><div className="office-sales-ai-balance-current"><small>Current balance</small><strong>{money(wallet.balance)}</strong><small>{money(wallet.reserved)} reserved</small></div>
      <fieldset disabled={busy}>
        <label>New balance (MMK)<input required type="number" min="0" max="9000000000" step="0.000001" value={balance} onChange={event => setBalance(event.target.value)} aria-invalid={Boolean(errors.balance)} aria-describedby={errors.balance ? 'ai-balance-error' : undefined} /></label>
        {errors.balance && <small id="ai-balance-error" role="alert">{errors.balance[0]}</small>}
        <label>Reason<textarea required rows={3} maxLength={255} value={reason} onChange={event => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? 'ai-balance-reason-error' : undefined} /></label>
        {errors.reason && <small id="ai-balance-reason-error" role="alert">{errors.reason[0]}</small>}
        {error && <p className="feedback error" role="alert">{error}</p>}{notice && <p className="office-success" role="status">{notice}</p>}
        <button type="submit" className="office-button-primary" disabled={busy || !balance || !reason.trim()}><Save size={15} />{busy ? 'Saving...' : 'Update balance'}</button>
      </fieldset>
    </form>
  </section>;
}
