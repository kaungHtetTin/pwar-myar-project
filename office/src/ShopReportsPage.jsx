import { officeDateTime } from './dateTime';
import { RowActions } from './RowActions';
import {OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Eye, RotateCcw, Save, ExternalLink, Store, Flag, CalendarDays, UserRound, ReceiptText, MessageSquare, ShieldCheck } from 'lucide-react';
import { api } from './api';
import { FilterDrawer } from './FilterDrawer';
import { OfficeModal } from './OfficeModal';
import { RetainedViews } from './RetainedViews';
import { usePageNavigation } from './usePageNavigation';

export const initialReportQuery = { q: '', status: 'open', reason: 'all', page: 1, per_page: 25 };
export const reasons = { misleading_information: 'Misleading information', payment_issue: 'Payment problem', order_issue: 'Order / delivery', unsafe_products: 'Unsafe / counterfeit products', abusive_behavior: 'Abusive behavior', other: 'Other' };
const statuses = { open: 'Open', in_review: 'Under review', resolved: 'Resolved', dismissed: 'Dismissed' };
const when = value => value ? officeDateTime(`${value.replace(' ', 'T')}Z`) : '—';
const matches = (row, query) => (query.status === 'all' || query.status === row.status) && (query.reason === 'all' || query.reason === row.reason) && (!query.q || [row.shop_name, row.shop_slug, row.customer_name, row.order_reference, row.details].some(value => String(value || '').toLowerCase().includes(query.q.toLowerCase())));
function ReportBadge({ value }) { return <span className={`office-status report-status-${value}`}>{statuses[value]}</span>; }

function ReportShopInformation({ report, busy, onOpenBusiness }) {
  return <section className="office-panel office-report-panel office-report-shop" aria-label="Shop and report information">
    <div className="office-report-shop-header">
      <div className="office-report-shop-eyebrow"><span>Reported shop</span><ReportBadge value={report.status} /></div>
      <div className="office-report-shop-identity"><span className="office-report-shop-avatar" aria-hidden="true"><Store size={24} /></span><div><h3>{report.shop_name}</h3><span className="office-report-shop-slug">/{report.shop_slug}</span></div></div>
      <div className="office-report-links"><button type="button" disabled={busy} onClick={() => onOpenBusiness(report.business_id)}><Eye size={15} />View business</button><a className="office-button" target="_blank" rel="noopener noreferrer" href={`${(import.meta.env.VITE_SHOP_URL || 'http://127.0.0.1:5177').replace(/\/$/, '')}/#/store/${encodeURIComponent(report.shop_slug)}`}><ExternalLink size={15} />Open shop</a></div>
    </div>
    <dl className="office-report-metadata">
      <div><dt><ReceiptText size={14} aria-hidden="true" />Report</dt><dd>#{report.id}</dd></div>
      <div><dt><CalendarDays size={14} aria-hidden="true" />Received</dt><dd>{when(report.created_at)}</dd></div>
      <div><dt><UserRound size={14} aria-hidden="true" />Reported by</dt><dd><strong>{report.customer_name}</strong><small>{report.customer_email}</small></dd></div>
      <div><dt><Flag size={14} aria-hidden="true" />Reason</dt><dd><span className="office-report-reason">{reasons[report.reason]}</span></dd></div>
      {report.order_reference && <div><dt><ReceiptText size={14} aria-hidden="true" />Order reference</dt><dd>{report.order_reference}</dd></div>}
    </dl>
    <div className="office-report-customer-message"><h4><MessageSquare size={15} aria-hidden="true" />Customer report</h4><p className="office-report-text">{report.details}</p></div>
    {report.office_response && <div className="office-report-response"><strong>Current customer response</strong><p>{report.office_response}</p></div>}
    <div className="office-report-help office-report-shop-note"><ShieldCheck size={16} aria-hidden="true" /><p>Reports do not automatically change shop visibility, cancel orders or send refunds. Review business evidence before using the existing marketplace controls.</p></div>
  </section>;
}

