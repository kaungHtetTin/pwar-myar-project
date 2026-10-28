import React, { useId, useRef, useState } from 'react';
import { Flag, ArrowLeft, ShieldCheck, RefreshCw, Store } from 'lucide-react';
import { useCustomer, CustomerAuth } from './CustomerAccount';
import { request } from './api';
import { useEndless } from './useEndless';
import { useText } from './i18n';
import { FeatureError } from './CustomerFeatures';
import { LoadingPanel, IconButton } from './ShoppingComponents';
import { goBack } from './shopNavigation';
import './shop-report.css';

export const reportReasons = [['misleading_information', 'Misleading shop information'], ['payment_issue', 'Payment problem'], ['order_issue', 'Order or delivery problem'], ['unsafe_products', 'Unsafe or counterfeit products'], ['abusive_behavior', 'Abusive behavior'], ['other', 'Other issue']];
const statuses = { open: 'Report received', in_review: 'Under review', resolved: 'Resolved', dismissed: 'Closed without action' };
export function ReportShopLink({ slug }) {
  const text = useText();
  return <a className="button shop-report-link" href={`#/store/${encodeURIComponent(slug)}/report`} title={text('Report shop')} aria-label={text('Report shop')}><Flag size={16} aria-hidden="true" /><span>{text('Report shop')}</span></a>;
}
function ReportForm({ slug }) {
  const text = useText(); const list = useEndless(`/customer/store-reports/${encodeURIComponent(slug)}`);
  const [form, setForm] = useState({ reason: '', details: '', order_reference: '' }), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const key = useRef(null), guard = useRef(false);
  const fieldId = useId();
  const active = list.items.find(row => ['open', 'in_review'].includes(row.status));
  async function submit(event) {
    event.preventDefault(); if (guard.current) return;
    if (form.details.trim().length < 10) { setError(text('Please explain the issue in at least 10 characters.')); return; }
    guard.current = true; setBusy(true); setError(''); setNotice(''); key.current ||= crypto.randomUUID();
    try {
      const result = await request(`/customer/store-reports/${encodeURIComponent(slug)}`, { method: 'POST', body: JSON.stringify({ ...form, submission_key: key.current }) });
      list.reconcile(rows => [result.report, ...rows.filter(row => row.id !== result.report.id)], { cursorDelta: result.created ? 1 : 0 });
      setNotice(text(result.created ? 'Your report was sent to Office.' : 'You already have an open report for this shop.')); setForm({ reason: '', details: '', order_reference: '' }); key.current = null;
    } catch (e) { setError(e.message); } finally { guard.current = false; setBusy(false); }
  }
  return <section className="shop-report-page">
    <a className="back report-back" href={`#/store/${encodeURIComponent(slug)}`} onClick={event => { event.preventDefault(); goBack(`/store/${encodeURIComponent(slug)}`); }}><ArrowLeft size={18} aria-hidden="true" />{text('Back to shop')}</a>
    <header className="report-intro">
      <span className="report-title-icon" aria-hidden="true"><Flag size={24} /></span>
      <div><h1>{text('Report shop')}</h1>{list.meta?.shop?.name && <p className="report-shop-name"><Store size={15} aria-hidden="true" />{list.meta.shop.name}</p>}</div>
      <IconButton label="Refresh reports" icon={RefreshCw} disabled={list.busy || busy} onClick={list.refresh} />
    </header>
    <FeatureError message={list.error} retry={list.retry} />
    {list.busy && !list.items.length ? <LoadingPanel variant="report" /> : !list.error && <>
      {notice && <p className="notice report-success" role="status"><ShieldCheck size={20} aria-hidden="true" />{notice}</p>}
      <aside className="report-guidance"><ShieldCheck size={22} aria-hidden="true" /><p>{text('Reports go to PwarMyar Office. Use shop chat for routine questions. A report does not cancel an order or request a refund.')}</p></aside>
      {active ? <div className="report-active notice"><ShieldCheck size={20} aria-hidden="true" /><p>{text('You already have an open report for this shop.')}</p></div> : list.meta?.shop?.can_report && <form className="feature-panel report-form" onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label htmlFor={`${fieldId}-reason`}>{text('Report reason')}</label>
          <select id={`${fieldId}-reason`} required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })}><option value="">{text('Choose a reason')}</option>{reportReasons.map(([value, title]) => <option value={value} key={value}>{text(title)}</option>)}</select>
          <div className="report-details-field"><label htmlFor={`${fieldId}-details`}>{text('What happened?')}</label><textarea id={`${fieldId}-details`} required minLength={10} maxLength={2000} aria-describedby={`${fieldId}-count`} value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} /><small id={`${fieldId}-count`} className="report-character-count">{form.details.length} / 2000</small></div>
          <div className="report-reference-field"><label htmlFor={`${fieldId}-reference`}>{text('Order reference (optional)')}</label><input id={`${fieldId}-reference`} maxLength={40} aria-describedby={`${fieldId}-reference-help`} value={form.order_reference} onChange={event => setForm({ ...form, order_reference: event.target.value })} /><small id={`${fieldId}-reference-help`}>{text('Use a reference from your own orders for this shop.')}</small></div>
          <FeatureError message={error} />
          <button type="submit" className="primary report-submit"><Flag size={18} aria-hidden="true" />{text(busy ? 'Please wait\u2026' : 'Send report to Office')}</button>
        </fieldset>
      </form>}
      {list.items.length > 0 && <section className="report-history"><h2>{text('Your reports for this shop')}</h2><div className="feature-list">{list.items.map(row => <article className="feature-panel report-history-card" key={row.id}>
        <div className="report-history-heading"><strong>#{row.id} · {text(reportReasons.find(([key]) => key === row.reason)?.[1] || 'Other issue')}</strong><span className={`report-status is-${row.status}`}>{text(statuses[row.status] || row.status)}</span></div>
        <time dateTime={`${row.created_at.replace(' ', 'T')}Z`}>{new Date(`${row.created_at.replace(' ', 'T')}Z`).toLocaleString()}</time><p>{row.details}</p>{row.order_reference && <small>{text('Order reference')}: {row.order_reference}</small>}{row.office_response && <div className="request-reply"><strong>{text('Office response')}</strong><p>{row.office_response}</p></div>}
      </article>)}</div></section>}
      <div ref={list.sentinel}>{list.busy ? <LoadingPanel variant="reviews" count={1} /> : list.more && <button type="button" onClick={list.retry}>{text('Load more')}</button>}</div>
    </>}
  </section>;
}
export function ShopReportPage({ slug }) { const { customer, loading } = useCustomer(); return loading ? <LoadingPanel variant="report" page /> : customer ? <ReportForm key={slug} slug={slug} /> : <CustomerAuth next={`/store/${encodeURIComponent(slug)}/report`} />; }
