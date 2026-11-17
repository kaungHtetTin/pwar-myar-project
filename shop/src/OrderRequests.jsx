import React, { useEffect, useRef, useState } from 'react';
import { Undo2, X, MessageCircle } from 'lucide-react';
import { request } from './api';
import { useText } from './i18n';
import { FeatureError } from './CustomerFeatures';
import { StatusBadge } from './ShoppingComponents';

export function OrderRequests({ order, credentials, onChange }) {
  const photoInput = useRef(null); const text = useText(); const [type, setType] = useState(''), [reason, setReason] = useState(''), [file, setFile] = useState(null), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const rows = order.customer_requests || [];
  const cancellation = !['completed', 'cancelled', 'expired', 'return_pending'].includes(order.status) && !rows.some(r => r.type === 'cancellation');
  const returns = order.status === 'completed' && order.payment_status === 'paid' && !order.sale_voided && !rows.some(r => r.type === 'return');
  function choose(file) { setError(''); if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError(text('Upload a JPG, PNG or WebP image no larger than 2 MB.')); return; } setFile(file || null); }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    const body = new FormData(); Object.entries({ ...credentials, type, reason }).forEach(([key, value]) => body.append(key, value)); if (file && type === 'return') body.append('photo', file);
    try { onChange(await request('/order-requests', { method: 'POST', body })); setType(''); setReason(''); setFile(null); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="order-requests"><div className="feature-actions">{cancellation && <button type="button" disabled={busy} onClick={() => { setType('cancellation'); setError(''); }}>{text('Request cancellation')}</button>}{returns && <button type="button" disabled={busy} onClick={() => { setType('return'); setError(''); }}><Undo2 size={16} />{text('Request return/refund')}</button>}{order.store_slug && <a className="button" href={`#/chats?shop=${encodeURIComponent(order.store_slug)}`}><MessageCircle size={16} />{text('Chat with shop')}</a>}</div>
    {type && <form className="feature-panel request-editor" onSubmit={submit}><div className="feature-panel-heading"><h3>{text(type === 'return' ? 'Request return/refund' : 'Request cancellation')}</h3><button type="button" className="icon-action" disabled={busy} aria-label={text('Close request')} onClick={() => setType('')}><X size={17} /></button></div><p>{text(type === 'return' ? 'The shop will review your request. Approval does not confirm a refund. Full-order returns follow the existing refund process.' : 'Pending unpaid orders can be cancelled immediately. Other orders require shop review.')}</p><fieldset disabled={busy}><label>{text('Reason')}<textarea required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>{type === 'return' && <label>{text('Photo (optional, up to 2 MB)')}<input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => choose(e.target.files?.[0])} /></label>}{file && <div className="request-photo"><img src={preview} alt={text('Return photo preview')} /><span>{file.name}</span><button type="button" onClick={() => { setFile(null); if (photoInput.current) photoInput.current.value = ''; }}>{text('Remove photo')}</button></div>}<FeatureError message={error} /><div className="feature-actions"><button className="primary">{text(busy ? 'Please wait…' : 'Submit request')}</button><button type="button" onClick={() => setType('')}>{text('Cancel')}</button></div></fieldset></form>}
    <div className="feature-list">{rows.map(row => <article className="feature-panel request-card" key={row.id}><div className="feature-panel-heading"><strong>{text(row.type === 'change' ? 'Order change request' : row.type === 'return' ? 'Return/refund request' : 'Cancellation request')}</strong><StatusBadge value={row.status} /></div><p>{row.reason}</p>{row.requested_changes && <dl>{Object.entries(row.requested_changes).filter(([key]) => key !== 'items').map(([key, value]) => <React.Fragment key={key}><dt>{text(key)}</dt><dd>{value}</dd></React.Fragment>)}</dl>}{row.requested_changes?.items && <ul>{row.requested_changes.items.map(item => <li key={item.product_id}>{order.items?.find(p => Number(p.product_id) === Number(item.product_id))?.name || `#${item.product_id}`}: {item.quantity}</li>)}</ul>}{row.staff_note && <div className="request-reply"><small>{text('Shop response')}</small><p>{row.staff_note}</p></div>}<small>{new Date(`${row.created_at.replace(' ', 'T')}Z`).toLocaleString()}</small></article>)}</div>
  </section>;
}
