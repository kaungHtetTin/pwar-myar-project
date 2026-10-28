import { officeDate } from './dateTime';
import { BusinessOwnerEmail } from './BusinessOwnerEmail';
import {OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import React, { useEffect, useRef, useState } from 'react';
import { Eye, Mail, Trash2, X } from 'lucide-react';
import { FilterDrawer } from './FilterDrawer';
import { RowActions } from './RowActions';
import { api } from './api';
import { subscriptionAccessState } from './subscriptionUi';

export const initialBusinessQuery = { q: '', access: 'all', prospect: 'all', deletion_candidate: 'all', sort: 'potential', per_page: 25, page: 1 };
const prospects = { requested: 'Package requested', engaged: 'Repeated selling', setup: 'Catalogue ready', early: 'Early / low activity', paid: 'Already paid' };
const date = value => value ? officeDate(value) : '—';

export function BusinessesPage({ onOpen, onDeleted = () => {}, query, onQueryChange, refreshToken = 0, filterOpen = false, onFilterClose = () => {} }) {
  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState({ key: '', ids: [] });
  const [deleteTargets, setDeleteTargets] = useState(null);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const [emailBusiness, setEmailBusiness] = useState(null);
  const loadVersion = useRef(0);
  const requestKey = `${new URLSearchParams(query)}&refresh=${refresh}&app_refresh=${refreshToken}`;
  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? '' : result.error;
  useEffect(() => {
    let current = true;
    const version = ++loadVersion.current;
    api(`/office/businesses?${requestKey}`).then(data => {
      if (current && version === loadVersion.current) setResult({ key: requestKey, data, error: '' });
    }).catch(err => { if (current && version === loadVersion.current) setResult({ key: requestKey, data: null, error: err.message }); });
    return () => { current = false; };
  }, [requestKey]);
  useEffect(() => {
    let current = true;
    const refreshRequests = event => {
      if (event.type === 'mkpos:office-activity' && !event.detail?.some(item => item.event === 'subscription.requested')) return;
      const version = ++loadVersion.current;
      api(`/office/businesses?${requestKey}`).then(data => {
        if (current && version === loadVersion.current) setResult({ key: requestKey, data, error: '' });
      }).catch(() => {});
    };
    window.addEventListener('mkpos:office-request-reviewed', refreshRequests);
    window.addEventListener('mkpos:office-activity', refreshRequests);
    return () => {
      current = false;
      window.removeEventListener('mkpos:office-request-reviewed', refreshRequests);
      window.removeEventListener('mkpos:office-activity', refreshRequests);
    };
  }, [requestKey]);
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const page = data?.page || 1;
  const selectedIds = selection.key === requestKey ? selection.ids : [];
  const selectedBusinesses = data?.items.filter(business => selectedIds.includes(business.id)) || [];
  const allSelected = Boolean(data?.items.length) && selectedBusinesses.length === data.items.length;

  function toggleBusiness(id) {
    setSelection(current => {
      const ids = current.key === requestKey ? current.ids : [];
      return { key: requestKey, ids: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] };
    });
  }

  function openDelete(targets) {
    setDeleteTargets(targets);
    setDeletePhrase('');
    setDeleteError('');
  }

  async function deleteBusinesses(event) {
    event.preventDefault();
    if (!deleteTargets?.length || deletePhrase !== 'DELETE' || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await api('/office/businesses', {
        method: 'DELETE',
        body: JSON.stringify({ ids: deleteTargets.map(business => business.id), confirmation: 'DELETE' }),
      });
      setNotice({
        warning: !response.file_cleanup_complete,
        message: response.file_cleanup_complete
          ? `${response.deleted_count} business${response.deleted_count === 1 ? '' : 'es'} permanently deleted.`
          : `${response.deleted_count} business${response.deleted_count === 1 ? '' : 'es'} deleted, but some stored files could not be removed. Check the server log.`,
      });
      setDeleteTargets(null);
      setSelection({ key: '', ids: [] });
      onQueryChange({ ...query, page: 1 });
      setRefresh(value => value + 1);
      onDeleted();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleting(false);
    }
  }
  return <section className="office-panel office-table-panel">
    <FilterDrawer open={filterOpen} title="Business filters" onClose={onFilterClose}>
      <form className="office-drawer-filter-form" aria-label="Business filters" onSubmit={event => { event.preventDefault(); onQueryChange({ ...query, access: draft.access, prospect: draft.prospect, deletion_candidate: draft.deletion_candidate, sort: draft.sort, page: 1 }); onFilterClose(); }}>
      <div className="office-drawer-filter-fields">
        <label>Access<select value={draft.access} onChange={e => change('access', e.target.value)}>{['all', 'trial', 'paid', 'expired', 'cancelled', 'scheduled', 'none'].map(v => <option key={v} value={v}>{v === 'all' ? 'All access' : (v === 'cancelled' ? 'suspended' : v)}</option>)}</select></label>
        <label>Follow-up signal<select value={draft.prospect} onChange={e => change('prospect', e.target.value)}><option value="all">All signals</option>{Object.entries(prospects).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Deletion suggestions<select value={draft.deletion_candidate} onChange={e => change('deletion_candidate', e.target.value)}><option value="all">All businesses</option><option value="suggested">No plan and inactive over 30 days</option></select></label>
        <p className="office-filter-help">Suggestions have no subscription history, were registered more than 30 days ago, and have no sales, purchases, payments, expenses, or stock movements in the last 30 days. Review each business before deleting.</p>
        <label>Sort by<select value={draft.sort} onChange={e => change('sort', e.target.value)}><option value="potential">Follow-up priority</option><option value="newest">Newest registered</option><option value="activity">Latest sale</option></select></label>
      </div>
      <div className="office-drawer-filter-actions"><button type="button" disabled={loading} onClick={() => { setDraft(current => ({ ...current, access: 'all', prospect: 'all', deletion_candidate: 'all', sort: 'potential' })); onQueryChange({ ...query, access: 'all', prospect: 'all', deletion_candidate: 'all', sort: 'potential', page: 1 }); onFilterClose(); }}>Clear</button><button type="submit" className="office-button-primary" disabled={loading}>Apply filters</button></div>
      </form>
    </FilterDrawer>
    <details className="office-business-signals"><summary>How follow-up signals work</summary><p>These are usage signals, not a purchase prediction. Priority: unpaid businesses with a pending package request; then at least 5 completed sales on 2 different days in the last 30 days; then at least 5 active products; then early/low activity. Active paid customers are shown separately. Test transactions can count. Unsynchronized offline sales are not included. Review the business before contacting its owner.</p></details>
    {notice && <p className={`office-business-notice${notice.warning ? ' is-warning' : ''}`} role={notice.warning ? 'alert' : 'status'}>{notice.message}</p>}
    {error && <div className="feedback error" role="alert">{error} <button type="button" onClick={() => setRefresh(n => n + 1)}>Retry</button></div>}
    {loading ? <OfficeTableLoading columns={["", "Business", "Access", "Follow-up", "Activity", "Last sale"]} label="Loading businesses..."/> : data && <>
      {selectedBusinesses.length > 0 && <div className="office-business-bulk-actions"><strong>{selectedBusinesses.length} selected</strong><button type="button" className="office-button-danger" onClick={() => openDelete(selectedBusinesses.map(({ id, name }) => ({ id, name })))}><Trash2 size={15} /> Delete selected</button><button type="button" onClick={() => setSelection({ key: requestKey, ids: [] })}>Clear selection</button></div>}
      {data.items.length ? <div className="office-table-scroll"><table className="office-data-table office-business-table">
        <thead><tr><th className="office-business-select-cell"><label className="office-business-selection"><input type="checkbox" aria-label="Select all businesses on this page" checked={allSelected} ref={node => { if (node) node.indeterminate = selectedBusinesses.length > 0 && !allSelected; }} onChange={() => setSelection({ key: requestKey, ids: allSelected ? [] : data.items.map(business => business.id) })} /></label></th><th>Business</th><th>Access</th><th>Follow-up</th><th>Activity</th><th>Last sale</th><OfficeActionHeader /></tr></thead>
        <tbody>{data.items.map(business => {
          const state = subscriptionAccessState(business.subscription);
          return <tr key={business.id} className={selectedIds.includes(business.id) ? 'is-selected' : undefined}>
            <td className="office-business-select-cell"><label className="office-business-selection"><input type="checkbox" aria-label={`Select ${business.name}`} checked={selectedIds.includes(business.id)} onChange={() => toggleBusiness(business.id)} /></label></td>
            <td><strong className="office-business-name" title={business.name}>{business.name}</strong><small className="office-business-meta" title={business.owner_name || business.owner_email || 'No owner'}>{business.owner_name || business.owner_email || 'No owner'}</small></td>
            <td><span className={`office-status office-status-${state.key}`}>{state.label}</span>{business.subscription?.ends_at && <small className="office-business-meta">Ends {date(business.subscription.ends_at)}</small>}</td>
            <td><span className={`office-prospect office-prospect-${business.prospect}`}>{prospects[business.prospect] || 'No signal'}</span>{Number(business.pending_requests) > 0 && <small className="office-business-meta">{business.pending_requests} pending request(s)</small>}</td>
            <td><strong>{business.sales_30d} sales · 30d</strong><small className="office-business-meta">{business.product_count} products</small></td>
            <td>{date(business.last_sale_at)}</td>
            <OfficeActionCell><RowActions label={business.name}><button type="button" onClick={() => onOpen(business.id)}><Eye size={14} /> View business</button><button type="button" disabled={!business.owner_email} title={!business.owner_email ? 'No owner email available' : undefined} onClick={() => { setNotice(''); setEmailBusiness(business); }}><Mail size={14} /> Send email</button><button type="button" className="danger-button" onClick={() => openDelete([{ id: business.id, name: business.name }])}><Trash2 size={14} /> Delete business</button></RowActions></OfficeActionCell>
          </tr>;
        })}</tbody>
      </table></div> : <p className="office-business-message">No matching businesses. Clear or adjust the filters.</p>}
      <OfficeTablePagination label="Businesses" total={data.total} page={page} perPage={data.per_page || query.per_page} lastPage={data.last_page} overallTotal={data.summary.total} onPageChange={page => onQueryChange({ ...query, page })} onPerPageChange={per_page => onQueryChange({ ...query, per_page, page: 1 })} />
    </>}
    {emailBusiness && <BusinessOwnerEmail key={emailBusiness.id} business={emailBusiness} onClose={() => setEmailBusiness(null)} onSent={message => { setNotice({ message, warning: false }); setEmailBusiness(null); }} />}
    {deleteTargets && <div className="office-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setDeleteTargets(null); }}>
      <form className="office-modal office-business-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="office-business-delete-title" onSubmit={deleteBusinesses} onKeyDown={event => { if (event.key === 'Escape' && !deleting) setDeleteTargets(null); }}>
        <div className="office-modal-header"><div><h2 id="office-business-delete-title">Permanently delete {deleteTargets.length === 1 ? 'business' : `${deleteTargets.length} businesses`}?</h2><p>This removes the business accounts, related records, and stored files.</p></div><button type="button" className="office-icon-button mkpos-dismiss-icon" disabled={deleting} onClick={() => setDeleteTargets(null)} aria-label="Close delete confirmation"><X size={17} /></button></div>
        <div className="office-modal-body"><ul className="office-business-delete-list">{deleteTargets.slice(0, 5).map(business => <li key={business.id}>{business.name}</li>)}{deleteTargets.length > 5 && <li>and {deleteTargets.length - 5} more</li>}</ul><label>Type DELETE to confirm<input autoFocus value={deletePhrase} onChange={event => setDeletePhrase(event.target.value)} autoComplete="off" spellCheck="false" /></label>{deleteError && <p className="feedback error" role="alert">{deleteError}</p>}</div>
        <div className="office-modal-footer"><button type="button" disabled={deleting} onClick={() => setDeleteTargets(null)}>Cancel</button><button type="submit" className="office-button-danger" disabled={deleting || deletePhrase !== 'DELETE'}><Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete permanently'}</button></div>
      </form>
    </div>}
  </section>;
}
