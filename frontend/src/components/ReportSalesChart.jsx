import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../utils';

const compactNumber = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));

export function ReportSalesChart({ title, period, items = [], formatValue = money, interval = 0, children }) {
  const chartData = items.map(item => ({ ...item, total: Number(item.total || 0) }));
  return <article className="report-sales-chart">
    <header><strong>{title}</strong><span>{period}</span></header>
    <div className="report-sales-chart-canvas" role="img" aria-label={`${title} for ${period}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--theme-border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" axisLine={{ stroke: "var(--theme-border)" }} tickLine={false} tick={{ fill: "var(--theme-text-muted)", fontSize: 13, fontWeight: 650 }} interval={interval} minTickGap={24} height={28} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--theme-text-muted)", fontSize: 12, fontWeight: 650 }} tickFormatter={compactNumber} width={48} />
          <Tooltip contentStyle={{ background: "var(--theme-surface)", borderColor: "var(--theme-border)", color: "var(--theme-text)" }} cursor={{ fill: "var(--theme-primary-soft)" }} formatter={value => [formatValue(value), 'Sales']} labelStyle={{ color: "var(--theme-primary-text)", fontWeight: 700 }} />
          <Bar dataKey="total" fill="var(--theme-chart-1)" maxBarSize={20} minPointSize={1} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    {children}
  </article>;
}
