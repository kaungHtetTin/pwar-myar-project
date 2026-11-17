import { focusPanel } from './keyboardFocus';
import { useShopRefresh } from './pageRefresh';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Heart, MapPin, Pencil, Trash2, Plus, ArrowLeft, ArrowRight, Clock3, Bell, Search, Store, ShoppingCart, X } from 'lucide-react';
import { request } from './api';
import { useCustomer, CustomerAuth } from './CustomerAccount';
import { useText } from './i18n';
import { goBack } from './shopNavigation';
import { SectionTitle, LoadingPanel, ProductMedia, PriceTag, IconButton } from './ShoppingComponents';
import { useEndless } from './useEndless';
import './favorites.css';
import './addresses.css';
import { useShopPageActive } from './RetainedViews';

const FeatureContext = createContext(null);
const favoriteKey = (slug, id) => `${slug}:${id}`;
export function ShoppingFeaturesProvider({ children }) {
  const { customer } = useCustomer();
  const [saved, setSaved] = useState(new Set());
  const [loaded, setLoaded] = useState(false);
  const epoch = useRef(0);
  useEffect(() => {
    const generation = ++epoch.current; setSaved(new Set()); setLoaded(false);
    if (customer) request('/customer/favorite-keys').then(data => {
      if (generation === epoch.current) { setSaved(new Set(data.items.map(row => favoriteKey(row.slug, row.product_id)))); setLoaded(true); }
    }).catch(() => {});
    return () => { epoch.current++; };
  }, [customer?.id]);
  function reconcile(slug, id, value) { setSaved(previous => { const next = new Set(previous); value ? next.add(favoriteKey(slug, id)) : next.delete(favoriteKey(slug, id)); return next; }); }
  return <FeatureContext.Provider value={{ saved, loaded, reconcile, epoch }}>{children}</FeatureContext.Provider>;
}

