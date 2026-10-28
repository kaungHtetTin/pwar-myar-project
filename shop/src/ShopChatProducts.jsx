import { canRestoreFocus, focusPanel } from './keyboardFocus';
import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useEffect, useRef, useState } from 'react';
import { Package, X } from 'lucide-react';

const price = product => `${Number(product.price).toLocaleString()} ${product.currency}`;

export function ChatProductCard({ product, href, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <a className="shop-chat-product-card" href={href} {...(href.startsWith('#') ? { onClick: onOpen } : { target: '_blank', rel: 'noreferrer' })} aria-label={`View product ${product.name}`}>
    {product.photo_url && !imageFailed ? <img src={product.photo_url} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <span className="shop-chat-product-photo"><Package size={24} /></span>}
    <span className="shop-chat-product-copy"><strong>{product.name}</strong><span>{price(product)} / {product.unit_name}</span><small>Price when shared · View product</small><span className="conversation-view-product">View Product</span></span>
  </a>;
}

export function ChatProductPreview({ product, disabled, onRemove }) {
  return <div className="shop-chat-product-preview"><Package size={18} /><span><strong>{product.name}</strong><small>{price(product)} / {product.unit_name}</small></span><button className="mkpos-dismiss-icon" type="button" aria-label="Remove product" disabled={disabled} onClick={onRemove}><X size={16} /></button></div>;
}

export function ChatProductPicker({ apiRequest, path, onSelect, onClose, disabled }) {
  const panel = useRef(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    focusPanel(panel.current, 'input');
    return () => { if (previousFocus?.isConnected && canRestoreFocus(previousFocus)) previousFocus.focus({ preventScroll: true }); };
  }, []);
  function handleKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
    if (event.key !== 'Tab') return;
    const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [cursor, setCursor] = useState(0), [retry, setRetry] = useState(0);
  const [state, setState] = useState({ items: [], next: null, loading: true, error: '' });
  useEffect(() => {
    if (query.trim() === search) return undefined;
    const timer = setTimeout(() => { setSearch(query.trim()); setCursor(0); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    let active = true;
    setState(value => ({ ...value, ...(cursor ? {} : { items: [] }), loading: true, error: '' }));
    apiRequest(`${path}?q=${encodeURIComponent(search)}&after_id=${cursor}`).then(result => {
      if (active) setState(value => ({ items: [...new Map([...(cursor ? value.items : []), ...result.items].map(item => [item.id, item])).values()], next: result.next_cursor, loading: false, error: '' }));
    }).catch(error => { if (active) setState(value => ({ ...value, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [apiRequest, path, search, cursor, retry]);
  return <div className="shop-chat-product-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className="shop-chat-product-picker" role="dialog" aria-modal="true" aria-label="Choose product" onKeyDown={handleKeyDown}>
    <header><strong>Share a product</strong><button className="mkpos-dismiss-icon" type="button" aria-label="Close product picker" onClick={onClose}><X size={16} /></button></header>
    <input type="search" aria-label="Search chat products" placeholder="Search published products" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} />
    <div className="shop-chat-product-options">
      {state.items.map(product => <button type="button" className="shop-chat-product-option" key={product.id} disabled={disabled || query.trim() !== search} onClick={() => onSelect(product)}><Package size={18} /><span><strong>{product.name}</strong><small>{price(product)} / {product.unit_name}</small></span></button>)}
      {state.loading ? <LoadingSkeleton variant="shop-products" count={2} message="Loading products…" /> : state.error ? <p role="alert">{state.error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry products</button></p> : !state.items.length ? <p>No published products found.</p> : null}
      {state.next && !state.loading && !state.error && <button type="button" disabled={query.trim() !== search} onClick={() => setCursor(state.next)}>More products</button>}
    </div>
  </section></div>;
}
