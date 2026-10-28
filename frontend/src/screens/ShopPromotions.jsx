import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Edit, Filter, Pause, Play, Plus, Search, Tag, Trash2, Zap } from 'lucide-react';
import { request } from '../api';
import { Field, FilterDrawer, Modal, TablePagination } from '../components/common';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { RemoteCombobox } from '../components/RemoteCombobox';
import { RowActions } from '../components/RowActions';
import { FlashSaleWizard } from './FlashSaleWizard';

const blank = type => ({ type, name: '', code: '', product_id: null, product_name: '', discount_type: 'percentage', discount_value: '', minimum_subtotal: 0, usage_limit: '', quantity_limit: '', starts_at: '', ends_at: '', enabled: true });
const defaults = { type: '', status: 'all' };
function shopTime(value, timezone) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
const editValue = (row, timezone) => ({ ...row, usage_limit: row.usage_limit ?? '', quantity_limit: row.quantity_limit ?? '', starts_at: shopTime(row.starts_at, timezone), ends_at: shopTime(row.ends_at, timezone) });
const payload = form => ({ type: form.type, name: form.name.trim(), code: form.type === 'coupon' ? form.code.trim().toUpperCase() : null,
  ...(form.product_ids ? { product_ids: form.product_ids } : {}),
  ...(form.items ? { items: form.items } : {}),
  product_id: form.type === 'flash_sale' ? form.product_id : null, discount_type: form.discount_type, discount_value: Number(form.discount_value),
  minimum_subtotal: Number(form.minimum_subtotal || 0), usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
  quantity_limit: form.quantity_limit === '' ? null : Number(form.quantity_limit), starts_at: form.starts_at || null, ends_at: form.ends_at || null, enabled: form.enabled });

