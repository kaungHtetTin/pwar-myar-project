import React, { useEffect, useId, useRef, useState } from 'react';
import { RotateCcw, ShoppingBag, X } from 'lucide-react';
import { post } from './api';
import { useText } from './i18n';
import { ProductMedia } from './ShoppingComponents';
import { useShopPageActive } from './RetainedViews';
import './buy-again.css';

const amount = (value, currency) => `${['Ks', 'MMK', 'K'].includes(currency) ? 'K' : currency || ''} ${Number(value || 0).toLocaleString()}`.trim();
export function BuyAgain({ reference, onCart }) {
  const text = useText(), active = useShopPageActive(), titleId = useId();
  const dialog = useRef(null);
  const launcher = useRef(null);
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!preview || !active) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close(); document.body.style.overflow = previousOverflow;
      if (launcher.current?.isConnected && !launcher.current.closest('[hidden]')) launcher.current.focus({ preventScroll: true });
    };
  }, [preview, active]);
  async function load() {
    if (busy) return;
    setBusy(true); setError('');
    try { setPreview(await post(`/customer/orders/${encodeURIComponent(reference)}/buy-again`, {})); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const close = () => setPreview(null);
  return <div className="buy-again">
    <button ref={launcher} type="button" disabled={busy} onClick={load}><RotateCcw size={16} />{text(busy ? 'Checking…' : 'Buy again')}</button>
    {error && <p className="notice error" role="alert">{error}</p>}
    {preview && <dialog ref={dialog} className="buy-again-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
      <header className="buy-again-dialog-header"><div><h2 id={titleId}>{text('Review your repeat order')}</h2><p>{text('Current prices and available quantities apply.')}</p></div><button type="button" className="buy-again-close" aria-label={text('Close repeat order')} onClick={close}><X size={20} /></button></header>
      <div className="buy-again-dialog-content">
        {preview.name && <p className="buy-again-shop"><ShoppingBag size={16} aria-hidden="true" />{preview.name}</p>}
        <div className="buy-again-items">{preview.items.map(p => <article className="buy-again-item" key={p.id}><ProductMedia src={p.photo_url} /><div className="buy-again-item-info"><strong>{p.name}</strong><span>{p.quantity} {p.unit_name}</span><small>{amount(p.price, p.currency)} {text('each')}</small>{p.quantity !== p.previous_quantity && <small className="buy-again-adjusted">{text('Quantity adjusted to available stock')}</small>}</div><strong className="buy-again-line-total">{amount(Number(p.price) * Number(p.quantity), p.currency)}</strong></article>)}</div>
        {preview.skipped.length > 0 && <p className="notice buy-again-warning">{text('Unavailable or changed-unit items were skipped.')}: {preview.skipped.join(', ')}</p>}
        {!preview.items.length && <p className="buy-again-empty">{text('No items from this order are available to buy again.')}</p>}
      </div>
      <footer className="buy-again-dialog-actions"><button type="button" className="primary" disabled={!preview.items.length} onClick={() => { if (onCart(preview)) close(); }}><ShoppingBag size={18} aria-hidden="true" />{text('Use these items in my cart')}</button></footer>
    </dialog>}
  </div>;
}
