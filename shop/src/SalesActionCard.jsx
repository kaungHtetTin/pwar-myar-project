import React, { useEffect, useRef, useState } from 'react';
import { requestChatImage } from './api';
import { useText } from './i18n';
import './sales-actions.css';
import { SalesTable } from './SalesTable';

const titles = { cart: 'Chat cart', checkout: 'Checkout', proof: 'Order payment proof', change: 'Order change request', cancellation: 'Cancellation request', return: 'Return request' };
const confirmLabels = { cart: 'Apply cart', checkout: 'Confirm order', proof: 'Submit payment proof', change: 'Submit change request', cancellation: 'Submit cancellation request', return: 'Submit return request' };
const format = (value, currency = '') => `${Number(value || 0).toLocaleString()}${currency ? ` ${currency}` : ''}`;

function ReviewImage({ path, file }) {
  const t = useText();
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let live = true, objectUrl;
    setUrl(''); setError('');
    if (file) { objectUrl = URL.createObjectURL(file); setUrl(objectUrl); }
    else if (path) requestChatImage(path).then(({ blob }) => { if (live) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(() => { if (live) setError('Unable to load review image. Choose the image again.'); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, file]);
  return error ? <p role="alert">{t(error)}</p> : url ? <a href={url} target="_blank" rel="noreferrer"><img className="sales-action-image" src={url} alt={t('Payment or request image for review')} /></a> : path || file ? <p role="status">{t('Loading image…')}</p> : null;
}

export function SalesActionCard({ action, uuid, basePath = '/chat', apiRequest, selfSender = 'customer', cache, onBusyChange, onActionResult }) {
  const t = useText();
  const saved = cache?.get(action.id);
  const [opened, setOpened] = useState(saved?.opened || false), [view, setView] = useState(saved?.view || null);
  const [values, setValues] = useState(saved?.values || {}), [dirty, setDirty] = useState(saved?.dirty || false), [checked, setChecked] = useState(false);
  const [file, setFile] = useState(saved?.file || null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const working = useRef(false), alive = useRef(true), trigger = useRef(null);
  const root = `${basePath}/${encodeURIComponent(uuid)}/sales-actions/${encodeURIComponent(action.id)}`;
  useEffect(() => { if (cache) cache.set(action.id, { opened, view, values, dirty, file }); }, [cache, action.id, opened, view, values, dirty, file]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusyChange?.(false); }; }, [onBusyChange]);
  const run = async task => {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); onBusyChange?.(true);
    try { await task(); } catch (e) { if (alive.current) { setError(e.message); setChecked(false); if ([409, 422].includes(e.status)) onActionResult?.(); } }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false); } }
  };
  const hydrate = next => {
    const fields = Object.fromEntries(Object.entries(next.values || {}).map(([key, value]) => [key, value ?? '']));
    setView(next); setValues({ customer_name: '', phone: '', email: '', address: '', notes: '', fulfillment: '', payment_method_id: '', delivery_zone_id: '', coupon_code: '', ...fields, items: (next.values?.items || next.preview?.items || []).map(item => ({ product_id: Number(item.product_id), quantity: item.quantity })) });
    setDirty(false); setChecked(false); setFile(null);
  };
  const load = () => run(async () => { const next = await apiRequest(root); if (alive.current) hydrate(next); });
  const open = event => { trigger.current = event.currentTarget; setOpened(true); if (!view) void load(); };
  const close = () => { if (working.current) return; setOpened(false); setChecked(false); trigger.current?.focus(); };
  const change = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setDirty(true); setChecked(false); };
  const review = event => {
    event.preventDefault();
    void run(async () => {
      let body;
      const edits = view.kind === 'checkout' ? Object.fromEntries(Object.entries(values).filter(([key]) => ['items', 'coupon_code', 'fulfillment', 'payment_method_id', 'delivery_zone_id', 'customer_name', 'phone', 'email', 'address', 'notes'].includes(key)))
        : view.kind === 'cart' ? { items: values.items } : view.kind === 'proof' ? {} : { reason: values.reason, ...(view.kind === 'change' ? { changes: values.changes } : {}) };
      if (file) { body = new FormData(); body.append('revision', view.revision); body.append('preview_hash', view.preview_hash); body.append('values', JSON.stringify(edits)); body.append('image', file); }
      else body = JSON.stringify({ revision: view.revision, preview_hash: view.preview_hash, values: edits });
      const next = await apiRequest(`${root}/review`, { method: 'POST', body });
      if (alive.current) { hydrate(next); onActionResult?.(); }
    });
  };
  const decide = choice => void run(async () => {
    const next = await apiRequest(`${root}/${choice}`, { method: 'POST', body: JSON.stringify(choice === 'confirm' ? { revision: view.revision, preview_hash: view.preview_hash, confirmed: true } : {}) });
    if (alive.current) { setView(next); setChecked(false); setDirty(false); setFile(null); onActionResult?.(); }
  });
  const status = action.status && action.status !== 'pending' ? action.status : view?.status || action.status;
  const pending = status === 'pending';
  const title = titles[action.kind] || 'Customer request';
  if (selfSender !== 'customer') return <section className="sales-action-card"><strong>{t(title)}</strong><p>{t('Customer confirmation required')} · {t(status)}</p></section>;
  const items = view?.preview?.items || [];
  const editableItems = ['cart', 'checkout'].includes(view?.kind);
  const displayedItems = editableItems ? values.items || [] : view?.preview?.requested_items || items;
  const selectedPayment = view?.options?.payment_methods?.find(method => method.id === values.payment_method_id) || view?.preview?.payment_method;
  const checkoutProof = view?.kind === 'checkout' && (selectedPayment?.type === 'transfer' || (!selectedPayment?.type && view?.preview?.payment_proof_required));
  const showImage = ['proof', 'return'].includes(view?.kind) || checkoutProof;
  const imagePath = view?.has_image ? `${root}/image?revision=${view.revision}` : view?.preview?.image_message_id ? `${basePath}/${uuid}/messages/${view.preview.image_message_id}/image` : null;
  return <section className="sales-action-card" aria-label={t(title)}>
    <div className="sales-action-heading"><strong>{t(title)}</strong><small>{t(status || 'pending')}</small><button ref={trigger} type="button" disabled={busy} onClick={opened ? close : open}>{t(opened ? 'Close review' : 'Review')}</button></div>
    {opened && <div className="sales-action-review" aria-busy={busy}>
      {!view ? <p role="status">{t('Loading review…')}</p> : <>
        {view.preview.reference && <p><strong>{view.preview.reference}</strong></p>}
        {view.preview.notice && <p>{t(view.preview.notice)}</p>}
        <form onSubmit={review}>
          <fieldset disabled={busy || !pending}>
            {displayedItems.length > 0 && <SalesTable label={t('Review products')} editable={editableItems}><table aria-label={t('Review products')}><thead><tr><th scope="col">{t('Product')}</th><th scope="col">{t('Quantity')}</th><th scope="col">{t('Price')}</th>{editableItems && <th scope="col">{t('Actions')}</th>}</tr></thead><tbody>{displayedItems.map((item, index) => {
              const product = items.find(p => Number(p.product_id) === Number(item.product_id)) || item;
              return <tr key={item.product_id}><td>{product.name || `#${item.product_id}`}<small>{product.unit_name}</small></td><td>{editableItems && pending ? <input aria-label={`${t('Quantity')} ${product.name || item.product_id}`} type="number" required min="0.001" max="100000" step="0.001" value={item.quantity} onChange={e => change('items', values.items.map((p, i) => i === index ? { ...p, quantity: e.target.value } : p))} /> : item.quantity}</td><td>{format(product.unit_price, view.preview.currency)}</td>{editableItems && <td><button type="button" aria-label={`${t('Remove')} ${product.name || item.product_id}`} onClick={() => change('items', values.items.filter((_, i) => i !== index))}>{t('Remove')}</button></td>}</tr>;
            })}</tbody></table></SalesTable>}
            {view.kind === 'cart' && !displayedItems.length && <p>{t('This will clear the chat cart.')}</p>}
            {view.kind === 'checkout' && <div className="sales-action-fields">
              <label>{t('Customer name')}<input aria-label={t('Customer name')} required maxLength={255} value={values.customer_name} onChange={e => change('customer_name', e.target.value)} autoComplete="name" /></label>
              <label>{t('Phone')}<input aria-label={t('Phone')} type="tel" required maxLength={80} value={values.phone} onChange={e => change('phone', e.target.value)} autoComplete="tel" /></label>
              <label>{t('Email (optional)')}<input aria-label={t('Email (optional)')} type="email" maxLength={255} value={values.email} onChange={e => change('email', e.target.value)} autoComplete="email" /></label>
              <label>{t('Fulfillment')}<select aria-label={t('Fulfillment')} required value={values.fulfillment} onChange={e => { change('fulfillment', e.target.value); change('delivery_zone_id', ''); }}><option value="">{t('Choose fulfillment')}</option><option value="pickup">{t('Pickup')}</option><option value="delivery">{t('Delivery')}</option></select></label>
              {values.fulfillment === 'delivery' && <><label>{t('Delivery zone')}<select aria-label={t('Delivery zone')} required value={values.delivery_zone_id} onChange={e => change('delivery_zone_id', e.target.value)}><option value="">{t('Choose delivery zone')}</option>{!view.options?.delivery_zones && values.delivery_zone_id && <option value={values.delivery_zone_id}>{view.preview.fulfillment_instructions || values.delivery_zone_id}</option>}{view.options?.delivery_zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name} · {format(zone.fee, view.preview.currency)}</option>)}<option value="__delivery_service__">{t('Pay delivery service directly (fee separate)')}</option></select></label><label className="is-wide">{t('Address')}<textarea aria-label={t('Address')} required maxLength={2000} value={values.address} onChange={e => change('address', e.target.value)} autoComplete="street-address" /></label></>}
              <label>{t('Payment method')}<select aria-label={t('Payment method')} required value={values.payment_method_id} onChange={e => change('payment_method_id', e.target.value)}><option value="">{t('Choose payment method')}</option>{!view.options?.payment_methods && values.payment_method_id && <option value={values.payment_method_id}>{view.preview.payment_method?.name || values.payment_method_id}</option>}{view.options?.payment_methods.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
              <label>{t('Coupon (optional)')}<input aria-label={t('Coupon (optional)')} maxLength={40} value={values.coupon_code} onChange={e => change('coupon_code', e.target.value)} /></label>
              <label className="is-wide">{t('Order note (optional)')}<textarea aria-label={t('Order note (optional)')} maxLength={2000} value={values.notes} onChange={e => change('notes', e.target.value)} /></label>
            </div>}
            {['change', 'cancellation', 'return'].includes(view.kind) && <label>{t('Reason')}<textarea aria-label={t('Reason')} required minLength={5} maxLength={2000} value={values.reason || ''} onChange={e => change('reason', e.target.value)} /></label>}
            {view.kind === 'change' && <dl>{Object.entries(values.changes || {}).filter(([key]) => key !== 'items').map(([key, value]) => <React.Fragment key={key}><dt>{t(key)}</dt><dd>{value}</dd></React.Fragment>)}</dl>}
            {showImage && <label>{t(view.kind === 'return' ? 'Photo evidence (optional)' : 'Payment screenshot')}<input aria-label={t('Review image file')} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const selected = e.target.files?.[0] || null; if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 2 * 1024 * 1024)) { setError(t('Choose a JPG, PNG or WebP image up to 2 MB.')); return; } setFile(selected); setDirty(true); setChecked(false); }} /></label>}
            {checkoutProof && <p>{t('A payment screenshot is required before confirming this order. Payment remains subject to shop verification.')}</p>}
            {pending && <button type="submit" disabled={busy}>{t(view.kind === 'checkout' ? 'Calculate and review quote' : view.kind === 'proof' ? 'Review image' : 'Refresh review')}</button>}
          </fieldset>
        </form>
        {showImage && pending && <ReviewImage path={imagePath} file={file} />}
        <dl className="sales-action-totals">{[['subtotal', 'Subtotal'], ['discount', 'Discount'], ['delivery_fee', 'Delivery fee'], ['total', 'Total']].filter(([key]) => view.preview[key] !== undefined).map(([key, label]) => <React.Fragment key={key}><dt>{t(label)}</dt><dd>{format(view.preview[key], view.preview.currency)}</dd></React.Fragment>)}</dl>
        {view.preview.fulfillment_instructions && <p>{view.preview.fulfillment_instructions}</p>}
        {view.preview.payment_method && <p className="sales-action-receiving">{['name', 'bank', 'account_name', 'account_no', 'instructions'].map(key => view.preview.payment_method[key]).filter(Boolean).join(' · ')}</p>}
        {view.preview.skipped?.length > 0 && <p>{t('Unavailable items skipped')}: {view.preview.skipped.join(', ')}</p>}
        {view.preview.adjustments?.filter(p => Number(p.quantity) !== Number(p.previous_quantity)).map(p => <p key={p.id}>{p.name}: {p.previous_quantity} → {p.quantity} {p.unit_name}</p>)}
        {pending && <>
          <small>{t('Review expires')}: {new Date(view.expires_at).toLocaleString()}</small>
          {dirty && <p role="status">{t('Values changed. Refresh the review before confirming.')}</p>}
          <label className="sales-action-consent"><input type="checkbox" checked={checked} disabled={busy || dirty || !view.preview.ready} onChange={e => setChecked(e.target.checked)} />{t('I reviewed the products, image, amounts and details and want to continue.')}</label>
          <div className="sales-action-buttons"><button type="button" disabled={busy} onClick={() => decide('cancel')}>{t('Cancel proposal')}</button><button type="button" className="primary" disabled={busy || dirty || !checked || !view.preview.ready} onClick={() => decide('confirm')}>{t(busy ? 'Processing…' : confirmLabels[view.kind])}</button></div>
        </>}
        {status === 'completed' && <p role="status">{t(view.result?.order_created ? (view.result?.payment_status === 'proof_submitted' ? 'Order and payment proof submitted. Awaiting shop verification.' : 'Order submitted. Payment is not verified.') : view.result?.cart_saved ? 'Chat cart saved. No stock is reserved.' : view.result?.payment_status === 'proof_submitted' ? 'Payment proof submitted. Awaiting shop verification.' : 'Request submitted. Check the shop response in your order.')}</p>}
        {['cancelled', 'expired'].includes(status) && <p role="status">{t(`Proposal ${status}. Ask for a new proposal if needed.`)}</p>}
        {view.result?.reference && <a className="sales-action-order-link" href={`#/orders/track?reference=${encodeURIComponent(view.result.reference)}`}>{t('View order')} · {view.result.reference}</a>}
        <button type="button" disabled={busy} onClick={() => void load()}>{t('Check action status')}</button>
      </>}
      {error && <p role="alert">{t(error)} <button type="button" disabled={busy} onClick={() => void load()}>{t('Retry status')}</button></p>}
    </div>}
  </section>;
}