export function ShopPromotions({ refresh, timezone = 'Asia/Rangoon', currency = 'Ks' }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [filters, setFilters] = useState(defaults), [draftFilters, setDraftFilters] = useState(defaults), [filterOpen, setFilterOpen] = useState(false);
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: '' });
  const saving = useRef(false);
  const selectPageRef = useRef(null);
  const [selected, setSelected] = useState(() => new Map()), [bulkDeleting, setBulkDeleting] = useState(null);
  const [edit, setEdit] = useState(null), [deleting, setDeleting] = useState(null), [working, setWorking] = useState(false), [formError, setFormError] = useState(''), [revision, setRevision] = useState(0);
  const selectedOnPage = state.items.filter(row => selected.has(row.id)).length;
  const pageSelected = state.items.length > 0 && selectedOnPage === state.items.length;
  const selectionDisabled = working || state.loading || Boolean(state.error) || search.trim() !== query;
  useEffect(() => { if (selectPageRef.current) selectPageRef.current.indeterminate = selectedOnPage > 0 && !pageSelected; }, [selectedOnPage, pageSelected]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    setState(value => ({ ...value, loading: true, error: '' }));
    request(`/shop-admin/promotions?${new URLSearchParams({ q: query, ...filters, offset: (page - 1) * 25, limit: 25 })}`).then(result => {
      if (!active) return;
      const lastPage = Math.max(1, Math.ceil(result.total / 25));
      if (page > lastPage) { setPage(lastPage); return; }
      setState({ ...result, loading: false, error: '' });
      setSelected(previous => {
        const next = new Map(previous);
        for (const row of result.items) if (next.has(row.id)) next.set(row.id, row);
        return next;
      });
    }).catch(error => { if (active) setState(value => ({ ...value, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [query, filters, page, refresh, revision]);
  const loadProducts = useCallback((q, { offset = 0, limit = 20, category = '', ...picker } = {}) => {
    const params = new URLSearchParams({ q, offset, limit, category, publication_status: 'published' });
    for (const [key, value] of Object.entries(picker)) {
      if (Array.isArray(value)) value.forEach(id => params.append(`${key}[]`, id));
      else if (value !== undefined && value !== null) params.set(key, value);
    }
    return request(`/shop-admin/publications?${params}`);
  }, []);
  const loadCategories = useCallback(async () => (await request('/shop-admin/publications/filters')).categories || [], []);
  function open(row) { setFormError(''); setEdit(row.id ? editValue(row, timezone) : row); }
  async function save(event, form = edit) {
    event?.preventDefault();
    if (saving.current) return;
    saving.current = true; setWorking(true); setFormError('');
    try {
      await request(`/shop-admin/promotions${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(payload(form)) });
      setEdit(null); setRevision(value => value + 1);
    } catch (error) { setFormError(error.message); }
    finally { saving.current = false; setWorking(false); }
  }
  async function remove() {
    if (saving.current) return;
    saving.current = true; setWorking(true); setFormError('');
    try { await request(`/shop-admin/promotions/${deleting.id}`, { method: 'DELETE' }); setSelected(previous => { const next = new Map(previous); next.delete(deleting.id); return next; }); setDeleting(null); setRevision(value => value + 1); }
    catch (error) { setFormError(error.message); }
    finally { saving.current = false; setWorking(false); }
  }
  const field = (name, value) => setEdit(form => ({ ...form, [name]: value }));
  function selectRows(rows, checked) {
    if (selectionDisabled) return;
    const next = new Map(selected);
    for (const row of rows) { if (checked) next.set(row.id, row); else next.delete(row.id); }
    if (next.size > 1000) { setFormError('Select up to 1,000 promotions at a time.'); return; }
    setSelected(next);
  }
  async function removeSelected() {
    if (saving.current || !bulkDeleting?.length) return;
    saving.current = true; setWorking(true); setFormError('');
    try {
      await request('/shop-admin/promotions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: bulkDeleting.map(row => row.id) }) });
      const ids = new Set(bulkDeleting.map(row => row.id));
      setSelected(previous => new Map([...previous].filter(([id]) => !ids.has(id))));
      setState(previous => ({ ...previous, items: previous.items.filter(row => !ids.has(row.id)) }));
      setBulkDeleting(null); setRevision(value => value + 1);
    } catch (error) { setFormError(error.message); }
    finally { saving.current = false; setWorking(false); }
  }
  const filterCount = Number(Boolean(filters.type)) + Number(filters.status !== 'all');
  const date = value => value ? new Date(value).toLocaleString(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }) : null;
  return <div className="shop-promotions">
    <AppBarSearch><label><Search size={16} /><input aria-label="Search promotions" disabled={working} maxLength={120} placeholder="Search promotion, coupon code or product" value={search} onChange={event => { setSearch(event.target.value); setSelected(new Map()); }} /></label></AppBarSearch>
    <AppBarActions>
      <button type="button" className="primary" disabled={working} onClick={() => open(blank('flash_sale'))}><Zap size={16} /> Add flash sale</button>
      <button type="button" disabled={working} onClick={() => open(blank('coupon'))}><Plus size={16} /> Add coupon</button>
      <button type="button" disabled={working} onClick={() => { setDraftFilters(filters); setFilterOpen(true); }}><Filter size={16} /> Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button>
    </AppBarActions>
    <p className="shop-promotions-help">Flash sales apply automatically to the product’s online unit. Coupons apply after sale prices and exclude delivery fees. Limits count placed orders, including cancelled orders; retries count once.</p>
    {formError && !edit && !deleting && !bulkDeleting && <p role="alert">{formError}</p>}
    <div className="shop-table-card">
      {selected.size > 0 && <div className="shop-promotion-selection-bar"><span role="status">{selected.size} selected across pages</span><div><button type="button" disabled={working} onClick={() => setSelected(new Map())}>Clear selection</button><button type="button" className="danger-button" disabled={selectionDisabled} onClick={() => { setFormError(''); setBulkDeleting([...selected.values()]); }}><Trash2 size={16} /> Delete selected ({selected.size})</button></div></div>}
      <div className="table-wrap sheet-table shop-table-scroll" aria-busy={state.loading}>
      <table className="shop-data-table" aria-label="Shop promotions">
        <colgroup><col className="shop-promotion-select-column" /><col /><col /><col /><col /><col /><col className="table-action-column" /></colgroup>
        <thead><tr><th className="shop-promotion-select-cell"><input ref={selectPageRef} type="checkbox" aria-label="Select all promotions on this page" disabled={selectionDisabled || !state.items.length} checked={pageSelected} onChange={event => selectRows(state.items, event.target.checked)} /></th><th>Promotion</th><th>Discount</th><th>Usage / limit</th><th>Duration</th><th>Status</th><th className="table-actions-cell">Actions</th></tr></thead>
        <tbody>{state.items.map(row => <tr key={row.id}>
          <td className="shop-promotion-select-cell"><input type="checkbox" aria-label={`Select ${row.name}${row.product_name ? ` — ${row.product_name}` : ''} (${row.id})`} disabled={selectionDisabled} checked={selected.has(row.id)} onChange={event => selectRows([row], event.target.checked)} /></td>
          <td><strong>{row.name}</strong><small className="shop-cell-meta">{row.type === 'coupon' ? `Coupon · ${row.code}` : `Flash sale · ${row.product_name || 'Unavailable product'} · ${row.unit === 'purchase' ? 'Purchase unit' : 'Base unit'}`}</small></td>
          <td><strong>{row.discount_type === 'percentage' ? `${row.discount_value}%` : `${Number(row.discount_value).toLocaleString()} ${currency}`} off</strong>{row.type === 'coupon' && Number(row.minimum_subtotal) > 0 && <small className="shop-cell-meta">Minimum {Number(row.minimum_subtotal).toLocaleString()} {currency}</small>}</td>
          <td>{row.type === 'coupon' ? `${row.used_count} / ${row.usage_limit ?? 'Unlimited'} uses` : `${Number(row.used_quantity).toLocaleString()} / ${row.quantity_limit == null ? 'Unlimited' : Number(row.quantity_limit).toLocaleString()} units`}</td>
          <td><span>{date(row.starts_at) || 'Starts immediately'}</span><small className="shop-cell-meta">{date(row.ends_at) ? `Until ${date(row.ends_at)}` : 'No end time'}</small></td>
          <td><span className={`status-badge ${row.status === 'active' ? 'completed' : row.status === 'scheduled' ? 'warn' : 'voided'}`}>{row.status}</span></td>
          <td className="table-actions-cell"><RowActions label={row.name} disabled={working}>
            <button type="button" onClick={() => open(row)}><Edit size={15} /> Edit</button>
            <button type="button" onClick={() => save(null, { ...editValue(row, timezone), enabled: !row.enabled })}>{row.enabled ? <Pause size={15} /> : <Play size={15} />}{row.enabled ? 'Pause' : 'Enable'}</button>
            <button type="button" className="danger-button" onClick={() => { setFormError(''); setDeleting(row); }}><Trash2 size={15} /> Delete</button>
          </RowActions></td>
        </tr>)}</tbody>
      </table>
      {state.loading ? <p role="status">Loading promotions…</p> : state.error ? <p role="alert">{state.error} <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p> : !state.items.length && <p className="shop-list-end">No promotions found. Add a flash sale or coupon to get started.</p>}
    </div><TablePagination page={page} pageSize={25} total={state.total} loading={state.loading || working} onPageChange={setPage} /></div>
    <FilterDrawer open={filterOpen} title="Promotion filters" onClose={() => setFilterOpen(false)}><form className="drawer-filter-form" onSubmit={event => { event.preventDefault(); setFilters(draftFilters); setSelected(new Map()); setPage(1); setFilterOpen(false); }}>
      <Field label="Type"><select value={draftFilters.type} onChange={event => setDraftFilters(value => ({ ...value, type: event.target.value }))}><option value="">All promotions</option><option value="flash_sale">Flash sales</option><option value="coupon">Coupons</option></select></Field>
      <Field label="Status"><select value={draftFilters.status} onChange={event => setDraftFilters(value => ({ ...value, status: event.target.value }))}>{['all', 'active', 'scheduled', 'expired', 'paused', 'exhausted'].map(status => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>)}</select></Field>
      <div className="drawer-filter-actions"><button type="button" onClick={() => { setFilters(defaults); setDraftFilters(defaults); setSelected(new Map()); setPage(1); setFilterOpen(false); }}>Clear</button><button type="submit" className="primary">Apply Filter</button></div>
    </form></FilterDrawer>
    {edit?.type === 'flash_sale' && <FlashSaleWizard initial={edit} timezone={timezone} currency={currency} loadProducts={loadProducts} loadCategories={loadCategories} working={working} error={formError} onClose={() => setEdit(null)} onSave={save} />}
    {edit?.type === 'coupon' && <Modal open title={`${edit.id ? 'Edit' : 'Add'} ${edit.type === 'coupon' ? 'coupon' : 'flash sale'}`} busy={working} onClose={() => setEdit(null)} footer={<><button type="button" disabled={working} onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="shop-promotion-form" className="primary" disabled={working || !edit.name.trim() || !edit.discount_value || (edit.type === 'coupon' ? !edit.code.trim() : !edit.product_id)}><Tag size={16} />{working ? 'Saving…' : 'Save promotion'}</button></>}>
      <form id="shop-promotion-form" className="shop-promotion-form" onSubmit={save}><fieldset disabled={working}>
        {formError && <p role="alert">{formError}</p>}
        <Field label="Promotion name"><input required maxLength={255} value={edit.name} onChange={event => field('name', event.target.value)} /></Field>
        {edit.type === 'coupon' ? <Field label="Coupon code"><input required maxLength={40} pattern="[A-Za-z0-9_-]+" value={edit.code} onChange={event => field('code', event.target.value.toUpperCase())} /></Field> : <Field label="Product"><RemoteCombobox value={edit.product_id} selectedOption={edit.product_id ? { id: edit.product_id, name: edit.product_name } : null} disabled={working || Number(edit.used_count) > 0} loadOptions={loadProducts} placeholder="Search publication products" onSelect={product => setEdit(form => ({ ...form, product_id: product?.id ?? null, product_name: product?.name ?? '' }))} /></Field>}
        <div className="shop-promotion-grid"><Field label="Discount type"><select value={edit.discount_type} onChange={event => field('discount_type', event.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></Field>
          <Field label={edit.discount_type === 'percentage' ? 'Discount (%)' : `Discount (${currency})`}><input required type="number" min="1" step="1" max={edit.discount_type === 'percentage' ? 99 : 1000000000} value={edit.discount_value} onChange={event => field('discount_value', event.target.value)} /></Field></div>
        {edit.type === 'coupon' && <Field label={`Minimum merchandise subtotal (${currency}, optional)`}><input type="number" min="0" max="1000000000" step="1" value={edit.minimum_subtotal} onChange={event => field('minimum_subtotal', event.target.value)} /></Field>}
        <Field label={edit.type === 'coupon' ? 'Total usage limit (optional)' : 'Total quantity limit in online units (optional)'}><input type="number" min={edit.type === 'coupon' ? 1 : 0.001} max="1000000" step={edit.type === 'coupon' ? 1 : 0.001} placeholder="Unlimited" value={edit.type === 'coupon' ? edit.usage_limit : edit.quantity_limit} onChange={event => field(edit.type === 'coupon' ? 'usage_limit' : 'quantity_limit', event.target.value)} /></Field>
        <p className="shop-cell-meta">Dates use shop time: {timezone}. Leave either date blank for no boundary. A discount keeps at least 1 {currency} payable.</p>
        <div className="shop-promotion-grid"><Field label="Start time (optional)"><input type="datetime-local" value={edit.starts_at} onChange={event => field('starts_at', event.target.value)} /></Field><Field label="End time (optional)"><input type="datetime-local" value={edit.ends_at} min={edit.starts_at || undefined} onChange={event => field('ends_at', event.target.value)} /></Field></div>
        <label className="shop-checkbox"><input type="checkbox" checked={edit.enabled} onChange={event => field('enabled', event.target.checked)} />Enabled</label>
      </fieldset></form>
    </Modal>}
    {bulkDeleting && <Modal open title="Delete selected promotions" busy={working} onClose={() => setBulkDeleting(null)} footer={<><button type="button" disabled={working} onClick={() => setBulkDeleting(null)}>Cancel</button><button type="button" className="danger-button" disabled={working} onClick={removeSelected}>{working ? 'Deleting...' : `Delete ${bulkDeleting.length} promotions`}</button></>}>
      <p>Stop and remove these {bulkDeleting.length} selected promotions. Existing order discounts and redemption history remain available.</p>
      <ul className="shop-promotion-delete-list">{bulkDeleting.map(row => <li key={row.id}><strong>{row.name}</strong>{row.product_name ? ` - ${row.product_name}` : row.code ? ` - ${row.code}` : ''}</li>)}</ul>
      {formError && <p role="alert">{formError}</p>}
    </Modal>}
    {deleting && <Modal open title="Delete promotion" busy={working} onClose={() => setDeleting(null)} footer={<><button type="button" disabled={working} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="danger-button" disabled={working} onClick={remove}>Delete promotion</button></>}><p>Stop {deleting.name} and remove it from this list. Discounts on existing orders and redemption history remain available.</p>{formError && <p role="alert">{formError}</p>}</Modal>}
  </div>;
}
