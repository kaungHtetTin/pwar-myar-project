import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, Checkbox, IconButton, Input, SearchInput, Select, Textarea } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, CloudUpload, Eye, Package, Pencil, Search, ShieldAlert, Store } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileSheet, MobileFilterToggle, MobileFilterPanel, MobileFilterActions } from '../components/MobilePrimitives';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { fieldErrors, shopMoney } from './shopUtils';

const FILTERS = { category: '', stock_status: 'all', publication_status: 'all', price_status: 'all', sort: 'name_asc' };
export function ShopCatalog({ onNavigate }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [filters, setFilters] = useState(FILTERS), [draft, setDraft] = useState(FILTERS), [open, setOpen] = useState(false);
  const [publicationMeta, setPublicationMeta] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false), meta = useShopResource('/shop-admin/publications/filters');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const activeCount = Object.keys(FILTERS).filter(key => filters[key] !== FILTERS[key]).length;
  const openFilters = () => { setDraft({ ...filters }); setOpen(true); };
  const queryKey = new URLSearchParams({ q: query, ...filters }).toString();
  const list = useEndlessList({ queryKey, loadPage: async ({ limit, offset, signal }) => { const result = await apiRequest(`/shop-admin/publications?${queryKey}&limit=${limit}&offset=${offset}`, { signal }); if (!signal.aborted) setPublicationMeta({ queryKey, published: result.published_count }); return result; } });
  usePageRefresh(list.reload);
  async function publishBulk() {
    if (working.current || !bulk) return;
    working.current = true; setBusy(true); setError('');
    try { await apiRequest(`/shop-admin/publications/bulk${bulk.ids ? '' : `?${bulk.query}`}`, { method: 'PUT', body: JSON.stringify({ published: bulk.published, ...(bulk.ids ? { product_ids: bulk.ids } : {}) }) }); if (bulk.ids) setSelected(current => current.filter(id => !bulk.ids.includes(id))); setBulk(null); await list.reload(); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); }
  }
  const options = {
    stock_status: [['all', 'All stock levels'], ['in_stock', 'Healthy stock'], ['low_stock', 'Low stock'], ['out_of_stock', 'Out of stock']],
    publication_status: [['all', 'All publications'], ['published', 'Published'], ['unpublished', 'Unpublished']],
    price_status: [['all', 'All prices'], ['priced', 'Price set'], ['missing', 'Missing or zero price']],
    sort: [['name_asc', 'Name: A to Z'], ['name_desc', 'Name: Z to A'], ['low_stock_first', 'Low stock first'], ['stock_asc', 'Stock: lowest first'], ['stock_desc', 'Stock: highest first'], ['price_asc', 'Price: lowest first'], ['price_desc', 'Price: highest first'], ['newest', 'Newest first'], ['oldest', 'Oldest first']],
  };
  return <><CatalogHeader title="Catalog" onBack={() => onNavigate('/shop')} />
    <div className="publication-toolbar"><SearchInput className="shop-mobile-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search publication</span><Input type="search" aria-label="Search publication" placeholder="Search products" value={search} onChange={event => setSearch(event.target.value)} /></SearchInput><MobileFilterToggle open={open} count={activeCount} onToggle={openFilters} controls="shop-publication-filters" /></div>
    <p className="publication-count">{list.total == null ? 'Products' : `${list.total} products`}<span>{publicationMeta?.queryKey === queryKey && publicationMeta.published != null ? `${publicationMeta.published} published` : 'Online publication'}</span></p>
    <MobileFilterPanel onClose={() => setOpen(false)} open={open} id="shop-publication-filters" className="publication-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft }); setOpen(false); }}>
      <ShopField name="category" label="Category"><Select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option value="">All categories</option>{meta.data?.categories?.map(category => <option key={category}>{category}</option>)}</Select></ShopField>
      {meta.error && <div role="alert"><p>{meta.error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => meta.reload()}>Retry categories</Button></div>}
      {Object.entries(options).map(([name, values]) => <ShopField key={name} name={name} label={{ stock_status: 'Stock status', publication_status: 'Publication status', price_status: 'Online price', sort: 'Sort products' }[name]}><Select value={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.value })}>{values.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></ShopField>)}
      <p className="publication-info">Bulk actions apply to every matching product, including products below the loaded list.</p><MobileFilterActions onClear={() => { setDraft({ ...FILTERS }); setFilters({ ...FILTERS }); }} />
    </MobileFilterPanel>
    <div className="publication-selection-controls"><label><Checkbox aria-label="Select loaded products" checked={list.items.length>0&&list.items.every(product=>selected.includes(product.id))} ref={node=>{if(node)node.indeterminate=list.items.some(product=>selected.includes(product.id))&&!list.items.every(product=>selected.includes(product.id));}} disabled={busy||!list.items.length} onChange={event=>setSelected(current=>event.target.checked?[...new Set([...current,...list.items.map(product=>product.id)])].slice(0,1000):current.filter(id=>!list.items.some(product=>product.id===id)))}/><span>Select loaded products</span></label>{selected.length>0&&<Button variant="plain" type="button" disabled={busy} onClick={()=>setSelected([])}>Clear selection</Button>}</div>
    <div className="publication-list">{list.initialLoading && <ShopLoading label="Loading products..." variant="list" />}{!list.initialLoading && !list.error && !list.items.length && <div className="publication-empty"><Package size={32} aria-hidden="true" /><h2>No matching products.</h2><p>Try another search or adjust your filters.</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => { setSearch(''); setQuery(''); setFilters({ ...FILTERS }); }}>Clear search and filters</Button></div>}{list.error && !list.items.length && <div className="shop-mobile-card" role="alert"><p>{list.error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={list.retry}>Retry products</Button></div>}{list.items.map(product => <article className={`publication-selectable-row${selected.includes(product.id)?' is-selected':''}`} key={product.id}><label className="publication-row-select"><Checkbox aria-label={`Select ${product.name}`} checked={selected.includes(product.id)} disabled={busy||(!selected.includes(product.id)&&selected.length>=1000)} onChange={event=>setSelected(current=>event.target.checked?[...current,product.id]:current.filter(id=>id!==product.id))}/></label><Button variant="plain" type="button" className="publication-row" key={product.id} aria-label={`Edit publication for ${product.name}`} onClick={() => onNavigate(`/shop/catalog/${product.id}/edit`)}><PublicationPhoto product={product} /><span className="publication-product"><strong>{product.name}</strong><small>{product.category || product.base_unit}</small><span className={`publication-stock${Number(product.stock) <= 0 ? ' is-empty' : ''}`}><Package size={12} aria-hidden="true" />{product.stock} {product.base_unit} {Number(product.stock) <= 0 ? 'Out of stock' : 'in stock'}</span></span><span className="publication-pricing"><b>{publicationPrice(product)}</b><small><span>Online price</span> ({product.price_type || 'Retail'})</small><span className={`publication-badge${product.published ? ' is-published' : ''}`}>{product.published ? 'Published' : 'Unpublished'}</span></span><Pencil size={15} aria-hidden="true" /></Button></article>)}<EndlessListFooter list={list} count={list.items.length} noun="products" /></div>
    <div className="publication-bulk-bar"><div><strong>{selected.length>0?`${selected.length} selected products`:`${list.total ?? 0} matching products`}</strong><small>{selected.length>0?'Only selected products, including selections in other filters':'All filtered results, including unloaded products'}</small></div><div>{[false, true].map(published => <Button variant={published ? 'primary' : 'secondary'} key={String(published)} type="button" className={published ? 'mobile-primary' : 'mobile-secondary'} disabled={busy || (!selected.length && (list.initialLoading || !list.items.length || search.trim() !== query))} onClick={() => { setError(''); setBulk({ published, ...(selected.length?{ids:[...selected]}:{}), query: queryKey, count: selected.length || list.total, filters: { ...filters }, search: query }); }}>{published && <CloudUpload size={15} aria-hidden="true" />}{selected.length?(published?'Publish selected':'Unpublish selected'):(published ? 'Publish all filtered' : 'Unpublish all filtered')}</Button>)}</div></div>
    <MobileSheet open={!!bulk} title={bulk?.ids?(bulk.published?'Publish selected products':'Unpublish selected products'):(bulk?.published ? 'Publish all filtered products' : 'Unpublish all filtered products')} description={bulk?.ids?'Only the selected products will change. Existing orders keep their product snapshots.':'This affects all matching products. Existing orders keep their product snapshots.'} onClose={() => { if (!busy) setBulk(null); }} className="publication-confirmation"><div className="publication-scope"><h3>{bulk?.count ?? 0} {bulk?.ids?'selected products':'matching products'}</h3>{bulk?.ids?<p>Selection is retained across searches and filters.</p>:<dl><div><dt>Search</dt><dd>{bulk?.search || 'All products'}</dd></div><div><dt>Category</dt><dd>{bulk?.filters.category || 'All categories'}</dd></div>{Object.keys(options).map(key => <div key={key}><dt>{{ stock_status:'Stock status', publication_status:'Publication status', price_status:'Online price', sort:'Sort products' }[key]}</dt><dd>{options[key].find(([value]) => value === bulk?.filters[key])?.[1]}</dd></div>)}</dl>}</div>{error && <p role="alert">{error}</p>}<div className="publication-confirm-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={() => setBulk(null)}>Cancel</Button><Button variant="primary" type="button" className="mobile-primary" disabled={busy} onClick={publishBulk}>{busy ? 'Saving...' : bulk?.ids?(bulk.published?'Publish selected':'Unpublish selected'):(bulk?.published ? 'Publish all' : 'Unpublish all')}</Button></div></MobileSheet>
  </>;

}

