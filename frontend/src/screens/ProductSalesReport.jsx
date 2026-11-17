import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, CalendarRange, CircleDollarSign, Filter, Gift, Package, Search } from 'lucide-react';
import { request } from '../api';
import { EmptyState, Field, FilterDrawer, TableLoadingState, TablePagination, TableSkeletonRows } from '../components/common';
import { AppBarActions, AppBarSearch } from '../components/WorkspaceHeader';
import { useDataRefresh } from '../dataEvents';
import { presetDateRange } from '../dateRanges';
import { formatQuantity, money } from '../utils';
import { productSalesError, productSalesFilters, productSalesPath, productSalesSorts } from '../../../shared/reports/productSales';

export function ProductSalesReport({ period, currency = 'Ks' }) {
  const [filters, setFilters] = useState(() => productSalesFilters(period));
  const [draft, setDraft] = useState(filters);
  const [search, setSearch] = useState(filters.q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const result = await request(productSalesPath(filters, 25, (page - 1) * 25));
      if (current !== generation.current) return;
      const last = Math.max(1, Math.ceil(result.total / 25));
      if (page > last) setPage(last);
      else setData(result);
    } catch (err) { if (current === generation.current) setError(err.message); }
    finally { if (current === generation.current) setLoading(false); }
  }, [filters, page]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  useDataRefresh(['reports', 'sales', 'products'], 'reports', load);
  const apply = event => {
    event.preventDefault();
    const next = { ...draft, q: filters.q };
    const invalid = productSalesError(next);
    if (invalid) { setFilterError(invalid); return; }
    setFilterError(''); setPage(1); setFilters(next); setFilterOpen(false);
  };
  const applySearch = event => {
    event.preventDefault();
    const q = search.trim();
    setPage(1);
    setFilters(current => current.q === q ? current : { ...current, q });
  };
  const rows = data?.items || [];
  return <section className="screen product-sales-page" aria-label="Product sales report">
    <AppBarSearch>
      <form role="search" onSubmit={applySearch}>
        <label><Search size={16} aria-hidden="true" /><input type="search" value={search} maxLength={150} onChange={event => {
          const value = event.target.value;
          setSearch(value);
          if (!value) {
            setPage(1);
            setFilters(current => current.q ? { ...current, q: '' } : current);
          }
        }} placeholder="Name, SKU or barcode" aria-label="Search products" title="Search products by name, SKU or barcode. Press Enter to search." /></label>
      </form>
    </AppBarSearch>
    <AppBarActions>
      <button type="button" className="workspace-icon-button filter-drawer-trigger" aria-label="Filters" title="Filters" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => { setDraft({ ...filters }); setFilterError(''); setFilterOpen(true); }}><Filter size={17} aria-hidden="true" /></button>
    </AppBarActions>
    
    <FilterDrawer open={filterOpen} title="Product sales filters" onClose={() => setFilterOpen(false)} busy={loading} className="product-sales-filter-drawer">
    <form className="drawer-filter-form report-drawer-filter" aria-label="Product sales filters" onSubmit={apply}>
        <div className="purchase-quick-ranges" role="group" aria-label="Date range">
          {[
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['year', 'This Year'],
            ['all', 'All Time'],
          ].map(([preset, label]) => (
            <button key={preset} type="button" className={draft.preset === preset ? 'selected' : ''} aria-pressed={draft.preset === preset} onClick={() => {
              setDraft({ ...draft, preset, ...presetDateRange(preset) });
              setFilterError('');
            }}>{label}</button>
          ))}
        </div>
        <Field label="From"><input type="date" value={draft.start} onChange={e => { setDraft({ ...draft, preset: 'custom', start: e.target.value }); setFilterError(''); }} /></Field>
        <Field label="To"><input type="date" value={draft.end} onChange={e => { setDraft({ ...draft, preset: 'custom', end: e.target.value }); setFilterError(''); }} /></Field>
        <Field label="Category"><select aria-label="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}><option value="">All categories</option><option value="__uncategorized__">Uncategorized</option>{(data?.categories || []).map(category => <option key={category} value={category}>{category}</option>)}</select></Field>
        <Field label="Sort by"><select aria-label="Sort by" value={draft.sort} onChange={e => setDraft({ ...draft, sort: e.target.value })}>{productSalesSorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {filterError && <p role="alert" className="product-sales-error">{filterError}</p>}
      <div className="drawer-filter-actions">
        <button type="button" disabled={loading} onClick={() => { const next = { ...productSalesFilters(period), q: filters.q }; setDraft(next); setFilters(next); setPage(1); setError(''); setFilterError(''); setFilterOpen(false); }}>Reset</button>
        <button type="submit" className="primary" disabled={loading}>Apply filters</button>
      </div>
    </form>
    </FilterDrawer>
    {error && <div role="alert" className="product-sales-error">{error} <button type="button" disabled={loading} onClick={load}>Retry report</button></div>}
    {data && <div className="product-sales-summary">
      <div className="product-stat-row" aria-label="Product sales statistics">
        <article className="product-stat-card">
          <span className="product-stat-icon"><Package size={20} aria-hidden="true" /></span>
          <div><span>Products</span><strong>{data.summary.product_count}</strong></div>
        </article>
        <article className="product-stat-card">
          <span className="product-stat-icon"><Boxes size={20} aria-hidden="true" /></span>
          <div><span>Units sold</span><strong>{formatQuantity(data.summary.quantity)}</strong></div>
        </article>
        <article className="product-stat-card">
          <span className="product-stat-icon"><Gift size={20} aria-hidden="true" /></span>
          <div><span>Free units</span><strong>{formatQuantity(data.summary.foc_quantity)}</strong></div>
        </article>
        <article className="product-stat-card">
          <span className="product-stat-icon"><CircleDollarSign size={20} aria-hidden="true" /></span>
          <div><span>Sales amount</span><strong>{money(data.summary.total, currency)}</strong></div>
        </article>
      </div>
      <p className="product-sales-period"><CalendarRange size={15} aria-hidden="true" /><span>{data.all_time ? 'All time' : `${data.start} ? ${data.end}`}</span></p>
    </div>}
    <div className="product-sales-results"><div className="product-sales-table-wrap">
      <table className="product-sales-table" aria-busy={loading}><colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Sale count</th><th>Units sold</th><th>Free units</th><th>Sales amount</th></tr></thead><tbody>
        {loading && !data ? <TableSkeletonRows columns={7} /> : rows.map(row => <tr key={row.id}><td><strong>{row.product_name}</strong></td><td>{row.sku || '—'}</td><td>{row.category || 'Uncategorized'}</td><td>{row.sale_count}</td><td>{formatQuantity(row.quantity)}</td><td>{formatQuantity(row.foc_quantity)}</td><td><strong>{money(row.total, currency)}</strong></td></tr>)}
      </tbody></table>
    </div>{loading && <TableLoadingState refreshing={Boolean(data)}>Loading product sales…</TableLoadingState>}{!loading && !error && !rows.length && <EmptyState>No product sales match these filters.</EmptyState>}
      <TablePagination page={page} pageSize={25} total={data?.total || 0} loading={loading} onPageChange={setPage} />
    </div>
    <p className="product-sales-note">Completed receipts only. Amounts are product line totals before receipt-level discounts, matching Top Products. Quantities use base units.</p>
  </section>;
}
