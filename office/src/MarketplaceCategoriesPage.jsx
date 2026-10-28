import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Pencil, Save, Trash2 } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoading, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import { RowActions } from './RowActions';
import { FilterDrawer } from './FilterDrawer';
import { OfficeModal } from './OfficeModal';
import { RetainedViews } from './RetainedViews';
import { usePageNavigation } from './usePageNavigation';
import { useRetainedActivity } from './retainedActivity';
import './marketplace-categories.css';

const endpoint = '/office/marketplace-categories';

function ParentPicker({ category, value, onChange }) {
  const selectId = useId();
  const [chosen, setChosen] = useState({ id: category?.parent_id, path: category?.parent_name_en });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], has_more: false, key: '', error: '' });
  const key = `${query}:${category?.id || ''}`;
  const requestKey = `${key}:${page}:${revision}`;
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ q: query, page });
    if (category?.id) params.set('exclude_id', category.id);
    api(`${endpoint}/options?${params}`).then(data => {
      if (current) setResult(previous => ({ ...data, key: requestKey, error: '',
        items: [...new Map([...(page > 1 && previous.queryKey === key ? previous.items : []), ...data.items].map(item => [item.id, item])).values()], queryKey: key }));
    }).catch(error => { if (current) setResult(previous => ({ ...previous, key: requestKey, error: error.message })); });
    return () => { current = false; };
  }, [query, page, key, requestKey, category?.id]);
  const items = result.queryKey === key ? result.items : [];
  const selected = items.some(item => String(item.id) === String(value));
  const busy = result.key !== requestKey;
  return <div className="marketplace-category-parent">
    <label>Find parent category<input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Search category names or paths" /></label>
    <label htmlFor={selectId}>Parent category</label><select id={selectId} value={value || ''} onChange={event => { const id = event.target.value; setChosen(items.find(item => String(item.id) === id) || { id, path: '' }); onChange(id); }}>
      <option value="">No parent (top level)</option>
      {value && !selected && <option value={value}>{String(chosen.id) === String(value) && chosen.path ? chosen.path : category?.parent_name_en || `Selected category #${value}`}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{item.path}{!item.effective_active ? ' (inactive)' : ''}</option>)}
    </select>
    {busy && <small role="status">Loading parent categories…</small>}
    {result.error && <p role="alert">{result.error} <button type="button" onClick={() => setRevision(n => n + 1)}>Retry parent categories</button></p>}
    {result.has_more && !result.error && <button type="button" disabled={busy} onClick={() => setPage(n => n + 1)}>Load more parent categories</button>}
    <small>Choose no parent for a top-level category. An inactive parent also makes its children inactive in the category tree.</small>
  </div>;
}

