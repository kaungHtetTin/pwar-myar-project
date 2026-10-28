import React, { useEffect, useState } from 'react';
import { Ban, Bot, Building2, CalendarDays, Calculator, Clock3, ShieldCheck } from 'lucide-react';
import { api } from './api';
import { officeDate } from './dateTime';
import { subscriptionAccessCounts } from './subscriptionUi';
import { OverviewIncomeChart } from './OverviewIncomeChart';
import './overview.css';

const money = (value, currency) => `${Number(value).toLocaleString()} ${currency}`;
const balanceMoney = value => {
  const [whole, fraction = ''] = value.split('.');
  return `USD ${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
};
const averageMoney = value => Number(value) > 0 && Number(value) < 0.000001 ? 'USD <0.000001' : `USD ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;

export function OverviewPage({ businesses, businessSummary, requests, financialReport, canManageAI, refreshToken = 0, onReviewPayments, onManageBusinesses, onManageAI }) {
  const [ai, setAi] = useState({ data: null, loading: true, error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!canManageAI) return;
    const changed = () => setRevision(value => value + 1);
    window.addEventListener('mkpos:office-ai-balance-changed', changed);
    return () => window.removeEventListener('mkpos:office-ai-balance-changed', changed);
  }, [canManageAI]);
  useEffect(() => {
    if (!canManageAI) return;
    let current = true;
    const timer = setTimeout(() => {
      setAi(previous => ({ ...previous, loading: true }));
      api('/office/ai-balance-book/summary').then(data => {
        if (typeof data.balance !== 'string' || !/^-?\d+(\.\d{1,9})?$/.test(data.balance) || typeof data.can_use_ai !== 'boolean') throw new Error('Invalid balance');
        if (current) setAi({ data, loading: false, error: false });
      }).catch(() => { if (current) setAi({ data: null, loading: false, error: true }); });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [canManageAI, refreshToken, revision]);

  const access = businessSummary?.access_counts || subscriptionAccessCounts(businesses);
  const total = Number(businessSummary?.total ?? businesses.length);
  const paid = Number(access.paid || 0), trials = Number(access.trial || 0);
  const active = paid + trials, inactive = Math.max(0, total - active);
  const pending = requests.filter(item => item.status === 'pending');
  const revenue = financialReport?.summary?.this_month;
  const hasRevenue = revenue !== null && revenue !== undefined && Number.isFinite(Number(revenue)) && financialReport?.currency;
  const aiHint = ai.loading ? 'Updating balance...' : ai.error ? 'Unavailable · Refresh to retry' : ai.data?.can_use_ai ? 'Internal credit available' : 'AI paused · Top up required';
  const average = ai.data?.average_cost_per_100_requests;
  const hasAverage = typeof average === 'string' && /^\d+(\.\d{1,9})?$/.test(average) && Number.isFinite(Number(average));
  const stats = [
    { label: 'Businesses', value: total, hint: `${inactive} without active access`, icon: Building2, tone: 'green' },
    { label: 'Active access', value: active, hint: `${paid} paid · ${trials} trials`, icon: ShieldCheck, tone: 'blue' },
    { label: 'Pending payments', value: pending.length, hint: 'Awaiting review', icon: Clock3, tone: 'amber' },
    { label: 'Revenue this month', value: hasRevenue ? money(revenue, financialReport.currency) : 'Unavailable', hint: 'Subscription sales', icon: CalendarDays, tone: 'green' },
    canManageAI
      ? { label: 'AI remaining balance', value: ai.data ? balanceMoney(ai.data.balance) : ai.loading ? 'Loading...' : 'Unavailable', hint: aiHint, icon: Bot, tone: ai.data && !ai.data.can_use_ai ? 'red' : 'green' }
      : { label: 'Without active access', value: inactive, hint: 'Review business subscriptions', icon: Ban, tone: 'red' },
    ...(canManageAI ? [{ label: 'AI cost per 100 requests', value: ai.loading ? 'Loading...' : hasAverage ? averageMoney(average) : average === null ? '—' : 'Unavailable', hint: ai.loading ? 'Updating usage...' : ai.error ? 'Unavailable · Refresh to retry' : hasAverage ? 'All-time estimated average' : average === null ? 'No usage yet' : 'Unavailable · Refresh to retry', icon: Calculator, tone: 'blue' }] : []),
  ];
  return <div className="office-page-stack office-overview-dashboard office-overview-focused">
    <section className="office-stat-grid" aria-label="Platform summary">{stats.map(({ label, value, hint, icon: Icon, tone }) => <article className="office-stat-card" key={label}>
      <span className={`office-stat-icon office-tone-${tone}`}>{React.createElement(Icon, { size: 18 })}</span><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>
    </article>)}</section>
    <OverviewIncomeChart report={financialReport} />
    <section className="office-overview-grid">
      <section className="office-panel office-overview-requests">
        <div className="office-panel-header"><div><h2>Pending payments</h2><p>{pending.length > 5 ? `Latest 5 of ${pending.length} awaiting review` : `${pending.length} awaiting review`}</p></div><button type="button" onClick={onReviewPayments}>Review payments</button></div>
        {pending.length ? <div className="office-table-scroll"><table className="office-data-table" aria-label="Pending payments">
          <thead><tr><th>Business</th><th>Plan</th><th>Amount</th><th>Requested</th></tr></thead>
          <tbody>{pending.slice(0, 5).map(item => <tr key={item.id}><td><strong>{item.business_name}</strong></td><td>{item.plan_name}</td><td>{money(item.price, item.currency)}</td><td>{officeDate(item.created_at)}</td></tr>)}</tbody>
        </table></div> : <p className="office-overview-empty" role="status">No payments are waiting for review.</p>}
      </section>
      <aside className="office-panel office-attention-panel" aria-label="Quick actions">
        <div className="office-panel-header"><h2>Quick actions</h2></div>
        <div className="office-access-summary"><div><span>Business access</span><strong>{total ? Math.round(active / total * 100) : 0}% active</strong></div><div className="office-access-meter"><span style={{ width: `${total ? Math.min(100, active / total * 100) : 0}%` }} /></div><small>{active} active · {inactive} without active access</small></div>
        <button type="button" className="office-attention-item" onClick={onManageBusinesses}><span className="office-tone-blue"><Building2 size={17} /></span><span><strong>Manage businesses</strong><small>{inactive} without active access</small></span></button>
        {canManageAI && <button type="button" className="office-attention-item" onClick={onManageAI}><span className={ai.data && !ai.data.can_use_ai ? 'office-tone-red' : 'office-tone-green'}><Bot size={17} /></span><span><strong>AI balance book</strong><small>{aiHint}</small></span></button>}
      </aside>
    </section>
  </div>;
}
