import React, { useEffect, useState } from 'react';
import { Building2, ExternalLink, MapPin, RotateCcw } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import { OfficeTablePagination } from './OfficeTable';
import { FilterDrawer } from './FilterDrawer';
import { ShopDistributionMap } from './ShopDistributionMap';
import { useRetainedActivity } from './retainedActivity';
import './shop-distribution.css';

const defaultFilters = { location: 'all', shop: 'all', marketplace: 'all', orders: 'all', access: 'all' };
const accessLabels = { paid: 'Active paid plan', trial: 'Free trial', expired: 'Expired plan', cancelled: 'Cancelled plan', scheduled: 'Plan not started', none: 'No plan' };
const filterFields = [
  ['location', 'Saved location', [['all', 'All shops'], ['located', 'With location'], ['missing', 'Without location']]],
  ['shop', 'Shop status', [['all', 'All shop statuses'], ['enabled', 'Enabled'], ['disabled', 'Disabled']]],
  ['marketplace', 'Marketplace status', [['all', 'All marketplace statuses'], ['enabled', 'Enabled'], ['disabled', 'Disabled'], ['suspended', 'Suspended']]],
  ['orders', 'Order acceptance', [['all', 'All order statuses'], ['open', 'Open for orders'], ['closed', 'Closed for orders']]],
  ['access', 'Paid status', [['all', 'All plans'], ['paid', 'Active paid plan'], ['unpaid', 'No active paid plan'], ['trial', 'Free trial'], ['expired', 'Expired'], ['cancelled', 'Cancelled'], ['scheduled', 'Not started'], ['none', 'No plan']]],
];

