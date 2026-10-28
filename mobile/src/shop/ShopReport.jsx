import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { InputGroup, Button, IconButton, Input, Select } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, CreditCard, FileText, Globe, Info, MessageCircle, Package, Store, Users } from 'lucide-react';
import { MobileFilterToggle, MobileFilterPanel, MobileFilterActions, MobileNotice, MobileSheet } from '../components/MobilePrimitives';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../utils/csvExport';
import { ShopField, ShopLoadState } from './ShopPrimitives';
import { ShopDatePresets } from './ShopDatePresets';
import { ShopReportTrend } from './ShopReportCharts';
import { useShopResource } from './useShopResource';
import { shopMoney, shopLabel, shopDate } from './shopUtils';
import { reportNumber, reportComparison, reportDateLabel, reportPreset, shopReportExportRows, SHOP_REPORT_COLUMNS } from './shopReportUtils';

const INITIAL = { date_from:'', date_to:'', currency:'' };
const METRICS = [
  ['sales','Completed sales','money','Completed, non-voided orders placed in this period, including delivery fees.'],
  ['completed_orders','Completed orders','count','Completed, non-voided orders placed in this period.'],
  ['refunded','Refunded order value','money','Current refunded status of orders placed in this period; not refund transaction dates.'],
  ['completion_rate','Completion rate','rate','Completed, non-voided orders divided by all orders placed in this period.'],
];

