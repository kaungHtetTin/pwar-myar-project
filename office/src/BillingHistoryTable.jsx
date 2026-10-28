import { officeDate, officeDateTime, officeDateInput, parseOfficeDate } from './dateTime';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Eye, Pencil, Save } from 'lucide-react';
import { api, apiBlob } from './api';
import { OfficeModal } from './OfficeModal';
import { OfficeActionHeader, OfficeActionCell } from './OfficeTable';
import { RowActions } from './RowActions';
import { subscriptionHistoryPresentation } from './subscriptionUi';
import { SalesAiTopupReview } from './SalesAiTopupsPage';
import './billing-history.css';

const parseDate = parseOfficeDate;
const shortDate = value => value ? officeDate(value) : 'No expiry';
const localInput = officeDateInput;

function PaymentProof({ path, label }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, objectUrl;
    apiBlob(path).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, retry]);
  if (error) return <p role="alert">{error} <button type="button" onClick={() => { setError(''); setRetry(value => value + 1); }}>Retry proof</button></p>;
  return url ? <img className="office-billing-proof-image" src={url} alt={label} /> : <p role="status">Loading payment proof...</p>;
}

function BillingDetails({ record: { type, item }, currency, onClose }) {
  const sales = type === 'sales-ai';
  const presentation = sales ? null : subscriptionHistoryPresentation(item);
  const title = sales ? `Sales AI top-up #${item.id}` : presentation.planLabel;
  const proofs = sales ? [{ id: item.id, url: `/office/sales-ai/topups/${item.id}/screenshot` }] : item.payment_proofs || [];
  const timestamp = value => value ? officeDateTime(value) : '\u2014';
  const fields = [
    ['Type', sales ? 'Sales AI top-up' : 'Subscription'],
    ['Amount', `${Number(sales ? item.amount || 0 : item.price_paid || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${item.currency || (sales ? 'MMK' : currency)}`],
    ['Status', sales ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : presentation.statusLabel], ['Created', timestamp(item.created_at)],
    ...(sales ? [['Transaction reference', item.transaction_reference], ['Bank', item.payment_account?.bank], ['Account number', item.payment_account?.account_no], ['Account name', item.payment_account?.account_name], ['Reviewed by', item.reviewed_by_name], ['Reviewed', item.reviewed_at ? timestamp(item.reviewed_at) : null], ['Note', item.message], ['Review note', item.review_note]]
      : [['Period start', timestamp(item.starts_at)], ['Period end', item.ends_at ? timestamp(item.ends_at) : 'No expiry'], ['Assigned by', item.created_by_name || 'System'], ['Last changed by', item.last_changed_by_name], ['Note', item.note]]),
  ];
  return <OfficeModal title="Billing details" description={title} onClose={onClose} footer={<button type="button" onClick={onClose}>Close</button>}>
    <dl className="office-billing-details">{fields.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '\u2014'}</dd></div>)}</dl>
    <section className="office-billing-detail-proofs"><h3>Payment proof</h3>{proofs.length ? proofs.map(image => <PaymentProof key={image.id} path={image.url} label={`Payment screenshot for ${title}`} />) : <p>No payment proof linked to this billing record.</p>}</section>
  </OfficeModal>;
}

function PeriodEditor({ item, businessId, onSaved, onClose }) {
  const [start, setStart] = useState(() => localInput(item.starts_at)), [end, setEnd] = useState(() => localInput(item.ends_at));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false), formId = useId();
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    if (end && parseDate(end) <= parseDate(start)) { setError('The end must be after the start.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      const detail = await api(`/office/businesses/${businessId}/subscriptions/${item.id}/period`, {
        method: 'PATCH', body: JSON.stringify({ starts_at: parseDate(start).toISOString(), ends_at: end ? parseDate(end).toISOString() : null,
          original_starts_at: parseDate(item.starts_at).toISOString(), original_ends_at: item.ends_at ? parseDate(item.ends_at).toISOString() : null }),
      });
      onSaved(detail); onClose();
    } catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title="Edit billing period" description={subscriptionHistoryPresentation(item).planLabel} closeLabel="Close billing period editor" onClose={onClose} busy={busy} className="office-billing-period-modal" footer={<><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={formId} disabled={busy} className="office-button-primary"><Save size={14} />{busy ? 'Saving...' : 'Save period'}</button></>}>
    <form id={formId} className="office-billing-period-editor" aria-label={`Edit billing period for subscription ${item.id}`} onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>Period start<input required type="datetime-local" step="1" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>Period end<input aria-label="Period end" required={item.access_type === 'trial'} type="datetime-local" step="1" min={start} value={end} onChange={event => setEnd(event.target.value)} /><small>{item.access_type === 'trial' ? 'An end date is required for free trials.' : 'Leave empty for no expiry.'}</small></label>
        <p>Dates use your local timezone and control subscription access.</p>
        {error && <div className="feedback error" role="alert">{error}</div>}
      </fieldset>
    </form>
  </OfficeModal>;
}

