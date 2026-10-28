import { useRefreshResource } from './useRefreshResource';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useId, useRef, useState } from 'react';
import { ArrowRight, Search, ShoppingCart, Utensils, House, Flower2, Laptop, Shirt, LayoutGrid, Leaf, X, MapPin } from 'lucide-react';
import heroGroceries from './assets/home-local-groceries.webp';
import { useText, localizeError, LocaleContext } from './i18n';
import { useEndless } from './useEndless';
import { CatalogFilters, defaultCatalogFilters, catalogFilterQuery } from './ProductDiscovery';
import { useShopPageActive } from './RetainedViews';
import { MarketplaceCategoryFilter, marketplaceCategoryLabel } from './MarketplaceCategoryBrowser';

function HomePreview({ path, children, skeleton = 'products' }) {
  const text = useText();
  const locale = React.useContext(LocaleContext);
  const resource = useRefreshResource(path);
  const state = { ...resource, items: resource.data?.items || [] };
  if (state.busy) return <LoadingSkeleton variant={skeleton} count={4} />;
  if (state.error) return <div className="home-preview-error" role="alert">{localizeError(locale, state.error)}<button type="button" onClick={resource.retry}>{text('Try again')}</button></div>;
  return children(state.items);
}

function categoryIcon(category) {
  if (/food|drink|fruit|produce|grocery|rice|snack/i.test(category)) return Utensils;
  if (/home|living|furniture/i.test(category)) return House;
  if (/beauty|health|care/i.test(category)) return Flower2;
  if (/electronic|computer|phone/i.test(category)) return Laptop;
  if (/fashion|cloth|shoe/i.test(category)) return Shirt;
  return LayoutGrid;
}

