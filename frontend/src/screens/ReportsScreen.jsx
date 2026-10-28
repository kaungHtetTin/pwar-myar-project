import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  Download,
  Filter,
  HandCoins,
  Package,
  ReceiptText,
  ShoppingBasket,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { ReportSalesChart as VerticalSalesChart } from '../components/ReportSalesChart';
import { request, requestDownload } from '../api';
import { formatDateInput, formatQuantity, money } from '../utils';
import { EmptyState, Field, FilterDrawer, PageSkeleton } from '../components/common';
import { useScreenNotifications } from '../components/notifications';
import { useDataRefresh } from '../dataEvents';
import { useLatestEffect } from '../hooks/useLatestEffect';
import { dateRangeError, presetDateRange, reportPath } from '../dateRanges';
import { AppBarActions } from '../components/WorkspaceHeader';

function blankFilters() {
  const today = formatDateInput(new Date());
  return { preset: 'today', start: today, end: today };
}

async function downloadCsv(filters) {
  const { blob } = await requestDownload(reportPath('/reports/summary.csv', filters), { accept: 'text/csv' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `mkpos-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ReportsScreen() {
  const [filters, setFilters] = useState(blankFilters());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const loadSequence = React.useRef(0);
  const { setError } = useScreenNotifications();

  const grossMargin = useMemo(() => {
    if (!summary?.sales_total) return 0;
    return Math.round((Number(summary.profit_estimate || 0) / Number(summary.sales_total || 1)) * 100);
  }, [summary]);

  async function loadReport(nextFilters = filters) {
    const rangeError = dateRangeError(nextFilters.start, nextFilters.end);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const nextSummary = await request(reportPath('/reports/summary', nextFilters));
      if (sequence === loadSequence.current) setSummary(nextSummary);
    } catch (err) {
      if (sequence === loadSequence.current) setError(`Cannot load report. ${err.message}`);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  useLatestEffect(() => {
    loadReport();
  }, []);

  useDataRefresh(['sales', 'purchases', 'expenses', 'customerPayments', 'supplierPayments', 'products', 'reports'], 'reports', () => loadReport(filters));

  function setPreset(preset) {
    const next = { ...filters, preset, ...presetDateRange(preset) };
    setFilters(next);
    loadReport(next);
  }

  function applyFilters(event) {
    event.preventDefault();
    loadReport(filters);
    setFilterOpen(false);
  }

  function clearFilters() {
    const next = blankFilters();
    setFilters(next);
    loadReport(next);
    setFilterOpen(false);
  }

  const paymentMethods = summary?.payment_methods || [];
  const expenseCategories = summary?.expense_categories || [];
  const topProducts = summary?.top_products || [];
  const activePaymentMethods = paymentMethods.filter((row) => Number(row.total || 0) || Number(row.paid_total || 0) || Number(row.credit_total || 0));
  const maxPaymentTotal = Math.max(...activePaymentMethods.map((row) => Number(row.total || 0)), 1);
  const currentAccounts = summary?.current_accounts || {
    as_of: formatDateInput(new Date()),
    receivable_total: summary?.debt_total || 0,
    payable_total: 0,
    customers_owing: summary?.customers_with_debt || 0,
    open_accounts: summary?.customers_with_debt || 0,
  };
  const inventoryValuation = summary?.inventory_valuation || {
    as_of: formatDateInput(new Date()),
    product_count: 0,
    stock_units: 0,
    investment_value: 0,
    potential_sales_value: 0,
  };
  const periodRange = summary ? `${summary.start} — ${summary.end}` : '';

  return (
    <section className="screen reports-layout mkpos-sheet">
      {loading && <PageSkeleton>Loading reports...</PageSkeleton>}

      <div className="report-main-panel">
        <AppBarActions>
          <button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}>
            <Filter size={16} /> Filters
          </button>
          <button type="button" onClick={() => downloadCsv(filters).catch((error) => setError(error.message))} disabled={loading}><Download size={15} /> Export CSV</button>
        </AppBarActions>

        <section className="report-period-section">
          <div className="report-section-heading">
            <span><CalendarRange size={17} /><strong>Selected Period</strong></span>
            <span className="report-period-range">
              {summary?.all_time && <><span>All Time</span><i>·</i></>}
              {periodRange}
            </span>
          </div>
          <div className="report-overview">
            <div className={`report-profit-card ${Number(summary?.profit_estimate || 0) < 0 ? 'is-negative' : ''}`}>
              <span className="report-profit-icon">{Number(summary?.profit_estimate || 0) < 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}</span>
              <div>
                <span>Net Profit Estimate</span>
                <strong>{money(summary?.profit_estimate)}</strong>
                <small>{summary?.sales_count || 0} receipts <i /> {grossMargin}% margin</small>
              </div>
            </div>
            <div className="report-kpi-grid">
              <div className="report-kpi report-kpi-sales"><span className="report-kpi-icon"><CircleDollarSign size={18} /></span><span>Sales</span><strong>{money(summary?.sales_total)}</strong></div>
              <div className="report-kpi report-kpi-received"><span className="report-kpi-icon"><WalletCards size={18} /></span><span>Paid During Sales</span><strong>{money(summary?.cash_total)}</strong></div>
              <div className="report-kpi report-kpi-credit"><span className="report-kpi-icon"><CreditCard size={18} /></span><span>Credit Sales</span><strong>{money(summary?.credit_total)}</strong></div>
              <div className="report-kpi report-kpi-expense"><span className="report-kpi-icon"><TrendingDown size={18} /></span><span>Expenses</span><strong>{money(summary?.expense_total)}</strong></div>
              <div className="report-kpi report-kpi-received"><span className="report-kpi-icon"><ShoppingBasket size={18} /></span><span>Purchases</span><strong>{money(summary?.purchase_total)}</strong></div>
              <div className="report-kpi report-kpi-credit"><span className="report-kpi-icon"><HandCoins size={18} /></span><span>Credit Purchases</span><strong>{money(summary?.purchase_credit_total)}</strong></div>
            </div>
          </div>
        </section>

        <section className="report-inventory-section">
          <div className="report-section-heading">
            <span><Package size={17} /><strong>Current Inventory Value</strong></span>
            <span className="report-period-range">
              <span>{inventoryValuation.product_count} products</span><i>·</i>
              <span>{formatQuantity(inventoryValuation.stock_units)} units</span><i>·</i>
              <span>As of</span> {inventoryValuation.as_of}
            </span>
          </div>
          <div className="report-inventory-grid">
            <div className="report-inventory-metric is-investment">
              <span className="report-account-icon"><Package size={18} /></span>
              <span>Current Stock Investment</span>
              <strong>{money(inventoryValuation.investment_value)}</strong>
              <small>Positive stock at current unit costs</small>
            </div>
            <div className="report-inventory-metric is-sales-value">
              <span className="report-account-icon"><CircleDollarSign size={18} /></span>
              <span>Potential Sales Value</span>
              <strong>{money(inventoryValuation.potential_sales_value)}</strong>
              <small>If all stock sells at current primary prices</small>
            </div>
          </div>
          {inventoryValuation.reserved_units > 0 && <p>Online stock: {formatQuantity(inventoryValuation.available_units)} available · {formatQuantity(inventoryValuation.reserved_units)} reserved · {formatQuantity(inventoryValuation.dispatched_units)} dispatched. Dispatched units remain in POS stock until order completion.</p>}
        </section>

        <section className="report-account-section">
          <div className="report-section-heading">
            <span><ReceiptText size={17} /><strong>Current Accounts</strong></span>
            <span className="report-period-range"><span>As of</span> {currentAccounts.as_of}</span>
          </div>
          <div className="report-account-grid">
            <div className="report-account-metric is-receivable">
              <span className="report-account-icon"><ReceiptText size={18} /></span>
              <span>Current Receivable</span>
              <strong>{money(currentAccounts.receivable_total)}</strong>
            </div>
            <div className="report-account-metric is-payable">
              <span className="report-account-icon"><HandCoins size={18} /></span>
              <span>Total Payable</span>
              <strong>{money(currentAccounts.payable_total)}</strong>
            </div>
            <div className="report-account-metric is-customers">
              <span className="report-account-icon"><UsersRound size={18} /></span>
              <span>Customers Owing</span>
              <strong>{currentAccounts.customers_owing}</strong>
            </div>
            <div className="report-account-metric is-payable">
              <span className="report-account-icon"><ShoppingBasket size={18} /></span>
              <span>Supplier Payable</span>
              <strong>{money(currentAccounts.supplier_payable_total || 0)}</strong>
            </div>
            <div className="report-account-metric is-open">
              <span className="report-account-icon"><HandCoins size={18} /></span>
              <span>Suppliers Owed</span>
              <strong>{currentAccounts.suppliers_owed || 0}</strong>
            </div>
            <div className="report-account-metric is-open">
              <span className="report-account-icon"><UserRoundCheck size={18} /></span>
              <span>Open Accounts</span>
              <strong>{currentAccounts.open_accounts}</strong>
            </div>
          </div>
        </section>

        <div className="report-month-chart-row">
          <VerticalSalesChart title="Sales of Month" period={summary?.sales_trends?.month?.label || ''} items={summary?.sales_trends?.month?.items || []} />
        </div>

        <div className="report-sales-analysis-grid">
          <div className="report-panel report-payment-panel">
            <div className="report-card-title">
              <span><CreditCard size={17} /><strong>Payment Breakdown</strong></span>
            </div>
            <div className="report-payment-list">
              {activePaymentMethods.map((row) => (
                <div className="report-payment-row" key={row.payment_method}>
                  <div>
                    <strong>{row.payment_method}</strong>
                    <span>{row.count} receipts</span>
                  </div>
                  <div className="report-bar-track">
                    <span className={`report-bar-width-${Math.max(5, Math.min(100, Math.round(((Number(row.total || 0) / maxPaymentTotal) * 100) / 5) * 5))}`} />
                  </div>
                  <strong>{money(row.total)}</strong>
                </div>
              ))}
              {!activePaymentMethods.length && !loading && <EmptyState>No payment data.</EmptyState>}
            </div>
          </div>

          <VerticalSalesChart title="Sales of Year" period={summary?.sales_trends?.year?.label || ''} items={summary?.sales_trends?.year?.items || []} />
        </div>

        <div className="report-dashboard-grid">
          <div className="report-panel">
            <div className="report-card-title"><span><ShoppingBasket size={17} /><strong>Top Products</strong></span><small>{topProducts.length}</small></div>
            <div className="report-rank-list">
              {topProducts.map((row, index) => (
                <div className="report-rank-row" key={row.product_name}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{row.product_name}</strong>
                    <small>
                      Sold {formatQuantity(row.quantity)}
                      {Number(row.foc_quantity || 0) > 0 ? ` + FOC ${formatQuantity(row.foc_quantity)}` : ''}
                    </small>
                  </div>
                  <strong>{money(row.total)}</strong>
                </div>
              ))}
              {!topProducts.length && !loading && <EmptyState>No product sales.</EmptyState>}
            </div>
          </div>

          <div className="report-panel">
            <div className="report-card-title"><span><BarChart3 size={17} /><strong>Expense Categories</strong></span><small>{expenseCategories.length}</small></div>
            <div className="report-rank-list">
              {expenseCategories.map((row, index) => (
                <div className="report-rank-row" key={row.category}>
                  <span>{index + 1}</span>
                  <div><strong>{row.category}</strong><small>{row.count} records</small></div>
                  <strong>{money(row.total)}</strong>
                </div>
              ))}
              {!expenseCategories.length && !loading && <EmptyState>No expenses.</EmptyState>}
            </div>
          </div>
        </div>
      </div>

      <FilterDrawer open={filterOpen} title="Report filters" onClose={() => setFilterOpen(false)} busy={loading}>
        <form className="drawer-filter-form report-drawer-filter" onSubmit={applyFilters}>
          <div className="purchase-quick-ranges">
            {[
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['year', 'This Year'],
              ['all', 'All Time'],
            ].map(([preset, label]) => (
              <button key={preset} type="button" className={filters.preset === preset ? 'selected' : ''} onClick={() => setPreset(preset)}>
                {label}
              </button>
            ))}
          </div>
          <Field label="From">
            <input type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, preset: 'custom', start: event.target.value })} />
          </Field>
          <Field label="To">
            <input type="date" value={filters.end} onChange={(event) => setFilters({ ...filters, preset: 'custom', end: event.target.value })} />
          </Field>
          <div className="drawer-filter-actions">
            <button type="button" onClick={clearFilters} disabled={loading}>Clear</button>
            <button type="submit" className="primary" disabled={loading}>Apply Filter</button>
          </div>
        </form>
      </FilterDrawer>
    </section>
  );
}
