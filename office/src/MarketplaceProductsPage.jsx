import { officeDateTime } from './dateTime';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Link2, Unlink, Save, Package, TriangleAlert } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoading, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import { OfficeModal } from './OfficeModal';
import { FilterDrawer } from './FilterDrawer';
import { RowActions } from './RowActions';
import { RetainedViews } from './RetainedViews';
import { usePageNavigation } from './usePageNavigation';
import { useRetainedActivity } from './retainedActivity';
import './marketplace-products.css';

const endpoint = '/office/marketplace-products';
const labels = { all: 'All products', unlinked: 'Unlinked', linked: 'Linked', needs_review: 'Needs review' };
const summaryStyles = { all: [Package, 'blue', 'Within current filters'], unlinked: [Unlink, 'amber', 'Awaiting a category'], linked: [Link2, 'green', 'Active category tree'], needs_review: [TriangleAlert, 'red', 'Inactive category tree'] };

function SearchOptions({ endpoint: path, label, value, selectedLabel, onChange, activeOnly = false, emptyLabel = 'All', disabled = false, placeholder }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [chosen, setChosen] = useState({ id: value, path: selectedLabel });
  const [result, setResult] = useState({ items: [], key: '', error: '' });
  const key = `${path}:${query}`, requestKey = `${key}:${page}:${revision}`;
  useEffect(() => {
    if (search.trim() === query) return;
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    let current = true;
    api(`${path}?${new URLSearchParams({ q: query, page })}`).then(data => {
      if (current) setResult(previous => ({ ...data, key: requestKey, queryKey: key, error: '',
        items: [...new Map([...(page > 1 && previous.queryKey === key ? previous.items : []), ...data.items].map(item => [item.id, item])).values()] }));
    }).catch(error => { if (current) setResult(previous => ({ ...previous, key: requestKey, error: error.message })); });
    return () => { current = false; };
  }, [path, key, requestKey, page, query]);
  const items = result.queryKey === key ? result.items : [];
  const loading = result.key !== requestKey;
  return <div className="marketplace-product-picker">
    <label>Find {label.toLowerCase()}<input disabled={disabled} value={search} maxLength={200} placeholder={`Search ${label.toLowerCase()}`} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></label>
    <label htmlFor={id}>{label}</label><select id={id} value={value || ''} disabled={disabled} onChange={event => {
      const item = items.find(item => String(item.id) === event.target.value);
      setChosen(item || { id: '', path: emptyLabel }); onChange(event.target.value, item?.path || '');
    }}>
      {placeholder && <option value="choose" disabled>{placeholder}</option>}
      <option value="">{emptyLabel}</option>
      {value && value !== 'choose' && !items.some(item => String(item.id) === String(value)) && <option value={value}>{String(chosen.id) === String(value) ? chosen.path || selectedLabel : selectedLabel || `Category #${value}`}</option>}
      {items.map(item => <option key={item.id} value={item.id} disabled={activeOnly && !item.effective_active}>{item.path}{item.effective_active === false ? ' (inactive)' : ''}</option>)}
    </select>
    {loading && <small role="status">Loading {label.toLowerCase()} options…</small>}
    {result.error && <p role="alert">{result.error} <button type="button" disabled={disabled} onClick={() => setRevision(n => n + 1)}>Retry {label.toLowerCase()} options</button></p>}
    {result.has_more && !result.error && <button type="button" disabled={disabled || loading} onClick={() => setPage(n => n + 1)}>Load more {label.toLowerCase()} options</button>}
  </div>;
}

function LinkHistory({ product }) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let current = true;
    api(`${endpoint}/${product.id}`).then(data => { if (current) setResult({ history: data.history || [] }); })
      .catch(error => { if (current) setResult({ error: error.message }); });
    return () => { current = false; };
  }, [product.id, product.link_version, revision]);
  return <details className="marketplace-product-history"><summary>Recent link history (latest 20)</summary>
    {!result && <p role="status">Loading link history…</p>}
    {result?.error && <p role="alert">{result.error} <button type="button" onClick={() => setRevision(n => n + 1)}>Retry link history</button></p>}
    {result?.history && (result.history.length ? <ol>{result.history.map(item => <li key={item.id}><strong>{item.before?.path || 'Unlinked'} → {item.after?.path || 'Unlinked'}</strong><small>{item.user_name ? `Shop user: ${item.user_name}` : item.admin_name || 'Office staff'} · {officeDateTime(item.created_at)}</small></li>)}</ol> : <p>No category changes recorded.</p>)}
  </details>;
}