export function ShopReportHeader({ onBack, children }) {
  return <PageAppBar className="shop-report-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" onClick={onBack}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Shop report</h1>{children}<AppBarMenu /></PageAppBar>;
}
function ShopReportMetric({ metric, summary, previous, currency, onInfo }) {
  const [key,label,type,description]=metric, result=reportComparison(summary[key],previous[key],type==='rate');
  const positive=key==='refunded'?result.change<0:result.change>0;
  const Arrow=result.change<0?ArrowDownRight:ArrowUpRight;
  const baseline=type==='money'?shopMoney(previous[key],currency):`${reportNumber(previous[key])}${type==='rate'?'%':''}`;
  const shortComparison=result.change===null?result.text:`${result.change>0?'+':''}${reportNumber(result.change)}${type==='rate'?' pp':'%'}`;
  return <article className="shop-report-metric"><small>{label}</small><strong>{type==='money'?shopMoney(summary[key],currency):`${reportNumber(summary[key])}${type==='rate'?'%':''}`}</strong><div className="shop-report-metric-comparison"><span title={result.text} className={result.change===null||result.change===0?'is-neutral':positive?'is-positive':'is-negative'}>{result.change!==null&&result.change!==0&&<Arrow size={13} aria-hidden="true" />}{shortComparison}</span><IconButton variant="ghost" type="button" aria-label={`About ${label}`} onClick={()=>onInfo({title:label,description,comparison:result.text,baseline})}><Info size={13} aria-hidden="true" /></IconButton></div></article>;
}
function Breakdown({ title, icon:Icon, rows=[], subtitle, compact=false, onDetails, sectionRef, children }) {
  return <section ref={sectionRef} className={`shop-report-card shop-report-breakdown${compact?' is-compact':''}`}><header><span className="shop-report-section-icon">{Icon&&<Icon size={20} aria-hidden="true" />}</span><div><h2>{title}</h2>{subtitle&&<small>{subtitle}</small>}</div>{onDetails&&<Button variant="plain" type="button" aria-label={`View ${title} details`} onClick={onDetails}>View details<ChevronRight size={13} aria-hidden="true" /></Button>}</header>{rows.length?<ul>{rows.map((row,index)=><li key={`${row.name}:${index}`}><span><i className={`report-key-dot is-${index%5}`} aria-hidden="true" />{shopLabel(row.name || '')}</span><strong>{row.value}</strong>{row.detail&&<small>{row.detail}</small>}</li>)}</ul>:<p className="shop-report-empty">No data for this period.</p>}{children}</section>;
}
function ShopReportProducts({ products, currency }) {
  const [all,setAll]=useState(false), total=products.reduce((sum,p)=>sum+Number(p.sales||0),0);
  return <section className="shop-report-card shop-report-products"><header><h2>Top products</h2>{products.length>3&&<Button variant="plain" type="button" aria-expanded={all} onClick={()=>setAll(v=>!v)}>{all?'Show fewer':'View all'}<ChevronRight size={13} aria-hidden="true" /></Button>}</header>{!products.length&&<p className="shop-report-empty">No data for this period.</p>}{(all?products:products.slice(0,3)).map((p,index)=><div className="shop-report-product" key={`${p.product_id}:${p.unit_name}:${index}`}><span className="shop-report-product-photo"><Package size={22} aria-hidden="true" /></span><span><strong>{p.name}</strong><small>{reportNumber(p.quantity)} {p.unit_name}</small></span><span><strong>{shopMoney(p.sales,currency)}</strong><small title="Share of listed product sales">{total?reportNumber(Number(p.sales)/total*100):0}%</small></span></div>)}</section>;
}
function ShopReportMetricInfo({ info, data, onClose }) {
  useEffect(()=>{
    const trigger=document.activeElement,dialog=document.querySelector('.shop-report-info');
    dialog?.querySelector('button')?.focus();
    const trap=event=>{if(event.key!=='Tab'||!dialog)return;const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href]')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
    document.addEventListener('keydown',trap);
    return()=>{document.removeEventListener('keydown',trap);if(trigger?.isConnected&&!trigger.closest('[hidden]'))trigger.focus({preventScroll:true});};
  },[]);
  return <MobileSheet open title={info.title} onClose={onClose} className="shop-report-info"><p>{info.description}</p><p>{info.comparison}</p><p>Previous value: {info.baseline}</p><p>Compared with {data?.previous_from} - {data?.previous_to}.</p><Button variant="primary" type="button" className="mobile-primary" onClick={onClose}>Done</Button></MobileSheet>;
}
export function ShopReport({ onNavigate }) {
  const [table,setTable]=useState(false),[filters,setFilters]=useState(INITIAL),[draft,setDraft]=useState(INITIAL),[preset,setPreset]=useState('custom'),[open,setOpen]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(null),[info,setInfo]=useState(null);
  const defaultPeriod=useRef(null), anchors=useRef({});
  const resource=useShopResource(`/shop-admin/report?analytics=1&${new URLSearchParams(filters)}`),data=resource.data;
  if(data&&!defaultPeriod.current)defaultPeriod.current={date_from:data.date_from,date_to:data.date_to,currency:data.currency};
  const openFilters=()=>{setDraft(data?{date_from:data.date_from,date_to:data.date_to,currency:data.currency}:{...INITIAL});setPreset('custom');setError('');setOpen(true);};
  const jump=key=>anchors.current[key]?.scrollIntoView({block:'start',behavior:'smooth'});
  function apply(event) {
    event.preventDefault();
    if(draft.date_from&&draft.date_to&&draft.date_from>draft.date_to){setError('End date must be on or after start date.');return;}
    if(draft.date_from&&draft.date_to&&(new Date(draft.date_to)-new Date(draft.date_from))/86400000>=366){setError('Choose a range of 1 to 366 days.');return;}
    setError('');setFilters({...draft});setOpen(false);
  }
  async function exportReport() {
    return exportFilteredCsv({loadRows:()=>shopReportExportRows(data),columns:SHOP_REPORT_COLUMNS,filename:csvFilename('shop-report')});
  }
  const summary=data?.summary||{},previous=data?.previous||{},currency=data?.currency,currencies=data?.currencies?.length?data.currencies:data?[data.currency]:[];
  const summaryRows=(rows,field)=> (rows||[]).map(row=>({name:row.name||row.status,value:reportNumber(row[field])}));
  const outcomes=summaryRows(data?.outcomes,'orders'),origins=summaryRows(data?.origins,'orders'),buyers=(data?.buyers||[]).map(row=>({name:row.name,value:reportNumber(row.buyers),detail:reportComparison(row.buyers,previous[row.name==='New buyers'?'new_buyers':'returning_buyers']).text})),fulfillment=summaryRows(data?.fulfillment,'orders');
  const money=value=>shopMoney(value,currency);
  const payments=[{name:'Paid order value',value:money(summary.paid_order_value)},{name:'Refunds pending',value:money(summary.refund_pending)},{name:'Refunded order value',value:money(summary.refunded)},{name:'Prepaid awaiting fulfillment',value:money(data?.prepaid)}];
  const pending=data&&((filters.currency&&filters.currency!==data.currency)||(filters.date_from&&filters.date_from!==data.date_from)||(filters.date_to&&filters.date_to!==data.date_to));
  return <>
    <ShopReportHeader onBack={()=>onNavigate('/shop',{back:true})}>{data&&<CsvExportButton compact label="Export shop report" onExport={exportReport} onNotice={setNotice} />}</ShopReportHeader>
    <MobileNotice notice={notice} onClose={()=>setNotice(null)} />
    <div className="shop-report-toolbar"><Button variant="plain" type="button" className="shop-report-period" onClick={openFilters}><CalendarDays size={16} aria-hidden="true" /><span>{data?`${reportDateLabel(data.date_from)} - ${reportDateLabel(data.date_to)}`:'Date range'}</span><ChevronDown size={14} aria-hidden="true" /></Button><InputGroup as="label" className="shop-report-currency"><CreditCard size={16} aria-hidden="true" /><span className="sr-only">Report currency</span><Select aria-label="Report currency" disabled={!data} value={currency||''} onChange={event=>setFilters(current=>({...current,currency:event.target.value}))}>{!data&&<option value="">Currency</option>}{currencies.map(code=><option key={code}>{code}</option>)}</Select></InputGroup><MobileFilterToggle open={open} onToggle={openFilters} controls="shop-report-filters" /></div>
    <MobileFilterPanel open={open} onClose={()=>setOpen(false)} id="shop-report-filters" className="shop-report-filter" onSubmit={apply}><fieldset className="shop-report-date-filter"><legend>Date range</legend><div className="shop-report-presets">{[['last7','Last 7 days',7],['last30','Last 30 days',30],['custom','Custom',0]].map(([key,label,days])=><Button variant="choice" type="button" key={key} aria-pressed={preset===key} onClick={()=>{setPreset(key);if(days)setDraft({...draft,...reportPreset(days,data?.timezone)});}}>{label}</Button>)}</div><div className="shop-report-date-fields">{['date_from','date_to'].map(name=><ShopField id={`shop-report-${name}`} name={name} key={name} label={name==='date_from'?'From date':'To date'}><Input required type="date" value={draft[name]} onChange={event=>{setPreset('custom');setDraft({...draft,[name]:event.target.value});}} /></ShopField>)}</div><details><summary>More date ranges</summary><ShopDatePresets timezone={data?.timezone} onChange={dates=>{setPreset('custom');setDraft({...draft,...dates});}} /></details></fieldset><ShopField id="shop-report-currency" name="currency" label="Currency"><Select value={draft.currency} onChange={event=>setDraft({...draft,currency:event.target.value})}>{!data&&<option value="">Loading...</option>}{currencies.map(code=><option key={code}>{code}</option>)}</Select></ShopField><p className="shop-report-timezone">Business timezone: {data?.timezone||'Asia/Rangoon'}</p>{error&&<p role="alert">{error}</p>}<MobileFilterActions onClear={()=>{const next={...(defaultPeriod.current||INITIAL)};setDraft(next);setFilters(next);setPreset('custom');setError('');}} /></MobileFilterPanel>
    {pending&&!resource.error&&<p role="status" className="shop-report-loading-scope">Loading report...</p>}
    <ShopLoadState resource={resource}>{data&&<div className="shop-report-content" aria-busy={Boolean(pending&&!resource.error)}>
      {resource.error&&<p className="shop-report-scope-note">Showing the last loaded report. <Button variant="plain" type="button" onClick={()=>resource.reload()}>Retry report</Button></p>}
      <section className="shop-report-card shop-report-overview"><h2>Overview</h2><div className="shop-report-overview-grid">{METRICS.map(metric=><ShopReportMetric key={metric[0]} metric={metric} summary={summary} previous={previous} currency={currency} onInfo={setInfo} />)}</div><p className="shop-report-comparison-period">Compared with {reportDateLabel(data.previous_from)} - {reportDateLabel(data.previous_to)}</p></section>
      {!summary.orders&&<p className="shop-report-card shop-report-empty">No orders in this period. Try another date range or currency.</p>}
      <ShopReportTrend data={data} table={table} onToggle={()=>setTable(v=>!v)} />
      <ShopReportProducts products={data.top_products||[]} currency={currency} />
      <div className="shop-report-summary-grid"><Breakdown compact title="Buyers" icon={Users} rows={[{name:'New buyers',value:reportNumber(summary.new_buyers)},{name:'Returning buyers',value:reportNumber(summary.returning_buyers)}]} subtitle={`${reportNumber(Number(summary.new_buyers||0)+Number(summary.returning_buyers||0))} buyers`} onDetails={()=>jump('buyers')} /><Breakdown compact title="Order outcomes" icon={FileText} rows={outcomes} onDetails={()=>jump('outcomes')} /><Breakdown compact title="Order origins" icon={Globe} rows={origins} onDetails={()=>jump('origins')} /><Breakdown compact title="Customer segments" icon={Users} rows={(data.segments||[]).map(row=>({name:row.name,value:reportNumber(row.buyers)}))} onDetails={()=>jump('segments')} /><Breakdown compact title="Payment status" icon={CreditCard} rows={payments.slice(0,3)} onDetails={()=>jump('payments')} /><Breakdown compact title="Fulfillment" icon={Package} rows={fulfillment} onDetails={()=>jump('fulfillment')} /></div>
      <Button variant="plain" type="button" className="shop-report-follow-up-link" onClick={()=>jump('follow-up')}><Users size={20} aria-hidden="true" /><span><strong>Customer follow-up</strong><small>{data.follow_up?.length||0} inactive repeat buyers</small></span><ChevronRight size={18} aria-hidden="true" /></Button>
      <section className="shop-report-extra-metrics" aria-label="Additional report metrics">{[['average_order_value','Average order value','money'],['cancellation_rate','Cancellation rate','rate'],['repeat_purchase_rate','Repeat purchase rate','rate']].map(([key,label,type])=><div key={key}><small>{label}</small><strong>{type==='money'?money(summary[key]):`${reportNumber(summary[key])}%`}</strong><small>{reportComparison(summary[key],previous[key],type==='rate').text}</small></div>)}</section>
      <p className="shop-report-scope-note">Sales use completed, non-voided orders placed in the selected period and include delivery fees. Product sales exclude delivery fees.</p>
      <section className="shop-report-breakdowns-section"><p className="shop-report-period-summary"><CalendarDays size={16} aria-hidden="true" /><span>{reportDateLabel(data.date_from)} - {reportDateLabel(data.date_to)} / {currency} / {reportNumber(summary.orders)} orders</span></p><h2>Breakdowns</h2>
        <Breakdown title="Order outcomes" icon={FileText} rows={outcomes} subtitle={`${reportNumber(summary.orders)} orders`} sectionRef={node=>{anchors.current.outcomes=node;}} />
        <Breakdown title="Order origins" icon={Store} rows={origins} subtitle={`${reportNumber(summary.orders)} orders`} sectionRef={node=>{anchors.current.origins=node;}} />
        <Breakdown title="New and returning buyers" icon={Users} rows={buyers} sectionRef={node=>{anchors.current.buyers=node;}} />
        <Breakdown title="Fulfillment" icon={Package} rows={fulfillment} subtitle={`${reportNumber(summary.orders)} orders`} sectionRef={node=>{anchors.current.fulfillment=node;}} />
        <Breakdown title="Payment status" icon={CreditCard} rows={payments} subtitle={`For ${reportNumber(summary.orders)} orders`} sectionRef={node=>{anchors.current.payments=node;}}><p className="shop-report-scope-note">Payment values describe current payment status of orders placed in this period, separately from completed sales.</p></Breakdown>
        <Breakdown title="Customer segments" icon={Users} rows={(data.segments||[]).map(row=>({name:row.name,value:reportNumber(row.buyers),detail:`Historical spend: ${money(row.spend)}`}))} sectionRef={node=>{anchors.current.segments=node;}}><p className="shop-report-scope-note">History through {data.date_to}. Loyal: 3+ purchases. Repeat: 2. Inactive repeat: 2+ purchases, none in the last 60 days.</p></Breakdown>
        <section ref={node=>{anchors.current['follow-up']=node;}} className="shop-report-card shop-report-follow-up"><header><span className="shop-report-section-icon"><MessageCircle size={21} aria-hidden="true" /></span><h2>Customers to reconnect with</h2></header><p className="shop-report-scope-note">Up to 10 inactive repeat buyers, ranked by historical spending.</p>{!data.follow_up?.length&&<p className="shop-report-empty">No inactive repeat buyers for this period.</p>}{(data.follow_up||[]).map(customer=><Button variant="plain" type="button" key={customer.customer_key} disabled={!customer.customer_key} className="shop-report-customer" onClick={()=>onNavigate(`/shop/customers/${encodeURIComponent(customer.customer_key)}`)} aria-label={`View customer ${customer.name}`}><span className="shop-report-customer-avatar">{Array.from(customer.name||'?')[0]}</span><span><strong>{customer.name}</strong><small>{customer.purchases} purchases / {money(customer.spend)}</small><small>Last purchase: {shopDate(customer.last_purchase,data.timezone)}</small></span><ChevronRight size={17} aria-hidden="true" /></Button>)}</section>
      </section>
    </div>}</ShopLoadState>
    {info&&<ShopReportMetricInfo info={info} data={data} onClose={()=>setInfo(null)} />}
  </>;
}