export function FeatureBack({ title }) {
  const text = useText();
  return <a className="back" href="#/account" onClick={e => { e.preventDefault(); goBack('/account'); }}><ArrowLeft size={16} />{text(title || 'My account')}</a>;
}
export function FeatureError({ message, retry }) {
  const text = useText();
  return message ? <div className="notice error" role="alert">{message}{retry && <button type="button" onClick={retry}>{text('Try again')}</button>}</div> : null;
}
export function FavoriteButton({ slug, productId = 0, compact = true }) {
  const text = useText(); const { customer } = useCustomer(); const context = useContext(FeatureContext);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saved = context?.saved.has(favoriteKey(slug, productId)) || false;
  async function toggle() {
    if (!customer) { location.hash = `/account/login?next=${encodeURIComponent(location.hash.slice(1))}`; return; }
    if (busy) return; setBusy(true); setError(''); const generation = context.epoch.current;
    try {
      const data = await request(`/customer/favorites/store/${encodeURIComponent(slug)}`, { method: saved ? 'DELETE' : 'PUT', body: JSON.stringify({ product_id: productId }) });
      if (generation === context.epoch.current) context.reconcile(slug, productId, data.saved);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <span className="favorite-control"><button type="button" className={compact ? 'icon-action favorite-button' : 'favorite-button'} disabled={busy} aria-pressed={saved} title={text(saved ? 'Remove from favorites' : 'Save to favorites')} aria-label={text(saved ? 'Remove from favorites' : 'Save to favorites')} onClick={toggle}><Heart size={18} fill={saved ? 'currentColor' : 'none'} />{!compact && text(saved ? 'Saved' : productId ? 'Save product' : 'Save shop')}</button>{error && <FeatureError message={error} />}</span>;
}

function FavoritesCollection({ ProductCard, ShopCard, add, carts = [], kind, query, sort }) {
  const text = useText(); const context = useContext(FeatureContext);
  const [removed, setRemoved] = useState(new Set()), [busy, setBusy] = useState(0), [error, setError] = useState('');
  const list = useEndless(`/customer/favorites?kind=${kind}`);
  async function remove(item) {
    if (busy) return; setBusy(item.favorite_id); setError('');
    try { await request(`/customer/favorites/${item.favorite_id}`, { method: 'DELETE' }); setRemoved(prev => new Set([...prev, item.favorite_id])); context.reconcile(item.store_slug || item.slug, item.product_id || item.id || 0, false); }
    catch (e) { setError(e.message); } finally { setBusy(0); }
  }

  const items = list.items.filter(item => !removed.has(item.favorite_id) && (!context.loaded || context.saved.has(favoriteKey(item.store_slug || item.slug, item.product_id || (kind === 'products' ? item.id : 0)))));
  const filtered = items.filter(item => `${item.name || item.display_name || ''} ${item.store_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  if (sort === 'oldest') filtered.reverse();
  return <div className="favorites-collection"><p data-shop-refresh-bar className="favorites-count">{text('{count} saved items', { count: filtered.length })}{list.more ? '+' : ''}</p><FeatureError message={error || list.error} retry={list.error ? list.retry : undefined} />
    <div className={kind === 'products' ? 'home-product-grid' : 'favorites-shop-grid'}>{filtered.map(item => <div className={kind === 'products' ? 'home-product-tile' : 'favorites-shop-tile'} key={item.favorite_id}>
      {item.unavailable ? <div className="feature-panel"><strong>{text('Currently unavailable')}</strong><p>{text('This saved item is no longer published.')}</p><IconButton label="Remove" icon={Trash2} disabled={Boolean(busy)} onClick={() => remove(item)} /></div> : kind === 'products' ? <ProductCard product={item} origin="marketplace" homeCard cartAction={<button type="button" className="home-quick-add" aria-label={`${text('Add to cart')}: ${item.name}`} disabled={!add || Number(item.available_quantity) <= Number(carts.find(cart => cart.slug === item.store_slug)?.items.find(product => product.id === item.id)?.quantity || 0)} onClick={() => add(item, 1, 'marketplace')}><ShoppingCart size={20} /></button>} /> : <><ShopCard store={item} compact /><span className="favorites-shop-save"><FavoriteButton slug={item.slug} /></span></>}
    </div>)}</div><div ref={list.sentinel}>{list.busy ? <LoadingPanel variant={kind === "products" ? "products" : "shops"} count={list.items.length ? 2 : 4} /> : !filtered.length && !list.error ? <FeatureEmpty icon={Heart} message={query ? 'No matching favorites.' : 'Save something you love to find it here.'} /> : list.more && <button type="button" onClick={list.retry}>{text('Load more')}</button>}</div></div>;
}
function FavoritesList(props) {
  const text = useText();
  const [kind, setKind] = useState('products'), [query, setQuery] = useState(''), [sort, setSort] = useState('newest');
  return <section className="favorites-page is-home-page"><header data-shop-refresh-bar className="favorites-intro"><h1>{text('Favorites')}</h1><p>{text('Products you love and saved for later.')}</p><div className="app-bar-search"><Search size={20} /><input type="search" aria-label={text('Search favorites')} placeholder={text(kind === 'products' ? 'Search your favorite products...' : 'Search your favorite shops...')} value={query} onChange={event => setQuery(event.target.value)} /><ArrowRight size={20} /></div></header><div className="favorites-surface"><div data-shop-refresh-bar className="favorites-sort"><label>{text('Sort favorites')}<select aria-label={text('Sort favorites')} value={sort} onChange={event => setSort(event.target.value)}><option value="newest">{text('Newest first')}</option><option value="oldest">{text('Oldest first')}</option></select></label></div>{['products','shops'].map(type => <div key={type} hidden={kind !== type}><FavoritesCollection {...props} kind={type} query={query} sort={sort} /></div>)}</div><nav className="favorites-navigation" aria-label={text('Favorites')}><button type="button" aria-pressed={kind === 'products'} onClick={() => setKind('products')}><Heart size={23} />{text('Products')}</button><button type="button" aria-pressed={kind === 'shops'} onClick={() => setKind('shops')}><Store size={23} />{text('Shops')}</button></nav></section>;
}

export function FavoritesPage(props) {
  const { customer, loading } = useCustomer();
  if (loading) return <LoadingPanel variant="products" page />;
  return customer ? <FavoritesList {...props} /> : <CustomerAuth next="/account/favorites" />;
}
export function FeatureEmpty({ icon: Icon = Heart, message }) { const text = useText(); return <div className="feature-empty"><Icon size={28} /><p>{text(message)}</p></div>; }

const blankAddress = { label: '', recipient: '', phone: '', address: '', is_default: false };
export function SavedAddressPicker({ onSelect }) {
  const text = useText(); const { customer } = useCustomer();
  const [items, setItems] = useState([]), [error, setError] = useState('');
  useEffect(() => { let active = true; request('/customer/addresses').then(data => active && setItems(data.items || [])).catch(e => active && setError(e.message)); return () => { active = false; }; }, [customer?.id]);
  useEffect(() => {
    const changed = event => { if (event.detail.customerId === customer?.id) { setItems(event.detail.items); setError(''); } };
    window.addEventListener('mkpos:addresses-changed', changed);
    return () => window.removeEventListener('mkpos:addresses-changed', changed);
  }, [customer?.id]);
  return <div className="saved-address-picker"><FeatureError message={error} /><label>{text('Choose a saved address')}<select defaultValue="" onChange={e => { const item = items.find(item => String(item.id) === e.target.value); if (item) onSelect(item); }}><option value="">{text('Enter address manually')}</option>{items.map(item => <option key={item.id} value={item.id}>{item.label} · {item.recipient}</option>)}</select></label><a href="#/account/addresses">{text('Manage saved addresses')}</a></div>;
}
export function AddressBook({ picker, onSelect }) {
  const text = useText(); const { customer, setCustomer } = useCustomer();
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [editing, setEditing] = useState(null), [form, setForm] = useState(blankAddress), [version, setVersion] = useState(0);
  useShopRefresh(() => setVersion(value => value + 1), !busy && !editing);
  useEffect(() => { let active = true; setLoading(true); request('/customer/addresses').then(data => { if (active) setItems(data.items); }).catch(e => active && setError(e.message)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [customer?.id, version]);
  function apply(data) { setItems(data.items); const current = data.items.find(item => item.is_default); setCustomer(prev => prev ? { ...prev, address: current?.address || '' } : prev); window.dispatchEvent(new CustomEvent('mkpos:addresses-changed', { detail: { customerId: customer.id, items: data.items } })); }
  async function save(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { apply(await request(`/customer/addresses${editing?.id ? `/${editing.id}` : ''}`, { method: editing?.id ? 'PUT' : 'POST', body: JSON.stringify(form) })); setForm({ ...blankAddress }); setEditing(null); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(text('Delete this saved address?')) || busy) return; setBusy(true); setError('');
    try { apply(await request(`/customer/addresses/${item.id}`, { method: 'DELETE' })); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function makeDefault(item) {
    if (busy) return; setBusy(true); setError('');
    try { apply(await request(`/customer/addresses/${item.id}`, { method: 'PUT', body: JSON.stringify({ label: item.label, recipient: item.recipient, phone: item.phone, address: item.address, is_default: true }) })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function edit(item = {}) { setEditing(item); setForm(item.id ? { label: item.label, recipient: item.recipient, phone: item.phone, address: item.address, is_default: Boolean(item.is_default) } : { ...blankAddress, recipient: customer.name, phone: customer.phone || '' }); setError(''); }
  const editorRef = useRef(null);
  const pageActive = useShopPageActive();
  useEffect(() => {
    const dialog = editorRef.current;
    if (!editing || !pageActive || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    focusPanel(dialog, 'input');
    return () => { dialog.close?.(); document.body.style.overflow = previousOverflow; };
  }, [editing, pageActive]);
  useEffect(() => { const action = event => { if (pageActive && !busy && items.length < 20 && event.detail === 'add-address') edit(); }; window.addEventListener('mkpos:account-action', action); return () => window.removeEventListener('mkpos:account-action', action); }, [pageActive, busy, items.length, customer]);
  return <section className={`address-book ${picker ? 'address-picker' : 'addresses-page'}`}><header className="addresses-intro"><h1>{text('Saved addresses')}</h1><p>{text('Manage your delivery addresses.')}</p></header><div className="addresses-content"><div className="feature-panel-heading"><h2>{text('Your addresses')}</h2><button type="button" className="primary" disabled={busy || items.length >= 20} onClick={() => edit()}><Plus size={18} />{text('Add address')}</button></div>
    <FeatureError message={editing ? null : error} retry={loading ? undefined : () => { setError(''); setVersion(v => v + 1); }} />
    {loading ? <LoadingPanel variant="addresses" /> : <div className="feature-list">{items.map(item => <article className="feature-panel address-card" key={item.id}><div className="address-card-top"><span className="address-pin"><MapPin size={23} aria-hidden="true" /></span><strong>{item.label}</strong>{Boolean(item.is_default) && <span className="feature-chip">{text('Default')}</span>}</div><strong>{item.recipient}</strong><small className="address-phone">{item.phone}</small><p>{item.address}</p><div className="feature-actions">{picker && <button type="button" className="primary" disabled={busy} onClick={() => onSelect(item)}>{text('Deliver here')}</button>}{!item.is_default && <button type="button" className="address-default-action" disabled={busy} onClick={() => makeDefault(item)}>{text('Make default')}</button>}<IconButton label="Edit" icon={Pencil} disabled={busy} onClick={() => edit(item)} /><IconButton label="Delete" icon={Trash2} disabled={busy} onClick={() => remove(item)} /></div></article>)}</div>}
    {!loading && !items.length && <FeatureEmpty icon={MapPin} message="Save Home, Work or another delivery address." />}
    {editing && <dialog ref={editorRef} className="address-editor-modal" aria-labelledby="address-editor-title" onCancel={event => { event.preventDefault(); if (!busy) setEditing(null); }}><form className="feature-panel address-editor" onSubmit={save}><header className="address-editor-heading"><h3 id="address-editor-title">{text(editing.id ? 'Edit address' : 'Add address')}</h3><button type="button" className="address-modal-close" aria-label={text("Close address form")} disabled={busy} onClick={() => setEditing(null)}><X size={22} /></button></header><FeatureError message={error} /><fieldset disabled={busy}><div className="feature-form-grid"><label>{text('Address label')}<input required maxLength={80} placeholder={text('Home or Work')} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label><label>{text('Recipient name')}<input required autoComplete="name" maxLength={255} value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} /></label><label>{text('Phone')}<input required type="tel" autoComplete="tel" maxLength={80} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label></div><label>{text('Delivery address')}<textarea required autoComplete="street-address" maxLength={2000} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label><label className="feature-check"><input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />{text('Use as default address')}</label><div className="feature-actions"><button className="primary">{text(busy ? 'Please wait…' : 'Save address')}</button><button type="button" onClick={() => setEditing(null)}>{text('Cancel')}</button></div></fieldset></form></dialog>}
  </div></section>;
}
export function AddressesPage() { const { customer, loading } = useCustomer(); return loading ? <LoadingPanel variant="addresses" page /> : customer ? <AddressBook /> : <CustomerAuth next="/account/addresses" />; }

export function AccountFeatureLinks() {
  const text = useText();
  return <div className="account-feature-links">{[['favorites', Heart, 'Favorites'], ['addresses', MapPin, 'Saved addresses'], ['notifications', Bell, 'Updates'], ['recent', Clock3, 'Recently viewed']].map(([path, Icon, title]) => <a key={path} href={`#/account/${path}`}><span className="section-symbol"><Icon size={20} /></span><strong>{text(title)}</strong><ArrowRight size={16} /></a>)}</div>;
}