function LinkEditor({ products: initialProducts, remove = false, onClose, onSaved }) {
  const [products, setProducts] = useState(initialProducts);
  const single = products.length === 1 ? products[0] : null;
  const [categoryId, setCategoryId] = useState(remove ? '' : single ? single.marketplace_category?.id || '' : 'choose');
  const [categoryLabel, setCategoryLabel] = useState(remove ? '' : single?.marketplace_category?.path || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false), formId = useId();
  const active = useRetainedActivity(), visible = useRef(active);
  useEffect(() => { visible.current = active; }, [active]);
  const close = () => { if (!saving.current) onClose(); };
  async function submit(event) {
    event.preventDefault(); if (saving.current || categoryId === 'choose') return;
    saving.current = true; setBusy(true); setError('');
    try {
      const saved = await api(`${endpoint}/link`, { method: 'POST', body: JSON.stringify({ category_id: categoryId ? Number(categoryId) : null,
        products: products.map(product => ({ id: product.id, version: product.link_version })) }) });
      setProducts(saved.items); onSaved(saved, visible.current);
    } catch (err) { setError(err.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={single ? 'Manage product category' : `Link ${products.length} products`} className="marketplace-product-modal" closeLabel="Close product category form" onClose={close} busy={busy}
    footer={<><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" form={formId} className="office-button-primary" disabled={busy || categoryId === 'choose'}><Save size={16} />{busy ? 'Saving…' : 'Save links'}</button></>}>
    {single ? <div className="marketplace-product-context"><h3>{single.name}</h3><p>{single.shop_name} · Product #{single.id}</p><dl><dt>Business category</dt><dd>{single.business_category || 'Uncategorized'}</dd><dt>Current marketplace category</dt><dd>{single.marketplace_category?.path || 'Unlinked'}</dd><dt>SKU / barcode</dt><dd>{single.sku || '—'} / {single.barcode || '—'}</dd><dt>POS base price</dt><dd>{Number(single.price).toLocaleString()} {single.currency}</dd></dl></div>
      : <div className="marketplace-product-context"><p>The selected products will share one marketplace category. Existing links will be replaced when you save.</p><ul>{products.map(product => <li key={product.id}>{product.name} <small>· {product.shop_name} · {product.business_category || 'Uncategorized'}</small></li>)}</ul></div>}
    <form id={formId} onSubmit={submit}>
      <fieldset disabled={busy} className="marketplace-product-fields">
        <SearchOptions endpoint="/office/marketplace-categories/options" label="Marketplace category" value={categoryId} selectedLabel={categoryLabel} emptyLabel="No marketplace category (unlink)" placeholder={!single ? 'Choose a category or unlink' : undefined} activeOnly disabled={busy} onChange={(id, label) => { setCategoryId(id); setCategoryLabel(label); }} />
        <p className="marketplace-product-preview"><strong>After saving:</strong> {categoryId === 'choose' ? 'Choose a category above.' : categoryId ? categoryLabel : 'Unlinked'}<small>Business categories, product details, prices and stock are managed by the shop.</small></p>
      </fieldset>
      {error && <p className="feedback error" role="alert">{error}</p>}
    </form>
    {single && <LinkHistory product={single} />}
  </OfficeModal>;
}

function ProductFilters({ query, onApply, onClear }) {
  const [draft, setDraft] = useState(query);
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}><div className="office-drawer-filter-fields">
    <SearchOptions endpoint={`${endpoint}/shops`} label="Shop" value={draft.business_id} selectedLabel={draft.shop_label} onChange={(id, label) => setDraft(current => ({ ...current, business_id: id, shop_label: label }))} emptyLabel="All shops" />
    <label>Business category<input maxLength={255} value={draft.business_category} placeholder="Exact business category name" onChange={event => change('business_category', event.target.value)} /></label>
    <SearchOptions endpoint="/office/marketplace-categories/options" label="Marketplace category" value={draft.category_id} selectedLabel={draft.category_label} onChange={(id, label) => setDraft(current => ({ ...current, category_id: id, category_label: label }))} emptyLabel="All marketplace categories" />
    <small>Marketplace category filters include subcategories.</small>
    <label>Link status<select value={draft.link_status} onChange={event => change('link_status', event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Publication<select value={draft.publication} onChange={event => change('publication', event.target.value)}><option value="all">All publication states</option><option value="published">Published by shop</option><option value="unpublished">Unpublished</option></select></label>
    <label>Product status<select value={draft.status} onChange={event => change('status', event.target.value)}><option value="all">All products</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
  </div><div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button className="office-button-primary">Apply filters</button></div></form>;
}

const initialQuery = { q: '', business_id: '', shop_label: '', business_category: '', category_id: '', category_label: '', link_status: 'unlinked', publication: 'published', status: 'all', page: 1, per_page: 25 };

export function MarketplaceProductsPage({ scope = 'office', refreshToken = 0, filterOpen: controlledFilterOpen, onFilterOpen, onFilterClose }) {
  const active = useRetainedActivity();
  const [localFilterOpen, setLocalFilterOpen] = useState(false);
  const filterOpen = controlledFilterOpen ?? localFilterOpen, closeFilters = onFilterClose || (() => setLocalFilterOpen(false));
  const [query, setQuery] = useState(initialQuery), [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0), [result, setResult] = useState({}), [message, setMessage] = useState('');
  const [selection, setSelection] = useState({ key: '', products: [] });
  const [editors, setEditors] = useState(() => new Map());
  const navigation = usePageNavigation(`office-marketplace-products:${scope}`, { kind: 'list' }, () => location.href, { resumeHistory: false });
  const editor = navigation.view.kind === 'editor' ? navigation.view : null;
  const queryKey = new URLSearchParams(Object.entries(query).filter(([key, value]) => !key.endsWith('_label') && value !== '')).toString();
  const requestKey = `${queryKey}&revision=${revision}&refresh=${refreshToken}`;
  const data = result.queryKey === queryKey ? result.data : null;
  const selected = selection.key === queryKey ? selection.products : [];
  useEffect(() => {
    let current = true;
    api(`${endpoint}?${requestKey}`).then(data => { if (current) setResult({ key: requestKey, queryKey, data }); })
      .catch(error => { if (current) setResult(previous => ({ key: requestKey, queryKey, data: previous.queryKey === queryKey ? previous.data : null, error: error.message })); });
    return () => { current = false; };
  }, [queryKey, requestKey]);
  function openEditor(products, remove = false) {
    if (!products.length) return;
    const key = crypto.randomUUID(); setEditors(current => new Map(current).set(key, { products, remove })); navigation.go({ kind: 'editor', key });
  }
  function save(saved, visible) {
    const updates = new Map(saved.items.map(product => [product.id, product]));
    setResult(current => current.data ? { ...current, data: { ...current.data, items: current.data.items.map(product => updates.get(product.id) || product) } } : current);
    setSelection({ key: '', products: [] }); setMessage(`${saved.changed} product link${saved.changed === 1 ? '' : 's'} updated.`); setRevision(n => n + 1);
    if (visible) navigation.back({ kind: 'list' });
  }
  const allSelected = data?.items.length > 0 && data.items.every(product => selected.some(item => item.id === product.id));
  return <>
    <OfficePageToolbar searchLabel="Search marketplace products" placeholder="Product, SKU, barcode, business category or shop" search={search} onSearchChange={setSearch}
      onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }}
      actionLabel={`Link selected (${selected.length})`} actionIcon={Link2} actionDisabled={!selected.length} onCreate={() => openEditor(selected)} busy={Boolean(editor)}
      filterOpen={filterOpen} onFilterOpen={onFilterOpen || (() => setLocalFilterOpen(true))} filterCount={['business_id', 'business_category', 'category_id', 'link_status', 'publication', 'status'].filter(key => query[key] !== initialQuery[key]).length} />
    <FilterDrawer open={filterOpen && active && !editor} title="Marketplace product filters" onClose={closeFilters}>
      {filterOpen && active && !editor && <ProductFilters query={query} onApply={draft => { setQuery({ ...draft, page: 1 }); closeFilters(); }} onClear={() => { setQuery(current => ({ ...initialQuery, q: current.q, per_page: current.per_page })); closeFilters(); }} />}
    </FilterDrawer>
    <div className="office-page-stack marketplace-product-manager">
      {data?.summary && <section className="office-stat-grid marketplace-product-summary" aria-label="Marketplace product summary">{Object.entries(labels).map(([status, label]) => {
        const [Icon, tone, hint] = summaryStyles[status];
        const count = data.summary[status === 'all' ? 'total' : status];
        return <button type="button" className="office-stat-card" key={status} aria-label={`${label}: ${count}`} aria-pressed={query.link_status === status} onClick={() => setQuery(current => ({ ...current, link_status: status, page: 1 }))}>
          <span className={`office-stat-icon office-tone-${tone}`}><Icon size={18} /></span><div><span>{label}</span><strong>{count}</strong><small>{hint}</small></div>
        </button>;
      })}</section>}
      {message && <p className="feedback" role="status">{message}</p>}
      {result.error && <p className="feedback error" role="alert">{result.error} <button onClick={() => setRevision(n => n + 1)}>Retry products</button></p>}
      <section className="office-panel office-table-panel">
        <div className="office-panel-header"><div><h2>Product directory</h2><p>Select products to link to a marketplace category. Each shop manages its own business categories.</p></div>
          {data && <div className="marketplace-product-selection"><span>{selected.length} selected on this page</span>{selected.length > 0 && <button type="button" onClick={() => setSelection({ key: '', products: [] })}>Clear selection</button>}</div>}
        </div>
      {!data && result.key !== requestKey && <OfficeTableLoading columns={["", "Product", "Shop", "Business category", "Marketplace category", "Link status"]} label="Loading marketplace products..."/>}
      {data && <>
        {data.items.length ? <div className="office-table-scroll"><table className="office-data-table marketplace-product-table"><thead><tr>
          <th><input type="checkbox" aria-label="Select all products on this page" checked={allSelected} onChange={event => setSelection({ key: queryKey, products: event.target.checked ? data.items : [] })} /></th>
          <th>Product</th><th>Shop</th><th>Business category</th><th>Marketplace category</th><th>Link status</th><OfficeActionHeader />
        </tr></thead><tbody>{data.items.map(product => <tr key={product.id}>
          <td><input type="checkbox" aria-label={`Select ${product.name} (#${product.id})`} checked={selected.some(item => item.id === product.id)} onChange={event => setSelection({ key: queryKey, products: event.target.checked ? [...selected, product] : selected.filter(item => item.id !== product.id) })} /></td>
          <td><div className="office-cell-stack"><strong>{product.name}</strong><small>#{product.id} · {product.sku || 'No SKU'}{product.barcode && ` · ${product.barcode}`}</small><small>{product.is_active ? 'Active' : 'Inactive'} · {product.published ? 'Published by shop' : 'Unpublished'}</small></div></td>
          <td><div className="office-cell-stack"><strong>{product.shop_name}</strong><small>Business #{product.business_id}{product.shop_slug && ` · ${product.shop_slug}`}</small></div></td>
          <td>{product.business_category || <span className="marketplace-product-muted">Uncategorized</span>}</td>
          <td>{product.marketplace_category ? <div className="office-cell-stack"><strong>{product.marketplace_category.path}</strong>{product.marketplace_category.name_my && <small>{product.marketplace_category.name_my}</small>}</div> : <span className="marketplace-product-muted">Not linked</span>}</td>
          <td><span className={`office-status office-status-${product.link_status === 'linked' ? 'active' : 'hidden'}`}>{labels[product.link_status]}</span>{product.link_status === 'needs_review' && <small className="office-business-meta">Category or parent inactive</small>}</td>
          <OfficeActionCell><RowActions label={`${product.name} (#${product.id})`}><button onClick={() => openEditor([product])}><Link2 size={16} /> Manage category</button>{product.marketplace_category && <button className="danger-button" onClick={() => openEditor([product], true)}><Unlink size={16} /> Remove link</button>}</RowActions></OfficeActionCell>
        </tr>)}</tbody></table></div> : <p className="marketplace-product-message">No products match these filters.</p>}
        <OfficeTablePagination label="Products" total={data.total} page={data.page} perPage={query.per_page} lastPage={data.last_page} onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, per_page, page: 1 }))} />
      </>}
      </section>
    </div>
    <RetainedViews activeKey={editor?.key || 'list'}>{editor && editors.has(editor.key) ? <LinkEditor {...editors.get(editor.key)} onClose={() => navigation.back({ kind: 'list' })} onSaved={save} /> : null}</RetainedViews>
  </>;
}
