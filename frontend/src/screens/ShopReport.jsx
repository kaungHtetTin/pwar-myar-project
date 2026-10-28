import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Text, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, CircleDollarSign, Filter, ReceiptText, ShoppingBag, UserRoundCheck, UsersRound, XCircle } from 'lucide-react';
import { request } from '../api';
import { Field, FilterDrawer } from '../components/common';
import { AppBarActions } from '../components/WorkspaceHeader';
import { ReportSalesChart } from '../components/ReportSalesChart';
import { dateRangeError, presetDateRange } from '../dateRanges';
import { formatDateInput } from '../utils';

const number = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const readable = value => value.replaceAll('_', ' ');
const metrics = [['sales', 'Completed sales', 'money', CircleDollarSign, 'sales'], ['completed_orders', 'Completed orders', '', ShoppingBag, 'received'], ['average_order_value', 'Average order value', 'money', ReceiptText, 'credit'], ['new_buyers', 'New buyers', '', UsersRound, 'customers'], ['returning_buyers', 'Returning buyers', '', UserRoundCheck, 'received'], ['cancellation_rate', 'Cancellation rate', 'rate', XCircle, 'expense']];

function Comparison({ value, previous, rate }) {
  const change = rate ? value - previous : previous ? (value - previous) / previous * 100 : null;
  return <small>{change === null ? (value ? 'No previous baseline' : 'No change') : `${change > 0 ? '+' : ''}${number(change)}${rate ? ' percentage points' : '%'} vs previous period`}</small>;
}

function WrappedLabel({ x, y, payload }) {
  const label = String(payload?.value || '');
  return <g><title>{label}</title><Text x={x - 4} y={y} width={78} textAnchor="end" verticalAnchor="middle" style={{ fontSize: 12 }} fill="var(--theme-text-muted)" lineHeight="1.1em" maxLines={3} breakAll={/\S{13,}/u.test(label)}>{label}</Text></g>;
}

