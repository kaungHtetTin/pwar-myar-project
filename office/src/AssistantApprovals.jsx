import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';
import {OfficeTableLoading, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import { RowActions } from './RowActions';
import { officeDateTime } from './dateTime';

export function AssistantApprovals({ refreshToken = 0, onOpenBusiness, onApplied }) {
  const [query, setQuery] = useState({ page: 1, per_page: 25 });
  const [result, setResult] = useState({ items: [], total: 0, page: 1, last_page: 1 });
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState(''), [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const loadKey = `${new URLSearchParams(query)}:${refreshToken}`;
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let current = true;
    api(`/office/assistant-approvals?${new URLSearchParams(query)}`).then(data => {
      if (!Array.isArray(data.items)) throw new Error('Assistant approvals could not be loaded. Please retry.');
      if (current) { setResult(data); setError(''); }
    }).catch(error => { if (current) setError(error.message); }).finally(() => { if (current) setLoadedKey(loadKey); });
    return () => { current = false; };
  }, [query, refreshToken, loadKey]);

  async function decide(approve) {
    if (saving.current || !selected || (approve && !confirmed)) return;
    saving.current = true; setBusy(true); setError('');
    try {
      await api(`/office/assistant-approvals/${selected.id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST', body: JSON.stringify(approve ? { confirmed: true, ...(selected.funds_verification_required ? { funds_verified: true } : {}) } : {}),
      });
      setResult(current => ({ ...current, items: current.items.filter(row => row.id !== selected.id), total: Math.max(0, current.total - 1) }));
      setSelected(null);
      if (approve) onApplied?.();
      setQuery(current => ({ ...current, page: Math.max(1, Math.min(current.page, Math.ceil((result.total - 1) / current.per_page))) }));
    } catch (error) { setError(error.message); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section className="office-panel office-table-panel" aria-label="Assistant approvals">
    <div className="office-panel-header"><div><h2>Assistant approvals</h2><p>Review actions prepared by the chatbot. Nothing changes until you approve.</p></div><button type="button" disabled={busy || loading} onClick={() => setQuery(current => ({ ...current }))}>Refresh actions</button></div>
    {error && !selected && <p role="alert" className="feedback error">{error}<button type="button" onClick={() => setQuery(current => ({ ...current }))}>Retry</button></p>}
    {loading ? <OfficeTableLoading columns={["Action", "Business", "Amount", "Prepared for"]} label="Loading assistant actions..."/> : result.items.length > 0 ? <><div className="office-table-scroll"><table className="office-data-table" aria-label="Assistant actions awaiting approval">
      <thead><tr><th>Action</th><th>Business</th><th>Amount</th><th>Prepared for</th><OfficeActionHeader /></tr></thead>
      <tbody>{result.items.map(row => <tr key={row.id}><td><div className="office-cell-stack"><strong>{row.label}</strong><small>Request #{row.subject_id}</small></div></td><td>{row.business_name}</td><td>{row.amount == null ? '—' : `${row.amount} ${row.currency || ''}`}</td><td>{row.proposer_name}</td>
        <OfficeActionCell><RowActions label={`assistant action ${row.id}`}><button type="button" onClick={() => { setSelected(row); setConfirmed(false); setError(''); }}>Review action</button></RowActions></OfficeActionCell></tr>)}</tbody>
    </table></div><OfficeTablePagination label="Assistant action" total={result.total} page={result.page} perPage={query.per_page} lastPage={result.last_page} disabled={busy}
      onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery({ page: 1, per_page })} /></> : <p className="office-business-message">No assistant actions are waiting for approval.</p>}
    {selected && <OfficeModal title="Review assistant action" onClose={() => setSelected(null)} busy={busy} footer={<>
      <button type="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
      <button type="button" className="danger-button" disabled={busy} onClick={() => decide(false)}>Reject proposal</button>
      <button type="button" className="office-button-primary" disabled={busy || !confirmed} onClick={() => decide(true)}>{busy ? 'Saving…' : 'Approve action'}</button>
    </>}>
      <h3>{selected.label}</h3><p>{selected.business_name} · Request #{selected.subject_id}</p>
      {selected.amount != null && <p><strong>{selected.amount} {selected.currency}</strong></p>}
      <p>{selected.note}</p>
      {selected.transfer_reference && <p>Completed transfer: {selected.transfer_reference}<br />{selected.transferred_at}</p>}
      <p>Prepared for {selected.proposer_name}. Expires {officeDateTime(selected.expires_at)}.</p>
      <p>Approving records the displayed action. It does not send money through a bank.</p>
      {selected.business_id && <button type="button" disabled={busy} onClick={() => onOpenBusiness(selected.business_id)}>View business</button>}
      <label className="office-financial-toggle"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{selected.funds_verification_required ? 'I independently verified receipt of these funds and approve this action.' : 'I reviewed the details and approve this exact action.'}</label>
      {error && <p role="alert" className="feedback error">{error}</p>}
    </OfficeModal>}
  </section>;
}