export function ShopPublicationForm({ id, onNavigate }) {
  const resource = useShopResource(`/shop-admin/publications/${id}`);
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const initialized = useRef(false), working = useRef(false), errorRef = useRef(null);
  useEffect(() => { if (error && errorRef.current?.getClientRects().length) errorRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [error]);
  useEffect(() => { if (resource.data && !initialized.current) { setForm({ published: !!resource.data.published, unit: resource.data.unit || 'base', description: resource.data.description || '' }); initialized.current = true; } }, [resource.data]);
  async function submit(event) {
    event.preventDefault(); if (working.current || !form) return;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try { await apiRequest(`/shop-admin/publications/${id}`, { method: 'PUT', body: JSON.stringify(form) }); onNavigate('/shop/catalog', { replace: true }); }
    catch (e) { const fields = fieldErrors(e); setError(Object.keys(fields).length ? 'Please correct the highlighted fields.' : e.message); setErrors(fields); } finally { working.current = false; setBusy(false); }
  }
  const product = resource.data, price = form?.unit === 'purchase' ? product?.purchase_price : product?.base_price;
  return <><CatalogHeader title="Edit publication" onBack={() => onNavigate('/shop/catalog')} /><ShopLoadState resource={resource}>{product && form && <form className="shop-mobile-form publication-editor" onSubmit={submit}>
    <section className="publication-product-card"><PublicationPhoto product={product} /><div><h1>{product.name}</h1><p>{product.category || product.base_unit}</p><span className="publication-stock"><Package size={14} aria-hidden="true" />Stock: {product.stock} {product.base_unit}</span></div></section>
    <p className="publication-info">Inventory and prices are managed in Products. Online prices follow the shop price type.</p>
    {error && <p ref={errorRef} role="alert" className="publication-error">{error}</p>}
    <fieldset disabled={busy}><section className="publication-panel"><h2>Public product information</h2><p>This information will be shown to online customers.</p><ShopField name="unit" label="Online selling unit" errors={errors}><Select value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })}><option value="base">{product.base_unit}</option>{product.purchase_unit && product.purchase_conversion_factor > 0 && <option value="purchase">{product.purchase_unit}</option>}</Select></ShopField><ShopField name="description" label="Online description" errors={errors}><Textarea maxLength={4000} rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></ShopField><small className="publication-character-count">{form.description.length} / 4000</small><div className="publication-price-note"><p>{product.price_type} price: {price == null ? 'Not set' : shopMoney(price, product.currency)}</p><small>{form.unit === 'purchase' ? product.purchase_unit : product.base_unit}</small></div><p>Prices follow the shop price type. Set a valid product price before publishing.</p><label className="shop-mobile-check"><Checkbox type="checkbox" aria-label="Publish online" checked={form.published} onChange={event => setForm({ ...form, published: event.target.checked })} /><span>Publish online<small>Visible to online customers when published.</small></span></label>{errors.published && <p role="alert">{errors.published}</p>}</section>
    <section className="publication-panel publication-preview"><h2><Eye size={17} aria-hidden="true" />Online preview</h2><p>This is how your product appears to customers.</p><div className="publication-product-card"><PublicationPhoto product={product} /><div><strong>{product.name}</strong><p>{form.unit === 'purchase' ? product.purchase_unit : product.base_unit}</p><b>{price == null ? 'Not set' : shopMoney(price, product.currency)}</b><span className={`publication-badge${form.published ? ' is-published' : ''}`}>{form.published ? 'Published' : 'Unpublished'}</span></div></div>{form.description && <p className="publication-description">{form.description}</p>}</section>
    <div className="publication-form-actions"><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => onNavigate('/shop/catalog')}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary" disabled={busy}>{busy ? <ShopBusy label="Saving..." /> : 'Save publication'}</Button></div></fieldset></form>}</ShopLoadState></>;
}

