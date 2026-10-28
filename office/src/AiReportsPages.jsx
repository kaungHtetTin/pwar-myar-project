import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { api } from './api';
import { AiUsageCharts } from './AiUsageCharts';
import { formatTokens } from './tokenFormat';
import './office-management.css';

export function AiUsageReportPage({ refreshToken = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      api('/office/ai-assistant').then(value => {
        if (current) { setData(value); setError(''); }
      }).catch(error => { if (current) setError(error.message); });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [refreshToken, revision]);
  return <div className="office-page-stack">
    {error && <div className="feedback error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Reload report</button></div>}
    {!data && !error && <p role="status">Loading AI usage report...</p>}
    {data && <>
    <section className="office-stat-grid" aria-label="AI usage">{[['Requests today (Asia/Yangon)',data.usage.today_requests],['Failures today (Asia/Yangon)',data.usage.today_failures],['Input tokens (all time)',data.usage.input_tokens],['Output tokens (all time)',data.usage.output_tokens]].map(([label,value])=><article className="office-stat-card" key={label}><span className="office-stat-icon office-tone-green"><Bot size={18}/></span><div><span>{label}</span><strong title={label.includes('tokens') ? `${Number(value).toLocaleString()} tokens` : undefined}>{label.includes('tokens') ? formatTokens(value) : Number(value).toLocaleString()}</strong></div></article>)}</section>
      <AiUsageCharts charts={data.usage_charts} pricing={data.pricing} />
      <section className="office-panel office-branding-panel"><h2>Usage totals</h2><p>Daily counts reset at midnight Asia/Yangon. Each attempt, including failed retries, counts. Input totals include cached tokens. Reported cache hits receive the discounted input rate; missing cache counts use an uncached estimate. Failed provider runs may have unreported usage.</p></section>
    </>}
  </div>;
}