function Chart({ title, items, field, money, currency }) {
  return <section className="report-sales-chart shop-analysis-chart"><header><strong>{title}</strong></header>
    {!items.length || !items.some(item => Number(item[field]) > 0) ? <p className="shop-analysis-empty">No data for this period.</p> : <>
      <div className="report-sales-chart-canvas" role="img" aria-label={title} style={{ height: Math.max(218, items.length * 44 + 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} layout="vertical" margin={{ left: 0, right: 16 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="var(--theme-border)" strokeDasharray="3 3" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--theme-text-muted)" }} />
            <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} interval={0} tick={WrappedLabel} />
            <Tooltip contentStyle={{ background: "var(--theme-surface)", borderColor: "var(--theme-border)", color: "var(--theme-text)" }} cursor={{ fill: "var(--theme-primary-soft)" }} labelStyle={{ color: "var(--theme-primary-text)", fontWeight: 700 }} formatter={value => [money ? `${number(value)} ${currency}` : number(value), money ? 'Sales' : 'Count']} />
            <Bar dataKey={field} fill="var(--theme-chart-1)" maxBarSize={20} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details><summary>View data</summary><div className="shop-analysis-table"><table><thead><tr><th>Name</th>{items.some(item => item.quantity != null) && <th>Quantity</th>}<th>{money ? `Sales (${currency})` : 'Count'}</th></tr></thead><tbody>{items.map((item, index) => <tr key={index}><td>{item.name}</td>{items.some(item => item.quantity != null) && <td>{number(item.quantity)}</td>}<td>{number(item[field])}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}

export function ShopReport({ refresh, onViewCustomer }) {
  const initial = { preset: 'last30', date_from: '', date_to: '', currency: '' };
  const [draft, setDraft] = useState(initial), [filters, setFilters] = useState(initial);
  const [filterOpen, setFilterOpen] = useState(false);
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ analytics: '1' });
    for (const key of ['date_from', 'date_to', 'currency']) if (filters[key]) params.set(key, filters[key]);
    request(`/shop-admin/report?${params}`).then(result => {
      if (!active) return;
      setData(result);
      setDraft(value => value.date_from ? value : { ...value, date_from: result.date_from, date_to: result.date_to, currency: result.currency });
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, refresh, retry]);
  const rangeError = dateRangeError(draft.date_from, draft.date_to);
  function preset(value) {
    if (value === 'custom') { setDraft(current => ({ ...current, preset: value })); return; }
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone || 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00`);
    const range = presetDateRange(value, today);
    if (value === 'last30') { const from = new Date(today); from.setDate(from.getDate() - 29); range.start = formatDateInput(from); range.end = formatDateInput(today); }
    setDraft(current => ({ ...current, preset: value, date_from: range.start, date_to: range.end }));
  }
  const money = value => `${number(value)} ${data.currency}`;
  return <div className="shop-analysis" aria-busy={loading}>
    <AppBarActions><button type="button" className="filter-drawer-trigger" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen}><Filter size={16} /> Filters</button></AppBarActions>
    <FilterDrawer open={filterOpen} title="Shop report filters" onClose={() => setFilterOpen(false)} busy={loading}>
    <form className="drawer-filter-form report-drawer-filter" aria-label="Shop report filters" onSubmit={event => { event.preventDefault(); if (!rangeError) { setFilters({ ...draft }); setFilterOpen(false); } }}>
        <Field label="Period"><select value={draft.preset} onChange={event => preset(event.target.value)}><option value="last30">Last 30 days</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></Field>
        <Field label="From"><input type="date" required value={draft.date_from} onChange={event => setDraft(value => ({ ...value, preset: 'custom', date_from: event.target.value }))} /></Field>
        <Field label="To"><input type="date" required min={draft.date_from} value={draft.date_to} onChange={event => setDraft(value => ({ ...value, preset: 'custom', date_to: event.target.value }))} /></Field>
        <Field label="Currency"><select value={draft.currency} onChange={event => setDraft(value => ({ ...value, currency: event.target.value }))}>{!data && <option value="">Loading…</option>}{data?.currencies.map(currency => <option key={currency}>{currency}</option>)}</select></Field>
      {rangeError && <p role="alert">{rangeError}</p>}
      <div className="drawer-filter-actions"><button type="button" disabled={loading} onClick={() => { setDraft(initial); setFilters(initial); setFilterOpen(false); }}>Clear</button><button type="submit" className="primary" disabled={loading || !!rangeError}>Apply Filter</button></div>
    </form>
    </FilterDrawer>
    {loading && <p role="status">Loading shop report…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {data && !loading && !error && <>
      <section className="report-period-section"><div className="report-section-heading"><span><CalendarRange size={17} /><strong>Selected Period</strong></span><span className="report-period-range">{data.date_from} – {data.date_to} · {data.currency}</span></div>
      <div className="report-kpi-grid shop-analysis-kpis">{metrics.map(([key, title, type, Icon, tone]) => <article className={`report-kpi report-kpi-${tone} report-kpi-with-meta`} key={key}><span className="report-kpi-icon"><Icon size={18} /></span><div className="report-kpi-copy"><span>{title}</span><strong>{type === 'money' ? money(data.summary[key]) : `${number(data.summary[key])}${type === 'rate' ? '%' : ''}`}</strong><Comparison value={data.summary[key]} previous={data.previous[key]} rate={type === 'rate'} /></div></article>)}</div>
      </section>
      <p className="shop-analysis-context">Compared with {data.previous_from} – {data.previous_to} · {data.timezone}</p>
      {!data.summary.orders && <p className="panel shop-analysis-empty">No orders in this period. Try another date range or currency.</p>}
      <p className="shop-analysis-context">Sales use completed, non-voided orders placed in the selected period and include delivery fees. Product sales exclude delivery fees. New and returning buyers use completed purchase history in this currency.</p>
      <div className="shop-analysis-grid">
        <ReportSalesChart title="Sales trend" period={`${data.date_from} – ${data.date_to}`} items={data.trend.map(day => ({ label: day.date, total: day.sales }))} formatValue={money} interval="preserveStartEnd"><details><summary>View daily sales</summary><div className="shop-analysis-table"><table><thead><tr><th>Date</th><th>Orders</th><th>Sales ({data.currency})</th></tr></thead><tbody>{data.trend.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.orders}</td><td>{number(day.sales)}</td></tr>)}</tbody></table></div></details></ReportSalesChart>
        <Chart title="Top products" items={data.top_products.map(item => ({ ...item, name: `${item.name} (${item.unit_name})`, sales: Number(item.sales) }))} field="sales" money currency={data.currency} />
        <Chart title="New and returning buyers" items={data.buyers} field="buyers" />
        <Chart title="Order outcomes" items={data.outcomes.map(item => ({ name: readable(item.status), orders: Number(item.orders) }))} field="orders" />
        <Chart title="Order origins" items={(data.origins || []).map(item => ({ ...item, name: readable(item.name), orders: Number(item.orders) }))} field="orders" />
        <section className="panel shop-analysis-chart"><h2>Customer segments</h2><p className="shop-analysis-context">History through {data.date_to} in {data.currency}. Loyal: 3+ purchases. Repeat: 2. Inactive repeat: 2+ purchases, none in the last 60 days.</p><div className="shop-analysis-table"><table><thead><tr><th>Segment</th><th>Buyers</th><th>Historical spend</th></tr></thead><tbody>{data.segments.map(segment => <tr key={segment.name}><td>{segment.name}</td><td>{segment.buyers}</td><td>{money(segment.spend)}</td></tr>)}</tbody></table></div>{!data.segments.length && <p>No completed purchase history.</p>}<p>Repeat purchase rate among buyers in this period: <strong>{data.summary.repeat_purchase_rate}%</strong></p></section>
        <section className="panel shop-analysis-chart"><h2>Payments and fulfillment</h2><dl className="shop-analysis-totals">{[['Completion rate', `${data.summary.completion_rate}%`], ['Paid order value', money(data.summary.paid_order_value)], ['Prepaid awaiting fulfillment', money(data.prepaid)], ['Refunds pending', money(data.summary.refund_pending)], ['Refunded order value', money(data.summary.refunded)]].map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><p className="shop-analysis-context">Payment values describe the current payment status of orders placed in this period; they are separate from completed sales.</p></section>
      </div>
      <section className="panel shop-analysis-chart"><h2>Customers to reconnect with</h2><p className="shop-analysis-context">Up to 10 inactive repeat buyers, ranked by historical spending. Open a customer to review their purchases before planning a follow-up.</p>{!data.follow_up.length ? <p>No inactive repeat buyers for this currency and cutoff date.</p> : <div className="shop-analysis-table"><table><thead><tr><th>Customer</th><th>Purchases</th><th>Historical spend</th><th>Last purchase</th><th>Action</th></tr></thead><tbody>{data.follow_up.map(customer => <tr key={customer.customer_key}><td>{customer.name}</td><td>{customer.purchases}</td><td>{money(customer.spend)}</td><td>{new Date(`${customer.last_purchase.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { timeZone: data.timezone })}</td><td><button type="button" onClick={() => onViewCustomer(customer.customer_key)} aria-label={`View customer ${customer.name}`}>View customer</button></td></tr>)}</tbody></table></div>}</section>
    </>}
  </div>;
}
