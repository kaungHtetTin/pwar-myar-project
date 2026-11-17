import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, ChevronRight, Plus, Settings2, BookOpen, ClipboardList, Wallet } from 'lucide-react';
import { Badge, Button, FloatingActionButton, IconButton, Input, Switch, Textarea } from '../components/Controls';
import { EndlessListFooter, MobileDeleteSheet } from '../components/MobilePrimitives';
import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { usePageRefresh } from '../navigation/pageRefresh';
import { apiRequest } from '../api/client';
import { useEndlessList } from '../hooks/useEndlessList';
import { useShopResource } from './useShopResource';
import { ShopField, ShopLoadState, ShopPrivateImage } from './ShopPrimitives';
import { fieldErrors } from './shopUtils';
import { BillingAccount } from '../billing/BillingReferenceParts';
import { SalesAiUsageCharts } from './SalesAiUsageCharts';
import { getBusinessTimezone } from '../timezone';
import { SalesTelegramPage } from './SalesTelegramPage';

const root = '/shop-admin/sales-ai', page = '/shop/sales-ai';
const money = value => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK`;
const publish = data => window.dispatchEvent(new CustomEvent('mkpos:sales-ai-updated', { detail: data }));
const topupStatus = status => ({ pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }[status] || status);
const topupTone = status => status === 'pending' ? 'warning' : status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'muted';
function Header({ title = 'Sales AI', onNavigate, fallback = page }) {
  return <PageAppBar><IconButton variant="ghost" aria-label="Back" onClick={() => onNavigate(fallback, { back: true })}><ArrowLeft size={21} /></IconButton><h1>{title}</h1><AppBarMenu /></PageAppBar>;
}
function Overview({ onNavigate }) {
  const resource = useShopResource(root);
  const [busy, setBusy] = useState(false), [toggleError, setToggleError] = useState('');
  const toggling = useRef(false);
  const setData = resource.setData;
  useEffect(() => {
    const changed = event => { if (event.detail.settings) setData(event.detail); else if (event.detail.wallet) setData(current => current && ({ ...current, wallet: event.detail.wallet })); };
    window.addEventListener('mkpos:sales-ai-updated', changed); return () => window.removeEventListener('mkpos:sales-ai-updated', changed);
  }, [setData]);
  async function toggleEnabled(event) {
    if (toggling.current) return;
    const enabled = event.target.checked;
    toggling.current = true; setBusy(true); setToggleError('');
    try {
      const result = await apiRequest(root, { method: 'PUT', body: JSON.stringify({ ...resource.data.settings, enabled }) });
      setData(result); publish(result);
    } catch (error) { setToggleError(error.message); }
    finally { toggling.current = false; setBusy(false); }
  }
  return <><Header onNavigate={onNavigate} fallback="/shop" /><div className="sales-ai-overview"><ShopLoadState resource={resource}>{resource.data && <>
    <section className="shop-mobile-card sales-ai-credit" aria-label="Sales AI credit">
      <div className="sales-ai-credit-label"><Wallet size={18} aria-hidden="true" /><span>Available credit</span></div>
      <strong className="sales-ai-credit-amount">{money(resource.data.wallet.available)}</strong>
      <div className="sales-ai-credit-footer"><small>{money(resource.data.wallet.reserved)} reserved</small><Button variant="primary" onClick={() => onNavigate(`${page}/topups/new`)}><Plus size={16} aria-hidden="true" />Top up</Button></div>
    </section>
    <section className="shop-mobile-card sales-ai-settings" aria-label="Sales AI settings">
      <div className="sales-ai-identity"><span className="sales-ai-overview-icon"><Bot size={22} aria-hidden="true" /></span><div><h2>{resource.data.settings.name}</h2><Badge tone={resource.data.settings.enabled ? 'success' : 'muted'} dot>{resource.data.settings.enabled ? 'Sales AI enabled' : 'Sales AI disabled'}</Badge></div><Switch aria-label="Enable Sales AI" checked={resource.data.settings.enabled} disabled={busy} aria-busy={busy} onChange={toggleEnabled} /></div>
      {busy && <p className="sales-ai-toggle-notice" role="status">Saving Sales AI status…</p>}
      {toggleError && <p className="sales-ai-toggle-notice sales-ai-toggle-error" role="alert">{toggleError}</p>}
      <div className="sales-ai-settings-rows">{[
        ['configure', 'Configuration', 'Name, instructions and permissions', Settings2],
        ['telegram', 'Telegram bot', 'Shop bot, approved groups and guest checkout', Bot],
        ['wallet', 'Balance book', 'Credit usage and balance history', BookOpen],
        ['topups', 'Top-up requests', 'Payment requests and approval status', ClipboardList],
      ].map(([key, title, description, Icon]) => <Button variant="plain" className="sales-ai-settings-row" key={key} onClick={() => onNavigate(`${page}/${key}`)}><span className="sales-ai-overview-icon"><Icon size={18} aria-hidden="true" /></span><span className="sales-ai-row-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} aria-hidden="true" /></Button>)}</div>
    </section>
  </>}</ShopLoadState></div></>;
}
function Configure({ onNavigate }) {
  const resource = useShopResource(root), [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const working = useRef(false);
  const previousSettings = useRef(null);
  useEffect(() => {
    if (!resource.data?.settings) return;
    const next = resource.data.settings, before = previousSettings.current;
    previousSettings.current = next;
    setDraft(current => ({ ...next, ...Object.fromEntries(Object.entries(current || {}).filter(([key, value]) => key !== 'version' && JSON.stringify(value) !== JSON.stringify(before?.[key]))) }));
  }, [resource.data]);
  const setResourceData = resource.setData;
  useEffect(() => {
    const changed = event => { if (event.detail?.settings) setResourceData(event.detail); };
    window.addEventListener('mkpos:sales-ai-updated', changed);
    return () => window.removeEventListener('mkpos:sales-ai-updated', changed);
  }, [setResourceData]);
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault(); if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try { const result = await apiRequest(root, { method: 'PUT', body: JSON.stringify(draft) }); resource.setData(result); publish(result); onNavigate(page, { back: true }); }
    catch (e) { setError(e.message); setErrors(fieldErrors(e)); } finally { working.current = false; setBusy(false); }
  }
  return <><Header title="Sales AI configuration" onNavigate={onNavigate} /><ShopLoadState resource={resource}>{draft && <form className="shop-mobile-form shop-mobile-card sales-ai-mobile-form" onSubmit={save}>
    {error && <p role="alert">{error}</p>}<fieldset disabled={busy}>
      <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />Enable Sales AI</label>
      <ShopField name="name" label="Representative name" errors={errors}><Input required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} /></ShopField>
      <ShopField name="instructions" label="Agent instructions" errors={errors}><Textarea required rows={5} maxLength={4000} value={draft.instructions} onChange={event => change('instructions', event.target.value)} /></ShopField>
      <ShopField name="soul" label="Soul / personality" errors={errors}><Textarea required rows={3} maxLength={2000} value={draft.soul} onChange={event => change('soul', event.target.value)} /></ShopField>
      <fieldset className="sales-ai-mobile-tools"><legend>Tool permissions</legend>{resource.data.tools.map(tool => <label key={tool.name} className="sales-ai-mobile-choice"><Input type="checkbox" checked={draft.tool_permissions.includes(tool.name)} onChange={event => change('tool_permissions', event.target.checked ? [...draft.tool_permissions, tool.name] : draft.tool_permissions.filter(value => value !== tool.name))} /><span><strong>{tool.name.replaceAll('_', ' ')}</strong><small>{tool.description}</small></span></label>)}</fieldset>
      <fieldset><legend>Published sales policies</legend><p>Customers confirm carts, orders and requests. The shop still verifies funds and approves refunds and exceptions.</p><p>Empty policies require human clarification.</p>{[['delivery', 'Delivery policy'], ['payment', 'Payment policy'], ['cancellation', 'Cancellation policy'], ['returns', 'Return policy'], ['warranty', 'Warranty policy']].map(([key, label]) => <ShopField key={key} name={`sales_policies.${key}`} label={label} errors={errors}><Textarea aria-label={label} rows={2} maxLength={2000} value={draft.sales_policies?.[key] || ''} onChange={event => change('sales_policies', { ...draft.sales_policies, [key]: event.target.value })} /></ShopField>)}</fieldset>
      <p>Customers can always request a person. AI cannot approve payments or change business records.</p>
    </fieldset><Button type="submit" variant="primary" busy={busy}>Save Sales AI</Button><Button onClick={() => onNavigate(page, { back: true })} disabled={busy}>Cancel</Button>
  </form>}</ShopLoadState></>;
}
function History({ kind, onNavigate }) {
  const [updates, setUpdates] = useState({});
  const [usage, setUsage] = useState(null);
  const list = useEndlessList({ queryKey: `sales-ai-${kind}`, loadPage: async ({ limit, offset, signal }) => {
    const result = await apiRequest(`${root}/${kind}?limit=${limit}&offset=${offset}${kind === 'wallet' ? `&include_usage=${offset === 0 ? 1 : 0}` : ''}`, { signal });
    if (!signal.aborted && kind === 'wallet' && offset === 0) setUsage(result.usage || null);
    return result;
  } });
  usePageRefresh(list.reload);
  const reloadHistory = list.reload;
  useEffect(() => {
    const changed = event => {
      for (const request of event.detail.requests || (event.detail.request ? [event.detail.request] : [])) {
        setUpdates(current => !current[request.id] || request.version >= current[request.id].version ? { ...current, [request.id]: request } : current);
      }
      if (kind === 'wallet' && event.detail.wallet_changed) void reloadHistory();
    };
    window.addEventListener('mkpos:sales-ai-updated', changed); return () => window.removeEventListener('mkpos:sales-ai-updated', changed);
  }, [kind, reloadHistory]);
  const rows = kind === 'topups' ? [...new Map([...Object.values(updates), ...list.items.map(row => updates[row.id]?.version >= row.version ? updates[row.id] : row)].map(row => [row.id, row])).values()].sort((a, b) => b.id - a.id) : list.items;
  return <><Header title={kind === 'wallet' ? 'Sales AI balance book' : 'Sales AI top-ups'} onNavigate={onNavigate} />{kind === 'topups' && <FloatingActionButton label="Add top-up" onClick={() => onNavigate(`${page}/topups/new`)}><Plus size={24} aria-hidden="true" /></FloatingActionButton>}
    <section className={`shop-mobile-list${kind === 'wallet' ? ' sales-ai-wallet-page' : ' sales-ai-topups-page'}`} aria-label={kind === 'wallet' ? 'Balance book' : 'Top-up requests'}>
      {kind === 'wallet' && (usage ? <SalesAiUsageCharts usage={usage} /> : !list.initialLoading && !list.error && <p className="sales-ai-usage-context">Usage charts are unavailable.</p>)}
      {kind === 'wallet' && <h2 className="sales-ai-ledger-title">Balance transactions</h2>}
      {list.initialLoading && <p role="status">Loading records…</p>}{!list.initialLoading && !list.error && !rows.length && (kind === 'topups' ? <div className="sales-ai-topups-empty"><span className="sales-ai-overview-icon"><Wallet size={22} aria-hidden="true" /></span><h2>No top-up requests yet</h2><p>Use the + button to add Sales AI credit.</p></div> : <p>No records yet.</p>)}
      {kind === 'topups' && list.error && !rows.length && <div className="sales-ai-topups-empty"><p role="alert">{list.error}</p><Button onClick={list.retry}>Retry</Button></div>}
      <div className={kind === 'wallet' && rows.length ? 'sales-ai-ledger' : 'shop-mobile-list'}>{rows.map(row => kind === 'wallet' ? <article className="sales-ai-ledger-row" key={row.id}>
        <div className="sales-ai-ledger-primary"><strong data-no-localize>{row.description}</strong><b className={Number(row.amount) < 0 ? 'is-debit' : 'is-credit'}>{Number(row.amount) > 0 ? '+' : ''}{money(row.amount)}</b></div>
        <div className="sales-ai-ledger-meta"><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString(undefined, { timeZone: usage?.timezone || getBusinessTimezone(), month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time><span>Balance {money(row.balance_after)}</span></div>
      </article> : <Button variant="plain" className="sales-ai-topup-card" aria-label={`View top-up #${row.id}`} key={row.id} onClick={() => onNavigate(`${page}/topups/${row.id}`)}><span className="sales-ai-overview-icon"><Wallet size={19} aria-hidden="true" /></span><span className="sales-ai-topup-card-copy"><span className="sales-ai-topup-card-heading"><strong>{money(row.amount)}</strong><Badge tone={topupTone(row.status)} dot>{row.status === 'pending' ? 'Pending' : topupStatus(row.status)}</Badge></span><span className="sales-ai-topup-card-meta"><span>#{row.id}</span><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString(undefined, { timeZone: getBusinessTimezone(), month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time></span>{row.payment_account?.bank && <small>{row.payment_account.bank}</small>}</span><ChevronRight size={18} aria-hidden="true" /></Button>)}</div>
      <EndlessListFooter list={list} count={rows.length} noun="records" labels={kind === 'topups' ? { end: `${rows.length} ${rows.length === 1 ? 'request' : 'requests'} · All loaded` } : undefined} />
    </section></>;
}
function Topup({ onNavigate }) {
  const resource = useShopResource(`${root}/topups?limit=1&offset=0`);
  const [accountNotice, setAccountNotice] = useState(null);
  const [form, setForm] = useState({ amount: '', payment_method_id: '', transaction_reference: '', message: '' }), [file, setFile] = useState(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({});
  const working = useRef(false), requestKey = useRef(crypto.randomUUID());
  useEffect(() => { if (resource.data) setForm(current => ({ ...current, payment_method_id: current.payment_method_id || resource.data.payment_methods[0]?.id || '' })); }, [resource.data]);
  useEffect(() => { if (!file) { setPreview(''); return undefined; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try {
      const body = new FormData(); body.append('request_key', requestKey.current); Object.entries(form).forEach(([key, value]) => body.append(key, value)); if (file) body.append('payment_screenshot', file);
      const result = await apiRequest(`${root}/topups`, { method: 'POST', body, timeoutMs: 120000 }); publish(result); requestKey.current = crypto.randomUUID(); setFile(null); setForm({ amount: '', payment_method_id: form.payment_method_id, transaction_reference: '', message: '' }); onNavigate(`${page}/topups/${result.request.id}`, { replace: true });
    } catch (e) { setError(e.message); setErrors(fieldErrors(e)); } finally { working.current = false; setBusy(false); }
  }
  return <><Header title="Top up Sales AI" onNavigate={onNavigate} fallback={`${page}/topups`} /><ShopLoadState resource={resource}>{resource.data && <form onSubmit={submit} className="shop-mobile-form shop-mobile-card sales-ai-mobile-form">
    {error && <p role="alert">{error}</p>}<fieldset disabled={busy}>
      <ShopField name="amount" label="Amount (MMK)" errors={errors}><Input required type="number" min="1" max="100000000" step="1" value={form.amount} onChange={event => change('amount', event.target.value)} /></ShopField>
      <fieldset className="sales-ai-mobile-tools"><legend>Transfer to</legend><BillingAccount methods={resource.data.payment_methods} method={resource.data.payment_methods.find(method => Number(form.payment_method_id) === method.id)} onChange={value => change('payment_method_id', value)} onNotice={setAccountNotice} />{accountNotice && <p role={accountNotice.type === 'error' ? 'alert' : 'status'}>{accountNotice.text}</p>}{!resource.data.payment_methods.length && <p>No payment accounts available. Contact platform support.</p>}</fieldset>
      <ShopField name="transaction_reference" label="Transaction reference (optional)" errors={errors}><Input maxLength={120} value={form.transaction_reference} onChange={event => change('transaction_reference', event.target.value)} /></ShopField>
      <ShopField name="payment_screenshot" label="Payment proof" errors={errors}><Input required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const next = event.target.files?.[0]; if (!next) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 5 * 1024 * 1024) { event.target.value = ''; setFile(null); setError('Choose a JPG, PNG or WebP image up to 5 MB.'); return; } setError(''); setFile(next); }} /></ShopField>
      {preview && <img className="sales-ai-mobile-proof" src={preview} alt="Selected payment proof" />}
      <ShopField name="message" label="Note (optional)" errors={errors}><Textarea rows={2} maxLength={1000} value={form.message} onChange={event => change('message', event.target.value)} /></ShopField>
      <p role={busy ? 'status' : undefined}>{busy ? 'Checking your receipt. Please wait.' : 'AI checks your receipt and extracts the transaction ID. Office approval is still required.'}</p>
    </fieldset><Button type="submit" variant="primary" busy={busy} disabled={!resource.data.payment_methods.length}>Submit top-up</Button><Button disabled={busy} onClick={() => onNavigate(`${page}/topups`, { back: true })}>Cancel</Button>
  </form>}</ShopLoadState></>;
}
function Detail({ id, onNavigate }) {
  const resource = useShopResource(`${root}/topups/${id}`), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false), row = resource.data?.request;
  const setResourceData = resource.setData;
  useEffect(() => {
    const changed = event => {
      const request = (event.detail?.requests || (event.detail?.request ? [event.detail.request] : [])).find(row => Number(row.id) === Number(id));
      if (request) { setResourceData(current => current?.request?.version > request.version ? current : { request }); setConfirm(false); }
    };
    window.addEventListener('mkpos:sales-ai-updated', changed);
    return () => window.removeEventListener('mkpos:sales-ai-updated', changed);
  }, [id, setResourceData]);
  async function cancel() {
    if (working.current) return; working.current = true; setBusy(true); setError('');
    try { const result = await apiRequest(`${root}/topups/${id}/cancel`, { method: 'POST', body: JSON.stringify({ version: row.version }) }); resource.setData(result); publish(result); setConfirm(false); }
    catch (e) { setError(e.message); } finally { working.current = false; setBusy(false); }
  }
  const statusLabel = topupStatus(row?.status);
  return <><Header title={`Top-up #${id}`} onNavigate={onNavigate} fallback={`${page}/topups`} /><div className="sales-ai-topup-detail"><ShopLoadState resource={resource}>{row && <>
    <section className="shop-mobile-card sales-ai-topup-summary" aria-label="Top-up summary">
      <div className="sales-ai-topup-summary-label"><span className="sales-ai-overview-icon"><Wallet size={18} aria-hidden="true" /></span><span>Top-up amount</span><Badge tone={topupTone(row.status)} dot>{statusLabel}</Badge></div>
      <h2>{money(row.amount)}</h2>
      {row.status === 'pending' && <p>Your payment proof is awaiting approval.</p>}
    </section>
    <section className="shop-mobile-card sales-ai-topup-payment" aria-labelledby={`sales-ai-payment-heading-${id}`}><h2 id={`sales-ai-payment-heading-${id}`}>Payment details</h2><dl>
      <div><dt>Payment method</dt><dd>{row.payment_account.bank}</dd></div>
      <div><dt>Account number</dt><dd>{row.payment_account.account_no}</dd></div>
      {row.payment_account.account_name && <div><dt>Account name</dt><dd>{row.payment_account.account_name}</dd></div>}
      <div><dt>Transaction reference</dt><dd>{row.transaction_reference || 'No reference'}</dd></div>
      {row.created_at && <div><dt>Requested</dt><dd><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString(undefined, { timeZone: getBusinessTimezone() })}</time></dd></div>}
      {row.message && <div className="sales-ai-topup-note"><dt>Note</dt><dd data-no-localize>{row.message}</dd></div>}
      {row.review_note && <div className="sales-ai-topup-note"><dt>Review note</dt><dd data-no-localize>{row.review_note}</dd></div>}
    </dl></section>
    <section className="shop-mobile-card sales-ai-topup-receipt" aria-labelledby={`sales-ai-proof-heading-${id}`}><h2 id={`sales-ai-proof-heading-${id}`}>Payment proof</h2><ShopPrivateImage path={`${root}/topups/${id}/screenshot`} label="Top-up payment proof" /></section>
    {error && !confirm && <p className="sales-ai-topup-error" role="alert">{error}</p>}
    {row.status === 'pending' && <Button variant="danger-ghost" className="sales-ai-topup-cancel" disabled={busy} onClick={() => setConfirm(true)}>Cancel request</Button>}
  </>}</ShopLoadState></div><MobileDeleteSheet open={confirm} title="Cancel top-up request?" itemTitle={`Top-up #${id}`} itemDescription={row && money(row.amount)} busy={busy} busyLabel="Cancelling…" onClose={() => setConfirm(false)} onConfirm={cancel} confirmLabel="Cancel request"><p>This pending request will not be credited.</p>{error && <p role="alert">{error}</p>}</MobileDeleteSheet></>;
}
export function ShopSalesAi({ pathname, onNavigate }) {
  if (pathname === `${page}/telegram` || pathname.startsWith(`${page}/telegram/`)) return <SalesTelegramPage pathname={pathname} onNavigate={onNavigate} />;
  if (pathname === `${page}/configure`) return <Configure onNavigate={onNavigate} />;
  if (pathname === `${page}/topups/new`) return <Topup onNavigate={onNavigate} />;
  const id = pathname.match(/^\/shop\/sales-ai\/topups\/(\d+)$/)?.[1];
  if (id) return <Detail id={id} onNavigate={onNavigate} />;
  if (pathname === `${page}/wallet` || pathname === `${page}/topups`) return <History kind={pathname.endsWith('/wallet') ? 'wallet' : 'topups'} onNavigate={onNavigate} />;
  return <Overview onNavigate={onNavigate} />;
}
