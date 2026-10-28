import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Building2 } from 'lucide-react';
import { api, apiBlob } from './api';
import {OfficeTableLoadingStatus, OfficeTableLoadingRows, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import { OfficePageToolbar, OfficeStatusFilterDrawer } from './OfficePageToolbar';
import { OfficeModal } from './OfficeModal';
import { RowActions } from './RowActions';
import { officeDateTime } from './dateTime';
import './sales-ai-topups.css';

const root = '/office/sales-ai/topups';
const amount = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const money = value => `${amount(value)} MMK`;
const statuses = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
export function SalesAiTopupReview({ row, onClose, onSaved }) {
  const [reference, setReference] = useState(row.transaction_reference || ''), [note, setNote] = useState(row.review_note || '');
  const [decision, setDecision] = useState('approved'), [url, setUrl] = useState(''), [proofError, setProofError] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    let active = true, objectUrl;
    apiBlob(`${root}/${row.id}/screenshot`).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(e => { if (active) setProofError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [row.id, retry]);
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const result = await api(`${root}/${row.id}/review`, { method: 'POST', body: JSON.stringify({ decision, version: row.version, transaction_reference: reference, admin_note: note }) }); window.dispatchEvent(new CustomEvent('mkpos:office-sales-ai-reviewed', { detail: result })); onSaved?.(result); onClose(); }
    catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={`Sales AI top-up #${row.id}`} onClose={onClose} busy={busy} footer={<><button type="button" disabled={busy} onClick={onClose}>Close</button>{row.status === 'pending' && <button type="submit" form="sales-ai-review" className="office-button-primary" disabled={busy || !url}>{busy ? 'Saving…' : 'Confirm review'}</button>}</>}>
    <p><strong>{money(row.amount)}</strong> · <span data-no-localize>{row.business_name || `Business #${row.business_id}`}</span> · {row.status}</p>
    <p data-no-localize>{row.payment_account?.bank} · {row.payment_account?.account_no} · {row.payment_account?.account_name}</p>
    {row.message && <p data-no-localize>{row.message}</p>}
    {row.prevalidation && <section className="office-sales-ai-validation" aria-label="System Agent payment check"><strong>System Agent: {row.prevalidation.verdict === 'looks_consistent' ? 'Receipt checks passed' : 'Needs review'}</strong><p>Manual approval required.</p><dl>{(row.prevalidation.checks || []).map((check, index) => <React.Fragment key={`${check.field}-${index}`}><dt>{check.field.replaceAll('_', ' ')}</dt><dd>{check.status.replaceAll('_', ' ')}</dd></React.Fragment>)}</dl></section>}
    {proofError ? <p role="alert">{proofError} <button type="button" onClick={() => { setProofError(''); setRetry(value => value + 1); }}>Retry proof</button></p> : url ? <a href={url} target="_blank" rel="noreferrer"><img className="office-sales-ai-proof" src={url} alt="Top-up payment proof" /></a> : <p role="status">Loading payment proof…</p>}
    {error && <p className="feedback error" role="alert">{error}</p>}
    {row.status === 'pending' ? <form id="sales-ai-review" onSubmit={submit}><fieldset className="office-sales-ai-review" disabled={busy}>
      <label>Decision<select value={decision} onChange={event => setDecision(event.target.value)}><option value="approved">Approve and credit wallet</option><option value="rejected">Reject</option></select></label>
      <label>Transaction reference<input required={decision === 'approved'} maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label>
      <label>{decision === 'rejected' ? 'Rejection reason' : 'Review note (optional)'}<textarea required={decision === 'rejected'} maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
    </fieldset></form> : <p data-no-localize>{row.transaction_reference}{row.review_note && ` · ${row.review_note}`}</p>}
  </OfficeModal>;
}

export function SalesAiTopupsPage({ businessId = null, refreshToken = 0, onOpenBusiness, alertTarget }) {
  const [state, setState] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [q, setQ] = useState(''), [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1), [per, setPer] = useState(25), [drawer, setDrawer] = useState(false), [review, setReview] = useState(null);
  const [book, setBook] = useState(false), [retry, setRetry] = useState(0);
  const openedAlerts = useRef(new Set());
  const loadVersion = useRef(0);
  useEffect(() => {
    if (!alertTarget || openedAlerts.current.has(alertTarget.key)) return;
    let active = true;
    api(`${root}/${alertTarget.id}`).then(result => {
      if (active) { openedAlerts.current.add(alertTarget.key); setReview(result.request); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [alertTarget]);
  useEffect(() => {
    let active = true; queueMicrotask(() => { if (active) { setLoading(true); setError(''); } });
    const query = new URLSearchParams({ page, per_page: per, q, status, ...(businessId ? { business_id: businessId } : {}) });
    const load = () => {
      const current = ++loadVersion.current;
      api(book && businessId ? `/office/businesses/${businessId}/sales-ai/wallet?page=${page}&per_page=${per}` : `${root}?${query}`)
        .then(result => { if (active && current === loadVersion.current) { setState(result); if (result.page < page) setPage(result.page); } })
        .catch(e => { if (active && current === loadVersion.current) setError(e.message); }).finally(() => { if (active && current === loadVersion.current) setLoading(false); });
    };
    load();
    const changed = event => { if (event.detail?.some(item => item.target === 'sales-ai-topup')) load(); };
    window.addEventListener('mkpos:office-activity', changed);
    return () => { active = false; window.removeEventListener('mkpos:office-activity', changed); };
  }, [businessId, page, per, q, status, book, refreshToken, retry]);
  const reconcileReview = useCallback(event => {
    const result = event.detail;
    if (!state || book || (businessId && Number(result.request.business_id) !== Number(businessId))) return;
    const existing = state.items.find(row => row.id === result.request.id);
    if (!existing) return;
    loadVersion.current++;
    setLoading(false);
    const remove = status && result.request.status !== status;
    const total = Math.max(0, state.total - (remove ? 1 : 0)), last = Math.max(1, Math.ceil(total / per));
    setState(current => ({ ...current, total, page: Math.min(current.page, last), last_page: last, ...(businessId ? { wallet: result.wallet } : {}), items: current.items.flatMap(row => row.id === result.request.id ? remove ? [] : [{ ...row, ...result.request }] : [row]) }));
    if (page > last) setPage(last);
  }, [state, book, businessId, status, per, page]);
  useEffect(() => {
    window.addEventListener('mkpos:office-sales-ai-reviewed', reconcileReview);
    return () => window.removeEventListener('mkpos:office-sales-ai-reviewed', reconcileReview);
  }, [reconcileReview]);
  const clear = () => { setSearch(''); setQ(''); setPage(1); };
  return <section className="office-panel office-table-panel office-sales-ai-topups" aria-label="Sales AI top-up management">
    {!businessId && <OfficePageToolbar searchLabel="Search Sales AI top-ups" placeholder="Business or transaction reference" search={search} onSearchChange={setSearch} onSearch={() => { setQ(search.trim()); setPage(1); }} onClearSearch={clear} onFilterOpen={() => setDrawer(true)} filterOpen={drawer} filterCount={status !== 'pending' ? 1 : 0} busy={Boolean(review)} />}
    <header className="office-panel-header"><h2>Sales AI {book ? 'balance book' : 'top-ups'}</h2>{businessId && <div><button type="button" disabled={loading} onClick={() => { setBook(value => !value); setState(null); setPage(1); }}>{book ? 'Top-up requests' : 'Balance book'}</button>{!book && <button type="button" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}>Filters</button>}</div>}</header>
    {state?.wallet && <div className="office-sales-ai-wallet"><span>Available <strong>{money(state.wallet.available)}</strong></span><span>Reserved <strong>{money(state.wallet.reserved)}</strong></span></div>}
    {error && <p className="feedback error" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {loading && <OfficeTableLoadingStatus label="Loading Sales AI records..."/>}
    <div className="office-table-scroll"><table className="office-data-table office-sales-ai-table" aria-label={book ? 'Sales AI balance entries' : 'Sales AI top-ups'} aria-busy={loading}>
      <thead><tr><th scope="col">{book ? 'Entry' : 'Business'}</th><th scope="col" className="office-sales-ai-amount">Amount (MMK)</th><th scope="col" className={book ? 'office-sales-ai-amount' : 'office-sales-ai-status'}>{book ? 'Balance (MMK)' : 'Status'}</th><th scope="col" className="office-sales-ai-created">Created</th>{!book && <OfficeActionHeader />}</tr></thead>
      <tbody>{!state && loading && <OfficeTableLoadingRows columns={book ? 4 : 5} actionColumn={!book}/>}{state?.items.map(row => <tr key={row.id}>
        <td>{book ? <span data-no-localize>{row.description}</span> : <div className="office-cell-stack"><strong data-no-localize>{row.business_name || `Business #${row.business_id}`}</strong><small title={`#${row.id} ? ${row.transaction_reference || 'No reference'}`}>#{row.id} ? {row.transaction_reference || 'No reference'}</small></div>}</td>
        <td className="office-sales-ai-amount" title={money(row.amount)}>{amount(row.amount)}</td>
        <td className={book ? 'office-sales-ai-amount' : 'office-sales-ai-status'}>{book ? amount(row.balance_after) : <span className={`office-status office-status-${row.status}`}>{statuses[row.status] || row.status}</span>}</td>
        <td className="office-sales-ai-created">{officeDateTime(row.created_at)}</td>
        {!book && <OfficeActionCell><RowActions label={`top-up ${row.id}`} disabled={loading}><button type="button" role="menuitem" onClick={() => setReview(row)}><Eye size={16} />{row.status === 'pending' ? 'Review top-up' : 'View top-up'}</button>{onOpenBusiness && <button type="button" role="menuitem" onClick={() => onOpenBusiness(row.business_id)}><Building2 size={16} />View business</button>}</RowActions></OfficeActionCell>}
      </tr>)}</tbody>
    </table></div>
    {!loading && state?.items.length === 0 && <p className="office-business-message">No records match these filters.</p>}
    {state && <OfficeTablePagination label={book ? 'Entries' : 'Top-ups'} total={state.total} page={state.page} perPage={per} lastPage={state.last_page} onPageChange={setPage} onPerPageChange={value => { setPer(value); setPage(1); }} disabled={loading || Boolean(review)} />}
    <OfficeStatusFilterDrawer open={drawer} title="Sales AI top-up filters" status={status} options={[['', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']]} onClose={() => setDrawer(false)} onApply={value => { setStatus(value); setPage(1); setDrawer(false); }} onClear={() => { setStatus(''); setPage(1); setDrawer(false); }} />
    {review && <SalesAiTopupReview row={review} onClose={() => setReview(null)} />}
  </section>;
}
