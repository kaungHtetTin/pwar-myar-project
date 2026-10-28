import { Button } from '../components/Controls';
import React from 'react';
import { reportNumber, reportDateLabel } from './shopReportUtils';
import { shopMoney } from './shopUtils';

export function ShopReportTrend({ data, table, onToggle }) {
  const days = data.trend || [], width=360, left=35, right=329, top=12, bottom=128;
  const rawSales=Math.max(1,...days.map(d=>Number(d.sales || 0))), salesStep=10**Math.floor(Math.log10(rawSales));
  const maxSales=Math.ceil(rawSales/salesStep)*salesStep,maxOrders=Math.max(4,Math.ceil(Math.max(0,...days.map(d=>Number(d.orders || 0)))/4)*4);
  const x = i=>days.length===1?(left+right)/2:left+i/(Math.max(1,days.length-1))*(right-left);
  const y = value=>bottom-Number(value || 0)/maxSales*(bottom-top);
  const tick = value=>value>=1000000?`${reportNumber(value/1000000)}M`:value>=1000?`${reportNumber(value/1000)}K`:reportNumber(value);
  const stride=Math.max(1,Math.ceil(days.length/6));
  return <section className="shop-report-card shop-report-trend"><header><h2>Daily sales trend</h2><Button variant="plain" type="button" aria-pressed={table} onClick={onToggle}>{table?'Show chart':'Show daily table'}</Button></header><div className="shop-report-trend-legend"><span><i />Completed sales ({data.currency})</span><span><i />Completed orders (right axis)</span></div>
    {table?<div className="shop-mobile-table-scroll"><table><caption>Daily completed sales</caption><thead><tr><th>Date</th><th>Sales</th><th>Orders</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><td>{day.date}</td><td>{shopMoney(day.sales,data.currency)}</td><td>{reportNumber(day.orders)}</td></tr>)}</tbody></table></div>:<svg className="shop-report-trend-svg" viewBox={`0 0 ${width} 153`} role="img" aria-label="Daily completed sales and completed orders">
      {[0,.25,.5,.75,1].map(f=><g key={f}><line x1={left} x2={right} y1={bottom-f*(bottom-top)} y2={bottom-f*(bottom-top)} className="report-trend-grid" /><text x={left-5} y={bottom-f*(bottom-top)+3} textAnchor="end">{tick(f*maxSales)}</text><text x={right+5} y={bottom-f*(bottom-top)+3}>{reportNumber(f*maxOrders)}</text></g>)}
      {days.map((day,i)=><g key={day.date}><rect className="report-trend-order" x={x(i)-Math.min(7,240/Math.max(1,days.length)/2)} y={bottom-Number(day.orders || 0)/maxOrders*(bottom-top)} width={Math.min(14,240/Math.max(1,days.length))} height={Number(day.orders || 0)/maxOrders*(bottom-top)} /><title>{`${day.date}: ${shopMoney(day.sales,data.currency)} / ${day.orders} completed orders`}</title>{(i%stride===0||i===days.length-1)&&<text x={x(i)} y={147} textAnchor="middle">{reportDateLabel(day.date).replace(/ \d{4}$/,'')}</text>}</g>)}
      <polyline className="report-trend-line" points={days.map((day,i)=>`${x(i)},${y(day.sales)}`).join(' ')} />{days.length<=31&&days.map((day,i)=><circle key={day.date} className="report-trend-dot" cx={x(i)} cy={y(day.sales)} r="2.2"><title>{`${day.date}: ${shopMoney(day.sales,data.currency)}`}</title></circle>)}
    </svg>}
    {!days.length&&<p className="shop-report-empty">No data for this period.</p>}
    <div className="shop-report-trend-totals"><span><strong>{shopMoney(data.summary?.sales,data.currency)}</strong><small>Completed sales</small></span><span><strong>{reportNumber(data.summary?.completed_orders)}</strong><small>Completed orders</small></span></div>
  </section>;
}
