import React, { useEffect, useRef, useState } from 'react';
import './business-actions.css';

const titles = { manage_sales_ai_telegram_settings:'Sales AI Telegram settings',manage_sales_ai_telegram_groups:'Sales AI Telegram groups', manage_sales_ai_settings:'Sales AI configuration',manage_sales_ai_tools:'Sales AI tool permissions',manage_sales_ai_policies:'Sales AI sales policies',manage_sales_ai_handover:'Sales AI conversation handover',manage_sales_ai_topups:'Cancel Sales AI top-up', manage_sales:'Sales',manage_purchases:'Purchases',manage_account_payments:'Account payments',manage_inventory:'Stock adjustment',manage_business_records:'Archive or delete records',manage_business_timezone:'Business time zone',manage_shop_settings:'Shop settings',manage_shop_contacts:'Shop contacts',manage_shop_delivery_zones:'Delivery zones',manage_shop_payment_methods:'Shop receiving methods',manage_shop_catalog:'Online catalog',manage_shop_orders:'Online order',manage_shop_promotions:'Shop promotions',manage_shop_customers:'Shop customer',manage_shop_reviews:'Shop review reply', manage_price_types: 'Price types and rules', create_purchase_draft: 'Invoice purchase draft', manage_app_settings: 'App settings', create_product: 'Add product', update_product: 'Update product', update_product_prices: 'Update product prices', execute_product_import: 'Import products', create_customer: 'Add customer', update_customer: 'Update customer', create_supplier: 'Add supplier', update_supplier: 'Update supplier', create_expense: 'Record expense', update_expense: 'Update expense' };
const label = key => key === 'is_manual' ? 'Pricing mode' : key.replaceAll('_', ' ');
function valueText(value, key = '') {
  if (key === 'is_manual') return value ? 'Manual' : 'Automatic';
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(value => valueText(value)).join('; ');
  if (typeof value === 'object') return Object.entries(value).map(([key, value]) => `${label(key)}: ${valueText(value, key)}`).join(', ');
  return String(value);
}


function LineItems({ items, title }) {
  if (!items?.length) return null;
  const keys = ['product', 'unit', 'quantity', 'foc_quantity', 'unit_price', 'unit_cost', 'line_total'].filter(key => items.some(item => item[key] !== undefined || (key === 'product' && (item.product_name || item.name)) || (key === 'unit' && item.unit_name)));
  return <div className="ai-action-lines"><table aria-label={title}><caption>{title}</caption><thead><tr>{keys.map(key => <th key={key}>{label(key)}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={index}>{keys.map(key => <td key={key}>{valueText(item[key] ?? (key === 'product' ? item.product_name ?? item.name : key === 'unit' ? item.unit_name : null), key)}</td>)}</tr>)}</tbody></table></div>;
}