export function BillingHistoryTable({ businessId, history, topups = [], currency, onSaved, onTopupSaved, disabled = false }) {
  const [editing, setEditing] = useState(null), [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [details, setDetails] = useState(null);
  const rows = [...history.map(item => ({ type: 'subscription', item })), ...topups.map(item => ({ type: 'sales-ai', item }))]
    .sort((a, b) => (parseDate(b.item.created_at)?.getTime() || 0) - (parseDate(a.item.created_at)?.getTime() || 0));
  function close() { setEditing(null); }
  return <>
    {notice && <p className="office-success office-billing-period-notice" role="status">{notice}</p>}
    <div className="office-table-scroll"><table className="office-data-table office-billing-history-table" aria-label="Billing history">
      <thead><tr><th>Billing item</th><th>Period / reference</th><th>Amount</th><th>Status</th><th>Assigned / reviewed by</th><th>Created</th><OfficeActionHeader /></tr></thead>
      <tbody>{rows.map(({ type, item }) => {
        if (type === 'sales-ai') {
          const statusKey = item.status === 'approved' ? 'active' : item.status;
          return <tr key={`sales-ai-${item.id}`}>
            <td><div className="office-cell-stack"><strong>Sales AI top-up</strong><small>#{item.id}{item.payment_account?.bank ? ` · ${item.payment_account.bank}` : ''}</small></div></td>
            <td>{item.transaction_reference || '—'}</td>
            <td>{Number(item.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.currency || 'MMK'}</td>
            <td><span className={`office-status office-status-${statusKey}`}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span></td>
            <td>{item.reviewed_by_name || '—'}</td><td>{shortDate(item.created_at)}</td>
            <OfficeActionCell><RowActions label={`top-up ${item.id}`} disabled={disabled || editing !== null || reviewing !== null || details !== null}><button type="button" onClick={() => setDetails({ type, item })}><Eye size={14} /> View details</button>{item.status === 'pending' && <button type="button" onClick={() => { setNotice(''); setReviewing(item); }}><Pencil size={14} />Review top-up</button>}</RowActions></OfficeActionCell>
          </tr>;
        }
        const presentation = subscriptionHistoryPresentation(item);
        return <React.Fragment key={`subscription-${item.id}`}><tr>
          <td><div className="office-cell-stack"><strong title={presentation.planLabel}>{presentation.planLabel}</strong><small title={item.note || undefined}>{item.note || `${item.duration_days} days`}</small></div></td>
          <td><div className="office-cell-stack"><span>{shortDate(item.starts_at)}</span><span>&rarr; {shortDate(item.ends_at)}</span></div></td>
          <td>{Number(item.price_paid || 0).toLocaleString()} {item.currency || currency}</td>
          <td><span className={`office-status office-status-${presentation.statusKey}`}>{presentation.statusLabel}</span></td>
          <td><div className="office-cell-stack"><span title={item.created_by_name || 'System'}>{item.created_by_name || 'System'}</span>{item.last_changed_by_name && <small>Last changed by {item.last_changed_by_name}</small>}</div></td>
          <td>{shortDate(item.created_at)}</td>
          <OfficeActionCell><RowActions label={`subscription ${item.id}`} disabled={disabled || editing !== null || reviewing !== null || details !== null}><button type="button" onClick={() => setDetails({ type, item })}><Eye size={14} /> View details</button><button type="button" onClick={() => { setNotice(''); setEditing(item); }}><Pencil size={14} /> Edit billing period</button></RowActions></OfficeActionCell>
        </tr></React.Fragment>;
      })}</tbody>
    </table></div>
    {editing && <PeriodEditor item={editing} businessId={businessId} onClose={close} onSaved={detail => { onSaved(detail); setNotice('Billing period updated.'); }} />}
    {reviewing && <SalesAiTopupReview row={reviewing} onClose={() => setReviewing(null)} onSaved={result => { onTopupSaved?.(result); setNotice('Top-up review saved.'); }} />}
    {details && <BillingDetails record={details} currency={currency} onClose={() => setDetails(null)} />}
  </>;
}