function ReportReview({ id, onBack, onSaved, onOpenBusiness, refreshToken }) {
  const formId = useId(), saving = useRef(false);
  const [report, setReport] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [notice, setNotice] = useState('');
  const [form, setForm] = useState({ status: 'in_review', internal_note: '', office_response: '' });
  useEffect(() => {
    let active = true;
    api(`/office/ecommerce/reports/${id}`).then(row => { if (active) { setError(''); setReport(row); setForm(previous => ({ ...previous, status: row.status === 'open' ? 'in_review' : row.status, office_response: row.office_response || '' })); } }).catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [id, reload, refreshToken]);
  async function save(event) {
    event.preventDefault(); if (saving.current) return;
    if (['resolved', 'dismissed'].includes(form.status) && form.office_response.trim().length < 5) { setError('Add a response for the customer before closing this report.'); return; }
    if (['resolved', 'dismissed'].includes(form.status) && !window.confirm('Close this report and share the response with the customer?')) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { const row = await api(`/office/ecommerce/reports/${id}`, { method: 'PUT', body: JSON.stringify({ ...form, version: report.version }) }); setReport(row); setForm(previous => ({ ...previous, internal_note: '' })); onSaved(row); setNotice('Review saved.'); }
    catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={`Review report #${id}`} description="Review the report details and record an Office response." closeLabel="Close report review" onClose={onBack} busy={busy} className="office-report-review-modal"
    footer={<><button type="button" disabled={busy} onClick={onBack}>Close</button><button type="submit" form={formId} className="office-button-primary" disabled={busy || !report}><Save size={15} />{busy ? 'Saving...' : 'Save review'}</button></>}>
    <div className="office-report-detail">{error && <p className="feedback error" role="alert">{error} <button type="button" disabled={busy} onClick={() => setReload(n => n + 1)}><RotateCcw size={14} />Reload report</button></p>}{notice && <p role="status">{notice}</p>}{report ? <div className="office-report-grid"><ReportShopInformation report={report} busy={busy} onOpenBusiness={onOpenBusiness} /><section className="office-panel office-report-panel"><h2>Office review</h2><form id={formId} onSubmit={save}><fieldset disabled={busy}><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(statuses).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label><label>Internal review note<textarea required minLength={5} maxLength={2000} value={form.internal_note} onChange={e => setForm({ ...form, internal_note: e.target.value })} /><small>Visible only to Office.</small></label><label>Response to customer<textarea maxLength={2000} required={['resolved', 'dismissed'].includes(form.status)} minLength={['resolved', 'dismissed'].includes(form.status) ? 5 : undefined} value={form.office_response} onChange={e => setForm({ ...form, office_response: e.target.value })} /><small>Customers can read this on their report page. Required when closing a report.</small></label></fieldset></form>{report.updates?.length > 0 && <details className="office-report-history"><summary>Review history ({report.updates.length})</summary>{report.updates.map(row => <article key={row.id}><ReportBadge value={row.status} /><small>{when(row.created_at)}</small><p>{row.internal_note}</p>{row.office_response && <p><strong>Customer response:</strong> {row.office_response}</p>}</article>)}</details>}</section></div> : !error && <p role="status">Loading report…</p>}</div></OfficeModal>;
}

export function ShopReportsPage({ query, onQueryChange, filterOpen, onFilterClose, refreshToken = 0, onOpenBusiness, scope = 'office', alertTarget }) {
  const [result, setResult] = useState({ key: '', data: null, error: '' }), [retry, setRetry] = useState(0), [draft, setDraft] = useState(query);
  const [previousFilterOpen, setPreviousFilterOpen] = useState(filterOpen);
  if (previousFilterOpen !== filterOpen) {
    setPreviousFilterOpen(filterOpen);
    if (filterOpen) setDraft(query);
  }
  const listRoot = useRef(null);
  const nav = usePageNavigation(`shop-reports:${scope}`, { id: null }, () => window.location.href, {
    resumeHistory: false,
    capture: () => ({ focus: document.activeElement, containers: [listRoot.current?.closest('.office-content'), listRoot.current?.querySelector('.office-table-scroll')].filter(Boolean).map(element => ({ element, left: element.scrollLeft, top: element.scrollTop })) }),
    restore: (_view, snapshot) => { if (snapshot) requestAnimationFrame(() => { for (const { element, left, top } of snapshot.containers) { element.scrollLeft = left; element.scrollTop = top; } if (snapshot.focus?.isConnected && !snapshot.focus.closest('[hidden]')) snapshot.focus.focus({ preventScroll: true }); }); },
  });
  const key = `${new URLSearchParams(query)}&refresh=${refreshToken}&retry=${retry}`, loading = result.key !== key, data = loading ? null : result.data;
  const openedAlerts = useRef(new Set());
  const loadVersion = useRef(0);
  useEffect(() => {
    if (!alertTarget || openedAlerts.current.has(alertTarget.key)) return;
    openedAlerts.current.add(alertTarget.key);nav.go({ id: alertTarget.id });
  }, [alertTarget, nav]);
  useEffect(() => {
    let active = true;
    const update = event => {
      if (!event.detail?.some(item => item.target === 'shop-report')) return;
      const version = ++loadVersion.current;
      api(`/office/ecommerce/reports?${new URLSearchParams(query)}`).then(data => { if (active && version === loadVersion.current) setResult({ key, data, error: '' }); }).catch(() => {});
    };
    window.addEventListener('mkpos:office-activity', update);
    return () => { active = false; window.removeEventListener('mkpos:office-activity', update); };
  }, [key, query]);
  useEffect(() => { let active = true; const version = ++loadVersion.current; api(`/office/ecommerce/reports?${new URLSearchParams(query)}`).then(data => active && version === loadVersion.current && setResult({ key, data, error: '' })).catch(e => active && version === loadVersion.current && setResult({ key, data: null, error: e.message })); return () => { active = false; }; }, [key, query]);
  function reconcile(row) {
    setResult(current => {
      if (current.key !== key || !current.data) return current;
      const present = current.data.items.some(item => item.id === row.id); if (!present) return current;
      const keep = matches(row, query), items = keep ? current.data.items.map(item => item.id === row.id ? row : item) : current.data.items.filter(item => item.id !== row.id);
      return { ...current, data: { ...current.data, items, total: Math.max(0, current.data.total - (keep ? 0 : 1)), last_page: Math.max(1, Math.ceil((current.data.total - (keep ? 0 : 1)) / query.per_page)) } };
    });
  }
  return <><FilterDrawer open={filterOpen} title="Shop report filters" onClose={onFilterClose}>
    <form className="office-drawer-filter-form" aria-label="Shop report filters" onSubmit={event => { event.preventDefault(); onQueryChange({ ...query, status: draft.status, reason: draft.reason, page: 1 }); onFilterClose(); }}>
      <div className="office-drawer-filter-fields">
        <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="all">All statuses</option>{Object.entries(statuses).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
        <label>Reason<select value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })}><option value="all">All reasons</option>{Object.entries(reasons).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      </div>
      <div className="office-drawer-filter-actions">
        <button type="button" onClick={() => { onQueryChange({ ...query, status: initialReportQuery.status, reason: initialReportQuery.reason, page: 1 }); onFilterClose(); }}>Clear</button>
        <button type="submit" className="office-button-primary">Apply filters</button>
      </div>
    </form>
  </FilterDrawer><section ref={listRoot} className="office-panel office-table-panel" aria-hidden={!!nav.view.id || undefined}>
    {!loading && result.error && <p className="feedback error" role="alert">{result.error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {loading ? <OfficeTableLoading columns={["Report / shop", "Customer", "Reason", "Status", "Received"]} label="Loading shop reports..."/> : data && <><div className="office-table-scroll"><table className="office-data-table office-report-table" aria-label="Shop reports"><thead><tr><th>Report / shop</th><th>Customer</th><th>Reason</th><th>Status</th><th>Received</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><strong>#{row.id} · {row.shop_name}</strong><small>{row.shop_slug}</small></td><td>{row.customer_name}</td><td>{reasons[row.reason]}</td><td><ReportBadge value={row.status} /></td><td>{when(row.created_at)}</td><OfficeActionCell><RowActions label={`report ${row.id}`}><button type="button" onClick={() => nav.go({ id: row.id })}><Eye size={16} />Review report</button></RowActions></OfficeActionCell></tr>)}</tbody></table></div>{!data.items.length && <p className="office-business-message">No shop reports match these filters.</p>}<OfficeTablePagination label="Shop report" total={data.total} page={data.page} perPage={query.per_page} lastPage={data.last_page} onPageChange={page => onQueryChange({ ...query, page })} onPerPageChange={per_page => onQueryChange({ ...query, per_page, page: 1 })} /></>}
    </section>
    <RetainedViews activeKey={nav.view.id ? `report:${nav.view.id}` : 'closed'}>{nav.view.id ? <ReportReview key={`report:${nav.view.id}`} id={nav.view.id} onBack={() => nav.back({ id: null })} onSaved={reconcile} onOpenBusiness={onOpenBusiness} refreshToken={refreshToken} /> : null}</RetainedViews>
  </>;
}
