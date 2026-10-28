import React, { useEffect, useRef, useState } from 'react';
import { Building2, Eye, Pencil, Trash2 } from 'lucide-react';
import { api, apiBlob } from './api';
import { OfficeModal } from './OfficeModal';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoadingRows, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import { RowActions } from './RowActions';
import { FilterDrawer } from './FilterDrawer';
import { officeDateTime } from './dateTime';
import './error-reports.css';

const base = '/office/error-reports';
const statuses = [['open', 'Open'], ['in_review', 'In review'], ['resolved', 'Resolved'], ['closed', 'Closed']];
const priorities = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']];
const blank = { business_id: '', title: '', description: '', expected_result: '', attempted_steps: '', app: 'unknown', status: 'open', priority: 'normal', resolution: '', internal_note: '' };
const label = (choices, value) => choices.find(([key]) => key === value)?.[1] || value;

function Screenshot({ image }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(false);
  useEffect(() => {
    let active = true, preview;
    apiBlob(image.path).then(blob => { if (active) { preview = URL.createObjectURL(blob); setUrl(preview); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (preview) URL.revokeObjectURL(preview); };
  }, [image.path]);
  return <figure>{url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot ${image.name}`}><img src={url} alt={image.name} /></a> : <span>{error ? 'Screenshot unavailable' : 'Loading screenshot...'}</span>}<figcaption>{image.name}</figcaption></figure>;
}

function ReportModal({ modal, onClose, onSaved }) {
  const creating = modal.type === 'new', viewing = modal.type === 'view', deleting = modal.type === 'delete';
  const [row, setRow] = useState(modal.row), [form, setForm] = useState({ ...blank, ...modal.row });
  const [ready, setReady] = useState(creating), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [businessSearch, setBusinessSearch] = useState(''), [businesses, setBusinesses] = useState([]), [more, setMore] = useState(false), [lookupError, setLookupError] = useState(''), [lookupBusy, setLookupBusy] = useState(false);
  const saving = useRef(false);
  const lookupRequest = useRef({ active: false });
  useEffect(() => {
    if (creating) return;
    let active = true;
    api(`${base}/${modal.row.id}`).then(value => { if (active) { setRow(value); setForm({ ...blank, ...value }); setReady(true); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [creating, modal.row?.id, retry]);
  useEffect(() => {
    if (!creating) return;
    const scope = { active: true };
    lookupRequest.current = scope;
    let active = true;
    const timer = setTimeout(() => {
      setLookupBusy(true); setLookupError('');
      api(`${base}/businesses?q=${encodeURIComponent(businessSearch)}`).then(value => { if (active) { setBusinesses(value.items); setMore(value.has_more); } }).catch(e => { if (active) setLookupError(e.message); }).finally(() => { if (active) setLookupBusy(false); });
    }, 200);
    return () => { active = false; scope.active = false; clearTimeout(timer); };
  }, [creating, businessSearch, retry]);
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function loadMore() {
    if (lookupBusy) return;
    const scope = lookupRequest.current;
    setLookupBusy(true); setLookupError('');
    try { const value = await api(`${base}/businesses?q=${encodeURIComponent(businessSearch)}&offset=${businesses.length}`); if (scope.active) { setBusinesses(current => [...current, ...value.items]); setMore(value.has_more); } }
    catch (e) { if (scope.active) setLookupError(e.message); } finally { if (scope.active) setLookupBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const data = deleting ? { version: row.version } : Object.fromEntries([...Object.keys(blank), 'version'].map(key => [key, form[key] ?? '']));
      const value = await api(creating ? base : `${base}/${row.id}`, { method: creating ? 'POST' : deleting ? 'DELETE' : 'PUT', body: JSON.stringify(data) });
      onSaved(value);
    } catch (e) { setError(e.message); } finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={creating ? 'New error report' : deleting ? 'Delete error report' : viewing ? row.reference : 'Edit error report'} closeLabel="Close error report" busy={busy} onClose={onClose} className="office-error-report-modal" footer={<><button type="button" onClick={onClose} disabled={busy}>{viewing ? 'Close' : 'Cancel'}</button>{!viewing && <button type="submit" form="error-report-form" disabled={busy || !ready || (creating && !form.business_id)} className={deleting ? 'danger-button' : 'office-button-primary'}>{busy ? 'Saving...' : deleting ? 'Delete report' : 'Save report'}</button>}</>}>
    {error && <p role="alert" className="feedback error">{error}{!ready && <button type="button" onClick={() => { setError(''); setRetry(value => value + 1); }}>Retry</button>}</p>}
    {!ready ? !error && <p role="status">Loading report...</p> : deleting ? <form id="error-report-form" onSubmit={submit}><p>Delete <strong data-no-localize>{row.reference}: {row.title}</strong> and its saved screenshots?</p></form> : viewing ? <>
      <h3 data-no-localize>{row.title}</h3>
      <dl className="office-error-report-summary"><dt>Business</dt><dd data-no-localize>{row.business_name}</dd><dt>Reported by</dt><dd>{row.reporter_name || 'Office'}</dd><dt>Contact channel</dt><dd>{({facebook:"Facebook",telegram:"Telegram",viber:"Viber",phone:"Phone"})[row.contact_channel] || "Not provided"}</dd>{row.contact_value && <><dt>Contact</dt><dd className="office-error-report-contact" data-no-localize>{row.contact_value}</dd></>}<dt>Status</dt><dd>{label(statuses, row.status)}</dd><dt>Priority</dt><dd>{label(priorities, row.priority)}</dd><dt>App</dt><dd>{row.app}</dd><dt>Created</dt><dd>{officeDateTime(row.created_at)}</dd></dl>
      {[['Problem', row.description], ['Expected result', row.expected_result], ['Steps already tried', row.attempted_steps], ['Resolution', row.resolution], ['Office note (private)', row.internal_note]].filter(([, value]) => value).map(([title, value]) => <section className="office-error-report-text" key={title}><h3>{title}</h3><p data-no-localize>{value}</p></section>)}
      {row.screenshots?.length > 0 && <section className="office-error-report-images" aria-label="Reported screenshots">{row.screenshots.map(image => <Screenshot key={image.path} image={image} />)}</section>}
    </> : <form id="error-report-form" className="office-error-report-fields" onSubmit={submit}><fieldset disabled={busy}>
      {creating ? <><label>Find business<input type="search" value={businessSearch} onChange={e => { setBusinessSearch(e.target.value); field('business_id', ''); }} placeholder="Search business name" /></label><label>Business<select required value={form.business_id} onChange={e => field('business_id', e.target.value)}><option value="">Choose business</option>{businesses.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{lookupBusy && <p role="status">Loading businesses...</p>}{lookupError && <p role="alert">{lookupError}<button type="button" onClick={() => setRetry(value => value + 1)}>Retry businesses</button></p>}{more && <button type="button" disabled={lookupBusy} onClick={loadMore}>Load more businesses</button>}</> : <p><strong>{row.reference}</strong> · {row.business_name}</p>}
      <label>Title<input required maxLength={160} value={form.title} onChange={e => field('title', e.target.value)} /></label>
      <label>Problem<textarea required rows={4} maxLength={4000} value={form.description} onChange={e => field('description', e.target.value)} /></label>
      <label>Expected result<textarea rows={2} maxLength={2000} value={form.expected_result || ''} onChange={e => field('expected_result', e.target.value)} /></label>
      <label>Steps already tried<textarea rows={3} maxLength={3000} value={form.attempted_steps || ''} onChange={e => field('attempted_steps', e.target.value)} /></label>
      <div className="office-error-report-row"><label>Status<select value={form.status} onChange={e => field('status', e.target.value)}>{statuses.map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e => field('priority', e.target.value)}>{priorities.map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label></div>
      <label>App<select value={form.app} onChange={e => field('app', e.target.value)}>{[['unknown','Unknown'],['business_web','Business web'],['business_mobile','Business mobile'],['windows','Windows']].map(([value,title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label>Resolution (visible to owner)<textarea rows={3} maxLength={4000} value={form.resolution || ''} onChange={e => field('resolution', e.target.value)} /></label>
      <label>Office note (private)<textarea rows={3} maxLength={4000} value={form.internal_note || ''} onChange={e => field('internal_note', e.target.value)} /></label>
    </fieldset></form>}
  </OfficeModal>;
}

function ReportFilters({ query, onApply, onClear }) {
  const [draft, setDraft] = useState(query);
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}><div className="office-drawer-filter-fields">{[['status', 'Status', statuses], ['priority', 'Priority', priorities]].map(([key,title,choices]) => <label key={key}>{title}<select value={draft[key]} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))}><option value="all">All</option>{choices.map(([value,name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div><div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button type="submit" className="office-button-primary">Apply filters</button></div></form>;
}

export function ErrorReportsPage({ refreshToken = 0, filterOpen = false, onFilterOpen, onFilterClose, onOpenBusiness }) {
  const [query, setQuery] = useState({ q: '', status: 'all', priority: 'all', page: 1, per_page: 25 }), [search, setSearch] = useState('');
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [notice, setNotice] = useState(''), [modal, setModal] = useState(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      api(`${base}?${new URLSearchParams(query)}`).then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, revision, refreshToken]);
  const saved = () => { setNotice(modal.type === 'delete' ? 'Error report deleted.' : 'Error report saved.'); setModal(null); setRevision(value => value + 1); };
  return <div className="office-page-stack">
    <OfficePageToolbar searchLabel="Search error reports" placeholder="Search problem or business" search={search} onSearchChange={setSearch} onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }} actionLabel="New error report" onCreate={() => setModal({ type: 'new' })} onFilterOpen={onFilterOpen} filterOpen={filterOpen} filterCount={['status','priority'].filter(key => query[key] !== 'all').length} busy={loading} />
    {error && <p role="alert" className="feedback error">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry reports</button></p>}{notice && <p role="status" className="office-success">{notice}</p>}
    <section className="office-panel office-table-panel"><header className="office-panel-header"><h2>Error reports</h2><span>{loading ? '' : `${data?.total || 0} report${data?.total === 1 ? '' : 's'}`}</span></header><div className="office-table-scroll"><table className="office-data-table" aria-label="Error reports"><thead><tr><th>Report</th><th>Business / reporter</th><th>Status</th><th>Priority</th><th>Created</th><OfficeActionHeader /></tr></thead><tbody>{!data && loading && <OfficeTableLoadingRows columns={6}/>}{data?.items.map(row => <tr key={row.id}><td><div className="office-cell-stack"><strong>{row.reference} · {row.title}</strong><small>{row.app.replaceAll('_',' ')} · {row.screenshots.length} screenshot{row.screenshots.length === 1 ? '' : 's'}</small></div></td><td><div className="office-cell-stack"><strong>{row.business_name}</strong><small>{row.reporter_name || 'Office'}</small></div></td><td><span className={`office-status office-status-${['resolved','closed'].includes(row.status) ? 'active' : 'pending'}`}>{label(statuses,row.status)}</span></td><td>{label(priorities,row.priority)}</td><td>{officeDateTime(row.created_at)}</td><OfficeActionCell><RowActions label={`error report ${row.id}`} disabled={loading}><button type="button" onClick={() => setModal({ type:'view', row })}><Eye size={14} />View report</button><button type="button" onClick={() => onOpenBusiness(row.business_id)}><Building2 size={14} />View business</button><button type="button" onClick={() => setModal({ type:'edit', row })}><Pencil size={14} />Edit report</button><button type="button" className="danger-button" onClick={() => setModal({ type:'delete', row })}><Trash2 size={14} />Delete report</button></RowActions></OfficeActionCell></tr>)}{!loading && !data?.items.length && <tr><td colSpan={6}>No error reports match these filters.</td></tr>}</tbody></table></div>{data && <OfficeTablePagination label="Error report" total={data.total} page={data.page} perPage={data.per_page} lastPage={data.last_page} disabled={loading} onPageChange={page => setQuery(current => ({ ...current,page }))} onPerPageChange={per_page => setQuery(current => ({ ...current,per_page,page:1 }))} />}</section>
    <FilterDrawer open={filterOpen} title="Error report filters" onClose={onFilterClose}>{filterOpen && <ReportFilters query={query} onApply={draft => { setQuery(current => ({ ...current,status:draft.status,priority:draft.priority,page:1 })); onFilterClose(); }} onClear={() => { setQuery(current => ({ ...current,status:'all',priority:'all',page:1 })); onFilterClose(); }} />}</FilterDrawer>
    {modal && <ReportModal key={`${modal.type}:${modal.row?.id || 'new'}`} modal={modal} onClose={() => setModal(null)} onSaved={saved} />}
  </div>;
}
