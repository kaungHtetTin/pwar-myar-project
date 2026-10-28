import { MobileFilterResetButton } from '../components/MobilePrimitives';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, Field, IconButton, Input } from '../components/Controls';
import { DateRangeChoices } from '../components/DateRangeChoices';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, BarChart3, CalendarDays, ChevronDown, CircleAlert, CircleDollarSign, Coins, CreditCard, Gift, Info, Package, RefreshCw, ShoppingBasket, Store, TrendingDown, TrendingUp, UsersRound } from 'lucide-react';
import { apiDownload, apiRequest } from '../api/client';
import { saveCsvFile } from '../utils/csvExport';
import { MobileFilterPanel, MobileFilterToggle, MobileNotice } from '../components/MobilePrimitives';
import { ModuleLocalizationBoundary } from '../localization/ModuleLocalizationBoundary';
import { REMAINING_PAGE_MESSAGES, REMAINING_PAGE_PATTERNS } from '../localization/remainingPagesLocale';

import { usePageRefresh } from '../navigation/pageRefresh';
import { formatQuantity, money } from '../products/productUtils';
import { blankReportFilters, grossMargin, reportPath, reportPeriodLabel, reportPreset } from './reportUtils';
import { REPORT_MESSAGES } from './reportsLocale';

const messages = { ...REMAINING_PAGE_MESSAGES, ...REPORT_MESSAGES };