export function BusinessActions({ api, conversation, actions, onChange, onAppend, onBusy, onSaved, disabled = false, stateCache = null, onOpenPurchaseDraft }) {
  const cached = stateCache?.current?.conversation === conversation ? stateCache.current : null;
  const [review, setReview] = useState(cached?.review ?? null), [checked, setChecked] = useState(cached?.checked ?? false), [busy, setBusy] = useState(false), [error, setError] = useState(cached?.error ?? '');
  const [edits, setEdits] = useState(cached?.edits ?? {});
  const [adminPin,setAdminPin]=useState(''),[verifiedPayment,setVerifiedPayment]=useState(false),[verifiedGoods,setVerifiedGoods]=useState(false);
  useEffect(()=>{setAdminPin('');setVerifiedPayment(false);setVerifiedGoods(false);},[review?.id,review?.preview_hash,review?.status]);
  useEffect(() => { if (stateCache) stateCache.current = { conversation, review, checked, edits, error }; }, [stateCache, conversation, review, checked, edits, error]);
  const settingsItem = review?.operation === 'manage_app_settings' ? review.preview.items[0] : null;
  const dirty = settingsItem && Object.keys(edits).some(key => String(edits[key]) !== String(settingsItem.after[key]));
  const running = useRef(false), alive = useRef(true), trigger = useRef(null), root = useRef(null);
  const base = `/ai-assistant/conversations/${conversation}/actions`;
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusy(false); }; }, [onBusy]);
  const run = async task => {
    if (running.current) return;
    running.current = true; setBusy(true); onBusy(true); setError('');
    try { await task(); } catch (e) { if (alive.current) setError(e.message); }
    finally { running.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  };
  const open = (action, event) => {
    trigger.current = event.currentTarget;
    void run(async () => {
      const next = await api(`${base}/${action.id}?limit=100&offset=0`);
      if (alive.current) { setReview(next); setEdits({}); setChecked(false); onChange(next); if (action.status !== 'completed' && next.status === 'completed') onSaved(next.result); }
    });
  };
  const close = () => { if (running.current) return; setReview(null); setEdits({}); setChecked(false); setAdminPin(''); setVerifiedPayment(false); setVerifiedGoods(false); setError(''); (trigger.current?.isConnected ? trigger.current : root.current?.querySelector('ul button'))?.focus?.(); };
  const more = () => void run(async () => {
    const next = await api(`${base}/${review.id}?limit=100&offset=${review.preview.next_offset}`);
    if (!alive.current) return;
    if (next.preview_hash !== review.preview_hash) { setReview(next); setEdits({}); setChecked(false); throw new Error('The preview changed. Review it again.'); }
    setReview(previous => ({ ...next, preview: { ...next.preview, items: [...previous.preview.items, ...next.preview.items] } }));
  });
  const decide = choice => void run(async () => {
    const decision=choice === 'confirm' ? { preview_hash: review.preview_hash, reviewed_count: review.preview.total, ...(review.requires_pin?{admin_pin:adminPin}:{}), ...(review.requires_payment_verification?{verified_payment:verifiedPayment}:{}), ...(review.requires_goods_verification?{verified_goods_return:verifiedGoods}:{}) } : {};
    setAdminPin('');
    const result = await api(`${base}/${review.id}/${choice}`, { method: 'POST', timeoutMs: 190000, body: JSON.stringify(decision) });
    if (!alive.current) return;
    setReview(result); setChecked(false); onChange(result);
    if (result.status === 'completed') onSaved(result.result);
  });
  const revise = event => { event.preventDefault(); void run(async () => {
    const next = await api(`${base}/${review.id}/revise`, { method: 'POST', body: JSON.stringify({ preview_hash: review.preview_hash, values: { ...settingsItem.after, ...edits } }) });
    if (!alive.current) return;
    onChange({ ...review, status: 'cancelled' }); onAppend({ items: [next], has_more: actions.has_more, next_offset: actions.next_offset });
    setReview(next); setEdits({}); setChecked(false);
  }); };
  const refresh = () => void run(async () => {
    const next = await api(`${base}/${review.id}?limit=100&offset=0`);
    if (alive.current) { setReview(next); setEdits({}); setChecked(false); onChange(next); if (review.status !== 'completed' && next.status === 'completed') onSaved(next.result); }
  });
  if (!actions.items?.length) return null;
  return <section ref={root} className="ai-business-actions" aria-label="Proposed business changes">
    <h3>Business changes</h3>
    <p>Changes are saved only after you review and confirm them here.</p>
    <ul>{actions.items.map(action => <li key={action.id}>
      <span><strong>{titles[action.operation] || 'Business change'}</strong>{action.target_names?.length > 0 && <small data-no-localize>{action.target_names.join(', ')}</small>}<small>{action.preview.total} change{action.preview.total === 1 ? '' : 's'} · {action.status === 'completed' ? 'Saved' : action.status}</small></span>
      <button type="button" disabled={disabled || busy} onClick={event => open(action, event)} aria-label={`Review ${titles[action.operation] || 'business change'}`}>Review</button>
    </li>)}</ul>
    {actions.has_more && <button type="button" disabled={disabled || busy} onClick={() => void run(async () => { const page = await api(`${base}?offset=${actions.next_offset}`); if (alive.current) onAppend(page); })}>Load older changes</button>}
    {review && <article className="ai-action-review" aria-label="Review business changes" aria-busy={busy}>
      <div className="ai-action-heading"><h4>{titles[review.operation] || 'Review changes'}</h4><button type="button" disabled={busy} onClick={close}>Close review</button></div>
      <p>{review.preview.total} change{review.preview.total === 1 ? '' : 's'} · {review.currency || 'Business currency'}</p>
      {review.import_summary && <p>CSV: {review.import_summary.filename}. Ready: {review.import_summary.ready}; skipped: {review.import_summary.skipped}; invalid: {review.import_summary.invalid}. Only the listed ready products will be imported.</p>}
      {settingsItem?.notice && <p>{settingsItem.notice}</p>}
      {settingsItem?.editable && review.status === 'pending' && <form className="ai-settings-form" onSubmit={revise}>
        <p>Edit proposed values, then refresh the review before approving.</p>
        {settingsItem.fields.map(field => <label className={`ai-settings-field${field.type === 'textarea' ? ' is-wide' : ''}`} key={field.key}><span>{field.label}</span><small>Current: <span data-no-localize>{valueText(settingsItem.before[field.key])}</span></small>
          {field.type === 'select' ? <select aria-label={field.label} disabled={busy} value={edits[field.key] ?? settingsItem.after[field.key]} onChange={event => { setEdits(previous => ({ ...previous, [field.key]: event.target.value })); setChecked(false); }}>{field.options.map(option => <option key={option} value={option}>{option === '1' ? 'Yes' : option === '0' ? 'No' : option}</option>)}</select>
          : field.type === 'textarea' ? <textarea aria-label={field.label} disabled={busy} maxLength={field.maxLength} value={edits[field.key] ?? settingsItem.after[field.key]} onChange={event => { setEdits(previous => ({ ...previous, [field.key]: event.target.value })); setChecked(false); }}/>
          : <input aria-label={field.label} disabled={busy} type={field.type} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength} value={edits[field.key] ?? settingsItem.after[field.key]} onChange={event => { setEdits(previous => ({ ...previous, [field.key]: event.target.value })); setChecked(false); }}/>}
        </label>)}
        <div className="ai-settings-form-actions"><button type="submit" disabled={busy || !dirty}>Refresh review</button></div>
        {dirty && <p role="status">Unsaved edits. Refresh review to validate these values.</p>}
      </form>}
      {review.preview.items.map((item, index) => <section className="ai-action-record" key={`${item.record_id || item.row_number || 'new'}:${index}`}>
        <strong>{item.name}{item.record_id ? ` · #${item.record_id}` : item.row_number ? ` · Row ${item.row_number}` : ''}</strong>
        <dl>{[...new Set([...Object.keys(item.before || {}), ...Object.keys(item.after)])].filter(key => key !== 'items').map(key => [key, Object.hasOwn(item.after, key) ? item.after[key] : item.after.deleted ? 'Removed' : 'Unchanged']).map(([key, value]) => <React.Fragment key={key}><dt>{label(key)}</dt><dd>{item.before && Object.hasOwn(item.before, key) && <><span className="ai-action-old" data-no-localize>{valueText(item.before[key], key)}</span><span aria-label="changes to"> → </span></>}<span data-no-localize>{valueText(value, key)}</span></dd></React.Fragment>)}</dl>
        <LineItems items={item.before?.items} title="Current line items"/><LineItems items={item.after.items} title="Proposed line items"/>
      </section>)}
      {review.preview.has_more && <button type="button" disabled={busy} onClick={more}>Load more changes ({review.preview.items.length} of {review.preview.total})</button>}
      {review.status === 'pending' && <>
        <p>Expires {new Date(review.expires_at).toLocaleString()}. If the records change, prepare a new proposal.</p>
        {review.requires_pin && <label className="ai-settings-field ai-management-pin"><span>Admin PIN</span><input type="password" inputMode="numeric" autoComplete="off" aria-label="Admin PIN" maxLength={64} disabled={busy} value={adminPin} onChange={event=>{setAdminPin(event.target.value);setChecked(false);}}/><small>Enter your PIN only here. It is never sent to the AI or saved in chat.</small></label>}
        {review.requires_payment_verification && <label className="ai-action-consent"><input type="checkbox" aria-label="Verified actual payment" checked={verifiedPayment} disabled={busy} onChange={event=>{setVerifiedPayment(event.target.checked);setChecked(false);}}/>I verified the actual payment or refund. A screenshot alone does not confirm funds.</label>}
        {review.requires_goods_verification && <label className="ai-action-consent"><input type="checkbox" aria-label="Confirmed goods returned" checked={verifiedGoods} disabled={busy} onChange={event=>{setVerifiedGoods(event.target.checked);setChecked(false);}}/>I confirmed the goods have physically returned.</label>}
        <label className="ai-action-consent"><input type="checkbox" checked={checked} disabled={busy || !!dirty || review.preview.has_more || (review.requires_pin&&!adminPin) || (review.requires_payment_verification&&!verifiedPayment) || (review.requires_goods_verification&&!verifiedGoods)} onChange={event => setChecked(event.target.checked)}/>I reviewed all {review.preview.total} changes and want to save them.</label>
        <div className="ai-action-buttons"><button type="button" disabled={busy} onClick={() => decide('cancel')}>Cancel proposal</button><button type="button" className="primary" disabled={busy || !!dirty || !checked || review.preview.has_more || (review.requires_pin&&!adminPin) || (review.requires_payment_verification&&!verifiedPayment) || (review.requires_goods_verification&&!verifiedGoods)} onClick={() => decide('confirm')}>{busy ? 'Processing…' : 'Confirm changes'}</button></div>
      </>}
      {review.status === 'completed' && <p role="status">{review.result?.purchase_draft_id ? 'Purchase draft saved. Stock and payments are unchanged.' : 'Changes saved.'}{review.result?.record_id ? ` Record #${review.result.record_id}.` : ''}{review.result?.import ? ` Imported ${review.result.import.imported} products.` : ''}</p>}
      {['cancelled', 'expired'].includes(review.status) && <p role="status">Proposal {review.status}. Ask the assistant for a new proposal if needed.</p>}
      {review.status === 'completed' && review.result?.purchase_draft_id && onOpenPurchaseDraft && <button type="button" disabled={busy || disabled} onClick={()=>onOpenPurchaseDraft(review.result.purchase_draft_id)}>Open purchase draft</button>}
      {error && <button type="button" disabled={busy} onClick={refresh}>Check action status</button>}
    </article>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
