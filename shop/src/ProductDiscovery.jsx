import React, { useEffect, useState } from 'react';
import { Clock3, Package } from 'lucide-react';
import { request } from './api';
import { useText } from './i18n';
import { useCustomer } from './CustomerAccount';
import { useShopPageActive } from './RetainedViews';
import { SectionTitle, LoadingPanel } from './ShoppingComponents';
import { FeatureEmpty, FeatureError } from './CustomerFeatures';
import './recent-products.css';

export { defaultCatalogFilters, catalogFilterQuery } from './catalogFilterState';
export { CatalogFilters } from './CatalogFilterDrawer';

const recentKey = id => `mkpos.shop.recent.${id || 'guest'}`;
export function readRecent(id) { try { return JSON.parse(localStorage.getItem(recentKey(id)) || '[]').filter(row => typeof row.slug === 'string' && Number.isInteger(row.id)).slice(0, 30); } catch { return []; } }
export function rememberProduct(id, product) {
  const items = readRecent(id).filter(row => row.slug !== product.store_slug || row.id !== product.id);
  localStorage.setItem(recentKey(id), JSON.stringify([{ slug: product.store_slug, id: product.id }, ...items].slice(0, 30)));
  window.dispatchEvent(new CustomEvent('mkpos:product-viewed', { detail: { customerId: id, product } }));
}
export function RememberProduct({ product }) {
  const { customer } = useCustomer(); const active = useShopPageActive();
  useEffect(() => { if (active) rememberProduct(customer?.id, product); }, [active, customer?.id, product.id, product.store_slug]);
  return null;
}
export function RecentProducts({ ProductCard }) {
  const text = useText(); const { customer } = useCustomer(); const [items, setItems] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => { const viewed = event => { if (event.detail.customerId !== customer?.id) return; const p = event.detail.product; setItems(previous => [p, ...previous.filter(row => row.id !== p.id || row.store_slug !== p.store_slug)].slice(0, 30)); }; window.addEventListener('mkpos:product-viewed', viewed); return () => window.removeEventListener('mkpos:product-viewed', viewed); }, [customer?.id]);
  useEffect(() => {
    let active = true; setBusy(true); setError('');
    Promise.allSettled(readRecent(customer?.id).map(row => request(`/stores/${encodeURIComponent(row.slug)}/products/${row.id}`))).then(results => {
      if (!active) return;
      setItems(results.filter(result => result.status === 'fulfilled').map(result => result.value));
      if (results.some(result => result.status === 'rejected' && result.reason.status !== 404)) setError(text('Some recently viewed products could not be loaded.'));
      setBusy(false);
    }); return () => { active = false; };
  }, [customer?.id, version]);
  return <section className="recent-products-page is-home-page">
    <div className="recent-products-surface">
      <div data-shop-refresh-bar className="recent-products-toolbar"><button type="button" className="recent-products-clear" disabled={busy || !items.length} onClick={() => { if (window.confirm(text('Clear recently viewed products on this device?'))) { localStorage.removeItem(recentKey(customer?.id)); setItems([]); } }}>{text('Clear history')}</button></div>
      <FeatureError message={error} retry={() => setVersion(v => v + 1)} />
      {busy ? <LoadingPanel variant="products" /> : items.length ? <div className="home-product-grid">{items.map(p => <div className="home-product-tile" key={`${p.store_slug}:${p.id}`}><ProductCard product={p} origin="marketplace" homeCard /></div>)}</div> : <div className="recent-products-empty"><FeatureEmpty icon={Clock3} message="Products you view will appear here." /></div>}
    </div>
  </section>;
}
export function RelatedProducts({ slug, id, ProductCard, origin }) {
  const text = useText(); const [data, setData] = useState(null), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => { let active = true; request(`/stores/${encodeURIComponent(slug)}/products/${id}/related`).then(data => active && setData(data.items || [])).catch(e => active && setError(e.message)); return () => { active = false; }; }, [slug, id, version]);
  return <section className="related-products"><SectionTitle icon={Package} title={text('More from this shop')} /><FeatureError message={error} retry={() => setVersion(v => v + 1)} />{!data && !error ? <LoadingPanel variant="products" /> : data?.length ? <div className="product-grid">{data.map(p => <ProductCard key={p.id} product={p} origin={origin} />)}</div> : !error && <p className="feature-subtitle">{text('No related products are available right now.')}</p>}</section>;
}
