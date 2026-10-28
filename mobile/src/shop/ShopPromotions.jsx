import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { FloatingActionButton, Switch, ChoiceGroup, Button, Checkbox, IconButton, Input, Radio, SearchInput, Select } from '../components/Controls';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Coins, MoreHorizontal, Package, Percent, Plus, SlidersHorizontal, Ticket, Trash2, Zap } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EndlessListFooter, MobileFilterActions, MobileFilterPanel, MobileFilterToggle, MobileDeleteSheet, MobileSheet } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ShopBusy, ShopField, ShopLoadState, ShopLoading } from './ShopPrimitives';
import { ProductPhoto } from '../products/ProductPhoto.jsx';
import { useShopResource } from './useShopResource';
import { fieldErrors, shopMoney, shopLabel } from './shopUtils';

const BLANK = { type: 'coupon', name: '', code: '', discount_type: 'percentage', discount_value: 10, minimum_subtotal: 0, usage_limit: '', quantity_limit: '', starts_at: '', ends_at: '', enabled: true };
const FILTERS = { type: '', status: 'all', date_from: '', date_to: '', sort: 'newest' };
function localTime(value, timezone) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function scheduleTimestamp(value) {
  if (!value) return null;
  // The API accepts minute precision and supplies zero seconds itself.
  // Also normalize drafts created before the date-only format correction.
  return value.length === 10 ? `${value}T00:00` : value.slice(0, 16);
}
function promotionPayload(form, products = []) {
  const payload = { type: form.type, name: form.name.trim(), code: form.type === 'coupon' ? form.code.trim().toUpperCase() : null, product_id: form.type === 'flash_sale' ? form.product_id || null : null, discount_type: form.discount_type, discount_value: Number(form.discount_value), minimum_subtotal: Number(form.minimum_subtotal || 0), usage_limit: form.usage_limit === '' || form.usage_limit == null ? null : Number(form.usage_limit), quantity_limit: form.quantity_limit === '' || form.quantity_limit == null ? null : Number(form.quantity_limit), starts_at: scheduleTimestamp(form.starts_at), ends_at: scheduleTimestamp(form.ends_at), enabled: !!form.enabled };
  if (products.length) payload.items = products.map(p => ({ product_id: p.product_id, discount_type: p.discount_type, discount_value: Number(p.discount_value), quantity_limit: p.quantity_limit === '' ? null : Number(p.quantity_limit) }));
  return payload;
}
export function PromotionHeader({ title, onBack, children }) {
  return <PageAppBar className="shop-promotions-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>{title}</h1>{children}<AppBarMenu /></PageAppBar>;
}
function PromotionBadge({ value }) { return <span className={`promotion-badge is-${value}`}>{shopLabel(value)}</span>; }
function PromotionPhoto({ product }) {
  return <span className="promotion-product-photo"><Package size={23} aria-hidden="true" /><ProductPhoto path={product.photo_url} alt={product.name || product.product_name || ''} /></span>;
}
function promotionSchedule(row, timezone) {
  const date = value => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:timezone || 'Asia/Rangoon' }).format(new Date(value));
  return row.starts_at && row.ends_at ? `${date(row.starts_at)} - ${date(row.ends_at)}` : row.starts_at ? `From ${date(row.starts_at)}` : row.ends_at ? `Until ${date(row.ends_at)}` : 'No time restriction';
}
function PromotionRow({ promotion: p, selected, disabled, onSelect, onMenu, timezone, currency }) {
  const Icon = p.type === 'coupon' ? Ticket : Zap;
  return <article className="promotion-reference-card"><div className="promotion-card-top"><Checkbox type="checkbox" aria-label={`Select ${p.name}`} checked={selected} disabled={disabled} onChange={onSelect} /><span className={`promotion-type-icon is-${p.type}`}><Icon size={24} aria-hidden="true" /></span><div><strong>{p.type === 'coupon' ? p.code : p.name}</strong>{p.type === 'coupon' && p.name !== p.code && <small>{p.name}</small>}<span className="promotion-card-badges"><PromotionBadge value={p.type} /><PromotionBadge value={p.status || (p.enabled ? 'active' : 'paused')} /></span></div><IconButton variant="ghost" className="icon-button" type="button" aria-label={`Actions for ${p.name}`} onClick={onMenu}><MoreHorizontal size={22} aria-hidden="true" /></IconButton></div><dl className="promotion-card-stats"><div><dt>Discount</dt><dd>{p.discount_type === 'percentage' ? `${p.discount_value}%` : shopMoney(p.discount_value, p.currency || currency)}</dd></div><div><dt>Schedule</dt><dd>{promotionSchedule(p, timezone)}</dd></div><div><dt>Used</dt><dd>{p.type === 'coupon' ? `${p.used_count || 0}${p.usage_limit ? ` / ${p.usage_limit}` : ''}` : `${p.used_quantity || 0}${p.quantity_limit ? ` / ${p.quantity_limit}` : ''}${p.unit ? ` ${p.unit}` : ''}`}</dd></div></dl>{p.product_name && <p className="promotion-card-product">{p.product_name}</p>}</article>;
}
export function ShopPromotions({ onNavigate, session }) {
  const [filtersOpen, setFiltersOpen] = useState(false), [addOpen, setAddOpen] = useState(false), [menu, setMenu] = useState(null);
  const [q, setQ] = useState(''), [query, setQuery] = useState(''), [filters, setFilters] = useState(FILTERS), [draft, setDraft] = useState(FILTERS), [filterError, setFilterError] = useState('');
  const [selected, setSelected] = useState([]), [deleting, setDeleting] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false);
  const addTrigger = useRef(null);
  const selectionBar = useRef(null);
  const [selectionHeight, setSelectionHeight] = useState(0);
  const selectionActive = selected.length > 0;
  useLayoutEffect(() => {
    if (!selectionActive) { setSelectionHeight(0); return undefined; }
    const measure = () => setSelectionHeight(selectionBar.current?.getBoundingClientRect().height || 0);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (selectionBar.current) observer?.observe(selectionBar.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [selectionActive]);
  useEffect(() => {
    if (!addOpen) return undefined;
    const close = event => { if (event.key === 'Escape' || event.type === 'mkpos:hardware-back') { event.preventDefault(); setAddOpen(false); addTrigger.current?.focus(); } };
    window.addEventListener('keydown', close); window.addEventListener('mkpos:hardware-back', close);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('mkpos:hardware-back', close); };
  }, [addOpen]);
  const [timezone, setTimezone] = useState('Asia/Rangoon');
  useEffect(() => { const timer = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(timer); }, [q]);
  const key = new URLSearchParams({ q: query, ...filters }).toString();
  const list = useEndlessList({ queryKey: key, loadPage: async ({ limit, offset, signal }) => { const result = await apiRequest(`/shop-admin/promotions?${key}&limit=${limit}&offset=${offset}`, { signal }); if (!signal?.aborted && result.timezone) setTimezone(result.timezone); return result; } });
  usePageRefresh(list.reload, { reconcilePage: list.reconcile });
  async function remove() {
    if (working.current || !deleting) return;
    working.current = true; setBusy(true); setError('');
    try { await apiRequest('/shop-admin/promotions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: deleting }) }); setSelected(s => s.filter(id => !deleting.includes(id))); setDeleting(null); await list.reconcile(); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); }
  }
  function apply(event) {
    event.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) { setFilterError('End date must be on or after the start date.'); return; }
    setFilters({ ...draft }); setFiltersOpen(false); setFilterError('');
  }
  const count = Object.entries(filters).filter(([k,v]) => v && v !== FILTERS[k]).length;
  return <>
    <PromotionHeader title="Promotions" onBack={() => onNavigate('/shop', { back:true })} /><div className="promotion-add-menu promotion-fab-menu" style={{ '--promotion-selection-height': `${selectionHeight}px` }}><FloatingActionButton ref={addTrigger} label="Add promotion" aria-expanded={addOpen} aria-controls={addOpen ? "promotion-create-options" : undefined} onClick={() => setAddOpen(v=>!v)}><Plus size={24} aria-hidden="true" /></FloatingActionButton>{addOpen && <><button className="promotion-menu-dismiss" type="button" tabIndex={-1} aria-label="Close add promotion menu" onClick={()=>setAddOpen(false)} /><div id="promotion-create-options" className="promotion-add-options" role="group" aria-label="Choose promotion type"><Button variant="plain" type="button" onClick={()=>{setAddOpen(false);onNavigate('/shop/promotions/new/coupon');}}><Ticket size={19} aria-hidden="true" />New coupon</Button><Button variant="plain" type="button" onClick={()=>{setAddOpen(false);onNavigate('/shop/promotions/new/flash_sale');}}><Zap size={19} aria-hidden="true" />New flash sale</Button></div></>}</div>
    <div className="promotion-search-row"><SearchInput className="mobile-search" type="search" aria-label="Search promotions" placeholder="Search promotions" maxLength={120} value={q} onChange={e=>setQ(e.target.value)} onClear={()=>{setQ('');setQuery('');}} clearLabel="Clear promotion search" /><MobileFilterToggle open={filtersOpen} onToggle={()=>{setDraft({...filters});setFilterError('');setFiltersOpen(true);}} controls="shop-promotion-filters" count={count} /></div>
    <p className="promotion-result-count">{list.total === null ? 'Loading promotions...' : `${list.total} promotions`}</p>
    <MobileFilterPanel open={filtersOpen} onClose={()=>setFiltersOpen(false)} id="shop-promotion-filters" className="promotion-filter-drawer" onSubmit={apply}>
      <ChoiceGroup className="promotion-filter-radios"><legend>Type</legend>{[['','All types'],['coupon','Coupon'],['flash_sale','Flash sale']].map(([value,label])=><label key={value}><Radio type="radio" name="promotion-filter-type" checked={draft.type===value} onChange={()=>setDraft({...draft,type:value})} />{value && (value==='coupon'?<Ticket size={18} aria-hidden="true" />:<Zap size={18} aria-hidden="true" />)}<span>{label}</span></label>)}</ChoiceGroup>
      <ChoiceGroup className="promotion-filter-radios"><legend>Status</legend>{['all','active','scheduled','expired','paused','exhausted'].map(value=><label key={value}><Radio type="radio" name="promotion-filter-status" checked={draft.status===value} onChange={()=>setDraft({...draft,status:value})} /><PromotionBadge value={value} /></label>)}</ChoiceGroup>
      <fieldset className="promotion-filter-dates"><legend>Date range</legend><ShopField name="promotion-from" label="From date"><Input type="date" value={draft.date_from} onChange={e=>setDraft({...draft,date_from:e.target.value})} /></ShopField><ShopField name="promotion-to" label="To date"><Input type="date" value={draft.date_to} onChange={e=>setDraft({...draft,date_to:e.target.value})} /></ShopField><small>Promotions available during this date range.</small></fieldset>
      <ShopField name="promotion-sort" label="Sort by"><Select value={draft.sort} onChange={e=>setDraft({...draft,sort:e.target.value})}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option></Select></ShopField>{filterError && <p role="alert">{filterError}</p>}<MobileFilterActions onClear={()=>{setDraft({...FILTERS});setFilters({...FILTERS});setFilterError('');}} />
    </MobileFilterPanel>
    <div className="shop-mobile-list">{list.initialLoading && <ShopLoading label="Loading promotions..." variant="list" />}{list.error && !list.items.length && <p role="alert">{list.error} <Button variant="secondary" type="button" className="mobile-secondary" onClick={list.retry}>Retry promotions</Button></p>}{list.items.map(p=><PromotionRow key={p.id} promotion={p} timezone={timezone} currency={session?.business?.currency} selected={selected.includes(p.id)} disabled={!selected.includes(p.id)&&selected.length>=1000} onSelect={e=>setSelected(s=>e.target.checked?[...s,p.id]:s.filter(id=>id!==p.id))} onMenu={()=>setMenu(p)} />)}{!list.initialLoading && !list.error && !list.items.length && <p className="shop-mobile-card">No matching promotions.</p>}<EndlessListFooter list={list} count={list.items.length} noun="promotions" /></div>
    {selectionActive && <div aria-hidden="true" style={{ height: selectionHeight }} />}{selectionActive && <aside ref={selectionBar} className="promotion-selection-bar"><div><strong>{selected.length} selected</strong><div><Button variant="plain" type="button" onClick={()=>setSelected(s=>[...new Set([...s,...list.items.map(p=>p.id)])].slice(0,1000))} disabled={!list.items.length}>Select loaded promotions</Button><Button variant="plain" type="button" onClick={()=>setSelected([])}>Clear selection</Button></div><small>Selection is retained across filters. Select up to 1,000 promotions.</small></div><Button variant="danger-ghost" className="promotion-delete-selected" type="button" aria-label={`Delete selected (${selected.length})`} onClick={()=>{setError('');setDeleting([...selected]);}}><Trash2 size={18} aria-hidden="true" /><span>Delete</span></Button></aside>}
    <MobileSheet open={!!menu} title="Promotion actions" onClose={()=>setMenu(null)} className="promotion-action-menu"><p>{menu?.name}</p><Button variant="plain" type="button" onClick={()=>{const id=menu.id;setMenu(null);onNavigate(`/shop/promotions/${id}/edit`);}}>Edit {menu?.name}</Button><Button variant="danger-ghost" type="button" className="is-danger" onClick={()=>{setError('');setDeleting([menu.id]);setMenu(null);}}>Delete {menu?.name}</Button></MobileSheet>
    <MobileDeleteSheet open={!!deleting} title="Delete promotions" itemTitle={`${deleting?.length || 0} selected promotions`} description="Customers will no longer be able to use these promotions. Existing order discounts are preserved." busy={busy} onClose={()=>{if(!busy)setDeleting(null);}} onConfirm={remove}>{error && <p role="alert">{error}</p>}</MobileDeleteSheet>
  </>;
}

function PromotionProductPicker({ onClose, onPick, selectedRows, single = false, startsAt, endsAt, enabled = true, promotionId }) {
  const [q,setQ]=useState(''),[category,setCategory]=useState(''),[rows,setRows]=useState(selectedRows),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [unavailable,setUnavailable]=useState({});
  const categoryId=useId();
  const picking=useRef(false), meta=useShopResource('/shop-admin/publications/filters');
  const context=new URLSearchParams({flash_sale_picker:'1',flash_sale_enabled:enabled?'1':'0',...(startsAt?{flash_sale_starts_at:scheduleTimestamp(startsAt)}:{}),...(endsAt?{flash_sale_ends_at:scheduleTimestamp(endsAt)}:{}),...(promotionId?{flash_sale_exclude_id:promotionId}:{})}).toString();
  const key=new URLSearchParams({q,category,publication_status:'published'}).toString()+'&'+context;
  const list=useEndlessList({queryKey:key,loadPage:({offset,limit,signal})=>apiRequest(`/shop-admin/publications?${key}&offset=${offset}&limit=${limit}`,{signal})});
  useEffect(()=>{const blocked=new Set(list.items.filter(row=>row.flash_sale_conflict||unavailable[row.id]).map(row=>row.id));if(rows.some(row=>blocked.has(row.id))){setRows(rows.filter(row=>!blocked.has(row.id)));setError('Unavailable products were removed from this selection.');}},[list.items,rows,unavailable]);
  function toggle(p) { if(p.flash_sale_conflict||unavailable[p.id])return;setError('');setRows(old=>old.some(row=>row.id===p.id)?old.filter(row=>row.id!==p.id):single?[p]:old.length<100?[...old,p]:old); }
  async function pickAll() {
    if(picking.current)return;picking.current=true;setBusy(true);setError('');
    try{const result=await apiRequest(`/shop-admin/publications?${key}&offset=0&limit=100`);if(result.total>100)throw new Error('Narrow the filters to 100 products or fewer.');const blocked=new Set(result.items.filter(row=>row.flash_sale_conflict||unavailable[row.id]).map(row=>row.id));const merged=[...new Map([...rows.filter(row=>!blocked.has(row.id)),...result.items.filter(row=>!row.flash_sale_conflict&&!unavailable[row.id])].map(row=>[row.id,row])).values()];if(merged.length>100)throw new Error('A flash sale can contain up to 100 products.');setRows(merged);}
    catch(e){setError(e.message);}finally{picking.current=false;setBusy(false);}
  }
  async function confirmSelection(){
    if(picking.current)return;picking.current=true;setBusy(true);setError('');
    try{const params=new URLSearchParams(context);params.set('publication_status','published');params.set('limit','100');rows.forEach(row=>params.append('flash_sale_product_ids[]',row.id));const result=await apiRequest(`/shop-admin/publications?${params}`);setUnavailable(current=>({...current,...Object.fromEntries(result.items.filter(row=>row.flash_sale_conflict).map(row=>[row.id,row.flash_sale_conflict]))}));const available=new Map(result.items.filter(row=>!row.flash_sale_conflict).map(row=>[row.id,row]));const allowed=rows.filter(row=>available.has(row.id));if(allowed.length!==rows.length){setRows(allowed);setError('Unavailable products were removed from this selection.');return;}onPick(allowed);}
    catch(e){setError(e.message);}finally{picking.current=false;setBusy(false);}
  }
  return <MobileFilterPanel open as="div" id={categoryId+'-picker'} icon={Package} footer={<div className="promotion-picker-footer"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" type="button" className="mobile-primary" disabled={busy||!rows.length} onClick={confirmSelection}>{single?'Use product':`Add ${rows.length} products`}</Button></div>} title="Select products" description="Choose up to 100 products for this flash sale." onClose={()=>!busy&&onClose()} className="promotion-product-picker"><div className="promotion-picker-controls"><SearchInput className="mobile-search" type="search" aria-label="Search flash sale products" placeholder="Search products by name or SKU" value={q} onChange={e=>setQ(e.target.value)} /><ShopField id={categoryId} name="flash-category" label="Category"><Select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{meta.data?.categories?.map(c=><option key={c}>{c}</option>)}</Select></ShopField><div className="promotion-picker-count"><span>{rows.length} of {single?1:100} selected</span><Button variant="plain" type="button" onClick={()=>setRows([])} disabled={busy}>Clear all</Button></div>{!single && <Button variant="plain" className="promotion-picker-select-all" type="button" disabled={busy||list.initialLoading||!list.items.length} onClick={pickAll}>Select all filtered products</Button>}</div>{error&&<p role="alert">{error}</p>}<div className="promotion-picker-products">{list.initialLoading&&<ShopLoading label="Loading products..." variant="list" />}{list.error&&!list.items.length&&<p role="alert">{list.error}<Button variant="plain" type="button" onClick={list.retry}>Retry products</Button></p>}{!list.initialLoading&&!list.error&&!list.items.length&&<p>No matching products.</p>}{list.items.map(p=>{const checked=rows.some(row=>row.id===p.id),conflict=p.flash_sale_conflict||unavailable[p.id],blocked=Boolean(conflict);return <label className={`promotion-picker-product${blocked?' is-unavailable':''}${checked?' is-selected':''}`} key={p.id}><Checkbox type="checkbox" aria-label={`Select ${p.name}`} checked={checked} disabled={busy||blocked||(!checked&&!single&&rows.length>=100)} onChange={()=>toggle(p)} /><PromotionPhoto product={p} /><span><strong>{p.name}</strong>{p.sku&&<small>{p.sku}</small>}<small>{p.unit_name||p.base_unit||p.unit}</small>{blocked&&<small className="promotion-product-unavailable">Already in flash sale: {conflict.name}</small>}</span><span><strong>{shopMoney(p.price ?? p.base_price,p.currency)}</strong><small>{p.unit_name||p.base_unit||p.unit}</small></span></label>;})}<EndlessListFooter list={list} count={list.items.length} noun="products" /></div></MobileFilterPanel>;
}
function PromotionSection({ title, children, className='' }) {return <section className={`promotion-form-section ${className}`}><h2>{title}</h2>{children}</section>;}
function PromotionEnabled({ checked, onChange, id, label='Enabled' }) {return <label className="promotion-enabled" htmlFor={id}><span>{label}</span><Switch id={id} type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)} /></label>;}
function DiscountFields({ form, change, errors, prefix='', radio=false, idPrefix=prefix, currency='Ks' }) {
  return <>
    {radio ? <fieldset className="promotion-discount-choice"><legend>Discount type</legend><div className="promotion-discount-options">{[['percentage','Percent',Percent],['fixed','Fixed amount',Coins]].map(([value,label,Icon]) => <label className={form.discount_type===value?'is-selected':''} key={value}><Icon size={19} aria-hidden="true" /><span>{label}</span><Radio type="radio" name={`promotion-${idPrefix}discount-choice`} checked={form.discount_type===value} onChange={()=>change('discount_type',value)} /></label>)}</div></fieldset> : <ShopField id={`promotion-${idPrefix}discount-type`} name={`${prefix}discount_type`} label="Discount type" errors={errors}><Select value={form.discount_type} onChange={e=>change('discount_type',e.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></Select></ShopField>}
    <div className="promotion-discount-value"><ShopField id={`promotion-${idPrefix}discount-value`} name={`${prefix}discount_value`} label="Discount value" errors={errors}><Input required type="number" min={1} max={form.discount_type==='percentage'?99:1000000000} step={1} value={form.discount_value} onChange={e=>change('discount_value',e.target.value)} /></ShopField><span aria-hidden="true">{form.discount_type==='percentage'?'%':currency}</span></div>
  </>;
}

export function ShopPromotionForm({ id, type='coupon', onNavigate, session }) {
  const resource=useShopResource(id?`/shop-admin/promotions/${id}`:'/shop-admin/promotions?limit=1');
  const [form,setForm]=useState(id?null:{...BLANK,type}),[products,setProducts]=useState([]),[picker,setPicker]=useState(false),[settings,setSettings]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[errors,setErrors]=useState({});
  const initialized=useRef(!id),working=useRef(false),timezone=resource.data?.timezone||'Asia/Rangoon';
  useEffect(()=>{if(!initialized.current&&resource.data?.promotion){const p=resource.data.promotion;setForm({...BLANK,...p,usage_limit:p.usage_limit??'',quantity_limit:p.quantity_limit??'',starts_at:localTime(p.starts_at,timezone),ends_at:localTime(p.ends_at,timezone)});initialized.current=true;}},[resource.data,timezone]);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  const back=()=>{if(!working.current)onNavigate('/shop/promotions',{back:true});};
  const currency=session?.business?.currency||'Ks';
  const prefix=`${id||type}-`, flash=form?.type==='flash_sale';
  async function submit(e) {
    e.preventDefault();if(working.current)return;setError('');setErrors({});
    if(!id&&flash&&!products.length){setError('Choose at least one product.');return;}
    const payload=promotionPayload(form,id?[]:products);
    if(payload.starts_at&&payload.ends_at&&payload.ends_at<=payload.starts_at){setErrors({ends_at:'End time must be later than start time.'});return;}
    working.current=true;setBusy(true);
    try{await apiRequest(`/shop-admin/promotions${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(payload)});if(!id){setForm({...BLANK,type});setProducts([]);setPicker(false);setSettings(false);}onNavigate('/shop/promotions',{replace:true});}
    catch(e){setError(e.message);setErrors(fieldErrors(e));}finally{working.current=false;setBusy(false);}
  }
  function pick(rows) {
    if(id){change('product_id',rows[0].id);change('product_name',rows[0].name);setPicker(false);return;}
    if(rows.length>100){setError('A flash sale can contain up to 100 products.');return;}
    setProducts(rows.map(row=>products.find(p=>p.product_id===row.id)||{product_id:row.id,name:row.name,photo_url:row.photo_url,unit_name:row.unit_name||row.base_unit||row.unit,discount_type:form.discount_type,discount_value:form.discount_value,quantity_limit:''}));setPicker(false);
  }
  const title=id?(flash?'Edit flash sale':'Edit coupon'):(flash?'New flash sale':'New coupon');
  return <><PromotionHeader title={title} onBack={back}>{flash&&!id&&<IconButton variant="ghost" type="button" className="icon-button" aria-label="Default product discount" disabled={busy} onClick={()=>setSettings(true)}><SlidersHorizontal size={21} aria-hidden="true" /></IconButton>}</PromotionHeader><ShopLoadState resource={resource}>{form&&<>
    <form className="shop-mobile-form promotion-reference-form" onSubmit={submit}>
      {error&&<p role="alert" className="shop-mobile-error">{error}</p>}<fieldset disabled={busy}>
      {id&&<section className="promotion-edit-summary"><span className={`promotion-type-icon is-${form.type}`}>{flash?<Zap size={24} aria-hidden="true" />:<Ticket size={24} aria-hidden="true" />}</span><div><strong>{flash?form.name:form.code}</strong><PromotionBadge value={form.status||(form.enabled?'active':'paused')} /></div></section>}
      <section className="promotion-form-section"><ShopField id={`promotion-${prefix}name`} name="name" label="Promotion name" errors={errors}><Input required maxLength={255} value={form.name} onChange={e=>change('name',e.target.value)} /></ShopField>{!flash&&<><p className="promotion-field-hint">This name is for your reference only.</p><ShopField id={`promotion-${prefix}code`} name="code" label="Coupon code" errors={errors}><Input required maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code||''} onChange={e=>change('code',e.target.value.toUpperCase())} /></ShopField><p className="promotion-field-hint">Customers will enter this code at checkout.</p></>}{flash&&<PromotionEnabled id={`promotion-${prefix}enabled`} checked={form.enabled} onChange={value=>change('enabled',value)} label="Enable sale" />}</section>
      {!flash&&<><section className="promotion-form-section"><DiscountFields currency={currency} form={form} change={change} errors={errors} radio idPrefix={prefix} /></section><PromotionSection title="Purchase requirements (optional)"><ShopField id={`promotion-${prefix}minimum`} name="minimum_subtotal" label="Minimum subtotal" errors={errors}><Input type="number" min={0} max={1000000000} value={form.minimum_subtotal} onChange={e=>change('minimum_subtotal',e.target.value)} /></ShopField><p className="promotion-field-hint">Minimum purchase amount before discount is applied.</p></PromotionSection><PromotionSection title="Usage limits (optional)"><ShopField id={`promotion-${prefix}usage`} name="usage_limit" label="Usage limit (optional)" errors={errors}><Input type="number" min={Math.max(1,form.used_count||1)} max={1000000} step={1} value={form.usage_limit} onChange={e=>change('usage_limit',e.target.value)} /></ShopField><p className="promotion-field-hint">Leave empty for no limit.</p></PromotionSection></>}
      <PromotionSection title={flash?'Schedule':'Availability'}>{!flash&&<PromotionEnabled id={`promotion-${prefix}enabled`} checked={form.enabled} onChange={value=>change('enabled',value)} label="Enabled" />}<div className="promotion-schedule-fields">{['starts_at','ends_at'].map(name=><ShopField id={`promotion-${prefix}${name}`} key={name} name={name} label={name==='starts_at'?'Starts at (optional)':'Ends at (optional)'} errors={errors}><Input type="date" value={form[name].slice(0,10)} onClick={event=>{try{event.currentTarget.showPicker?.();}catch{event.currentTarget.focus();}}} onChange={event=>change(name,event.target.value?`${event.target.value}T00:00`:'')} /></ShopField>)}</div><p className="promotion-field-hint">Business timezone: {timezone}. Empty dates have no time restriction.</p><p className="promotion-field-hint">Selected dates use 00:00:00.</p></PromotionSection>
      {flash&&<PromotionSection title="Products"><div className="promotion-products-heading"><span>{id?form.product_name:`${products.length} products selected`}</span><small>{id?'':`${products.length} of 100 selected`}</small></div><Button variant="plain" className="promotion-add-products" type="button" disabled={!!id&&!!Number(form.used_count)} onClick={()=>setPicker(true)}><Plus size={19} aria-hidden="true" /><span>{id?'Change product':'Choose products'}</span><ChevronRight size={18} aria-hidden="true" /></Button>{errors.product_id&&<p role="alert">{errors.product_id}</p>}{id?<><DiscountFields currency={currency} form={form} change={change} errors={errors} idPrefix={prefix} /><ShopField id={`promotion-${prefix}quantity`} name="quantity_limit" label="Quantity limit (optional)" errors={errors}><Input type="number" min={Math.max(0.001,Number(form.used_quantity||0))} max={1000000} step="0.001" value={form.quantity_limit} onChange={e=>change('quantity_limit',e.target.value)} /></ShopField>{!!Number(form.used_count)&&<p className="promotion-field-hint">This used flash sale must keep its original product and online unit.</p>}</>:products.map((p,index)=><section className="promotion-selected-product" key={p.product_id}><header><PromotionPhoto product={p} /><strong>{p.name}</strong><IconButton variant="ghost" type="button" className="promotion-remove-product" aria-label={`Remove ${p.name}`} onClick={()=>setProducts(rows=>rows.filter(row=>row.product_id!==p.product_id))}><Trash2 size={18} aria-hidden="true" /></IconButton></header><DiscountFields currency={currency} form={p} prefix={`items.${index}.`} idPrefix={`${prefix}${p.product_id}-`} errors={errors} change={(key,value)=>setProducts(rows=>rows.map(row=>row.product_id===p.product_id?{...row,[key]:value}:row))} /><ShopField id={`promotion-${prefix}${p.product_id}-quantity`} name={`items.${index}.quantity_limit`} label="Quantity limit (optional)" errors={errors}><Input type="number" min="0.001" max={1000000} step="0.001" value={p.quantity_limit} onChange={e=>setProducts(rows=>rows.map(row=>row.product_id===p.product_id?{...row,quantity_limit:e.target.value}:row))} /></ShopField></section>)}</PromotionSection>}
      {id&&<section className="promotion-usage-summary"><strong>Usage so far</strong><span>{flash?form.used_quantity||0:form.used_count||0} / {(flash?form.quantity_limit:form.usage_limit)||'Unlimited'}</span>{(flash?form.quantity_limit:form.usage_limit)>0&&<progress aria-label="Promotion usage" max={flash?form.quantity_limit:form.usage_limit} value={flash?form.used_quantity||0:form.used_count||0} />}</section>}
      <div className={`promotion-form-footer${!id?' is-create':''}`}><Button variant="secondary" type="button" className="mobile-secondary" onClick={back}>Cancel</Button><Button variant="primary" type="submit" className="mobile-primary">{busy?<ShopBusy label="Saving..." />:id?'Save changes':flash?'Save flash sale':'Save coupon'}</Button></div>
    </fieldset></form>
    {picker&&<PromotionProductPicker startsAt={form.starts_at} endsAt={form.ends_at} enabled={form.enabled} promotionId={id} onClose={()=>setPicker(false)} onPick={pick} single={!!id} selectedRows={id?(form.product_id?[{id:form.product_id,name:form.product_name}]:[]):products.map(p=>({...p,id:p.product_id}))} />}
    <MobileSheet open={settings} title="Default product discount" onClose={()=>setSettings(false)} className="promotion-default-settings"><p>Used for newly added products. Each product can have its own discount.</p><DiscountFields currency={currency} form={form} change={change} errors={{}} idPrefix={`${prefix}default-`} /><Button variant="primary" className="mobile-primary" type="button" onClick={()=>setSettings(false)}>Done</Button></MobileSheet>
  </>}</ShopLoadState></>;
}
