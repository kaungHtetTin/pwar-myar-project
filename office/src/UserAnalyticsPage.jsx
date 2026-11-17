import React, { useEffect, useState } from 'react';
import { Activity, UserPlus, Users, UserCheck, CalendarDays, TrendingUp } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import './user-analytics.css';

const number = value => Number(value).toLocaleString();
const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const comparison = (value, previous) => previous ? `${value >= previous ? '+' : ''}${Math.round((value - previous) / previous * 100)}% vs previous period` : 'No previous-period baseline';

function TrendChart({ title, description, rows, field, trackingSince }) {
  const [selected, setSelected] = useState(null);
  const available = row => field !== 'active' || (trackingSince && row.day >= trackingSince);
  const max = Math.ceil(Math.max(2, ...rows.filter(available).map(row => row[field])) / 2) * 2;
  const x = i => 52 + i * (690 / Math.max(1, rows.length - 1));
  const y = value => 198 - value / max * 166;
  const active = rows.find(row => row.day === selected) || rows.at(-1);
  const points = rows.map((row, i) => available(row) ? `${x(i)},${y(row[field])}` : null).filter(Boolean).join(' ');
  return <section className="office-panel office-user-chart" aria-label={title}>
    <div className="office-panel-header"><div><h2>{title}</h2><p>{description}</p></div></div>
    <div className="office-user-chart-scroll"><svg viewBox="0 0 780 242" role="group" aria-label={`${title} by day`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="52" x2="748" y1={y(max * fraction)} y2={y(max * fraction)} className="office-user-grid" /><text x="44" y={y(max * fraction) + 4} textAnchor="end">{number(Math.ceil(max * fraction))}</text></g>)}
      <polyline points={points} className={`office-user-line series-${field}`} />
      {rows.map((row, i) => <g key={row.day}>
        {available(row) && <circle cx={x(i)} cy={y(row[field])} r={active.day === row.day ? 4 : 2} className={`office-user-dot series-${field}`} />}
        {(i === 0 || i === rows.length - 1 || i === Math.floor(rows.length / 2)) && <text x={x(i)} y="230" textAnchor="middle">{date(row.day)}</text>}
        <rect x={x(i) - 690 / rows.length / 2} y="20" width={690 / rows.length} height="184" fill="transparent" tabIndex="0" role="img" aria-label={`${row.day}: ${available(row) ? number(row[field]) : 'Not tracked'}`} onMouseEnter={() => setSelected(row.day)} onFocus={() => setSelected(row.day)}><title>{row.day}: {available(row) ? number(row[field]) : 'Not tracked'}</title></rect>
      </g>)}
    </svg></div>
    <div className="office-user-chart-detail" aria-live="polite"><span>{date(active.day)}</span><strong>{available(active) ? number(active[field]) : 'Not tracked'}</strong></div>
  </section>;
}

export default function UserAnalyticsPage({ refreshToken = 0 }) {
  const [days, setDays] = useState('30'), [audience, setAudience] = useState('business');
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    api(`/office/user-analytics?days=${days}&audience=${audience}`).then(data => {
      if (current) setState({ data, loading: false, error: '' });
    }).catch(error => { if (current) setState({ data: null, loading: false, error: error.message || 'Unable to load user analytics.' }); });
    return () => { current = false; };
  }, [days, audience, refreshToken, retry]);
  const change = (setter, value) => { setState({ data: null, loading: true, error: '' }); setter(value); };
  const data = state.data, summary = data?.summary;
  const stats = summary ? [
    ['Total accounts', summary.total, `${number(summary.enabled)} enabled · ${number(summary.disabled)} disabled`, Users],
    ['Daily active users', summary.dau, 'Today · unique accounts', Activity],
    ['Weekly active users', summary.wau, 'Last 7 days · unique accounts', UserCheck],
    ['Monthly active users', summary.mau, 'Last 30 days · unique accounts', CalendarDays],
    ['New registrations', summary.registered, comparison(summary.registered, summary.previous_registered), UserPlus],
    ['Active in period', summary.active, comparison(summary.active, summary.previous_active), TrendingUp],
  ] : [];
  return <div className="office-page-stack office-user-analytics" aria-busy={state.loading}>
    <OfficePageToolbar extraActions={<>
      <label className="office-analytics-select">Accounts<select aria-label="Analytics accounts" value={audience} onChange={event => change(setAudience, event.target.value)}><option value="business">Business users</option><option value="customers">Shop customers</option></select></label>
      <label className="office-analytics-select">Period<select aria-label="Analytics period" value={days} onChange={event => change(setDays, event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
    </>} />
    {state.loading && <p role="status">Loading user analytics…</p>}
    {state.error && <div className="office-panel office-user-note" role="alert"><p>{state.error}</p><button type="button" onClick={() => { setState({ data: null, loading: true, error: '' }); setRetry(value => value + 1); }}>Retry analytics</button></div>}
    {data && <>
      <p className="office-user-period">{date(data.from)} – {date(data.to)} · {data.timezone} · Includes today so far</p>
      <section className="office-stat-grid" aria-label="User analytics summary">{stats.map(([label, value, hint, Icon]) => <article className="office-stat-card" key={label}><span className="office-stat-icon office-tone-blue">{React.createElement(Icon, { size: 18 })}</span><div><span>{label}</span><strong>{number(value)}</strong><small>{hint}</small></div></article>)}</section>
      <div className="office-user-charts">
        <TrendChart title="Daily active users" description="Distinct accounts with a successful authenticated API request each day" rows={data.daily} field="active" trackingSince={data.tracking_since} />
        <TrendChart title="New registrations by day" description="Accounts created each day, including staff added by owners" rows={data.daily} field="registered" />
        <TrendChart title="Account growth" description="Cumulative accounts currently in the system" rows={data.daily} field="total" />
        <section className="office-panel office-user-note"><h2>Engagement & account health</h2><dl>
          <div><dt>DAU / MAU</dt><dd>{summary.stickiness == null ? 'Not available' : `${summary.stickiness}%`}</dd></div>
          <div><dt>Enabled accounts</dt><dd>{number(summary.enabled)}</dd></div>
          <div><dt>Disabled accounts</dt><dd>{number(summary.disabled)}</dd></div>
        </dl><p>DAU / MAU is today’s active users as a share of users active in the last 30 days.</p><p>Activity tracking {data.tracking_since ? `has records from ${data.tracking_since}` : 'starts when users next use the app'}. Earlier activity is unavailable; activity totals and comparisons may cover a partial period. Authenticated background requests can count as activity. Office administrators and anonymous visitors are excluded.</p><p>Registration and growth charts reflect existing accounts; deleted accounts are excluded. Account enabled status is separate from recent usage.</p></section>
      </div>
    </>}
  </div>;
}