function CategoryEditor({ category, onClose, onSaved }) {
  const formId = useId();
  const active = useRetainedActivity();
  const visible = useRef(active);
  useEffect(() => { visible.current = active; }, [active]);
  const [form, setForm] = useState(category || { name_en: '', name_my: '', slug: '', parent_id: '', sort_order: 0, is_active: true });
  const [slugEdited, setSlugEdited] = useState(Boolean(category));
  const [parentPickerRevision, setParentPickerRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const saving = useRef(false);
  const close = () => { if (!saving.current) onClose(); };
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setErrors({});
    try {
      const saved = await api(`${endpoint}${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify({
        name_en: form.name_en, name_my: form.name_my || null, slug: form.slug, parent_id: form.parent_id ? Number(form.parent_id) : null,
        sort_order: Number(form.sort_order), is_active: form.is_active, ...(form.id ? { version: form.version } : {}),
      }) });
      const creating = !form.id;
      setForm(creating ? { name_en: '', name_my: '', slug: '', parent_id: '', sort_order: 0, is_active: true } : saved);
      setSlugEdited(!creating); if (creating) setParentPickerRevision(value => value + 1);
      onSaved(saved, visible.current, creating);
    } catch (err) { setError(err.message); setErrors(err.payload?.errors || {}); }
    finally { saving.current = false; setBusy(false); }
  }
  const fieldError = key => errors[key] && <small className="feedback error">{errors[key][0]}</small>;
  return <OfficeModal title={form.id ? 'Edit marketplace category' : 'Add marketplace category'} closeLabel="Close category form" className="marketplace-category-modal" onClose={close} busy={busy}
    footer={<><button type="button" disabled={busy} onClick={close}>Cancel</button><button type="submit" form={formId} className="office-button-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save category'}</button></>}>
    <form id={formId} onSubmit={submit}>
      <fieldset disabled={busy} className="marketplace-category-fields">
        <label>English name<input required maxLength={160} value={form.name_en} onChange={event => {
          const name = event.target.value;
          setForm(current => ({ ...current, name_en: name, ...(!slugEdited ? { slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '') } : {}) }));
        }} />{fieldError('name_en')}</label>
        <label>Myanmar name (optional)<input maxLength={160} value={form.name_my || ''} onChange={event => change('name_my', event.target.value)} />{fieldError('name_my')}</label>
        <label>Slug<input required maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => { setSlugEdited(true); change('slug', event.target.value); }} /><small>Unique lowercase letters, numbers and hyphens, for example food-and-drinks.</small>{fieldError('slug')}</label>
        <label>Display order<input required type="number" min={0} max={999999} step={1} value={form.sort_order} onChange={event => change('sort_order', event.target.value)} /><small>Lower numbers appear first.</small>{fieldError('sort_order')}</label>
        <ParentPicker key={parentPickerRevision} category={form} value={form.parent_id} onChange={value => change('parent_id', value)} />
        {fieldError('parent_id')}
        <label className="marketplace-category-check"><input type="checkbox" checked={form.is_active} onChange={event => change('is_active', event.target.checked)} /> Active category</label>
      </fieldset>
      {error && <p className="feedback error" role="alert">{error}</p>}
    </form>
  </OfficeModal>;
}

function CategoryFilters({ query, onApply, onClear }) {
  const [draft, setDraft] = useState({ status: query.status, level: query.level });
  return <form className="office-drawer-filter-form marketplace-category-filters" onSubmit={event => { event.preventDefault(); onApply(draft); }}><div className="office-drawer-filter-fields">
    <label>Status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label>Level<select value={draft.level} onChange={event => setDraft(current => ({ ...current, level: event.target.value }))}><option value="all">All levels</option><option value="root">Top-level categories</option><option value="child">Subcategories</option></select></label>
    </div><div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear filters</button><button className="office-button-primary">Apply filters</button></div>
  </form>;
}

export function MarketplaceCategoriesPage({ scope = 'office', refreshToken = 0, filterOpen: controlledFilterOpen, onFilterOpen, onFilterClose }) {
  const active = useRetainedActivity();
  const [localFilterOpen, setLocalFilterOpen] = useState(false);
  const filterOpen = controlledFilterOpen ?? localFilterOpen;
  const closeFilters = onFilterClose || (() => setLocalFilterOpen(false));
  const [query, setQuery] = useState({ q: '', status: 'all', level: 'all', page: 1, per_page: 25 });
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const [records, setRecords] = useState(() => new Map());
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const navigation = usePageNavigation(`office-marketplace-categories:${scope}`, { kind: 'list' }, () => location.href, { resumeHistory: false });
  const editor = navigation.view.kind === 'editor' ? navigation.view : null;
  const content = useRef(null), scrollPositions = useRef(new Map());
  useLayoutEffect(() => {
    if (!active) return;
    const scroller = content.current?.closest('.office-content');
    if (!scroller) return;
    const key = 'list';
    const position = scrollPositions.current.get(key) || [0, 0];
    const restore = () => scroller.scrollTo(...position);
    restore();
    const frame = requestAnimationFrame(restore);
    const remember = () => scrollPositions.current.set(key, [scroller.scrollLeft, scroller.scrollTop]);
    scroller.addEventListener('scroll', remember);
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener('scroll', remember); };
  }, [active]);
  const queryKey = new URLSearchParams(query).toString();
  const requestKey = `${queryKey}&revision=${revision}&refresh=${refreshToken}`;
  const data = result.queryKey === queryKey ? result.data : null;
  useEffect(() => {
    let current = true;
    api(`${endpoint}?${requestKey}`).then(value => { if (current) setResult({ key: requestKey, queryKey, data: value, error: '' }); })
      .catch(error => { if (current) setResult(previous => ({ key: requestKey, queryKey, data: previous.queryKey === queryKey ? previous.data : null, error: error.message })); });
    return () => { current = false; };
  }, [queryKey, requestKey]);
  function openEditor(category) {
    const key = crypto.randomUUID();
    setRecords(current => new Map(current).set(key, category));
    navigation.go({ kind: 'editor', key });
  }
  function closeDelete() { if (!deleting.current) { setDeleteTarget(null); setDeleteError(''); } }
  async function remove() {
    if (deleting.current) return;
    deleting.current = true; setBusy(true); setDeleteError('');
    try {
      await api(`${endpoint}/${deleteTarget.id}`, { method: 'DELETE', body: JSON.stringify({ version: deleteTarget.version }) });
      setDeleteTarget(null); setMessage('Category deleted.'); setRevision(n => n + 1);
    } catch (error) { setDeleteError(error.message); }
    finally { deleting.current = false; setBusy(false); }
  }
  const list = <section className="office-panel office-table-panel marketplace-category-manager">
    <div className="office-panel-header"><div><h2>Category directory</h2><p>Manage the shared marketplace category tree. Each business keeps its own product categories.</p></div></div>
    {message && <p className="feedback" role="status">{message}</p>}
    {result.error && <p className="feedback error" role="alert">{result.error} <button onClick={() => setRevision(n => n + 1)}>Retry categories</button></p>}
    {!data && result.key !== requestKey && <OfficeTableLoading columns={["Category", "Parent", "Status", "Order", "Children", "Linked products"]} label="Loading categories..."/>}
    {data && <>
      {data.items.length ? <div className="office-table-scroll"><table className="office-data-table"><thead><tr><th>Category</th><th>Parent</th><th>Status</th><th>Order</th><th>Children</th><th>Linked products</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(category => <tr key={category.id}>
        <td><div className="office-cell-stack"><strong>{category.name_en}</strong>{category.name_my && <span>{category.name_my}</span>}<small>{category.path}</small><small>{category.slug}</small></div></td>
        <td>{category.parent_name_en || 'Top level'}</td><td><span className={`office-status office-status-${category.is_active ? 'active' : 'hidden'}`}>{category.is_active ? 'Active' : 'Inactive'}</span>{category.is_active && !category.effective_active && <small className="office-business-meta">Parent inactive</small>}</td>
        <td>{category.sort_order}</td><td>{category.children_count}</td><td>{category.products_count || 0}</td><OfficeActionCell><RowActions label={category.name_en} disabled={busy}><button onClick={() => openEditor(category)}><Pencil size={16} /> Edit</button><button className="danger-button" disabled={category.children_count > 0 || category.products_count > 0} title={category.children_count > 0 || category.products_count > 0 ? 'Move or unlink children and products first' : 'Delete category'} onClick={() => { setDeleteError(''); setDeleteTarget(category); }}><Trash2 size={16} /> Delete</button></RowActions></OfficeActionCell>
      </tr>)}</tbody></table></div> : <p>No categories found. Add a category or change your search and filters.</p>}
      <OfficeTablePagination label="Categories" total={data.total} page={data.page} perPage={query.per_page} lastPage={data.last_page} disabled={busy}
        onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, per_page, page: 1 }))} />
    </>}
  </section>;
  return <>
    <OfficePageToolbar searchLabel="Search marketplace categories" placeholder="Search English, Myanmar or slug" search={search} onSearchChange={setSearch}
      onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }}
      actionLabel="Add category" onCreate={() => openEditor(null)} busy={busy || Boolean(editor)} filterOpen={filterOpen} filterCount={Number(query.status !== 'all') + Number(query.level !== 'all')} onFilterOpen={onFilterOpen || (() => setLocalFilterOpen(true))} />
    <FilterDrawer open={filterOpen && active && !editor} title="Marketplace category filters" onClose={closeFilters} busy={busy}>
      {filterOpen && active && !editor && <CategoryFilters query={query} onApply={draft => { setQuery(current => ({ ...current, ...draft, page: 1 })); closeFilters(); }} onClear={() => { setQuery(current => ({ ...current, status: 'all', level: 'all', page: 1 })); closeFilters(); }} />}
    </FilterDrawer>
    <div ref={content}>{list}</div>
    <RetainedViews activeKey={editor?.key || 'list'}>{editor ? <CategoryEditor category={records.get(editor.key)} onClose={() => navigation.back({ kind: 'list' })} onSaved={(saved, stillVisible, creating) => {
      setRecords(current => new Map(current).set(editor.key, creating ? null : saved)); setMessage('Category saved.');
      setResult(current => current.data ? { ...current, data: { ...current.data, items: current.data.items.map(item => item.id === saved.id ? { ...item, ...saved } : item) } } : current);
      setRevision(n => n + 1); if (stillVisible) navigation.back({ kind: 'list' });
    }} /> : null}</RetainedViews>
    {deleteTarget && active && !editor && <OfficeModal title="Delete marketplace category" description={`Delete “${deleteTarget.name_en}”? This cannot be undone.`} onClose={closeDelete} busy={busy} footer={<><button onClick={closeDelete} disabled={busy}>Cancel</button><button className="danger-button" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete category'}</button></>}>
      <p>Only categories without children or linked products can be deleted.</p>{deleteError && <p className="feedback error" role="alert">{deleteError}</p>}
    </OfficeModal>}
  </>;
}
