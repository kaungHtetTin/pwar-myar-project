import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Save } from 'lucide-react';
import { request, requestDownload } from '../api';
import { Field, Modal } from '../components/common';
import '../styles/shop-sales-ai.css';
import { SalesAiBalanceBook } from './SalesAiBalanceBook';
import { SalesTelegramSettings } from './SalesTelegramSettings';

const root = '/shop-admin/sales-ai';
const money = value => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} MMK`;
function Proof({ id }) {
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let active = true, objectUrl;
    requestDownload(`${root}/topups/${id}/screenshot`, { accept: 'image/*' }).then(({ blob }) => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return error ? <p role="alert">{error}</p> : url ? <a href={url} target="_blank" rel="noreferrer"><img className="sales-ai-proof" src={url} alt="Top-up payment proof" /></a> : <p role="status">Loading proof…</p>;
}

export function ShopSalesAi({ refresh = 0, section = null, onSectionChange, topupId, onTopupClose }) {
  const [data, setData] = useState(null), [draft, setDraft] = useState(null), [localTab, setLocalTab] = useState('settings');
  const tab = section || localTab;
  const isHistory = ['wallet', 'topups'].includes(tab);
  const setTab = value => { if (onSectionChange) onSectionChange(value); else setLocalTab(value); };
  const [topups, setTopups] = useState(null), [walletRefresh, setWalletRefresh] = useState(0);
  const [error, setError] = useState(''), [errors, setErrors] = useState({}), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState(null), [detail, setDetail] = useState(null), [preview, setPreview] = useState('');
  const working = useRef(false), historyLoading = useRef(false), sentinel = useRef(null);
  const [loadErrors, setLoadErrors] = useState({});
  const loadError = loadErrors[tab] || '';
  const setLoadError = useCallback(value => setLoadErrors(current => ({ ...current, [tab]: value })), [tab]);
  const currentData = useRef(data); currentData.current = data;
  useEffect(() => {
    const changed = event => {
      const next = event.detail;
      if (next?.settings) {
        const before = currentData.current?.settings;
        setData(next);
        setDraft(current => ({ ...next.settings, ...Object.fromEntries(Object.entries(current || {}).filter(([key, value]) => key !== 'version' && JSON.stringify(value) !== JSON.stringify(before?.[key]))) }));
        setNotice('Sales AI updated in the assistant. Review any unsaved edits before saving.');
      }
      if (next?.wallet) setData(current => current && ({ ...current, wallet: next.wallet }));
      if (next?.wallet_changed) setWalletRefresh(value => value + 1);
      for (const request of next?.requests || (next?.request ? [next.request] : [])) {
        setTopups(current => current && ({ ...current, items: current.items.map(row => row.id === request.id && request.version >= row.version ? request : row) }));
        setDetail(current => current?.id === request.id && request.version >= current.version ? request : current);
      }
    };
    window.addEventListener('mkpos:sales-ai-updated', changed);
    return () => window.removeEventListener('mkpos:sales-ai-updated', changed);
  }, []);
  useEffect(() => {
    if (!topupId) return;
    let active = true;
    request(`${root}/topups/${topupId}`).then(result => { if (active) setDetail(current => current?.id === result.request.id && current.version > result.request.version ? current : result.request); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [topupId]);
  const closeDetail = () => { setDetail(null); setError(''); if (topupId) onTopupClose?.(); };
  const load = useCallback(async () => {
    const result = await request(root); setData(result); setDraft(result.settings);
  }, []);
  useEffect(() => {
    let active = true;
    request(root).then(result => { if (active) { setData(result); setDraft(result.settings); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [refresh, retry]);
  useEffect(() => {
    if (!editor?.file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(editor.file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [editor?.file]);
  const history = tab === 'topups' ? topups : null;
  const loadHistory = useCallback(async (append = false) => {
    if (historyLoading.current || tab !== 'topups') return;
    historyLoading.current = true; setLoading(true); setLoadError('');
    try {
      const result = await request(`${root}/${tab === 'wallet' ? 'wallet' : 'topups'}?limit=25&offset=${append ? history?.items.length || 0 : 0}`);
      const update = previous => ({ ...result, items: append ? [...new Map([...(previous?.items || []), ...result.items].map(row => [row.id, row])).values()] : result.items });
      setTopups(update);
    } catch (e) { setLoadError(e.message); } finally { historyLoading.current = false; setLoading(false); }
  }, [tab, history?.items.length, setLoadError]);
  useEffect(() => { if (tab === 'topups' && !history && !loading && !loadError) loadHistory(); }, [isHistory, tab, history, loadHistory, loading, loadError]);
  useEffect(() => {
    if (!history?.has_more || loading || loadError || !sentinel.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadHistory(true); });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [history, loading, loadError, loadHistory]);
  async function mutate(action) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try { await action(); } catch (e) { setError(e.message); setErrors(e.payload?.errors || e.errors || {}); }
    finally { working.current = false; setBusy(false); }
  }
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const fieldError = key => errors[key] && <small id={`sales-ai-${key}-error`} role="alert">{errors[key][0]}</small>;
  async function newTopup() {
    await mutate(async () => {
      const result = topups || await request(`${root}/topups?limit=25&offset=0`); setTopups(result);
      setEditor({ request_key: crypto.randomUUID(), amount: '', payment_method_id: result.payment_methods[0]?.id || '', transaction_reference: '', message: '', file: null });
    });
  }
  const telegramVisited = useRef(false);
  if (tab === 'telegram') telegramVisited.current = true;
  return <>{telegramVisited.current && <div hidden={tab !== 'telegram'}><SalesTelegramSettings /></div>}<section hidden={tab === 'telegram'} className="sales-ai-settings" aria-label="Sales AI management">
    <header className="sales-ai-heading"><div><h2>{section ? ({ settings: 'Configuration', tools: 'Tool permissions', policies: 'Sales policies', wallet: 'Balance book', topups: 'Top-up requests' }[tab]) : 'Sales AI'}</h2><p>{tab === 'wallet' ? 'MMK credit, transactions and AI usage.' : 'Represent your shop in customer conversations.'}</p></div><button type="button" aria-label="Refresh Sales AI" disabled={busy} onClick={() => mutate(async () => { await load(); if (tab === 'wallet') setWalletRefresh(value => value + 1); else if (tab === 'topups') await loadHistory(); })}><RefreshCw size={17} /></button></header>
    {error && <p role="alert">{error}{!data && <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>}</p>}
    {notice && <p role="status">{notice}</p>}
    {!data ? !error && <p role="status">Loading Sales AI…</p> : <>
      {(!section || isHistory) && <div className="sales-ai-wallet-summary"><div><small>Available credit</small><strong>{money(data.wallet.available)}</strong></div><div><small>Reserved for replies</small><strong>{money(data.wallet.reserved)}</strong></div><button type="button" className="primary" disabled={busy} onClick={newTopup}><Plus size={16} /> Top up</button></div>}
      {!section && <nav className="sales-ai-tabs" aria-label="Sales AI sections">{[['settings', 'Configuration'], ['wallet', 'Balance book'], ['topups', 'Top-up requests']].map(([key, title]) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'primary' : ''} disabled={busy} onClick={() => { setTab(key); setError(''); setLoadError(''); }}>{title}</button>)}</nav>}
      <div hidden={isHistory}><form className="shop-settings" onSubmit={event => { event.preventDefault(); mutate(async () => { const result = await request(root, { method: 'PUT', body: JSON.stringify(draft) }); setData(result); setDraft(result.settings); setNotice('Sales AI settings saved.'); }); }}>
        <fieldset disabled={busy} className="sales-ai-fields">
          {(!section || tab === 'settings') && <><label className="shop-checkbox"><input type="checkbox" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} /> Enable Sales AI</label>
          {[['name', 'Representative name', 80, 0], ['instructions', 'Agent instructions', 4000, 5], ['soul', 'Soul / personality', 2000, 3]].map(([key, label, max, rows]) => <Field key={key} label={label}>{rows ? <textarea required rows={rows} maxLength={max} value={draft[key]} onChange={event => change(key, event.target.value)} aria-describedby={`sales-ai-${key}-error`} /> : <input required maxLength={max} value={draft[key]} onChange={event => change(key, event.target.value)} aria-describedby={`sales-ai-${key}-error`} />}{fieldError(key)}</Field>)}
          </>}
          {(!section || tab === 'tools') && <fieldset className="sales-ai-tools"><legend>Tool permissions</legend>{data.tools.map(tool => <label key={tool.name}><input type="checkbox" checked={draft.tool_permissions.includes(tool.name)} onChange={event => change('tool_permissions', event.target.checked ? [...draft.tool_permissions, tool.name] : draft.tool_permissions.filter(name => name !== tool.name))} /><span><strong>{tool.name.replaceAll('_', ' ')}</strong><small>{tool.description}</small></span></label>)}<small>Customers can always request a person. Cart, checkout and request tools require customer confirmation. Payments, refunds and exceptions remain under shop control.</small></fieldset>}
          {(!section || tab === 'policies') && <fieldset className="sales-ai-policies"><legend>Published sales policies</legend><p className="muted">The representative shares only these published terms. Leave a field empty to require human clarification.</p>{[['delivery', 'Delivery policy'], ['payment', 'Payment policy'], ['cancellation', 'Cancellation policy'], ['returns', 'Return policy'], ['warranty', 'Warranty policy']].map(([key, label]) => <Field key={key} label={label}><textarea aria-label={label} rows={2} maxLength={2000} value={draft.sales_policies?.[key] || ''} onChange={event => change('sales_policies', { ...draft.sales_policies, [key]: event.target.value })} />{fieldError(`sales_policies.${key}`)}</Field>)}</fieldset>}
        </fieldset><div className="sales-ai-actions"><button type="button" disabled={busy} onClick={() => { setDraft(data.settings); setError(''); setErrors({}); }}>Reset changes</button><button className="primary" type="submit" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save Sales AI'}</button></div>
      </form></div>
      <SalesAiBalanceBook active={tab === 'wallet'} refreshToken={`${refresh}:${walletRefresh}`} onWalletChange={wallet => setData(current => current && ({ ...current, wallet }))} />
      {tab === 'topups' && <div className="shop-table-card"><div className="table-wrap"><table className="shop-data-table" aria-label={tab === 'wallet' ? 'Sales AI balance book' : 'Sales AI top-up requests'}><thead><tr><th>Date</th><th>{tab === 'wallet' ? 'Entry' : 'Request'}</th><th>Amount (MMK)</th><th>{tab === 'wallet' ? 'Balance (MMK)' : 'Status'}</th></tr></thead><tbody>{history?.items.map(row => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{tab === 'wallet' ? row.description : <button type="button" onClick={() => { setDetail(row); setError(''); }}>Top-up #{row.id}</button>}</td><td>{money(row.amount)}</td><td>{tab === 'wallet' ? money(row.balance_after) : row.status}</td></tr>)}</tbody></table></div>{!loading && history?.items.length === 0 && <p>No entries yet.</p>}{loadError && <p role="alert">{loadError}</p>}{loading && <p role="status">Loading…</p>}{(history?.has_more || loadError) && <button type="button" disabled={loading} onClick={() => loadHistory(Boolean(history))}>{loadError ? 'Retry' : 'Load more'}</button>}<div ref={sentinel} aria-hidden="true" /></div>}
    </>}
    {editor && <Modal open title="Top up Sales AI" size="medium" busy={busy} onClose={() => { setEditor(null); setError(''); }} footer={<><button type="button" disabled={busy} onClick={() => { setEditor(null); setError(''); }}>Cancel</button><button type="submit" form="sales-ai-topup" className="primary" disabled={busy || !topups?.payment_methods.length}>{busy ? 'Checking payment…' : 'Submit top-up'}</button></>}>
      <form id="sales-ai-topup" className="shop-settings" onSubmit={event => { event.preventDefault(); mutate(async () => {
        const body = new FormData(); for (const key of ['request_key', 'amount', 'payment_method_id', 'transaction_reference', 'message']) body.append(key, editor[key]); body.append('payment_screenshot', editor.file);
        const result = await request(`${root}/topups`, { method: 'POST', body, timeoutMs: 120000 });
        setTopups(current => ({ ...current, items: [result.request, ...current.items.filter(row => row.id !== result.request.id)] })); setEditor(null); setTab('topups'); setNotice('Top-up submitted for manual approval.');
      }); }}>
        {error && <p role="alert">{error}</p>}<fieldset disabled={busy} className="sales-ai-fields">
          <Field label="Amount (MMK)"><input required type="number" min="1" max="100000000" step="1" value={editor.amount} onChange={event => setEditor(current => ({ ...current, amount: event.target.value }))} aria-describedby="sales-ai-amount-error" />{fieldError('amount')}</Field>
          <fieldset className="sales-ai-accounts"><legend>Transfer to</legend>{topups?.payment_methods.map(method => <label key={method.id}><input type="radio" name="sales-ai-account" checked={Number(editor.payment_method_id) === method.id} onChange={() => setEditor(current => ({ ...current, payment_method_id: method.id }))} /><strong data-no-localize>{method.bank}</strong><span data-no-localize>{method.account_no} · {method.account_name}</span></label>)}{!topups?.payment_methods.length && <p>No payment accounts are available. Contact platform support.</p>}</fieldset>
          <Field label="Transaction reference (optional)"><input maxLength={120} value={editor.transaction_reference} onChange={event => setEditor(current => ({ ...current, transaction_reference: event.target.value }))} aria-describedby="sales-ai-transaction_reference-error" />{fieldError('transaction_reference')}</Field>
          <Field label="Payment proof"><input required type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="sales-ai-payment_screenshot-error" onChange={event => { const file = event.target.files[0]; if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { event.target.value = ''; setError('Choose a JPG, PNG or WebP image up to 5 MB.'); setEditor(current => ({ ...current, file: null })); return; } setError(''); setEditor(current => ({ ...current, file })); }} />{fieldError('payment_screenshot')}{preview && <img className="sales-ai-proof" src={preview} alt="Selected payment proof" />}</Field>
          <Field label="Note (optional)"><textarea rows={2} maxLength={1000} value={editor.message} onChange={event => setEditor(current => ({ ...current, message: event.target.value }))} /></Field>
          <p role={busy ? 'status' : undefined}>{busy ? 'Checking your receipt. Please wait.' : 'AI checks your receipt and extracts the transaction ID. Office approval is still required.'}</p>
        </fieldset>
      </form>
    </Modal>}
    {detail && <Modal open title={`Top-up #${detail.id}`} size="medium" busy={busy} onClose={closeDetail} footer={<><button type="button" disabled={busy} onClick={closeDetail}>Close</button>{detail.status === 'pending' && <button type="button" disabled={busy} onClick={() => mutate(async () => { const result = await request(`${root}/topups/${detail.id}/cancel`, { method: 'POST', body: JSON.stringify({ version: detail.version }) }); setDetail(result.request); setTopups(current => current && ({ ...current, items: current.items.map(row => row.id === detail.id ? result.request : row) })); })}>Cancel request</button>}</>}>
      {error && <p role="alert">{error}</p>}<p><strong>{money(detail.amount)}</strong> · {detail.status}</p><p>{detail.transaction_reference ? <span data-no-localize>{detail.transaction_reference}</span> : 'No reference'}{detail.review_note && <> · <span data-no-localize>{detail.review_note}</span></>}</p><Proof id={detail.id} />
    </Modal>}
  </section></>;
}
