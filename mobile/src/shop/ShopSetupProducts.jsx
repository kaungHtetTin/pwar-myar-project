import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { Button, Checkbox, Field, SearchInput } from '../components/Controls';
import { EndlessListFooter } from '../components/MobilePrimitives';
import { useEndlessList } from '../hooks/useEndlessList';
import { usePageRefresh } from '../navigation/pageRefresh';
import { ShopLoading } from './ShopPrimitives';
import { shopMoney } from './shopUtils';

export function ShopSetupProducts({ disabled, onBusyChange, revision }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const list = useEndlessList({ queryKey: `${query}:${revision}`, loadPage: ({ limit, offset, signal }) => apiRequest(`/shop-admin/publications?${new URLSearchParams({ q: query, limit, offset })}`, { signal }) });
  usePageRefresh(list.reload, { dataPath: '/shop/setup/new' });
  async function publish(published, product) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      await apiRequest(product ? `/shop-admin/publications/${product.id}` : `/shop-admin/publications/bulk?${new URLSearchParams({ q: query })}`, { method: 'PUT', body: JSON.stringify(product ? { published, unit: product.unit || 'base' } : { published }) });
      // Reconcile the already loaded range; preserve search, scroll and loaded pages.
      if (alive.current) await list.reload();
    } catch (e) { if (alive.current) setError(e.message); }
    finally { lock.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }
  return <section aria-label="Product publication" className="mobile-shop-setup-products">
    <div className="mobile-shop-setup-search"><Field label="Search products"><SearchInput as="div" value={search} disabled={busy || disabled} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, barcode or category" /></Field><div><Button variant="primary" disabled={busy || disabled || list.initialLoading} onClick={() => publish(true)}>Publish all</Button><Button disabled={busy || disabled || list.initialLoading} onClick={() => publish(false)}>Unpublish all</Button></div></div>
    <p className="mobile-shop-setup-hint">Applies to all products matching your search, across every page.</p>
    {error && <p role="alert">{error}</p>}
    {list.initialLoading && <ShopLoading />}
    {!list.initialLoading && !list.error && !list.items.length && <p>No matching products.</p>}
    {list.items.map(product => <article className="mobile-shop-setup-product" key={product.id}>
      <strong data-no-localize>{product.name}</strong>
      <span className="mobile-shop-setup-product-price" data-no-localize>{shopMoney(product.unit === 'purchase' ? product.purchase_price : product.base_price, product.currency)}</span>
      <label title="Publish online"><Checkbox checked={!!product.published} disabled={busy || disabled} onChange={e => publish(e.target.checked, product)} /><span className="sr-only">Publish online</span><span className="sr-only" data-no-localize>{product.name}</span></label>
    </article>)}
    <EndlessListFooter list={list} count={list.items.length} noun="products" />
  </section>;
}