function ReportMetric({ label, value }) {
  return <div className="report-mobile-metric"><small>{label}</small><strong data-no-localize>{value}</strong></div>;
}
function ReportHeading({ icon: Icon, title, subtitle }) {
  return <header className="report-mobile-heading"><Icon size={21} aria-hidden="true" /><div><h2>{title}</h2>{subtitle && <small>{subtitle}</small>}</div></header>;
}
function ReportValue({ label, value, highlight = false }) {
  return <div className={`report-value-row${highlight ? ' is-highlight' : ''}`}><span>{label}</span><strong data-no-localize>{value}</strong></div>;
}
function RankList({ rows, type, currency }) {
  if (!rows.length) return <p className="mobile-inline-empty">No data for this period.</p>;
  return <div className={`report-mobile-ranks is-${type}`}>{rows.map((row, index) => <article key={`${row.product_name || row.category || row.payment_method}-${index}`}>
    <span className="report-rank-number" aria-hidden="true">{type === 'expenses' ? <i style={{ '--rank-color': ['var(--theme-chart-1)', 'var(--theme-chart-2)', 'var(--theme-chart-3)', 'var(--theme-chart-4)', 'var(--theme-chart-5)'][index % 5] }} /> : type === 'payments' ? <CreditCard size={18} /> : index + 1}</span>
    <div><strong data-no-localize>{row.product_name || row.category || row.payment_method || 'Other'}</strong><small>{type === 'products' ? <>Sold <span data-no-localize>{formatQuantity(row.quantity)}</span>{Number(row.foc_quantity || 0) ? <> + FOC <span data-no-localize>{formatQuantity(row.foc_quantity)}</span></> : null}</> : <><span data-no-localize>{row.count || 0}</span> records</>}</small>{type === 'payments' && <small>Sales total <span data-no-localize>{money(row.total,currency)}</span></small>}</div>
    <b data-no-localize>{money(type === 'payments' ? row.paid_total ?? row.total : row.total, currency)}</b>
  </article>)}</div>;
}
function SalesBarChart({ title, period, items = [], currency }) {
  const rows = items.map(item => ({ label: String(item.label ?? ''), total: Number(item.total || 0) }));
  const maximum = Math.max(...rows.map(item => item.total), 1);
  return <div className="report-trend-chart"><h3>{period}</h3>
    {!rows.some(item => item.total) && <p className="mobile-inline-empty">No data for this period.</p>}
    <div className={`report-sales-bars${rows.length > 12 ? ' is-daily' : ''}`} role="list" aria-label={`${title}${period ? ` for ${period}` : ''}`}>
      {rows.map((item, index) => <div className="report-sales-bar-column" role="listitem" aria-label={`${item.label}: ${money(item.total, currency)}`} key={`${item.label}-${index}`}>
        <span className="report-sales-bar-value" data-no-localize>{item.total > 0 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(item.total) : ''}</span><span className="report-sales-bar-track"><i style={{ height: `${item.total > 0 ? Math.max(3, item.total / maximum * 100) : 0}%` }} /></span><small data-no-localize>{item.label}</small>
      </div>)}
    </div><p className="report-help">Scroll the chart to view every period.</p>{rows.length > 0 && <details className="report-chart-values"><summary>View chart values</summary><table><thead><tr><th scope="col">Period</th><th scope="col">Sales</th></tr></thead><tbody>{rows.map((item,index) => <tr key={`${item.label}-${index}`}><th scope="row" data-no-localize>{item.label}</th><td data-no-localize>{money(item.total,currency)}</td></tr>)}</tbody></table></details>}</div>;
}
function ReportDateField({ label, value, onChange }) {
  return <Field label={label}><Input type="date" value={value} onChange={onChange} onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard entry remains available. */ } }} /></Field>;
}
export function ReportsScreen(props) {
  return <ModuleLocalizationBoundary messages={messages} patterns={REMAINING_PAGE_PATTERNS}><ReportsScreenContent {...props} /></ModuleLocalizationBoundary>;
}
function ReportsScreenContent({ session }) {
  
  const currency = session?.business?.currency || 'Ks';
  const [filters, setFilters] = useState(() => blankReportFilters());
  const [draft, setDraft] = useState(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [trend, setTrend] = useState('month');
  const generation = useRef(0), exportBusy = useRef(false);
  const loadReport = useCallback(async (next = filters) => {
    const requestGeneration = ++generation.current;
    setLoading(true); setLoadError('');
    try {
      const data = await apiRequest(reportPath('/reports/summary', next));
      if (requestGeneration === generation.current) { setSummary(data); setFilters(next); setUpdatedAt(new Date()); }
      return true;
    } catch (error) {
      if (requestGeneration === generation.current) setLoadError(error.message || 'Cannot load report.');
      return false;
    } finally { if (requestGeneration === generation.current) setLoading(false); }
  }, [filters]);
  useEffect(() => { loadReport(); return () => { generation.current += 1; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  usePageRefresh(loadReport);
  const margin = useMemo(() => grossMargin(summary), [summary]);
  const period = reportPeriodLabel(summary ? { preset: summary.all_time ? 'all' : 'custom', start: summary.start, end: summary.end } : filters);
  const accounts = summary?.current_accounts || {}, inventory = summary?.inventory_valuation || {}, movement = summary?.cash_movement || {};
  const paid = Number(summary?.cash_total || 0), credit = Number(summary?.credit_total || 0);
  const paidPercent = paid + credit > 0 ? Math.round(paid / (paid + credit) * 1000) / 10 : 0;
  const costOfGoods = Number(summary?.sales_total || 0) - Number(summary?.profit_estimate || 0) - Number(summary?.expense_total || 0);
  const moneyValue = value => money(value, currency);
  const payments = (summary?.payment_methods || []).filter(row => Number(row.total || 0) || Number(row.paid_total || 0) || Number(row.credit_total || 0));
  function openFilters() { setDraft({ ...filters }); setFilterError(''); setFiltersOpen(true); }
  async function applyFilters(event) {
    event.preventDefault();
    if (draft.preset !== 'all' && (!draft.start || !draft.end)) { setFilterError('Choose both From and To dates.'); return; }
    if (draft.start && draft.end && draft.start > draft.end) { setFilterError('From date cannot be later than To date.'); return; }
    // The displayed period belongs to the last successful report, including after failed filter requests.
    if (await loadReport(draft)) setFiltersOpen(false);
    else setFilterError('Cannot apply filters. Try again.');
  }
  async function downloadCsv() {
    if (exportBusy.current || loading || !summary) return;
    exportBusy.current = true; setExporting(true); setNotice(null);
    try {
      const response = await apiDownload(reportPath('/reports/summary.csv', filters), { accept: 'text/csv' });
      await saveCsvFile(`mkpos-report-${new Date().toISOString().slice(0, 10)}.csv`, await response.text());
      setNotice({ type: 'success', text: 'Report CSV is ready to save or share.' });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { exportBusy.current = false; setExporting(false); }
  }
  return <main className="report-page report-reference-page sale-retail-page">
    <PageAppBar className="retail-sale-header report-reference-header"><h1>Reports</h1><IconButton variant="ghost" className="app-bar-export" title="Export CSV" busy={exporting} type="button" onClick={downloadCsv} disabled={loading || exporting || !summary} aria-label="Export CSV">{exporting ? <RefreshCw className="spin" size={18} /> : <ArrowDownToLine size={18} />}</IconButton><AppBarMenu /></PageAppBar>
    <MobileNotice notice={notice} onClose={() => setNotice(null)} />
    <section className="report-filter-controls" aria-label="Report controls"><span id="report-period-label" className="report-period-label">Report period</span><div className="mobile-control-row report-filter-toolbar">
      <Button variant="secondary" type="button" className="report-period-button" aria-labelledby="report-period-label report-period-value" aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="report-period-filters" onClick={openFilters}><CalendarDays size={19} aria-hidden="true" /><span id="report-period-value" data-no-localize={period !== 'All time' ? true : undefined}>{period}</span><ChevronDown size={16} aria-hidden="true" /></Button>
      <MobileFilterToggle open={filtersOpen} onToggle={() => filtersOpen ? setFiltersOpen(false) : openFilters()} controls="report-period-filters" />
      
    </div></section>
    <MobileFilterPanel onClose={() => setFiltersOpen(false)} open={filtersOpen} id="report-period-filters" className="report-filter-panel" onSubmit={applyFilters}>
      <DateRangeChoices value={draft.preset} options={[
        ['all', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'],
        ['last-month', 'Last month'], ['year', 'This year'], ['custom', 'Custom'],
      ].map(([value, label]) => ({ value, label, ...(!['all', 'custom'].includes(value) ? reportPreset(value) : {}) }))}
        onChange={preset => { setFilterError(''); setDraft(preset === 'custom' ? current => ({ ...current, preset }) : reportPreset(preset)); }} />
      <div className="report-filter-dates"><ReportDateField label="From" value={draft.start} onChange={event => { setDraft({ ...draft, preset: 'custom', start: event.target.value }); setFilterError(''); }} /><ReportDateField label="To" value={draft.end} onChange={event => { setDraft({ ...draft, preset: 'custom', end: event.target.value }); setFilterError(''); }} /></div>
      {filterError && <p className="mobile-field-error" role="alert">{filterError}</p>}
      <div className="report-currency-field"><span>Currency</span><div><span data-no-localize>{currency}</span><small>Shop currency</small></div></div>
      <aside className="report-filter-help"><Info size={19} aria-hidden="true" /><div><strong>These filters apply to period activity only.</strong><p>Sales, expenses, cash movement and profit use the selected date range. Inventory valuation and outstanding balances are current snapshots. Monthly and yearly charts use the selected end date.</p></div></aside>
      <div className="product-filter-actions"><MobileFilterResetButton variant="secondary" type="button" onClick={() => { const next = blankReportFilters(); setDraft(next); setFilterError(''); setFiltersOpen(false); void loadReport(next); }} disabled={loading}>Reset</MobileFilterResetButton><Button variant="primary" className="mobile-primary" type="submit" disabled={loading}>{loading ? <RefreshCw className="spin" size={17} /> : null}Apply filters</Button></div>
    </MobileFilterPanel>
    {loadError && !filtersOpen && <section className="report-refresh-error" role="alert"><CircleAlert size={22} aria-hidden="true" /><div><strong>{summary ? 'Could not refresh.' : 'Could not load report.'}</strong><small>{summary && updatedAt ? <>Showing last update <span data-no-localize>{updatedAt.toLocaleString()}</span>.</> : loadError}</small></div><Button variant="plain" type="button" onClick={() => loadReport()} disabled={loading}>Retry</Button></section>}
    {loading && !summary ? <div className="report-loading" role="status"><RefreshCw size={23} className="spin" /><span>Loading report…</span><div className="report-skeleton" aria-hidden="true" /></div> : summary ? <div className="report-content" aria-busy={loading}>
      {loading && <p className="report-refresh-status" role="status">Updating report…</p>}
      <section className={`report-profit${Number(summary.profit_estimate) < 0 ? ' is-negative' : ''}`}><div><small>Net profit estimate <Info size={12} aria-hidden="true" /></small><strong data-no-localize>{moneyValue(summary.profit_estimate)}</strong><p>{Number(summary.profit_estimate) < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}<span data-no-localize>{summary.sales_count || 0}</span> receipts <span aria-hidden="true">·</span> <span data-no-localize>{margin}%</span> net margin</p></div><BarChart3 className="report-profit-art" size={43} aria-hidden="true" /></section>
      <section className="report-mobile-grid" aria-label="Period metrics"><ReportMetric label="Sales" value={moneyValue(summary.sales_total)} /><ReportMetric label="Paid during sales" value={moneyValue(summary.cash_total)} /><ReportMetric label="Credit sales" value={moneyValue(summary.credit_total)} /><ReportMetric label="Cost of goods" value={moneyValue(costOfGoods)} /><ReportMetric label="Expenses" value={moneyValue(summary.expense_total)} /><ReportMetric label="Net profit estimate" value={moneyValue(summary.profit_estimate)} /></section>
      <nav className="report-section-links" aria-label="Report sections">{[['report-cash', 'Cash movement'], ['report-inventory', 'Inventory & accounts'], ['report-trends', 'Sales trend'], ['report-breakdowns', 'Breakdowns']].map(([id, label]) => <Button variant="plain" type="button" key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{label}</Button>)}</nav>
      <section id="report-cash" className="report-section"><ReportHeading icon={Coins} title="Cash movement" subtitle={period} /><ReportValue label="Sales received" value={moneyValue(movement.sales_received)} /><ReportValue label="Customer debt collected" value={moneyValue(movement.debt_collected)} /><ReportValue label="Supplier refunds" value={moneyValue(movement.supplier_refunds)} /><ReportValue label="Shop payouts" value={moneyValue(movement.shop_payouts)} /><ReportValue label="Paid during purchases" value={moneyValue(movement.purchase_payments)} /><ReportValue label="Supplier payments" value={moneyValue(movement.supplier_payments)} /><ReportValue label="Expenses" value={moneyValue(movement.expenses)} /><ReportValue label="Net movement" value={moneyValue(movement.net_movement)} highlight /><p className="report-help">Inflows minus outflows for this period. Opening cash is not included.</p><ReportValue label="Expected drawer" value={moneyValue(movement.expected_cash_drawer)} /></section>
      <section className="report-section"><ReportHeading icon={Gift} title="FOC summary" subtitle={period} /><ReportValue label="FOC issued" value={`${formatQuantity(summary.foc_quantity)} · ${moneyValue(summary.foc_cost)}`} /><ReportValue label="FOC received" value={`${formatQuantity(summary.purchase_foc_quantity)} · ${moneyValue(summary.purchase_foc_value)}`} /></section>
      <section id="report-inventory" className="report-current-section"><p className="report-scope-label">Current balances <span data-no-localize>· {inventory.as_of || accounts.as_of || ''}</span></p><div className="report-section"><ReportHeading icon={Package} title="Current inventory value" /><strong className="report-inventory-total" data-no-localize>{moneyValue(inventory.investment_value)}</strong><span className="report-inventory-investment-label">Current stock investment</span><p className="report-help"><span data-no-localize>{inventory.product_count || 0}</span> products <span aria-hidden="true">·</span> <span data-no-localize>{formatQuantity(inventory.stock_units)}</span> units in stock</p><ReportValue label="Potential sales value" value={moneyValue(inventory.potential_sales_value)} /><p className="report-help">Uses positive stock, current unit costs and current primary selling prices.</p></div>
        <section className="report-section report-accounts"><ReportHeading icon={UsersRound} title="Current accounts" subtitle={`As of ${accounts.as_of || ''}`} /><ReportValue label="Customer owes shop" value={moneyValue(accounts.receivable_total)} /><ReportValue label="Shop owes suppliers" value={moneyValue(accounts.supplier_payable_total)} /><ReportValue label="Shop owes customers" value={moneyValue(accounts.customer_payable_total ?? accounts.payable_total)} /><ReportValue label="Supplier credit" value={moneyValue(accounts.supplier_credit_total)} /><div className="report-account-counts"><span>Customers owing <strong data-no-localize>{accounts.customers_owing || 0}</strong></span><span>Open accounts <strong data-no-localize>{accounts.open_accounts || 0}</strong></span></div></section>
      </section>
      <section id="report-trends" className="report-section report-sales-chart-mobile"><ReportHeading icon={BarChart3} title="Sales trend" /><div className="report-trend-tabs" role="group" aria-label="Sales trend period"><Button variant="plain" type="button" aria-pressed={trend === 'month'} onClick={() => setTrend('month')}>Monthly</Button><Button variant="plain" type="button" aria-pressed={trend === 'year'} onClick={() => setTrend('year')}>Yearly</Button></div><SalesBarChart title={trend === 'month' ? 'Sales of Month' : 'Sales of Year'} period={summary.sales_trends?.[trend]?.label || ''} items={summary.sales_trends?.[trend]?.items || []} currency={currency} /></section>
      <section id="report-breakdowns" className="report-breakdowns"><article className="report-section"><ReportHeading icon={CreditCard} title="Payment breakdown" subtitle={period} /><div className="report-payment-summary"><div className={`report-payment-pie${paid + credit ? '' : ' is-empty'}`} style={{ '--paid-percent': `${paidPercent}%` }} role="img" aria-label={`Paid ${paidPercent}%, Credit ${paid + credit ? Math.round((100 - paidPercent) * 10) / 10 : 0}%`} /><div><span><i />Paid<strong data-no-localize>{moneyValue(paid)}</strong></span><span><i />Credit<strong data-no-localize>{moneyValue(credit)}</strong></span></div></div><h3 className="report-breakdown-label">Payments received</h3><RankList rows={payments} type="payments" currency={currency} /><ReportValue label="Paid during sales" value={moneyValue(paid)} highlight /></article>
        <article className="report-section"><ReportHeading icon={ShoppingBasket} title="Top products" subtitle={period} /><RankList rows={summary.top_products || []} type="products" currency={currency} /></article>
        <article className="report-section"><ReportHeading icon={CircleDollarSign} title="Expense categories" subtitle={period} /><RankList rows={summary.expense_categories || []} type="expenses" currency={currency} /><ReportValue label="Total expenses" value={moneyValue(summary.expense_total)} highlight /></article>
        <article className="report-section"><ReportHeading icon={Store} title="Purchases" subtitle={period} /><ReportValue label="Purchases" value={moneyValue(summary.purchase_total)} /><ReportValue label="Paid during purchases" value={moneyValue(summary.purchase_paid_total)} /><ReportValue label="Credit purchases" value={moneyValue(summary.purchase_credit_total)} /><p className="report-help"><span data-no-localize>{summary.purchase_count || 0}</span> records</p></article>
      </section>
    </div> : null}
  </main>;
}
