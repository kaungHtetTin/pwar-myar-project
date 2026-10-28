import React, { useState } from 'react';

const series = [ ['income', 'Income'], ['outcome', 'Outcome'], ['profit', 'Profit'] ];
const short = value => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function OverviewIncomeChart({ report }) {
  const [selected, setSelected] = useState(null);
  const rows = report?.monthly_cash_flow;
  const available = Array.isArray(rows) && rows.length === 12 && rows.every(row => series.every(([key]) => Number.isFinite(Number(row[key]))));
  const format = value => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${report.currency}`;
  if (!available) return <section className="office-panel"><div className="office-panel-header"><h2>Monthly income, outcome &amp; profit</h2></div><p className="office-overview-empty">Monthly financial data is unavailable.</p></section>;
  const values = rows.flatMap(row => series.map(([key]) => Number(row[key])));
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const roughStep = (max - min || 1) / 4;
  const unit = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 5, 10].find(value => value * unit >= roughStep) * unit;
  const low = Math.floor(min / step) * step, high = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + step * index);
  const y = value => 26 + (high - value) / (high - low) * 190;
  const x = index => 78 + index * 60;
  const active = rows[selected ?? Math.max(0, Math.min(11, new Date().getMonth()))];
  const totals = Object.fromEntries(series.map(([key]) => [key, rows.reduce((sum, row) => sum + Number(row[key]), 0)]));
  return <section className="office-panel office-income-chart" aria-label="Monthly financial performance">
    <div className="office-panel-header"><div><h2>Monthly income, outcome &amp; profit</h2><p>{report.current_year} · {report.currency}</p></div><div className="office-income-legend">{series.map(([key, label]) => <span key={key}><i className={`flow-${key}`} />{label}</span>)}</div></div>
    <div className="office-income-totals">{series.map(([key, label]) => <div key={key}><span>{label}</span><strong>{format(totals[key])}</strong></div>)}</div>
    <div className="office-income-scroll"><svg viewBox="0 0 790 250" aria-label="Monthly income, outcome and profit bars" role="group">
      {ticks.map(value => <g key={value}><line x1="48" x2="770" y1={y(value)} y2={y(value)} className="office-income-grid" /><text x="40" y={y(value) + 4} textAnchor="end">{short(value)}</text></g>)}
      <line x1="48" x2="770" y1={y(0)} y2={y(0)} className="office-income-zero" />
      {rows.map((row, index) => <g key={row.month}>
        {series.map(([key], s) => <rect key={key} className={`flow-${key}`} x={x(index) - 23 + s * 16} y={Math.min(y(0), y(row[key]))} width="14" height={Math.abs(y(row[key]) - y(0))} rx="2" />)}
        <text x={x(index)} y="240" textAnchor="middle">{row.label}</text>
      </g>)}
      {rows.map((row, index) => <g key={row.month}>
        <rect x={x(index) - 27} y="16" width="54" height="205" fill="transparent" tabIndex="0" role="img"
          aria-label={`${row.label}: ${series.map(([key, label]) => `${label} ${format(row[key])}`).join(', ')}`}
          onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} className="office-income-hit"><title>{row.label}: {series.map(([key, label]) => `${label} ${format(row[key])}`).join(' · ')}</title></rect>
      </g>)}
    </svg></div>
    <div className="office-income-detail" aria-live="polite"><strong>{active.label}</strong>{series.map(([key, label]) => <span key={key}>{label} <b>{format(active[key])}</b></span>)}</div>
    {values.every(value => value === 0) && <p className="office-overview-empty">No income or expenses recorded for {report.current_year}.</p>}
  </section>;
}
