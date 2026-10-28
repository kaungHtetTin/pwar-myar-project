import React, { useState } from 'react';
import { aiRequestCost, formatAiCost } from './aiRequestCost';
import { formatTokens } from './tokenFormat';
import './ai-usage-charts.css';

const metrics = [
  ['requests', 'Requests'], ['failures', 'Failures'], ['input_tokens', 'Input tokens'],
  ['output_tokens', 'Output tokens'], ['total_tokens', 'Total tokens'],
  ['cached_input_tokens', 'Cached input tokens'],
  ['total_cost', 'Estimated cost (USD)'],
];
const periods = [
  ['hourly', '24-hour usage', 'Last 24 hours · hourly'],
  ['daily', 'Daily usage', 'Last 30 days · daily'],
  ['monthly', 'Monthly usage', 'Last 12 months · monthly'],
  ['yearly', 'Yearly usage', 'Last 5 years · yearly'],
];
const valueFor = (bucket, metric, pricing) => {
  if (metric === 'total_cost') {
    if (!Array.isArray(bucket.cost_usage)) return null;
    let total = 0;
    for (const usage of bucket.cost_usage) {
      const cost = aiRequestCost(usage, pricing);
      if (!cost) return null;
      total += cost.total;
    }
    return total;
  }
  return metric === 'total_tokens'
    ? Number(bucket.input_tokens || 0) + Number(bucket.output_tokens || 0)
    : Number(bucket[metric] || 0);
};
const number = value => value.toLocaleString();

function UsageChart({ period, title, description, buckets, metric, metricLabel, pricing }) {
  const [selected, setSelected] = useState(null);
  const values = buckets.map(bucket => valueFor(bucket, metric, pricing));
  const max = Math.max(0, ...values.filter(value => value !== null)) || (metric === 'total_cost' ? 0.000001 : 1);
  const total = values.includes(null) ? null : values.reduce((sum, value) => sum + value, 0);
  const tokenMetric = metric.endsWith('_tokens');
  const format = metric === 'total_cost' ? formatAiCost : tokenMetric ? formatTokens : number;
  const exact = tokenMetric ? number : format;
  const active = selected === null ? null : buckets[selected];
  const tickEvery = Math.ceil(buckets.length / 6);
  return <section className="office-panel office-ai-chart" aria-label={title}>
    <div className="office-ai-chart-heading"><div><h2>{title}</h2><p>{description} · Asia/Yangon</p></div><div className="office-ai-chart-total"><strong title={tokenMetric ? `${number(total)} tokens` : undefined}>{format(total)}</strong><span>Period total</span></div></div>
    <div className="office-ai-chart-plot">
      <div className="office-ai-chart-y-axis" aria-hidden="true"><span>{format(max)}</span><span>{metric === 'total_cost' ? format(max / 2) : format(Math.round(max / 2))}</span><span>{metric === 'total_cost' ? '$0' : '0'}</span></div>
      <div className="office-ai-chart-plot-area">
      <div className="office-ai-chart-gridlines" aria-hidden="true"><i /><i /><i /></div>
      <div className="office-ai-chart-bars" style={{ gridTemplateColumns: `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))` }} role="group" aria-label={`${title}: ${metricLabel}`}>
      {buckets.map((bucket, index) => <div className="office-ai-chart-column" key={bucket.key}>
        <div className="office-ai-chart-track" tabIndex={0} role="img" aria-label={`${bucket.label} Asia/Yangon: ${exact(values[index])} ${metricLabel.toLowerCase()}`} onMouseEnter={() => setSelected(index)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)}>
          <span className="office-ai-chart-bar" style={{ height: `${(values[index] ?? 0) / max * 100}%` }} />
        </div>
      </div>)}
      </div>
      </div>
      <div className={`office-ai-chart-x-axis${buckets.length <= 6 ? ' is-sparse' : ''}`} style={{ gridTemplateColumns: `repeat(${Math.max(1, buckets.length)}, minmax(0, 1fr))` }} aria-hidden="true">
        {buckets.map((bucket, index) => <span key={bucket.key}><span className="office-ai-chart-tick-label">{(index % tickEvery === 0 && index < buckets.length - Math.ceil(tickEvery / 2)) || index === buckets.length - 1 ? (period === 'hourly' ? bucket.key.slice(11, 16) : period === 'monthly' ? bucket.label.slice(0, 3) : bucket.label) : ''}</span></span>)}
      </div>
    </div>
    <div className="office-ai-chart-detail" aria-live="polite">{active ? `${active.label} Asia/Yangon: ${exact(valueFor(active, metric, pricing))} ${metricLabel.toLowerCase()}` : total === null ? 'Cost unavailable for some requests; check pricing availability.' : total === 0 ? 'No usage recorded for this period.' : 'Hover over or focus a bar to see its value.'}</div>
  </section>;
}

export function AiUsageCharts({ charts, pricing }) {
  const [metric, setMetric] = useState('requests');
  const metricLabel = metrics.find(([key]) => key === metric)[1];
  if (!charts?.series) return <p role="status">Usage charts are unavailable. Refresh the report to try again.</p>;
  return <div className="office-ai-charts">
    <div className="office-ai-charts-toolbar"><div><h2>Usage over time</h2><p>All periods use Asia/Yangon and include the current partial period.</p></div><label>Chart metric<select value={metric} onChange={event => setMetric(event.target.value)}>{metrics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {metric === 'total_cost' && <p className="office-ai-charts-note">Input + output for completed requests. Reported cache hits use discounted rates; unreported cache usage uses uncached rates. Peak pricing; off-peak discounts excluded.{pricing?.stale ? ' Using the last successful pricing fetch.' : ''}</p>}
    <div className="office-ai-charts-grid">{periods.map(([key, title, description]) => <UsageChart key={key} period={key} title={title} description={description} buckets={charts.series[key] || []} metric={metric} metricLabel={metricLabel} pricing={pricing} />)}</div>
  </div>;
}
