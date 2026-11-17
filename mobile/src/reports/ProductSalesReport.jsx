import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { Button, Field, IconButton, Input, SearchInput, Select } from '../components/Controls';
import { EndlessListFooter, MobileFilterPanel, MobileFilterToggle, MobileNotice } from '../components/MobilePrimitives';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { usePageRefresh } from '../navigation/pageRefresh';
import { useEndlessList } from '../hooks/useEndlessList';
import { apiRequest } from '../api/client';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_MESSAGES } from '../localization/remainingPagesLocale';
import { PRODUCT_SALES_MESSAGES } from '../../../shared/localization/productSales';
import { productSalesError, productSalesFilters, productSalesPath, productSalesSorts } from '../../../shared/reports/productSales';
import { DateRangeChoices } from '../components/DateRangeChoices';
import { formatQuantity, money } from '../products/productUtils';
import { blankReportFilters, reportPreset } from './reportUtils';
import { REPORT_MESSAGES } from './reportsLocale';

const messages = { ...REMAINING_PAGE_MESSAGES, ...REPORT_MESSAGES, ...PRODUCT_SALES_MESSAGES };
export function ProductSalesReport(props) {
  return <ModuleLocalizationBoundary messages={messages}><ProductSalesContent {...props} /></ModuleLocalizationBoundary>;
}
function ProductSalesContent({ session, onBack }) {
  const [initial] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return productSalesFilters({ ...blankReportFilters(), ...Object.fromEntries(['preset', 'start', 'end'].filter(key => query.has(key)).map(key => [key, query.get(key)])) });
  });
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [search, setSearch] = useState(initial.q);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = search.trim();
      setFilters(current => current.q === q ? current : { ...current, q });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [open, setOpen] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [meta, setMeta] = useState(null);
  const loadPage = useCallback(async ({ limit, offset, signal }) => {
    const result = await apiRequest(productSalesPath(filters, limit, offset), { signal });
    if (!signal.aborted && offset === 0) setMeta(result);
    return result;
  }, [filters]);
  const list = useEndlessList({ loadPage, queryKey: JSON.stringify(filters), pageSize: 20 });
  usePageRefresh(list.reload);
  const currency = session?.business?.currency || 'Ks';
  const apply = event => {
    event.preventDefault();
    const next = { ...draft, q: filters.q };
    const invalid = productSalesError(next);
    if (invalid) { setFilterError(invalid); return; }
    setFilters(next); setFilterError(''); setOpen(false);
  };
  return <main className="report-page report-reference-page sale-retail-page product-sales-mobile">
    <PageAppBar className="retail-sale-header report-reference-header"><IconButton variant="ghost" aria-label="Back to Reports" type="button" onClick={onBack}><ArrowLeft size={22} /></IconButton><h1>Product sales</h1><AppBarMenu /></PageAppBar>
    <p className="report-help">Sale count is the number of completed receipts containing each product. Paid units and free units are shown separately.</p>
    <div className="mobile-control-row report-filter-toolbar product-sales-mobile-toolbar">
      <SearchInput className="mobile-search" aria-label="Search products" value={search} maxLength={150} placeholder="Name, SKU or barcode" onChange={event => setSearch(event.target.value)} onClear={() => {
        setSearch('');
        setFilters(current => current.q ? { ...current, q: '' } : current);
      }} />
      <MobileFilterToggle open={open} count={[filters.category, filters.sort !== 'amount_desc', filters.start !== initial.start || filters.end !== initial.end || filters.preset !== initial.preset].filter(Boolean).length} onToggle={() => { setDraft({ ...filters }); setFilterError(''); setOpen(value => !value); }} controls="product-sales-filters" />
    </div>
    <MobileFilterPanel open={open} id="product-sales-filters" onClose={() => setOpen(false)} onSubmit={apply}>
      <DateRangeChoices value={draft.preset} options={['today', 'week', 'month', 'last-month', 'year', 'all', 'custom'].map((value, i) => ({ value, label: ['Today', 'This week', 'This month', 'Last month', 'This year', 'All time', 'Custom'][i] }))} onChange={preset => setDraft({ ...draft, ...(preset === 'custom' ? { preset } : reportPreset(preset)) })} />
      <div className="report-filter-dates"><Field label="From"><Input type="date" value={draft.start} disabled={draft.preset === 'all'} onChange={e => { setDraft({ ...draft, preset: 'custom', start: e.target.value }); setFilterError(''); }} /></Field><Field label="To"><Input type="date" value={draft.end} disabled={draft.preset === 'all'} onChange={e => { setDraft({ ...draft, preset: 'custom', end: e.target.value }); setFilterError(''); }} /></Field></div>
      <Field label="Category"><Select aria-label="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}><option value="">All categories</option><option value="__uncategorized__">Uncategorized</option>{(meta?.categories || []).map(category => <option key={category} value={category}>{category}</option>)}</Select></Field>
      <Field label="Sort by"><Select aria-label="Sort by" value={draft.sort} onChange={e => setDraft({ ...draft, sort: e.target.value })}>{productSalesSorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      {filterError && <p role="alert" className="mobile-field-error">{filterError}</p>}
      <div className="report-filter-actions"><Button type="button" variant="secondary" onClick={() => { const next = { ...initial, q: filters.q }; setDraft(next); setFilters(next); setFilterError(''); setOpen(false); }}>Reset</Button><Button type="submit" disabled={list.initialLoading || list.loadingMore}>Apply filters</Button></div>
    </MobileFilterPanel>
    {meta && !list.initialLoading && <section className="report-mobile-grid" aria-label="Product sales summary"><div className="report-mobile-metric"><small>Products</small><strong>{meta.summary.product_count}</strong></div><div className="report-mobile-metric"><small>Sales amount</small><strong data-no-localize>{money(meta.summary.total, currency)}</strong></div><div className="report-mobile-metric"><small>Units sold</small><strong data-no-localize>{formatQuantity(meta.summary.quantity)}</strong></div><div className="report-mobile-metric"><small>Free units</small><strong data-no-localize>{formatQuantity(meta.summary.foc_quantity)}</strong></div></section>}
    {meta && !list.initialLoading && <p className="report-help" data-no-localize>{meta.all_time ? 'All time' : `${meta.start} — ${meta.end}`}</p>}
    {list.initialLoading && !list.items.length && <div className="report-loading" role="status"><RefreshCw size={20} className="spin" /><span>Loading product sales…</span><div className="report-skeleton" aria-hidden="true" /></div>}
    {list.error && !list.items.length && <><MobileNotice notice={{ type: 'error', text: list.error }} /><Button type="button" onClick={list.retry}>Retry report</Button></>}
    {!list.initialLoading && !list.error && !list.items.length && <div className="mobile-inline-empty"><Package size={30} /><p>No product sales match these filters.</p></div>}
    <section className="product-sales-mobile-list" aria-label="Product sales results" aria-busy={list.initialLoading || list.loadingMore}>{list.items.map(row => <article className="report-section product-sales-mobile-row" key={row.id}><header><strong data-no-localize>{row.product_name}</strong><span data-no-localize>{money(row.total, currency)}</span></header><small data-no-localize>{row.sku || '—'} · {row.category || '—'}</small><dl><div><dt>Sale count</dt><dd data-no-localize>{row.sale_count}</dd></div><div><dt>Units sold</dt><dd data-no-localize>{formatQuantity(row.quantity)}</dd></div><div><dt>Free units</dt><dd data-no-localize>{formatQuantity(row.foc_quantity)}</dd></div></dl></article>)}</section>
    <EndlessListFooter list={list} count={list.items.length} noun="products" />
    <p className="report-help">Completed receipts only. Amounts are product line totals before receipt-level discounts, matching Top Products. Quantities use base units.</p>
  </main>;
}
