export const reportNumber = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function reportComparison(value, previous, rate = false) {
  const current = Number(value || 0), baseline = Number(previous || 0);
  const change = rate ? current - baseline : baseline ? (current - baseline) / baseline * 100 : null;
  return { change, text: change === null ? current ? 'No previous baseline' : 'No change' : `${change > 0 ? '+' : ''}${reportNumber(change)}${rate ? ' percentage points' : '%'} vs previous period` };
}

export function reportDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

export function reportPreset(days, timezone = 'Asia/Rangoon', now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now).map(p => [p.type, p.value]));
  const end = new Date(Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day))), start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { date_from: start.toISOString().slice(0,10), date_to: end.toISOString().slice(0,10) };
}

export function shopReportExportRows(data) {
  const result = [];
  function add(section, metric, value, unit = 'count', item = '') { result.push({ section, metric, item, value: Number(value || 0), unit, date_from:data.date_from, date_to:data.date_to, timezone:data.timezone }); }
  const money = new Set(['sales','average_order_value','paid_order_value','refund_pending','refunded']);
  for (const [metric,value] of Object.entries(data.summary || {})) add('Summary',metric,value,money.has(metric)?data.currency:metric.endsWith('_rate')?'percent':'count');
  for (const [metric,value] of Object.entries(data.previous || {})) result.push({section:'Previous period',metric,item:'',value:Number(value || 0),unit:money.has(metric)?data.currency:metric.endsWith('_rate')?'percent':'count',date_from:data.previous_from,date_to:data.previous_to,timezone:data.timezone});
  for (const day of data.trend || []) { add('Daily trend','completed sales',day.sales,data.currency,day.date); add('Daily trend','completed orders',day.orders,'count',day.date); }
  for (const p of data.top_products || []) { add('Top products','sales',p.sales,data.currency,p.name); add('Top products','quantity',p.quantity,p.unit_name,p.name); }
  for (const [section,rows,field] of [['Order outcomes',data.outcomes,'orders'],['Order origins',data.origins,'orders'],['Buyers',data.buyers,'buyers'],['Fulfillment',data.fulfillment,'orders'],['Customer segments',data.segments,'buyers']]) for (const row of rows || []) { add(section,field,row[field],'count',row.name || row.status); if(row.spend!=null)add(section,'historical spend',row.spend,data.currency,row.name); }
  add('Payment status','prepaid awaiting fulfillment',data.prepaid,data.currency);
  for (const buyer of data.follow_up || []) { add('Inactive repeat buyers','purchases',buyer.purchases,'count',buyer.name); add('Inactive repeat buyers','historical spend',buyer.spend,data.currency,buyer.name); }
  return result;
}

export const SHOP_REPORT_COLUMNS = ['section','metric','item','value','unit','date_from','date_to','timezone'].map(key => ({ label:key.replaceAll('_',' '), value:row=>row[key] }));