export function CatalogHeader({ title, onBack }) {
  return <PageAppBar className="publication-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1><AppBarMenu /></PageAppBar>;
}
function publicationPrice(product) {
  const price = product.unit === 'purchase' ? product.purchase_price : product.base_price;
  const unit = product.unit === 'purchase' ? product.purchase_unit : product.base_unit;
  return price == null ? 'Not set' : `${shopMoney(price, product.currency)} / ${unit || ''}`;
}
function PublicationPhoto({ product }) {
  return <span className="publication-photo"><Package size={25} aria-hidden="true" />{product.photo_url && <ProductPhoto path={product.photo_url} alt={product.name} />}</span>;
}
export function CatalogSubscriptionGate({ onNavigate }) {
  return <><CatalogHeader title="Catalog" onBack={() => onNavigate('/shop')} /><section className="publication-subscription"><span className="publication-subscription-icon"><Store size={48} aria-hidden="true" /><ShieldAlert size={24} aria-hidden="true" /></span><h2>Subscription expired</h2><p>Renew to manage your catalog and promotions.</p><Button variant="primary" type="button" className="mobile-primary" onClick={() => onNavigate('/billing')}>View subscription<ChevronRight size={17} aria-hidden="true" /></Button><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => onNavigate('/shop')}>Back to My Shop</Button><p className="publication-info">You can still process orders from your current sales channels.</p></section></>;
}
