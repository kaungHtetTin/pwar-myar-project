import React, { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { request } from '../api';
import { TablePagination } from '../components/common';
import { getBusinessTimezone } from '../timezone';
import { useLanguage } from '../components/LanguageProvider';
import { featureText } from '../../../shared/localization/newFeatures.js';

const number = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
const compact = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
function UsageChart({ title: sourceTitle, period: sourcePeriod, series, timezone }) {
  const { language } = useLanguage();
  const title = featureText(sourceTitle, language);
  const period = featureText(sourcePeriod, language);
  return <section className="sales-ai-usage-chart"><header><div><h3>{title}</h3><small>{period} {'\u00b7'} {timezone}</small></div><strong>{number(series.total)} MMK</strong></header>
    <div className="sales-ai-usage-canvas" role="img" aria-label={`${title}: ${number(series.total)} MMK`}><ResponsiveContainer width="100%" height="100%"><BarChart data={series.items.map(item => ({ ...item, cost: Number(item.cost) }))} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--theme-border)" strokeDasharray="3 3" /><XAxis dataKey="label" minTickGap={26} interval="preserveStartEnd" tick={{ fontSize: 11, fill: 'var(--theme-text-muted)' }} tickLine={false} axisLine={false} /><YAxis width={48} tickFormatter={compact} tick={{ fontSize: 11, fill: 'var(--theme-text-muted)' }} tickLine={false} axisLine={false} />
      <Tooltip cursor={{ fill: 'var(--theme-primary-soft)' }} contentStyle={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }} formatter={value => [`${number(value)} MMK`, featureText('Usage cost', language)]} /><Bar dataKey="cost" fill="var(--theme-chart-1)" maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div>
    {!series.items.some(item => Number(item.cost) > 0) && <p className="muted">No AI usage in this period.</p>}
  </section>;
}

export function SalesAiBalanceBook({ active, refreshToken, onWalletChange }) {
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState(null), [usage, setUsage] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const cache = useRef(new Map()), epoch = useRef(refreshToken), usageRef = useRef(null), onWallet = useRef(onWalletChange);
  onWallet.current = onWalletChange;
  useEffect(() => {
    if (!active) return;
    if (epoch.current !== refreshToken) { cache.current.clear(); epoch.current = refreshToken; usageRef.current = null; }
    const key = `${pageSize}:${page}`;
    const saved = cache.current.get(key);
    let current = true;
    if (saved) { setData(saved); setLoading(false); setError(''); return; }
    setLoading(true); setError('');
    const query = new URLSearchParams({ limit: pageSize, offset: (page - 1) * pageSize, with_total: '1', include_usage: usageRef.current ? '0' : '1' });
    request(`/shop-admin/sales-ai/wallet?${query}`).then(result => {
      if (!current) return;
      cache.current.set(key, result); setData(result); onWallet.current?.(result.wallet);
      if (result.usage) { usageRef.current = result.usage; setUsage(result.usage); }
      const last = Math.max(1, Math.ceil(result.total / pageSize));
      if (page > last) setPage(last);
    }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, page, pageSize, refreshToken, retry]);
  function changePage(value) { setRetry(0); setPage(value); }
  const timezone = usage?.timezone || getBusinessTimezone();
  return <div className="sales-ai-balance-book" hidden={!active}>
    {usage && <div className="sales-ai-usage-charts"><UsageChart title="Daily usage" period="Last 30 days" series={usage.daily} timezone={timezone} /><UsageChart title="Monthly usage" period="Last 12 months" series={usage.monthly} timezone={timezone} /></div>}
    <section className="shop-table-card"><header className="sales-ai-ledger-heading"><h3>Balance transactions</h3><label>Rows per page<select aria-label="Balance rows per page" value={pageSize} disabled={loading} onChange={event => { setPageSize(Number(event.target.value)); changePage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></header>
      {error && <p role="alert">{error} <button type="button" onClick={() => { cache.current.delete(`${pageSize}:${page}`); setRetry(value => value + 1); }}>Retry balance book</button></p>}{loading && <p role="status">Loading balance book...</p>}
      <div className="table-wrap"><table className="shop-data-table" aria-label="Sales AI balance book" aria-busy={loading}><colgroup><col style={{ width: '26%' }} /><col style={{ width: '34%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /></colgroup><thead><tr><th>Date</th><th>Entry</th><th>Amount (MMK)</th><th>Balance (MMK)</th></tr></thead><tbody>{data?.items.map(row => <tr key={row.id}><td>{new Date(row.created_at.replace(' ', 'T') + (/(Z|[+-]\d{2}:\d{2})$/.test(row.created_at) ? '' : 'Z')).toLocaleString(undefined, { timeZone: timezone })}</td><td data-no-localize>{row.description}</td><td>{number(row.amount)}</td><td>{number(row.balance_after)}</td></tr>)}{data && !data.items.length && <tr><td colSpan={4}>No balance transactions yet.</td></tr>}</tbody></table></div>
      {data && <TablePagination page={page} pageSize={pageSize} total={data.total ?? data.items.length} loading={loading} onPageChange={changePage} />}
    </section>
  </div>;
}