function DistributionFilters({ value, onApply, onClear }) {
  const [draft, setDraft] = useState(value);
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div className="office-drawer-filter-fields">{filterFields.map(([key, label, options]) => <label key={key}>{label}<select value={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
      <small>Open for orders requires an enabled shop, accepting orders, and no temporary closure. Paid status follows the current plan.</small>
    </div>
    <div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button type="submit" className="office-button-primary">Apply filters</button></div>
  </form>;
}

function ShopStatus({ shop }) {
  return <div className="office-distribution-statuses">
    {shop.shop_enabled != null && <span>Shop {shop.shop_enabled ? 'enabled' : 'disabled'}</span>}
    {shop.marketplace_status && <span>Marketplace {shop.marketplace_status}</span>}
    {shop.orders_open != null && <span>Orders {shop.orders_open ? 'open' : 'closed'}</span>}
    {shop.access_state && <span>{accessLabels[shop.access_state] || shop.access_state}</span>}
  </div>;
}

export default function ShopDistributionPage({ refreshToken, onOpenBusiness }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [filters, setFilters] = useState(defaultFilters);
  const { location, shop, marketplace, orders, access } = filters;
  const [page, setPage] = useState(1), [perPage, setPerPage] = useState(25), [filterOpen, setFilterOpen] = useState(false);
  const [data, setData] = useState(null), [selected, setSelected] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const active = useRetainedActivity();
  useEffect(() => {
    const reload = () => setRetry(value => value + 1);
    window.addEventListener('mkpos:office-storefront-changed', reload);
    return () => window.removeEventListener('mkpos:office-storefront-changed', reload);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ q: query, location, page, per_page: perPage, shop, marketplace, orders, access });
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true); setError('');
      return api(`/office/shop-distribution?${params}`);
    }).then(result => {
      if (cancelled || !result) return;
      setData({ ...result, filterKey: JSON.stringify([query, location, shop, marketplace, orders, access]) });
      setSelected(current => {
        if (!current) return null;
        const updated = [...result.points, ...result.items].find(shop => shop.id === current.id);
        return updated?.latitude != null ? updated : null;
      });
      if (result.page !== page) setPage(result.page);
    }).catch(reason => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, location, shop, marketplace, orders, access, page, perPage, refreshToken, retry]);
  useEffect(() => { if (!active) queueMicrotask(() => setFilterOpen(false)); }, [active]);
  function applySearch() { setQuery(search.trim()); setPage(1); setSelected(null); }
  function clearSearch() { setSearch(''); setQuery(''); setPage(1); setSelected(null); }
  function applyFilters(value) { setFilters(value); setPage(1); setSelected(null); setFilterOpen(false); }
  const summary = data?.summary;
  return <div className="office-distribution-page">
    <OfficePageToolbar searchLabel="Search shops" placeholder="Shop, business, address or phone" search={search} onSearchChange={setSearch} onSearch={applySearch} onClearSearch={clearSearch}
      onFilterOpen={() => setFilterOpen(true)} filterOpen={filterOpen} filterCount={Object.values(filters).filter(value => value !== 'all').length} />
    <div className="office-distribution-summary" aria-label="Shop location coverage">
      <div><small>Matching businesses</small><strong>{summary?.total ?? '—'}</strong></div><div><small>With saved location</small><strong>{summary?.located ?? '—'}</strong></div><div><small>Without saved location</small><strong>{summary?.missing ?? '—'}</strong></div>
    </div>
    {error && <div className="office-distribution-error" role="alert"><span>{error}{data && ' Previous results are shown.'}</span><button className="office-button" type="button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={15} aria-hidden="true" />Retry</button></div>}
    {loading && <p role="status">Loading shop locations…</p>}
    {data && <>
      {data.map_total > data.points.length && <p role="status">Showing the first {data.points.length} of {data.map_total} map locations. Search to narrow the map; every shop is available in the list.</p>}
      <div className="office-distribution-layout" aria-busy={loading}>
        <div><ShopDistributionMap points={data.points} selected={selected} onSelect={setSelected} filterKey={data.filterKey} />
          {!data.points.length && <p className="office-distribution-caption">No saved locations match these filters.</p>}
          {selected && <section className="office-distribution-selected" aria-label="Selected shop"><div><strong>{selected.display_name || selected.business_name}</strong><p>{selected.address || 'No address saved'}</p><small>{selected.latitude?.toFixed(6)}, {selected.longitude?.toFixed(6)}{selected.accuracy != null ? ` · GPS accuracy ${Number(selected.accuracy).toLocaleString()} m` : ''}</small><ShopStatus shop={selected} /></div>
            <button className="office-button office-button-primary" type="button" onClick={() => onOpenBusiness(selected.id)}><Building2 size={15} aria-hidden="true" />View business</button><a className="office-button" href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />Google Maps</a></section>}
        </div>
        <section className="office-panel office-distribution-shops" aria-label="Shops"><div className="office-panel-header"><h2>Shops</h2><span>{data.total} matching</span></div>
          {!data.items.length ? <p className="office-distribution-caption">No shops match these filters.</p> : <ul>{data.items.map(shop => <li key={shop.id} className={selected?.id === shop.id ? 'is-selected' : undefined}>
            <strong>{shop.display_name || shop.business_name}</strong>{shop.display_name && <small>{shop.business_name}</small>}<span>{shop.address || 'No address saved'}</span>{shop.phone && <small>{shop.phone}</small>}
            <ShopStatus shop={shop} />
            <div><span className="office-distribution-location"><MapPin size={13} />{shop.latitude == null ? 'No saved location' : 'Location saved'}</span><small>{shop.status}</small></div>
            <div className="office-distribution-shop-actions">{shop.latitude != null && <button className="office-button" type="button" disabled={loading} onClick={() => setSelected(shop)}><MapPin size={15} aria-hidden="true" />Show on map</button>}<button className="office-button" type="button" disabled={loading} onClick={() => onOpenBusiness(shop.id)}><Building2 size={15} aria-hidden="true" />View business</button></div>
          </li>)}</ul>}
          <OfficeTablePagination label="Shops" total={data.total} page={data.page} perPage={perPage} lastPage={data.last_page} onPageChange={setPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} disabled={loading} />
        </section>
      </div>
    </>}
    <FilterDrawer open={filterOpen && active} title="Shop distribution filters" onClose={() => setFilterOpen(false)}><DistributionFilters key={String(filterOpen)} value={filters} onApply={applyFilters} onClear={() => applyFilters(defaultFilters)} /></FilterDrawer>
  </div>;
}
