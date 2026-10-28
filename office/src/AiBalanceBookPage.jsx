import React, { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from './api';
import { officeDateTime } from './dateTime';
import { formatTokens } from './tokenFormat';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoadingStatus, OfficeTableLoading, OfficeTablePagination} from './OfficeTable';
import { OfficeModal } from './OfficeModal';
import './office-management.css';
import './ai-balance-book.css';

const money = value => {
  const [whole, fraction = ''] = String(value).split('.');
  return `${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
};
const usd = value => `USD ${money(value)}`;

function TopUpForm({ onClose, onSaved }) {
  const [draft, setDraft] = useState({ amount: '', description: '', reference: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(null), saving = useRef(false);
  const field = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    const body = { ...draft, description: draft.description.trim(), reference: draft.reference.trim() };
    if (!body.description) { setError('Enter a description for this top-up.'); return; }
    const fingerprint = JSON.stringify(body);
    if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    saving.current = true; setBusy(true); setError('');
    try {
      await api('/office/ai-balance-book/top-ups', { method: 'POST', body: JSON.stringify({ ...body, request_key: pending.current.key }) });
      window.dispatchEvent(new Event('mkpos:office-ai-balance-changed'));
      onSaved();
    } catch (error) { setError(error.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title="Top up AI balance" onClose={onClose} busy={busy} description="Record an internal USD credit. This does not send a payment or change your DeepSeek account balance.">
    <form className="office-management-form office-ai-top-up" onSubmit={submit}>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <label>Amount (USD)<input required type="number" min="0.000001" max="1000000" step="0.000001" value={draft.amount} onChange={event => field('amount', event.target.value)} /></label>
        <label>Description<input required maxLength={255} value={draft.description} onChange={event => field('description', event.target.value)} placeholder="Internal AI budget allocation" /></label>
        <label>Reference (optional)<input maxLength={120} value={draft.reference} onChange={event => field('reference', event.target.value)} /></label>
        <div className="office-management-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="office-button-primary"><Save size={15} />{busy ? 'Recording...' : 'Record top-up'}</button></div>
      </fieldset>
    </form>
  </OfficeModal>;
}

export function AiBalanceBookPage({ refreshToken = 0 }) {
  const [query, setQuery] = useState({ q: '', page: 1, per_page: 25 }), [search, setSearch] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [topUp, setTopUp] = useState(false), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      api(`/office/ai-balance-book?${new URLSearchParams(query)}`).then(value => { if (current) setData(value); })
        .catch(error => { if (current) setError(error.message); }).finally(() => { if (current) setLoading(false); });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [query, refreshToken, revision]);
  return <div className="office-page-stack">
    <OfficePageToolbar searchLabel="Search AI balance entries" placeholder="Description, reference, model or request ID" search={search} onSearchChange={setSearch}
      onSearch={() => setQuery(current => ({ ...current, q: search, page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }}
      actionLabel="Top up" onCreate={() => setTopUp(true)} busy={loading || topUp} />
    {error && <div className="feedback error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Reload balance book</button></div>}
    {notice && <p className="office-success" role="status">{notice}</p>}
    {data && loading && <OfficeTableLoadingStatus label="Updating balance entries..."/>}
    {!data && loading && <OfficeTableLoading columns={["Time", "Entry", "Details", "Credit (USD)", "Debit (USD)", "Balance (USD)"]} label="Loading AI balance book..." actionColumn={false}/>}
    {data && <>
      <section className="office-stat-grid" aria-label="AI balance summary">
        {[['Internal balance', data.balance], ['Total top-ups', data.total_top_ups], ['Estimated usage cost', data.total_usage]].map(([label, value]) => <article className="office-stat-card" key={label}><div><span>{label}</span><strong>{usd(value)}</strong></div></article>)}
        <article className="office-stat-card" title="All-time estimated usage cost ÷ recorded requests × 100. Includes assistant requests and system AI checks; excludes top-ups and uncharged attempts."><div><span>Average cost per 100 requests</span><strong>{data.average_cost_per_100_requests == null ? '—' : usd(data.average_cost_per_100_requests)}</strong><small>All time · {Number(data.total_requests || 0).toLocaleString()} recorded requests</small></div></article>
        <article className="office-stat-card"><div><span>System AI access</span><strong>{data.can_use_ai ? 'Funded' : 'Paused'}</strong></div></article>
      </section>
      <section className="office-panel office-table-panel" aria-busy={loading}>
        <div className="office-panel-header"><div><h2>Balance entries</h2><p>Internal records only. No payments are sent to DeepSeek.</p></div></div>
        <div className="office-table-scroll"><table className="office-data-table office-ai-balance-table" aria-label="AI balance entries">
          <thead><tr><th>Time</th><th>Entry</th><th>Details</th><th>Credit (USD)</th><th>Debit (USD)</th><th>Balance (USD)</th></tr></thead>
          <tbody>{data.items.map(entry => <tr key={entry.id}>
            <td>{officeDateTime(entry.created_at)}</td><td><div className="office-cell-stack"><strong>{entry.type === 'top_up' ? 'Top-up' : 'AI usage'}</strong><small data-no-localize>{entry.description}</small></div></td>
            <td><div className="office-cell-stack">{entry.type === 'top_up' ? <><span data-no-localize>{entry.recorded_by}</span><small>{entry.reference || 'No reference'}</small></> : <><span>{entry.model} · Business #{entry.business_id} · User #{entry.user_id}</span><small title={`${entry.input_tokens} input / ${entry.output_tokens} output tokens`}>{formatTokens(entry.input_tokens)} input / {formatTokens(entry.output_tokens)} output tokens</small><small>{entry.cached_input_tokens == null ? 'Cache usage unreported; uncached estimate' : `${formatTokens(entry.cached_input_tokens)} cached / ${formatTokens(Number(entry.input_tokens) - Number(entry.cached_input_tokens))} uncached input`}</small><small>{entry.run_id}</small></>}</div></td>
            <td>{entry.type === 'top_up' ? money(entry.amount) : '—'}</td><td>{entry.type === 'usage' ? money(entry.amount.replace(/^-/, '')) : '—'}</td><td><strong>{money(entry.balance_after)}</strong></td>
          </tr>)}{!data.items.length && <tr><td colSpan={6}>No balance entries match this view.</td></tr>}</tbody>
        </table></div>
        <OfficeTablePagination label="AI balance entries" total={data.total} page={data.page} perPage={data.per_page} lastPage={data.last_page} disabled={loading || topUp}
          onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, page: 1, per_page }))} />
      </section>
    </>}
    {topUp && <TopUpForm onClose={() => setTopUp(false)} onSaved={() => { setTopUp(false); setNotice('Internal AI top-up recorded.'); setRevision(value => value + 1); }} />}
  </div>;
}
