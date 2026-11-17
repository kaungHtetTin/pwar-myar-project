import React, { useId } from 'react';
import { useLocale } from '../localization/LocaleContext';
import { featureText } from '../../../shared/localization/newFeatures.js';

const money = value => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK`;
const compact = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function UsageChart({ title: sourceTitle, period: sourcePeriod, series, timezone }) {
  const { language } = useLocale();
  const title = featureText(sourceTitle, language);
  const period = featureText(sourcePeriod, language);
  const titleId = useId();
  const items = series.items || [];
  const maximum = Math.max(0, ...items.map(item => Number(item.cost)));
  const scale = maximum || 1;
  const step = 284 / Math.max(1, items.length);
  return <section className="shop-mobile-card sales-ai-usage-chart" aria-labelledby={titleId}>
    <header><div><h2 id={titleId}>{title}</h2><small>{period}</small></div><strong>{money(series.total)}</strong></header>
    <svg className="sales-ai-usage-plot" viewBox="0 0 340 116" role="img" aria-label={`${title}: ${money(series.total)}. ${period}. ${timezone}. ${featureText('Exact values are available below.', language)}`}>
      <text x="0" y="15">{compact(scale)}</text><text x="0" y="104">0</text>
      {[12, 56, 100].map(y => <line key={y} x1="48" x2="332" y1={y} y2={y} />)}
      {items.map((item, index) => {
        const height = Number(item.cost) > 0 ? Math.max(1, Number(item.cost) / scale * 88) : 0;
        return <rect key={item.key} x={48 + index * step + step * .18} y={100 - height} width={step * .64} height={height} rx="1.5"><title>{item.label}: {money(item.cost)}</title></rect>;
      })}
      <text x="48" y="115">{items[0]?.label}</text><text x="332" y="115" textAnchor="end">{items.at(-1)?.label}</text>
    </svg>
    {maximum === 0 && <p className="sales-ai-usage-empty">No AI usage in this period.</p>}
    <details className="sales-ai-usage-values"><summary>{language === 'my' ? `${title} တန်ဖိုးများ ကြည့်မည်` : `View ${title.toLowerCase()} values`}</summary><table><caption>{timezone} · MMK</caption><thead><tr><th scope="col">Period</th><th scope="col">Usage (MMK)</th></tr></thead><tbody>{items.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{money(item.cost)}</td></tr>)}</tbody></table></details>
  </section>;
}

export function SalesAiUsageCharts({ usage }) {
  return <div className="sales-ai-usage-charts"><p className="sales-ai-usage-context">AI usage cost · MMK · {usage.timezone}</p><UsageChart title="Daily usage" period="Last 30 days" series={usage.daily} timezone={usage.timezone} /><UsageChart title="Monthly usage" period="Last 12 months" series={usage.monthly} timezone={usage.timezone} /></div>;
}