export function MarketplaceHome({ t, ProductCard, ShopCard, ListEnd, add, carts }) {
  const text = useText(), active = useShopPageActive(), searchId = useId();
  const locale = React.useContext(LocaleContext);
  const [kind, setKind] = useState('products'), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [category, setCategory] = useState(null), [filterOpen, setFilterOpen] = useState(false);
  const categories = useEndless('/marketplace/categories?level=root');
  const [filters, setFilters] = useState(defaultCatalogFilters), [browse, setBrowse] = useState(false), [added, setAdded] = useState('');
  const catalog = useRef(null);
  const [location, setLocation] = useState(null), [locating, setLocating] = useState(false), [locationError, setLocationError] = useState('');
  const isOverview = kind === 'products' && !browse && !query && !category && !Object.entries(filters).some(([key, value]) => value !== defaultCatalogFilters[key]);
  const featuredQuery = `featured=1${location ? `&latitude=${location.latitude}&longitude=${location.longitude}` : ''}`;
  const list = useEndless(`/marketplace/${kind}?q=${encodeURIComponent(query)}&${kind === 'products' ? `marketplace_category_id=${category?.id || ''}&${catalogFilterQuery(filters)}` : ''}${isOverview ? `&${featuredQuery}` : ''}`);
  const openCategories = () => { setBrowse(true); setFilterOpen(true); };
  function locate() {
    if (!navigator.geolocation) { setLocationError(text('Location is unavailable. Recommendations still work without it.')); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(position => { setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false); }, () => { setLocationError(text('Location is unavailable. Recommendations still work without it.')); setLocating(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  function showCatalog(nextKind = 'products', nextFilters = defaultCatalogFilters, nextCategory = null) {
    setFilterOpen(false); setKind(nextKind); setFilters(nextFilters); setCategory(nextCategory); setBrowse(true);
    requestAnimationFrame(() => catalog.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  function quickAdd(product) {
    const current = carts.find(cart => cart.slug === product.store_slug)?.items.find(item => item.id === product.id)?.quantity || 0;
    const quantity = Math.min(1, Number(product.available_quantity) - Number(current));
    if (quantity > 0 && Number(current) + quantity <= Number(product.available_quantity) && add(product, quantity, 'marketplace')) setAdded(text('Added to cart: {name}', { name: product.name }));
  }
  const cards = items => <div className="home-product-grid">{items.map(product => <div className="home-product-tile" key={`${product.store_slug}:${product.id}`}><ProductCard product={product} origin="marketplace" homeCard cartAction={<button type="button" className="primary home-quick-add" aria-label={`${text('Add to cart')}: ${product.name}`} disabled={Number(product.available_quantity) <= 0 || (Number(carts.find(cart => cart.slug === product.store_slug)?.items.find(item => item.id === product.id)?.quantity || 0) >= Number(product.available_quantity))} onClick={() => quickAdd(product)}><ShoppingCart size={20} aria-hidden="true" /></button>} /></div>)}</div>;
  const heading = (title, action) => <div className="home-section-heading"><h2>{text(title)}</h2><button type="button" onClick={action}>{text('See all')}<ArrowRight size={17} aria-hidden="true" /></button></div>;
  return <div className="marketplace-home">
    <div className="home-search-band app-bar-search-band"><form className="home-search app-bar-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setBrowse(Boolean(search.trim())); setCategory(''); }}>
      <Search size={21} aria-hidden="true" /><label className="sr-only" htmlFor={searchId}>{t.search}</label><input id={searchId} maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder={text(kind === 'products' ? 'Search products or categories' : 'Search shops')} />
      {search && <button type="button" aria-label={text('Clear search')} onClick={() => { setSearch(''); setQuery(''); }}><X size={18} /></button>}
      <button type="submit" aria-label={t.search}><ArrowRight size={21} /></button>
    </form></div>
    <div className="home-content">
      {isOverview && <>
        <div className="home-location"><button type="button" disabled={locating} onClick={locate}><MapPin size={16} aria-hidden="true" />{text(locating ? 'Finding your location…' : location ? 'Update my location' : 'Use my location')}</button>{location && <button type="button" onClick={() => { setLocation(null); setLocationError(''); }}>{text('Clear location')}</button>}{locationError && <p role="status">{locationError}</p>}</div>
        <section className="home-hero"><div><h1>{text('Fresh Choices')}<br />{text('Brighter Days')}</h1><p>{text('Support Local Shops')}</p><button type="button" className="primary" onClick={() => showCatalog()}>{text('Shop Now')}<ArrowRight size={18} aria-hidden="true" /></button></div><div className="home-hero-art" aria-hidden="true"><img src={heroGroceries} alt="" /></div></section>
        {categories.items.length > 0 && <div className="home-categories" aria-label={text('Product categories')}>{categories.items.slice(0, 5).map((item, index) => { const Icon = categoryIcon(item.name_en); return <button type="button" key={item.id} className={`category-${index}`} onClick={() => showCatalog('products', defaultCatalogFilters, item)}><span><Icon size={22} aria-hidden="true" /></span>{marketplaceCategoryLabel(item, locale)}</button>; })}<button type="button" onClick={openCategories}><span><LayoutGrid size={22} aria-hidden="true" /></span>{text('More')}</button></div>}
        {categories.error && <p role="alert">{text('Unable to load categories.')} <button type="button" onClick={categories.retry}>{text('Try again')}</button></p>}
      </>}
      <div className="home-catalog" ref={catalog}>
        <div data-shop-refresh-bar={!isOverview ? '' : undefined} className="home-browse-bar"><div className="tabs" aria-label={text('Browse marketplace')}><button type="button" aria-pressed={kind === 'products'} onClick={() => { setKind('products'); setCategory(''); }}>{t.products}</button><button type="button" aria-pressed={kind === 'shops'} onClick={() => { setKind('shops'); setCategory(''); }}>{t.shops}</button></div>{!isOverview && <button type="button" className="home-reset" onClick={() => { setKind('products'); setSearch(''); setQuery(''); setCategory(''); setFilters(defaultCatalogFilters); setBrowse(false); }}>{text('Back to home')}</button>}</div>
        {!isOverview && kind === 'products' && <CatalogFilters refreshBar={!isOverview} value={filters} onChange={setFilters} open={filterOpen} onOpenChange={setFilterOpen} category={category} onCategoryChange={setCategory} renderCategoryFilter={props => <MarketplaceCategoryFilter {...props} />} />}
        {isOverview ? <>
          <section className="home-section">{heading('Featured Products', () => showCatalog())}{cards(list.items.slice(0, 4))}{list.busy && !list.items.length && <LoadingSkeleton variant="products" count={4} message="Loading products" />}</section>
          <section className="home-section">{heading('Local Shops', () => showCatalog('shops'))}<HomePreview skeleton="shops" path={`/marketplace/shops?limit=4&${featuredQuery}`}>{items => items.length ? <div className="home-shop-grid">{items.map(item => <ShopCard key={item.slug} store={item} compact />)}</div> : <p className="home-empty">{text('No shops available right now.')}</p>}</HomePreview></section>
          <section className="home-section">{heading('Special Deals', () => showCatalog('products', { ...defaultCatalogFilters, on_sale: true }))}<HomePreview path="/marketplace/products?on_sale=1&limit=4">{items => items.length ? cards(items) : <p className="home-empty">{text('No flash sales available right now.')}</p>}</HomePreview></section>
          <div className="home-community"><Leaf size={29} aria-hidden="true" /><div><strong>{text('Support local. Shop together.')}</strong><span>{text('Independent shops. One simple checkout.')}</span></div></div>
          {list.items.length > 4 && <section className="home-section"><div className="home-section-heading"><h2>{text('More products')}</h2></div>{cards(list.items.slice(4))}</section>}
        </> : kind === 'shops' ? <div className="home-shop-grid">{list.items.map(item => <ShopCard key={item.slug} store={item} compact />)}</div> : cards(list.items)}
        <ListEnd list={list} skeleton={kind === "shops" ? "shops" : "products"} hideLoading={isOverview && !list.items.length} />
      </div>
      {active && added && <p className="home-cart-feedback" role="status">{added}<button type="button" aria-label={text('Dismiss notification')} onClick={() => setAdded('')}><X size={17} /></button></p>}
    </div>
  </div>;
}
